# Magic Issue Log

## 2026-09-29: Acrobat batch worker can stall after an Acrobat restart

### Observed behavior

The PDF remediation worker remained alive after Acrobat was restarted during a final accessibility check. The active document had already reached the `__ecclesqa_final.pdf` stage, but the worker never returned from Acrobat automation, so the remaining queue did not run.

### Impact

Completed output files and stage files were preserved, but one stalled Acrobat call prevented the rest of the batch from progressing.

### Resolution

PDF remediation now runs every file in an isolated worker process. A file gets two recovery attempts before it is deferred, with Acrobat force-terminated between attempts. Magic continues with the remaining queue, then performs one final pass over deferred files. Each worker has a 20-minute ceiling. After three unsuccessful attempts, the manifest records the file as failed with recovery details while completed and staged work remains resumable.

### Follow-up: 2026-09-29

Live diagnosis showed an Acrobat renderer can become unresponsive during a final accessibility check while the isolated worker remains alive. The Acrobat-internal watchdog did not reliably interrupt the blocked COM call. The parent supervisor now treats three minutes without any output after an initial or final accessibility-check request as a stalled check, terminates that worker and Acrobat, and applies the normal retry/defer policy. The broader 20-minute limit remains in place for other long-running remediation stages such as OCR and autotagging.

## 2026-09-29: Windows console encoding aborted the PDF retry supervisor

### Observed behavior

At file 53 of a 93-file batch, the isolated PDF worker emitted a replacement character (`U+FFFD`) in its diagnostic output. The parent PDF runner inherited a Windows CP-1252 stdout stream and raised `UnicodeEncodeError` while forwarding that line. The exception escaped the retry loop, so Magic reported exit code 1 and did not defer the document or continue the queue.

### Resolution

The PDF runner now reconfigures stdout to UTF-8 with replacement handling before it starts processing. Child diagnostics can therefore include malformed or non-Windows characters without terminating the supervisor. The existing per-file retry, Acrobat restart, deferral, and final retry pass will run after a child failure instead of being bypassed by log output.
