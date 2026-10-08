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
from datetime import datetime, timedelta, timezone
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
              progress TEXT, input_zip TEXT NOT NULL, result_zip TEXT,
              attempt INTEGER NOT NULL DEFAULT 1, previous_result_zips TEXT NOT NULL DEFAULT '[]')""")
            columns = {row["name"] for row in db.execute("PRAGMA table_info(jobs)")}
            if "attempt" not in columns:
                db.execute("ALTER TABLE jobs ADD COLUMN attempt INTEGER NOT NULL DEFAULT 1")
            if "previous_result_zips" not in columns:
                db.execute("ALTER TABLE jobs ADD COLUMN previous_result_zips TEXT NOT NULL DEFAULT '[]'")
            db.execute("UPDATE jobs SET status='queued', message='Recovered after server restart' WHERE status='running'")

    def create(self, client, job_type, priority, metadata, input_zip):
        job_id = uuid.uuid4().hex
        with closing(self.connect()) as db, db:
            db.execute("INSERT INTO jobs (id, client, type, priority, status, created_at, started_at, finished_at, metadata, message, progress, input_zip, result_zip) VALUES (?, ?, ?, ?, 'queued', ?, NULL, NULL, ?, 'Queued', '{}', ?, NULL)",
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
        previous = json.loads(job.get("previous_result_zips") or "[]")
        result_zip = job.get("result_zip")
        if result_zip and Path(result_zip).is_file():
            preserved = Path(result_zip).with_name(f"result-attempt-{job.get('attempt', 1)}.zip")
            shutil.copy2(result_zip, preserved)
            previous.append(str(preserved))
        self.update(job_id, status="queued", started_at=None, finished_at=None, message="Requeued as next attempt", progress="{}", result_zip=None, attempt=job.get("attempt", 1) + 1, previous_result_zips=json.dumps(previous))
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
        # A retried job reuses its immutable input archive but never reuses an
        # old extracted tree or output files. Its completed ZIP was preserved
        # by requeue() before this cleanup.
        shutil.rmtree(source, ignore_errors=True)
        shutil.rmtree(output, ignore_errors=True)
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
    attempt = job.get("attempt", 1)
    attempt_suffix = "" if attempt == 1 else f"-attempt-{attempt}"
    destination = destination_dir / f"sorcerer-{job['type']}-{job['id']}{attempt_suffix}.zip"
    temporary = destination_dir / f".{destination.name}.{uuid.uuid4().hex}.partial"
    try:
        shutil.copy2(result, temporary)
        os.replace(temporary, destination)
    except OSError:
        temporary.unlink(missing_ok=True)
        return "Completed; UBox publishing deferred because the shared folder could not be written"
    return "Completed; published to UBox"


def public_job(job):
    keys = ("id", "type", "priority", "status", "created_at", "started_at", "finished_at", "message", "progress", "attempt")
    result = {key: job.get(key) for key in keys}
    result["attempt"] = result["attempt"] or 1
    result["progress"] = json.loads(result["progress"] or "{}")
    return result


def parse_timestamp(value):
    if not value:
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except (TypeError, ValueError):
        return None


def seconds_between(start, end):
    if not start or not end:
        return None
    return max(0, round((end - start).total_seconds()))


def progress_message(job):
    progress = job.get("progress") or {}
    if isinstance(progress, str):
        try:
            progress = json.loads(progress)
        except json.JSONDecodeError:
            progress = {}
    return progress.get("message") or job.get("message")


def operator_metrics(jobs, now=None, server_started_at=None):
    """Return local-only aggregate telemetry without client, path, or archive data."""
    now = now or datetime.now(timezone.utc)
    counts = {status: 0 for status in ("queued", "running", "completed", "failed", "cancelled")}
    by_type, waits, runtimes, type_runtimes = {}, [], [], {}
    day_buckets = {str((now - timedelta(days=offset)).date()): {"date": str((now - timedelta(days=offset)).date()), "completed": 0, "failed": 0} for offset in range(6, -1, -1)}
    publish = {"published": 0, "share_unavailable": 0, "write_failed": 0, "not_configured": 0}
    priorities = {"low": 0, "standard": 0, "expedited": 0}
    recent = {"completed_24h": 0, "completed_7d": 0, "failed_24h": 0, "failed_7d": 0}
    active = None
    for job in jobs:
        status = job.get("status", "")
        if status in counts:
            counts[status] += 1
        created, started, finished = (parse_timestamp(job.get(key)) for key in ("created_at", "started_at", "finished_at"))
        if started:
            wait = seconds_between(created, started)
            if wait is not None:
                waits.append(wait)
        if finished:
            runtime = seconds_between(started, finished)
            if runtime is not None:
                runtimes.append(runtime)
                type_runtimes.setdefault(job.get("type", "unknown"), []).append(runtime)
            bucket = day_buckets.get(str(finished.date()))
            if bucket and status in {"completed", "failed"}:
                bucket[status] += 1
            age_seconds = seconds_between(finished, now)
            if age_seconds is not None:
                period = "24h" if age_seconds <= 24 * 60 * 60 else "7d" if age_seconds <= 7 * 24 * 60 * 60 else None
                if period and status in {"completed", "failed"}:
                    recent[f"{status}_{period}"] += 1
        entry = by_type.setdefault(job.get("type", "unknown"), {"type": job.get("type", "unknown"), "completed": 0, "failed": 0, "cancelled": 0, "total": 0})
        entry["total"] += 1
        if status in entry:
            entry[status] += 1
        priority = job.get("priority")
        if isinstance(priority, int):
            priorities["low" if priority < 34 else "standard" if priority < 67 else "expedited"] += 1
        message = (job.get("message") or "").lower()
        if status == "completed":
            if "published to ubox" in message:
                publish["published"] += 1
            elif "shared folder is unavailable" in message:
                publish["share_unavailable"] += 1
            elif "shared folder could not be written" in message:
                publish["write_failed"] += 1
            else:
                publish["not_configured"] += 1
        if status == "running":
            active = {"id": job.get("id"), "type": job.get("type"), "priority": job.get("priority"), "started_at": job.get("started_at"), "stage": progress_message(job), "attempt": job.get("attempt") or 1, "elapsed_seconds": seconds_between(started, now)}
    terminal = counts["completed"] + counts["failed"]
    for job_type, entry in by_type.items():
        values = type_runtimes.get(job_type, [])
        typed_terminal = entry["completed"] + entry["failed"]
        entry["average_runtime_seconds"] = round(sum(values) / len(values)) if values else None
        entry["completion_rate"] = round((entry["completed"] / typed_terminal) * 100) if typed_terminal else None
    return {
        "generated_at": now.isoformat(),
        "counts": counts,
        "queue_depth": counts["queued"] + counts["running"],
        "active": active,
        "timing": {
            "average_wait_seconds": round(sum(waits) / len(waits)) if waits else None,
            "average_runtime_seconds": round(sum(runtimes) / len(runtimes)) if runtimes else None,
            "completion_rate": round((counts["completed"] / terminal) * 100) if terminal else None,
        },
        "throughput": list(day_buckets.values()),
        "recent": recent,
        "priority_distribution": priorities,
        "uptime_seconds": seconds_between(server_started_at, now),
        "by_type": sorted(by_type.values(), key=lambda entry: (-entry["total"], entry["type"])),
        "publishing": publish,
    }


def operator_dashboard_data(jobs, server_started_at=None):
    return {"jobs": [public_job(job) for job in jobs], "metrics": operator_metrics(jobs, server_started_at=server_started_at)}


def operator_dashboard_html() -> str:
    """Local-only dashboard with derived queue telemetry and no client data."""
    return """<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Sorcerer operator dashboard</title><style>
