# Sorcerer decisions to confirm

## Network and data retention

- Which office subnet(s) and Magic workstations may connect to Sorcerer? The
  initial server uses per-client bearer tokens and requires a firewall rule.
- Confirmed: retain input archives for 30 days and result archives, queue
  history, and failed-job diagnostics for 90 days. The editable source of
  truth is `retention_days` in the external `C:\SorcererData\config.json`;
  automatic deletion remains disabled until its cleanup workflow is implemented
  and tested.
- Should results be copied into a shared Box folder in addition to direct LAN
  download? Direct ZIP download is implemented first because it is faster and
  does not require Box credentials on the server.

## Workflow policy

- Should any job types have higher default priority or a concurrency limit
  different from the single-worker default? Acrobat and Office automation are
  intentionally serialized.
