"""Sorcerer: authenticated, single-worker LAN batch queue for Magic workflows."""
from __future__ import annotations

import argparse
import hashlib
import ipaddress
import json
import os
import secrets
import shutil
import signal
import sqlite3
import subprocess
import sys
import threading
import time
import uuid
import zipfile
from contextlib import closing
from datetime import datetime, timezone
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path, PurePosixPath, PureWindowsPath

sys.path.insert(0, str(Path(__file__).resolve().parent))
from job_types import JOB_TYPES

MAX_ARCHIVE_BYTES = 5 * 1024 * 1024 * 1024
MAX_EXTRACTED_BYTES = 10 * 1024 * 1024 * 1024
MAX_ARCHIVE_ENTRIES = 100_000
# This is copied into a new data directory's config.json.  The external config
# is the operational source of truth so an operator can change it without a build.
DEFAULT_RETENTION_DAYS = {
    "input_archives": 30,
    "result_archives": 90,
    "queue_history": 90,
    "failed_job_diagnostics": 90,
}


def utcnow() -> str:
    return datetime.now(timezone.utc).isoformat()


class Queue:
    def __init__(self, data_dir: Path):
        self.data_dir = data_dir
        self.db_path = data_dir / "queue.sqlite3"
        self.lock = threading.Lock()
        self.active: dict[str, subprocess.Popen] = {}
        self._init_db()

    def connect(self):
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        return conn

    def _init_db(self):
        with closing(self.connect()) as db, db:
            db.execute("""CREATE TABLE IF NOT EXISTS jobs (
              id TEXT PRIMARY KEY, client TEXT NOT NULL, type TEXT NOT NULL,
              priority INTEGER NOT NULL, status TEXT NOT NULL, created_at TEXT NOT NULL,
              started_at TEXT, finished_at TEXT, metadata TEXT NOT NULL, message TEXT,
              progress TEXT, input_zip TEXT NOT NULL, result_zip TEXT)""")
            db.execute("UPDATE jobs SET status='queued', message='Recovered after server restart' WHERE status='running'")

    def create(self, client, job_type, priority, metadata, input_zip):
        job_id = uuid.uuid4().hex
        with closing(self.connect()) as db, db:
            db.execute("INSERT INTO jobs VALUES (?, ?, ?, ?, 'queued', ?, NULL, NULL, ?, 'Queued', '{}', ?, NULL)",
                       (job_id, client, job_type, priority, utcnow(), json.dumps(metadata), str(input_zip)))
        return self.get(job_id)

    def get(self, job_id, client=None):
        with closing(self.connect()) as db, db:
            row = db.execute("SELECT * FROM jobs WHERE id=?", (job_id,)).fetchone()
        if not row or (client is not None and row["client"] != client):
            return None
        return dict(row)

    def list(self, client=None):
        query, params = "SELECT * FROM jobs", []
        if client:
            query += " WHERE client=?"; params.append(client)
        query += " ORDER BY CASE status WHEN 'running' THEN 0 WHEN 'queued' THEN 1 ELSE 2 END, priority DESC, created_at"
        with closing(self.connect()) as db, db:
            return [dict(row) for row in db.execute(query, params)]

    def next(self):
        with closing(self.connect()) as db, db:
            row = db.execute("SELECT * FROM jobs WHERE status='queued' ORDER BY priority DESC, created_at LIMIT 1").fetchone()
            if not row: return None
            db.execute("UPDATE jobs SET status='running', started_at=?, message='Starting' WHERE id=?", (utcnow(), row["id"]))
        return self.get(row["id"])

    def update(self, job_id, **fields):
        if not fields: return
        fields["id"] = job_id
        assignments = ", ".join(f"{key}=:{key}" for key in fields if key != "id")
        with closing(self.connect()) as db, db: db.execute(f"UPDATE jobs SET {assignments} WHERE id=:id", fields)

    def cancel(self, job_id, client):
        job = self.get(job_id, client)
        if not job or job["status"] not in {"queued", "running"}: return None
        proc = self.active.get(job_id)
        if proc and proc.poll() is None: proc.terminate()
        self.update(job_id, status="cancelled", finished_at=utcnow(), message="Cancelled by client")
        return self.get(job_id, client)

    def requeue(self, job_id, client):
        job = self.get(job_id, client)
        if not job or job["status"] not in {"failed", "cancelled", "completed"}: return None
        self.update(job_id, status="queued", started_at=None, finished_at=None, message="Requeued", progress="{}", result_zip=None)
        return self.get(job_id, client)


