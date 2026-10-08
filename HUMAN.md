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
4. Sorcerer is currently running on this workstation at port 8765. Run
   `fantasia\sorcerer\install-logon-task.cmd` to restore it automatically at
   the server user's next sign-in.
   - Attempted on 2026-09-29: Windows returned `Access is denied`; an
     administrator or Task Scheduler policy change is required to create the
     `Sorcerer Server` logon task.
