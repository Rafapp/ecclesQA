# Human actions needed for Sorcerer deployment

1. On the server PC, run `python fantasia/sorcerer/server.py init --data-dir
   C:\SorcererData`, create a unique token for each allowed client, and start
   the server.
2. With administrator approval, add an inbound Windows Firewall rule for TCP
   8765 limited to the approved office subnet. Do not expose Sorcerer to the
   public internet.
3. Confirm that Adobe Acrobat Pro and any required Office desktop applications
   are installed and licensed in the same interactive Windows session that runs
   Sorcerer.
4. Sorcerer is currently running on this workstation at port 8765. The
   `Sorcerer Server` interactive logon task was installed successfully on
   2026-10-08 for the server user, so it starts after that user signs in.
   Office and Acrobat still require that interactive desktop session. If the
   task is removed or this is deployed to another workstation, rerun
   `fantasia\sorcerer\install-logon-task.cmd` from the intended server user's
   session and verify it with `schtasks /Query /TN "Sorcerer Server" /FO LIST`.