class Worker(threading.Thread):
    def __init__(self, queue: Queue, config: dict):
        super().__init__(daemon=True); self.queue = queue; self.config = config; self.stop_event = threading.Event()

    def run(self):
        while not self.stop_event.wait(0.5):
            job = self.queue.next()
            if job: self.execute(job)

    def execute(self, job):
        job_dir = self.queue.data_dir / "jobs" / job["id"]
        source, output = job_dir / "input", job_dir / "output"
        source.mkdir(parents=True, exist_ok=True); output.mkdir(exist_ok=True)
        try:
            safe_extract(
                Path(job["input_zip"]),
                source,
                self.config.get("max_extracted_bytes", MAX_EXTRACTED_BYTES),
                self.config.get("max_archive_entries", MAX_ARCHIVE_ENTRIES),
            )
            if self.queue.get(job["id"])["status"] == "cancelled":
                return
            spec = JOB_TYPES[job["type"]]
            scripts_dir = Path(self.config["magic_scripts_dir"])
            launcher = Path(__file__).resolve().parent / "workflow_runner.py"
            command = [self.config["python"], str(launcher), str(scripts_dir), str(scripts_dir / spec.script_file), *spec.args(str(source), str(output), json.loads(job["metadata"]))]
            proc = subprocess.Popen(command, cwd=scripts_dir, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, encoding="utf-8", errors="replace")
            self.queue.active[job["id"]] = proc
            for line in proc.stdout:
                message = line.strip()
                if not message: continue
                try: progress = json.loads(message)
                except json.JSONDecodeError: progress = {"type": "log", "message": message}
                self.queue.update(job["id"], progress=json.dumps(progress), message=progress.get("message", message)[:500])
                if progress.get("confirm"):
                    proc.stdin.write("continue\n")
                    proc.stdin.flush()
            code = proc.wait()
            latest = self.queue.get(job["id"])
            if latest["status"] == "cancelled": return
            if code:
                self.queue.update(job["id"], status="failed", finished_at=utcnow(), message=f"Workflow exited with code {code}")
                return
            result = job_dir / "result.zip"
            with zipfile.ZipFile(result, "w", zipfile.ZIP_DEFLATED) as archive:
                for file in output.rglob("*"):
                    if file.is_file(): archive.write(file, file.relative_to(output))
            self.queue.update(job["id"], status="completed", finished_at=utcnow(), message=publish_result(result, job, self.config), result_zip=str(result))
        except Exception as error:
            self.queue.update(job["id"], status="failed", finished_at=utcnow(), message=str(error)[:500])
        finally:
            if "proc" in locals():
                if proc.stdout: proc.stdout.close()
                if proc.stdin: proc.stdin.close()
            self.queue.active.pop(job["id"], None)


def validate_archive(archive_path: Path, max_extracted_bytes: int, max_entries: int):
    with zipfile.ZipFile(archive_path) as archive:
        entries = archive.infolist()
        if len(entries) > max_entries:
            raise ValueError(f"Archive contains more than {max_entries} entries")
        extracted_bytes = 0
        for item in entries:
            if item.flag_bits & 0x1:
                raise ValueError("Encrypted archives are not supported")
            posix_path = PurePosixPath(item.filename)
            windows_path = PureWindowsPath(item.filename)
            if posix_path.is_absolute() or windows_path.is_absolute() or ".." in posix_path.parts or ".." in windows_path.parts:
                raise ValueError("Archive contains an unsafe file path")
            extracted_bytes += item.file_size
            if extracted_bytes > max_extracted_bytes:
                raise ValueError(f"Archive expands beyond the {max_extracted_bytes} byte limit")


def safe_extract(archive_path: Path, destination: Path, max_extracted_bytes: int, max_entries: int):
    validate_archive(archive_path, max_extracted_bytes, max_entries)
    with zipfile.ZipFile(archive_path) as archive:
        for item in archive.infolist():
            target = (destination / item.filename).resolve()
            if not target.is_relative_to(destination.resolve()): raise ValueError("Archive contains an unsafe file path")
        archive.extractall(destination)