:root{color-scheme:light;font-family:system-ui,sans-serif;color:#20242c;background:#f5f7fa}*{box-sizing:border-box}body{margin:0}main{max-width:1200px;margin:auto;padding:32px}.eyebrow{color:#38618d;font-size:.78rem;font-weight:700;letter-spacing:.08em;text-transform:uppercase}.top{display:flex;justify-content:space-between;gap:20px;align-items:end}.top h1{margin:5px 0;font-size:2rem}.muted{color:#5e6978}.stamp{font-size:.86rem}.metrics{display:grid;grid-template-columns:repeat(5,1fr);gap:12px;margin:24px 0}.card,.panel{background:#fff;border:1px solid #dce2e9;border-radius:12px;box-shadow:0 2px 10px #1c30400a}.card{padding:16px}.card strong{display:block;font-size:1.8rem}.card span,.label{font-size:.8rem;font-weight:700;text-transform:uppercase;letter-spacing:.04em;color:#667384}.grid{display:grid;grid-template-columns:1.2fr .8fr;gap:16px;margin-bottom:16px}.panel{padding:18px}.panel h2{font-size:1rem;margin:0 0 14px}.facts{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}.fact{padding:10px;background:#f5f7fa;border-radius:8px}.fact strong{display:block;font-size:1.25rem}.bars{height:150px;display:flex;align-items:end;gap:7px;border-bottom:1px solid #dce2e9;padding:0 4px}.bar{flex:1;min-width:18px;background:#3876ad;border-radius:5px 5px 0 0;position:relative}.bar.fail{background:#bd4a4a}.bar span{position:absolute;bottom:-24px;left:50%;transform:translateX(-50%);font-size:.7rem;color:#667384}.legend{display:flex;gap:16px;margin:30px 0 0;font-size:.82rem}.dot{display:inline-block;width:9px;height:9px;border-radius:50%;background:#3876ad}.dot.fail{background:#bd4a4a}table{width:100%;border-collapse:collapse}th,td{text-align:left;padding:11px 8px;border-bottom:1px solid #edf0f3;font-size:.9rem}th{font-size:.72rem;text-transform:uppercase;letter-spacing:.05em;color:#667384}.status{font-weight:700;text-transform:capitalize}.status-completed{color:#18754a}.status-failed,.status-cancelled{color:#ad3434}.status-running{color:#176295}.id{font-family:ui-monospace,monospace;font-size:.8rem}button{border:1px solid #cbd5df;border-radius:6px;background:#fff;padding:4px 7px;cursor:pointer}.empty{color:#667384;text-align:center;padding:24px}@media(max-width:800px){main{padding:20px}.metrics{grid-template-columns:repeat(2,1fr)}.grid{grid-template-columns:1fr}.facts{grid-template-columns:1fr}.top{align-items:start;flex-direction:column}th:nth-child(4),td:nth-child(4){display:none}}</style></head>
<body><main><header class="top"><div><div class="eyebrow">Local operator console</div><h1>Sorcerer queue health</h1><p class="muted">Aggregated queue activity only. This dashboard is available on the server itself.</p></div><p class="muted stamp" id="stamp">Loading telemetry...</p></header><section class="metrics" id="counts"></section><section class="grid"><article class="panel"><h2>Recent throughput</h2><div class="bars" id="throughput"></div><p class="legend"><span><i class="dot"></i> Completed</span><span><i class="dot fail"></i> Failed</span></p></article><article class="panel"><h2>Queue timing</h2><div class="facts" id="timing"></div><h2 style="margin-top:20px">Active work</h2><p class="muted" id="active">No workflow is running.</p></article></section><section class="grid"><article class="panel"><h2>Workflow breakdown</h2><div id="types" class="muted">No completed history yet.</div></article><article class="panel"><h2>Result publishing</h2><div class="facts" id="publishing"></div><h2 style="margin-top:20px">Priority mix</h2><div class="facts" id="priorities"></div></article></section><section class="panel"><h2>Recent jobs</h2><table><thead><tr><th>Job ID</th><th>Workflow</th><th>Status</th><th>Attempt</th><th>Submitted</th><th>Message</th></tr></thead><tbody id="jobs"></tbody></table></section></main>
<script>const q=s=>document.querySelector(s),esc=v=>String(v??''),fmt=s=>s==null?'Not enough data':s<60?`${s}s`:`${Math.round(s/60)}m`,when=v=>v?new Date(v).toLocaleString():'-',copy=async id=>{try{await navigator.clipboard.writeText(id);q('#stamp').textContent='Job ID copied.'}catch{q('#stamp').textContent='Select and copy the job ID manually.'}};function facts(target,items){const root=q(target);root.replaceChildren(...items.map(([label,value])=>{const e=document.createElement('div');e.className='fact';e.innerHTML=`<span class="label">${esc(label)}</span><strong>${esc(value)}</strong>`;return e}))}function render(data){const m=data.metrics||{},c=m.counts||{};q('#counts').replaceChildren(...[['Queue depth',m.queue_depth],['Queued',c.queued],['Running',c.running],['Completed',c.completed],['Failed',c.failed]].map(([label,value])=>{const e=document.createElement('article');e.className='card';e.innerHTML=`<span>${label}</span><strong>${value??0}</strong>`;return e}));facts('#timing',[['Average wait',fmt(m.timing?.average_wait_seconds)],['Average runtime',fmt(m.timing?.average_runtime_seconds)],['Completion rate',m.timing?.completion_rate==null?'Not enough data':`${m.timing.completion_rate}%`],['Server uptime',fmt(m.uptime_seconds)]]);const a=m.active;q('#active').textContent=a?`${a.type} (attempt ${a.attempt}) | ${a.id} | priority ${a.priority} | ${fmt(a.elapsed_seconds)} elapsed | ${a.stage||'Working'}`:'No workflow is running.';facts('#publishing',[['Published',m.publishing?.published??0],['Share unavailable',m.publishing?.share_unavailable??0],['Write failed',m.publishing?.write_failed??0],['Not configured',m.publishing?.not_configured??0]]);facts('#priorities',[['Low',m.priority_distribution?.low??0],['Standard',m.priority_distribution?.standard??0],['Expedited',m.priority_distribution?.expedited??0]]);const max=Math.max(1,...(m.throughput||[]).map(x=>x.completed+x.failed));q('#throughput').replaceChildren(...(m.throughput||[]).map(x=>{const e=document.createElement('div');e.className='bar';e.style.height=`${Math.max(3,100*(x.completed+x.failed)/max)}%`;e.title=`${x.date}: ${x.completed} completed, ${x.failed} failed`;e.innerHTML=`<span>${x.date.slice(5)}</span>`;return e}));const types=q('#types');types.replaceChildren(...(m.by_type||[]).map(x=>{const p=document.createElement('p');p.textContent=`${x.type}: ${x.total} total, ${x.completed} completed, ${x.failed} failed, ${x.cancelled} cancelled | ${fmt(x.average_runtime_seconds)} average runtime | ${x.completion_rate??'Not enough data'}% completion`;return p}));if(!(m.by_type||[]).length)types.textContent='No workflow history yet.';const body=q('#jobs');body.replaceChildren();const jobs=data.jobs||[];if(!jobs.length){body.innerHTML='<tr><td class="empty" colspan="6">No jobs have been submitted yet.</td></tr>'}for(const j of jobs){const row=document.createElement('tr');const id=document.createElement('td');id.className='id';const b=document.createElement('button');b.textContent=j.id;b.title='Copy job ID';b.addEventListener('click',()=>copy(j.id));id.append(b);const state=document.createElement('td');state.className=`status status-${esc(j.status)}`;state.textContent=j.status;for(const cell of [id,Object.assign(document.createElement('td'),{textContent:j.type}),state,Object.assign(document.createElement('td'),{textContent:j.attempt||1}),Object.assign(document.createElement('td'),{textContent:when(j.created_at)}),Object.assign(document.createElement('td'),{textContent:j.message||'-'})])row.append(cell);body.append(row)}q('#stamp').textContent=`Updated ${new Date().toLocaleTimeString()} | ${jobs.length} visible jobs`};async function load(){try{const r=await fetch('/dashboard/data',{cache:'no-store'});if(!r.ok)throw Error('unavailable');render(await r.json())}catch{q('#stamp').textContent='Dashboard data is temporarily unavailable.'}}load();setInterval(load,5000);</script></body></html>"""


def token_identity(config, header):
    if not header.startswith("Bearer "): return None
    digest = hashlib.sha256(header[7:].encode()).hexdigest()
    for client in config["clients"]:
        if secrets.compare_digest(client["token_hash"], digest): return client["name"]
    return None


def make_handler(queue, config):
    server_started_at = datetime.now(timezone.utc)
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
                return self.send_json(200, operator_dashboard_data(queue.list(), server_started_at))
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
