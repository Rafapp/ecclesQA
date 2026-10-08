# Shared Sorcerer health-view design

## Decision

Keep the detailed Sorcerer operator dashboard local to the workstation. It is
the authoritative operational console and is deliberately loopback-only. Do
not expose it with a public route, a Cloudflare Tunnel, a reverse proxy, or a
website iframe.

The password-protected Project Fantasia site may eventually show a separate,
minimal shared-health card. It is a convenience status signal, not a control
plane and not a substitute for the local dashboard.

## Safe shared fields

An authorized shared view may contain only:

- server online/offline state;
- last successful refresh timestamp;
- queued-job count;
- active/idle state;
- aggregate recent completions and failures.

It must not contain job IDs, workflow names, client identities, source/output
names, filesystem paths, archive metadata, error text, tokens, result links,
or queue controls.

## Recommended implementation when ownership is approved

Use an outbound scheduled publisher on the Sorcerer workstation. It should
read the existing local aggregate dashboard data, reduce it to the allowlist
above, and publish a signed static JSON status artifact for the protected site.
The workstation should make no new inbound service reachable from the internet.

Before implementing it, an operator must choose who owns the publishing
credential, the refresh cadence, offline/stale thresholds, and incident
response. Store that credential outside the repository and outside site source
files. The publisher must fail closed: a missed update should become `stale`,
not reuse an old value as live status.

## Grafana decision

Grafana is deferred. The built-in dashboard already covers the one-workflow
workstation's real-time needs without another service, database, credentials,
or port. Re-evaluate Grafana only when an authorized owner needs multi-server
history, alert routing, or long-term organization-wide reporting.

## Deployment rule

The site is password-gated. Deploy it only through `npm run deploy:protected`,
with the existing secret material supplied through its ignored secret-file
mechanism. Never use a bare Worker deployment command: it can replace the
password-gate handler with the generated static Worker.