def publish_result(result: Path, job: dict, config: dict) -> str:
    """Best-effort publish that never blocks a client's direct download."""
    share_dir = config.get("result_share_dir")
    if not share_dir:
        return "Completed"
    destination_dir = Path(share_dir)
    if not destination_dir.is_dir():
        return "Completed; UBox publishing deferred because the shared folder is unavailable"
    destination = destination_dir / f"sorcerer-{job['type']}-{job['id']}.zip"
    temporary = destination_dir / f".{destination.name}.{uuid.uuid4().hex}.partial"
    try:
        shutil.copy2(result, temporary)
        os.replace(temporary, destination)
    except OSError:
        temporary.unlink(missing_ok=True)
        return "Completed; UBox publishing deferred because the shared folder could not be written"
    return "Completed; published to UBox"


def public_job(job):
    keys = ("id", "type", "priority", "status", "created_at", "started_at", "finished_at", "message", "progress")
    result = {key: job.get(key) for key in keys}
    result["progress"] = json.loads(result["progress"] or "{}")
    return result


def operator_dashboard_html() -> str:
    return """<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Sorcerer operator dashboard</title><style>
body{margin:0;background:#f5f3ef;color:#201f1d;font:15px system-ui,sans-serif}main{max-width:1100px;margin:auto;padding:32px}
h1{margin:0}.intro{color:#625d57}.cards{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin:24px 0}.card,table{background:#fff;border:1px solid #ddd7cf;border-radius:10px}.card{padding:18px}.card b{display:block;font-size:28px}.card span{color:#625d57}
table{width:100%;border-collapse:separate;border-spacing:0;overflow:hidden}th,td{padding:12px;text-align:left;border-bottom:1px solid #eee9e2}th{background:#f8f6f2;font-size:12px;text-transform:uppercase;letter-spacing:.05em}tr:last-child td{border:0}.status{font-weight:700;text-transform:capitalize}.completed{color:#28623b}.failed,.cancelled{color:#9b1c1c}.queued{color:#8a5b00}.running{color:#155b91}.empty{color:#625d57;padding:20px}.stamp{color:#625d57;font-size:13px}
@media(max-width:700px){main{padding:20px}.cards{grid-template-columns:repeat(2,1fr)}table{font-size:13px}th:nth-child(3),td:nth-child(3){display:none}}</style></head>
<body><main><h1>Sorcerer operator dashboard</h1><p class="intro">Local-only server view. Refreshes every five seconds.</p><section class="cards" id="counts"></section><p class="stamp" id="stamp">Loading queue…</p><table><thead><tr><th>Job</th><th>Status</th><th>Priority</th><th>Created</th><th>Message</th></tr></thead><tbody id="jobs"></tbody></table></main>
<script>const esc=(v)=>String(v??"");function render(data){const jobs=data.jobs;const counts={queued:0,running:0,completed:0,failed:0,cancelled:0};jobs.forEach(j=>counts[j.status]=(counts[j.status]||0)+1);document.querySelector('#counts').replaceChildren(...['queued','running','completed','failed'].map(s=>{const e=document.createElement('div');e.className='card';e.innerHTML=`<b>${counts[s]||0}</b><span>${s}</span>`;return e}));const body=document.querySelector('#jobs');body.replaceChildren();if(!jobs.length){const row=document.createElement('tr');row.innerHTML='<td class="empty" colspan="5">No jobs yet.</td>';body.append(row)}jobs.forEach(j=>{const row=document.createElement('tr');for(const [value,className] of [[j.type],[j.status,`status ${j.status}`],[`P${j.priority}`],[new Date(j.created_at).toLocaleString()],[j.message]]){const cell=document.createElement('td');cell.textContent=esc(value);if(className)cell.className=className;row.append(cell)}body.append(row)});document.querySelector('#stamp').textContent=`Updated ${new Date().toLocaleTimeString()} · ${jobs.length} total jobs`};async function load(){try{render(await (await fetch('/dashboard/data',{cache:'no-store'})).json())}catch{document.querySelector('#stamp').textContent='Dashboard data is temporarily unavailable.'}}load();setInterval(load,5000);</script></body></html>"""


def token_identity(config, header):
    if not header.startswith("Bearer "): return None
    digest = hashlib.sha256(header[7:].encode()).hexdigest()
    for client in config["clients"]:
        if secrets.compare_digest(client["token_hash"], digest): return client["name"]
    return None


