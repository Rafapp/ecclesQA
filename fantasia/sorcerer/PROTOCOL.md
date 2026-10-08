# Sorcerer LAN protocol

All endpoints require `Authorization: Bearer <client-token>` except `GET
/v1/health`. Requests and responses use JSON unless noted.

| Method | Path | Purpose |
| --- | --- | --- |
| `POST` | `/v1/jobs` | Submit a ZIP body. Headers: `X-Sorcerer-Job-Type`, optional `X-Sorcerer-Priority` (`0`–`100`) and `X-Sorcerer-Metadata` (JSON). |
| `GET` | `/v1/jobs` | List jobs visible to the authenticated client. |
| `GET` | `/v1/jobs/{id}` | Read one job and its latest progress event. |
| `POST` | `/v1/jobs/{id}/cancel` | Cancel a queued or running job. |
| `POST` | `/v1/jobs/{id}/requeue` | Put a terminal job back in the queue as its next attempt. Prior completed result archives are preserved before a new current result is created. |
| `GET` | `/v1/jobs/{id}/result` | Download completed output as `application/zip`. |

The server rejects archive path traversal, encrypted ZIPs, unknown job types,
payloads over the configured limit, ZIPs above the configured expanded-data or
entry limits, unauthenticated clients, and jobs owned by another token.
Server execution is serialized because Office and Acrobat automation require a
single interactive Windows desktop session. Submitted server jobs automatically
continue workflow confirmation checkpoints; the client's explicit submission is
the approval boundary.

Job responses include an `attempt` field. The job ID remains stable when a
terminal job is requeued, while `attempt` increments. Clients should show both
values when helping an operator identify an execution.
