"""End-to-end tests for Sorcerer's authenticated queue protocol."""
import hashlib
import http.client
import io
import json
import sqlite3
import sys
import tempfile
import threading
import time
import unittest
import zipfile
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from job_types import JOB_TYPES, JobType
from server import Queue, Worker, make_handler, operator_metrics
from http.server import ThreadingHTTPServer


class SorcererServerTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        self.scripts = self.root / "scripts"
        self.scripts.mkdir()
        (self.scripts / "fake.py").write_text(
            "import json, pathlib, sys\nprint(json.dumps({'type': 'step_info', 'confirm': True, 'message': 'approve'}), flush=True)\n"
            "assert sys.stdin.readline().strip() == 'continue'\npathlib.Path(sys.argv[2]).mkdir(exist_ok=True)\n"
            "pathlib.Path(sys.argv[2], 'done.txt').write_text('done')\n"
            "print('{\\\"type\\\": \\\"run_done\\\", \\\"message\\\": \\\"done\\\"}')\n",
            encoding="utf-8",
        )
        self.token = "test-token"
        self.config = {
            "clients": [{"name": "test-client", "token_hash": hashlib.sha256(self.token.encode()).hexdigest()}],
            "python": sys.executable,
            "magic_scripts_dir": str(self.scripts),
            "max_archive_bytes": 1024 * 1024,
        }
        self.old_type = JOB_TYPES.get("test")
        JOB_TYPES["test"] = JobType("fake.py", "test", (".txt",))
        self.queue = Queue(self.root)
        self.worker = Worker(self.queue, self.config)
        self.worker.start()
        self.httpd = ThreadingHTTPServer(("127.0.0.1", 0), make_handler(self.queue, self.config))
        self.thread = threading.Thread(target=self.httpd.serve_forever, daemon=True)
        self.thread.start()

    def tearDown(self):
        self.httpd.shutdown(); self.httpd.server_close(); self.thread.join(2)
        self.worker.stop_event.set(); self.worker.join(2)
        if self.old_type is None: del JOB_TYPES["test"]
        else: JOB_TYPES["test"] = self.old_type
        self.temp.cleanup()

    def request(self, method, path, body=None, headers=None, token=None):
        conn = http.client.HTTPConnection("127.0.0.1", self.httpd.server_port)
        headers = {"Authorization": f"Bearer {token or self.token}", **(headers or {})}
        conn.request(method, path, body=body, headers=headers)
        response = conn.getresponse(); data = response.read(); conn.close()
        return response.status, data

    def test_submit_runs_and_returns_result(self):
        source = io.BytesIO()
        with zipfile.ZipFile(source, "w") as archive: archive.writestr("input.txt", "hello")
        status, body = self.request("POST", "/v1/jobs", source.getvalue(), {
            "Content-Type": "application/zip", "X-Sorcerer-Job-Type": "test", "X-Sorcerer-Priority": "90",
        })
        self.assertEqual(status, 201)
        job_id = json.loads(body)["id"]
        for _ in range(30):
            status, body = self.request("GET", f"/v1/jobs/{job_id}")
            job = json.loads(body)
            if job["status"] in {"completed", "failed"}: break
            time.sleep(0.1)
        self.assertEqual(job["status"], "completed", job)
        status, result = self.request("GET", f"/v1/jobs/{job_id}/result")
        self.assertEqual(status, 200)
        with zipfile.ZipFile(io.BytesIO(result)) as archive:
            self.assertEqual(archive.read("done.txt"), b"done")

    def test_completed_job_is_published_to_configured_share(self):
        share = self.root / "shared-results"
        share.mkdir()
        self.config["result_share_dir"] = str(share)
        source = io.BytesIO()
        with zipfile.ZipFile(source, "w") as archive: archive.writestr("input.txt", "hello")
        status, body = self.request("POST", "/v1/jobs", source.getvalue(), {
            "Content-Type": "application/zip", "X-Sorcerer-Job-Type": "test",
        })
        self.assertEqual(status, 201)
        job_id = json.loads(body)["id"]
        for _ in range(30):
            status, body = self.request("GET", f"/v1/jobs/{job_id}")
            job = json.loads(body)
            if job["status"] in {"completed", "failed"}: break
            time.sleep(0.1)
        self.assertEqual(job["status"], "completed", job)
        self.assertEqual(list(share.glob(f"sorcerer-test-{job_id}.zip")), [share / f"sorcerer-test-{job_id}.zip"])
        self.assertEqual(job["message"], "Completed; published to UBox")

    def test_manifest_workflows_all_have_server_job_types(self):
        manifest_path = ROOT.parent / "magic" / "app" / "scripts-manifest.json"
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        self.assertEqual([item["id"] for item in manifest if item["id"] not in JOB_TYPES], [])

    def test_rejects_unauthenticated_requests(self):
        conn = http.client.HTTPConnection("127.0.0.1", self.httpd.server_port)
        conn.request("GET", "/v1/jobs")
        self.assertEqual(conn.getresponse().status, 401)
        conn.close()

    def test_local_operator_dashboard_shows_queue_without_client_credentials(self):
        conn = http.client.HTTPConnection("127.0.0.1", self.httpd.server_port)
        conn.request("GET", "/dashboard")
        response = conn.getresponse()
        page = response.read().decode()
        conn.close()
        self.assertEqual(response.status, 200)
        self.assertIn("Sorcerer operator dashboard", page)
        self.assertIn("Recent outcomes", page)
        conn = http.client.HTTPConnection("127.0.0.1", self.httpd.server_port)
        conn.request("GET", "/dashboard/data")
        response = conn.getresponse()
        data = json.loads(response.read())
        conn.close()
        self.assertEqual(response.status, 200)
        self.assertIn("jobs", data)
        self.assertIn("metrics", data)
        self.assertNotIn("input_zip", json.dumps(data))

    def test_operator_metrics_aggregate_without_private_job_fields(self):
        now = datetime(2026, 10, 8, 12, 0, tzinfo=timezone.utc)
        jobs = [
            {"id": "one", "type": "test", "status": "completed", "created_at": "2026-10-08T11:00:00+00:00", "started_at": "2026-10-08T11:10:00+00:00", "finished_at": "2026-10-08T11:30:00+00:00", "message": "Completed; published to UBox", "input_zip": "private.zip"},
            {"id": "two", "type": "test", "status": "failed", "created_at": "2026-10-08T11:20:00+00:00", "started_at": "2026-10-08T11:25:00+00:00", "finished_at": "2026-10-08T11:35:00+00:00", "message": "Failed"},
            {"id": "three", "type": "other", "status": "running", "created_at": "2026-10-08T11:40:00+00:00", "started_at": "2026-10-08T11:45:00+00:00", "progress": json.dumps({"message": "Converting"}), "priority": 50},
            {"id": "four", "type": "other", "status": "queued", "created_at": "2026-10-08T11:50:00+00:00"},
        ]
        metrics = operator_metrics(jobs, now=now, server_started_at=datetime(2026, 10, 8, 10, 0, tzinfo=timezone.utc))
        self.assertEqual(metrics["counts"], {"queued": 1, "running": 1, "completed": 1, "failed": 1, "cancelled": 0})
        self.assertEqual(metrics["timing"]["average_wait_seconds"], 400)
        self.assertEqual(metrics["timing"]["average_runtime_seconds"], 900)
        self.assertEqual(metrics["timing"]["completion_rate"], 50)
        self.assertEqual(metrics["publishing"]["published"], 1)
        self.assertEqual(metrics["recent"], {"completed_24h": 1, "completed_7d": 0, "failed_24h": 1, "failed_7d": 0})
        self.assertEqual(metrics["priority_distribution"], {"low": 0, "standard": 1, "expedited": 0})
        self.assertEqual(metrics["uptime_seconds"], 7200)
        self.assertEqual(metrics["active"]["stage"], "Converting")
        self.assertEqual(metrics["active"]["elapsed_seconds"], 900)
        test_metrics = next(entry for entry in metrics["by_type"] if entry["type"] == "test")
        self.assertEqual(test_metrics["average_runtime_seconds"], 900)
        self.assertEqual(test_metrics["completion_rate"], 50)
        self.assertNotIn("input_zip", json.dumps(metrics))

    def test_rejects_archive_that_expands_beyond_configured_limit(self):
        self.config["max_extracted_bytes"] = 5
        source = io.BytesIO()
        with zipfile.ZipFile(source, "w", zipfile.ZIP_DEFLATED) as archive:
            archive.writestr("too-large.txt", "six!!!")
        status, body = self.request("POST", "/v1/jobs", source.getvalue(), {
            "Content-Type": "application/zip", "X-Sorcerer-Job-Type": "test",
        })
        self.assertEqual(status, 400)
        self.assertIn("expands beyond", json.loads(body)["error"])
        jobs_dir = self.root / "jobs"
        self.assertFalse(jobs_dir.exists() and any(jobs_dir.iterdir()))

    def test_rejects_archive_path_traversal_at_submission(self):
        source = io.BytesIO()
        with zipfile.ZipFile(source, "w") as archive:
            archive.writestr("../outside.txt", "nope")
        status, body = self.request("POST", "/v1/jobs", source.getvalue(), {
            "Content-Type": "application/zip", "X-Sorcerer-Job-Type": "test",
        })
        self.assertEqual(status, 400)
        self.assertIn("unsafe file path", json.loads(body)["error"])

    def test_cancelled_job_does_not_launch_after_input_extraction(self):
        source = io.BytesIO()
        with zipfile.ZipFile(source, "w") as archive:
            archive.writestr("input.txt", "hello")
        input_zip = self.root / "cancelled.zip"
        input_zip.write_bytes(source.getvalue())
        job = self.queue.create("test-client", "test", 50, {}, input_zip)
        self.queue.cancel(job["id"], "test-client")
        self.worker.execute(job)
        self.assertFalse((self.root / "jobs" / job["id"] / "output" / "done.txt").exists())

    def test_clients_cannot_read_each_others_jobs(self):
        other_token = "other-client-token"
        self.config["clients"].append({"name": "other-client", "token_hash": hashlib.sha256(other_token.encode()).hexdigest()})
        job = self.queue.create("test-client", "test", 50, {}, self.root / "private.zip")
        status, body = self.request("GET", "/v1/jobs", token=other_token)
        self.assertEqual(status, 200)
        self.assertEqual(json.loads(body)["jobs"], [])
        status, _ = self.request("GET", f"/v1/jobs/{job['id']}", token=other_token)
        self.assertEqual(status, 404)

    def test_priority_cancel_and_requeue(self):
        self.worker.stop_event.set(); self.worker.join(2)
        low = self.queue.create("test-client", "test", 10, {}, self.root / "low.zip")
        high = self.queue.create("test-client", "test", 90, {}, self.root / "high.zip")
        self.assertEqual(self.queue.next()["id"], high["id"])
        cancelled = self.queue.cancel(low["id"], "test-client")
        self.assertEqual(cancelled["status"], "cancelled")
        requeued = self.queue.requeue(low["id"], "test-client")
        self.assertEqual(requeued["status"], "queued")
        self.assertEqual(requeued["attempt"], 2)

    def test_requeue_preserves_completed_result_as_prior_attempt(self):
        self.worker.stop_event.set(); self.worker.join(2)
        job = self.queue.create("test-client", "test", 50, {}, self.root / "input.zip")
        result = self.root / "jobs" / job["id"] / "result.zip"
        result.parent.mkdir(parents=True)
        result.write_bytes(b"original result")
        self.queue.update(job["id"], status="completed", result_zip=str(result), finished_at="2026-10-08T12:00:00+00:00")
        requeued = self.queue.requeue(job["id"], "test-client")
        preserved = result.with_name("result-attempt-1.zip")
        self.assertEqual(requeued["attempt"], 2)
        self.assertIsNone(requeued["result_zip"])
        self.assertEqual(preserved.read_bytes(), b"original result")
        self.assertEqual(json.loads(requeued["previous_result_zips"]), [str(preserved)])

    def test_queue_migrates_existing_database_for_attempt_history(self):
        legacy = self.root / "legacy"
        legacy.mkdir()
        db = sqlite3.connect(legacy / "queue.sqlite3")
        db.execute("""CREATE TABLE jobs (
            id TEXT PRIMARY KEY, client TEXT NOT NULL, type TEXT NOT NULL,
            priority INTEGER NOT NULL, status TEXT NOT NULL, created_at TEXT NOT NULL,
            started_at TEXT, finished_at TEXT, metadata TEXT NOT NULL, message TEXT,
            progress TEXT, input_zip TEXT NOT NULL, result_zip TEXT)""")
        db.execute("INSERT INTO jobs VALUES ('old', 'test-client', 'test', 50, 'completed', '2026-10-08T10:00:00+00:00', NULL, NULL, '{}', 'Completed', '{}', 'input.zip', NULL)")
        db.commit(); db.close()
        migrated = Queue(legacy).get("old")
        self.assertEqual(migrated["attempt"], 1)
        self.assertEqual(migrated["previous_result_zips"], "[]")

    def test_cancel_and_requeue_endpoints(self):
        self.worker.stop_event.set(); self.worker.join(2)
        job = self.queue.create("test-client", "test", 50, {}, self.root / "endpoint.zip")
        status, body = self.request("POST", f"/v1/jobs/{job['id']}/cancel")
        self.assertEqual(status, 200)
        self.assertEqual(json.loads(body)["status"], "cancelled")
        status, body = self.request("POST", f"/v1/jobs/{job['id']}/requeue")
        self.assertEqual(status, 200)
        self.assertEqual(json.loads(body)["status"], "queued")


if __name__ == "__main__":
    unittest.main()