def make_handler(queue, config):
    class Handler(BaseHTTPRequestHandler):
        def log_message(self, *_): pass
        def send_json(self, status, body):
            data = json.dumps(body).encode(); self.send_response(status); self.send_header("Content-Type", "application/json"); self.send_header("Content-Length", str(len(data))); self.end_headers(); self.wfile.write(data)
        def is_local_operator(self):
            try: return ipaddress.ip_address(self.client_address[0]).is_loopback
            except ValueError: return False
        def send_html(self, body):
            data = body.encode("utf-8"); self.send_response(200); self.send_header("Content-Type", "text/html; charset=utf-8"); self.send_header("Content-Length", str(len(data))); self.end_headers(); self.wfile.write(data)
        def client(self): return token_identity(config, self.headers.get("Authorization", ""))
        def require_client(self):
            client = self.client()
            if not client: self.send_json(HTTPStatus.UNAUTHORIZED, {"error": "valid bearer token required"})
            return client
        def do_GET(self):
            path = self.path.split("?")[0]
            if path == "/dashboard":
                if not self.is_local_operator(): return self.send_json(404, {"error": "not found"})
                return self.send_html(operator_dashboard_html())
            if path == "/dashboard/data":
                if not self.is_local_operator(): return self.send_json(404, {"error": "not found"})
                return self.send_json(200, {"jobs": [public_job(job) for job in queue.list()]})
            if self.path == "/v1/health": return self.send_json(200, {"ok": True, "queue": len(queue.list())})
            client = self.require_client()
            if not client: return
            parts = self.path.split("?")[0].split("/")
            if self.path.split("?")[0] == "/v1/jobs": return self.send_json(200, {"jobs": [public_job(job) for job in queue.list(client)]})
            if len(parts) == 5 and parts[4] == "result":
                job = queue.get(parts[3], client)
                if not job or not job["result_zip"]: return self.send_json(404, {"error": "result not available"})
                data = Path(job["result_zip"]).read_bytes(); self.send_response(200); self.send_header("Content-Type", "application/zip"); self.send_header("Content-Disposition", f'attachment; filename="sorcerer-{job["id"]}.zip"'); self.send_header("Content-Length", str(len(data))); self.end_headers(); return self.wfile.write(data)
            if len(parts) == 4:
                job = queue.get(parts[3], client)
                return self.send_json(200, public_job(job)) if job else self.send_json(404, {"error": "job not found"})
            self.send_json(404, {"error": "not found"})
        def do_POST(self):
            client = self.require_client()
            if not client: return
            if self.path == "/v1/jobs":
                job_dir = None
                try:
                    length = int(self.headers.get("Content-Length", "0")); job_type = self.headers["X-Sorcerer-Job-Type"]
                    if not 0 < length <= config.get("max_archive_bytes", MAX_ARCHIVE_BYTES): raise ValueError("invalid archive size")
                    if job_type not in JOB_TYPES: raise ValueError("unknown job type")
                    priority = max(0, min(100, int(self.headers.get("X-Sorcerer-Priority", "50"))))
                    metadata = json.loads(self.headers.get("X-Sorcerer-Metadata", "{}"))
                    job_dir = queue.data_dir / "jobs" / uuid.uuid4().hex; job_dir.mkdir(parents=True)
                    input_zip = job_dir / "input.zip"
                    remaining = length
                    with input_zip.open("wb") as archive:
                        while remaining:
                            chunk = self.rfile.read(min(64 * 1024, remaining))
                            if not chunk: raise ValueError("incomplete archive upload")
                            archive.write(chunk)
                            remaining -= len(chunk)
                    validate_archive(input_zip, config.get("max_extracted_bytes", MAX_EXTRACTED_BYTES), config.get("max_archive_entries", MAX_ARCHIVE_ENTRIES))
                    job = queue.create(client, job_type, priority, metadata, input_zip)
                    return self.send_json(HTTPStatus.CREATED, public_job(job))
                except (KeyError, ValueError, json.JSONDecodeError, zipfile.BadZipFile) as error:
                    if job_dir: shutil.rmtree(job_dir, ignore_errors=True)
                    return self.send_json(400, {"error": str(error)})
            parts = self.path.split("/")
            if len(parts) == 5 and parts[4] in {"cancel", "requeue"}:
                job = getattr(queue, parts[4])(parts[3], client)
                return self.send_json(200, public_job(job)) if job else self.send_json(404, {"error": "job unavailable"})
            self.send_json(404, {"error": "not found"})
    return Handler


