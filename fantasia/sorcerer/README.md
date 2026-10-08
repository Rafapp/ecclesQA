# Sorcerer

Sorcerer is the Windows workstation service for queueing expensive Magic file
remediation jobs. Magic clients submit a ZIP over the office LAN; Sorcerer runs
the registered workflow once at a time and returns a ZIP of the output files.

```
Magic client --Bearer token + ZIP--> Sorcerer queue --> Magic Python workflow
     ^                                                          |
     +------------------- status / result ZIP -----------------+
```

## Quick start on the server workstation

Run these commands from `fantasia/sorcerer`:

```powershell
python server.py init --data-dir C:\SorcererData
python server.py token --data-dir C:\SorcererData --name magic-lab-01
python server.py serve --data-dir C:\SorcererData
```

Copy the generated token into the allowed Magic client's Sorcerer settings.
Use a different token per client. Open TCP port 8765 only to the office subnet
through Windows Firewall; see `HUMAN.md`.

Use `sorcerer.cmd clients --data-dir C:\SorcererData` to list allowed device
names (never tokens), and `sorcerer.cmd revoke --data-dir C:\SorcererData
--name magic-lab-01` to revoke a lost or retired device. Changes take effect on
the next server restart.

In another terminal, `sorcerer.cmd status --data-dir C:\SorcererData` streams
the queue. Press `Ctrl+C` to stop watching.

To keep the server available after this PC restarts, run
`install-logon-task.cmd` once from the server user's interactive Windows
session. Office and Acrobat automation must run in that interactive session,
so do not install Sorcerer as a Windows service.

Run `python -m unittest discover -s tests -v` to exercise authenticated submit,
execution, result download, priority scheduling, cancellation, and requeue
without Office or Acrobat.

## Job types

`job_types.py` is the registry. A job type declares the Magic script it runs,
the input archive layout, and the arguments passed to the script. To add a job:

1. Add and validate the Magic Python script under `fantasia/magic/scripts`.
2. Add one `JobType` entry in `job_types.py` with a unique identifier.
3. Add it to Magic's manifest/client choices and test submit, status, cancel,
   requeue, and result download.

The Sorcerer test suite also checks that every workflow in Magic's manifest has
a matching server job type, so an option shown to a client cannot be rejected
as unknown by the server.

Job data, results, the SQLite queue, and secrets stay outside the repository in
the configured data directory. The API contract is documented in
`PROTOCOL.md`.

Fresh server configuration limits each upload to 5 GiB, the total expanded ZIP
data to 10 GiB, and each ZIP to 100,000 entries. Operators may lower those
external `config.json` values for a workstation with less available storage.

## Retention policy

The single operational retention setting is the `retention_days` object in the
external data directory's `config.json` (for the live server,
`C:\SorcererData\config.json`). New configurations receive the defaults from
`DEFAULT_RETENTION_DAYS` in `server.py`: inputs for 30 days, and results,
queue history, and failed-job diagnostics for 90 days. Update that one object
when the retention policy changes; it is deliberately external to the
repository and takes effect when a retention cleanup workflow is implemented
and validated. Sorcerer does not yet delete data automatically.

## Shared UBox results

After the team-owned UBox folder is created and visible in Box Drive on the
server, configure it once with:

```powershell
.\sorcerer.cmd set-result-share --data-dir C:\SorcererData --share-dir "C:\Users\Fantasia\Box\Accessibility\Sorcerer Results"
```

Restart Sorcerer after setting the path. Each completed job will then copy its
ZIP archive into that folder using a unique job identifier. The copy is written
atomically so teammates do not see a partial archive. UBox publishing never
blocks a successful job or Magic's direct result download; if Box Drive is
unavailable, the job remains completed and its status explains that publishing
was deferred.

`workflow_runner.py` is intentionally small: Magic's embeddable Python runtime
uses an isolated import path, so the launcher adds the selected workflow's
`scripts/` directory before it runs the script.
