# Magic release and rollback

Magic portable releases are built on a Windows workstation because they embed
the project-managed Python runtime and are intended to operate Office and
Acrobat through the interactive desktop session.

## Release procedure

1. Start from a clean checkout of the intended commit and run `npm ci` in this
   directory.
2. Run `node --check app/main.js`, `node --check app/renderer/renderer.js`, and
   from the repository root run `fantasia\magic\python\python.exe -m unittest
   discover -s fantasia\sorcerer\tests -v`.
3. Confirm `python\python.exe` is present, then run `npm run package`. The
   portable executable is built in `dist/` and the uploadable ZIP is written to
   `downloads/` outside the Magic source tree.
4. Smoke-test the executable on the release workstation. Verify local workflow
   launch, the remote-run toggle, queue refresh, and that no token is displayed
   in the UI or logs.
5. Create or update the matching GitHub release tag (`magic-v<version>`) and
   upload `downloads/magic-application-v<version>.zip`. Update the public site
   download URL only after the release asset is available.

## Server release checks

Before telling clients to use a new Magic release, on the Sorcerer workstation
verify `http://127.0.0.1:8765/v1/health`, the local dashboard, and the exact
configured Box path. Keep TCP 8765 scoped to the approved LAN and keep the
server in the signed-in Office/Acrobat desktop session.

## Rollback

If a release fails its smoke test, remove or mark the GitHub release as draft
before sharing its link. To roll back an already shared client release, direct
users to the prior signed-off GitHub release asset; do not overwrite a released
ZIP in place. Restore the prior Git tag/commit, rebuild on Windows, rerun the
checks above, and update the site link only after the replacement asset has
been verified.