def config_path(data_dir): return data_dir / "config.json"

def load_config(data_dir):
    with config_path(data_dir).open(encoding="utf-8") as file: return json.load(file)

def main():
    parser = argparse.ArgumentParser(); parser.add_argument("command", choices=("init", "token", "clients", "revoke", "set-result-share", "serve", "status")); parser.add_argument("--data-dir", type=Path, default=Path("C:/SorcererData")); parser.add_argument("--name", default="magic-client"); parser.add_argument("--host"); parser.add_argument("--port", type=int); parser.add_argument("--share-dir", type=Path); parser.add_argument("--allow-unavailable", action="store_true"); args = parser.parse_args()
    data_dir = args.data_dir.resolve(); data_dir.mkdir(parents=True, exist_ok=True)
    if args.command == "init":
        path = config_path(data_dir)
        if path.exists(): raise SystemExit(f"Refusing to overwrite {path}")
        magic_scripts = Path(__file__).resolve().parents[1] / "magic" / "scripts"
        path.write_text(json.dumps({"host": "0.0.0.0", "port": 8765, "python": sys.executable, "magic_scripts_dir": str(magic_scripts), "clients": [], "max_archive_bytes": MAX_ARCHIVE_BYTES, "max_extracted_bytes": MAX_EXTRACTED_BYTES, "max_archive_entries": MAX_ARCHIVE_ENTRIES, "retention_days": DEFAULT_RETENTION_DAYS}, indent=2), encoding="utf-8")
        return print(f"Created {path}. Add a client token before serving.")
    config = load_config(data_dir)
    if args.command == "token":
        if any(client["name"] == args.name for client in config["clients"]):
            raise SystemExit(f"A token named {args.name!r} already exists. Revoke it before issuing a replacement.")
        token = secrets.token_urlsafe(32); config["clients"].append({"name": args.name, "token_hash": hashlib.sha256(token.encode()).hexdigest()}); config_path(data_dir).write_text(json.dumps(config, indent=2), encoding="utf-8"); return print(f"Token for {args.name} (show once): {token}")
    if args.command == "clients":
        if not config["clients"]: return print("No allowed clients.")
        return print("\n".join(client["name"] for client in config["clients"]))
    if args.command == "revoke":
        remaining = [client for client in config["clients"] if client["name"] != args.name]
        if len(remaining) == len(config["clients"]): raise SystemExit(f"No client named {args.name!r}.")
        config["clients"] = remaining
        config_path(data_dir).write_text(json.dumps(config, indent=2), encoding="utf-8")
        return print(f"Revoked {args.name}.")
    if args.command == "set-result-share":
        if not args.share_dir: raise SystemExit("--share-dir is required.")
        share_dir = args.share_dir.resolve()
        if not share_dir.is_dir() and not args.allow_unavailable: raise SystemExit(f"Shared result folder does not exist: {share_dir}")
        config.setdefault("retention_days", DEFAULT_RETENTION_DAYS)
        config["result_share_dir"] = str(share_dir)
        config_path(data_dir).write_text(json.dumps(config, indent=2), encoding="utf-8")
        if share_dir.is_dir(): return print(f"Completed result archives will be copied to {share_dir} after the next server restart.")
        return print(f"Configured {share_dir}; UBox publishing will begin after the folder is available and the server restarts.")
    queue = Queue(data_dir)
    if args.command == "status":
        while True:
            os.system("cls" if os.name == "nt" else "clear"); print(f"Sorcerer queue — {utcnow()}")
            for job in queue.list(): print(f"{job['status']:<10} p{job['priority']:03} {job['type']:<20} {job['id'][:8]}  {job['message'] or ''}")
            time.sleep(2)
    host, port = args.host or config["host"], args.port or config["port"]
    worker = Worker(queue, config); worker.start(); server = ThreadingHTTPServer((host, port), make_handler(queue, config)); print(f"Sorcerer listening on http://{host}:{port}")
    try: server.serve_forever()
    except KeyboardInterrupt: pass
    finally: worker.stop_event.set(); server.server_close()


if __name__ == "__main__": main()
