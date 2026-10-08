# Magic

Magic is the Project Fantasia Windows desktop app for running local Eccles School automation scripts. It was revived from the `magic-v1.0.0` release and is maintained under `fantasia/magic`.

## Commands

Run these from `fantasia/magic`:

```bash
python -m pip install -r scripts/requirements.txt
npm install
npm run build:portable
npm start
npm run build
npm run package
```

Double-click `launch.cmd` to start Magic locally; it runs `npm ci` automatically only when Node dependencies are missing. `npm start` launches the Electron app from a terminal. `npm run build:portable` (also available as `npm run build`) creates `dist/magic-v<version>-portable.exe`, which can be copied to another Windows device. `npm run package` creates a local release archive.

## Sorcerer server batches

For a large batch (normally five or more files), select the same source and
output folders as a local run, then enable **Send to Sorcerer server** in the
run dialog. Enter the office server URL (for example,
`http://sorcerer-pc:8765`) and the client token issued by the Sorcerer
operator. Magic uploads the source folder, shows the server-side workflow
progress, and downloads the completed output into the selected local output
folder. The token is stored only in this Windows user's Magic preferences.

After a remote submission, Magic displays the full copyable job ID in the run
progress view and in the authenticated queue panel. Include that ID, workflow
name, and visible status when asking an operator for help; never include the
client token. A cancellation request affects only the authenticated client's
job and may take effect at the workflow's next safe process boundary. Requeue
creates the next attempt for a terminal job while preserving the prior completed
result archive.

The server must be reachable on the office LAN and have the relevant Office or
Acrobat application installed. See `../sorcerer/README.md` for server setup.

## Layout

- `app/main.js` starts Electron and manages the script runner.
- `app/renderer` contains the desktop UI.
- `app/scripts-manifest.json` registers the automations shown in Magic.
- `scripts` contains the bundled automation implementations.

## Accessibility Workflows

Magic includes recovered local workflows for Word, PDF, PowerPoint, and Excel.
Each workflow asks for a source folder and an output folder. Magic copies the
supported files into the output folder before remediation, leaving the source
folder unchanged.

Magic preserves existing files in an output folder on a rerun. The recovered
workflow manifest and its per-file stage files let the same source/output
selection resume unfinished work. Use `Stop after current file` to checkpoint
at the next file boundary, then launch the same workflow with the same output
folder to requeue the remaining work.

PDF work is isolated per file. If Acrobat stops responding, Magic restarts it
and retries that file twice before deferring it so the rest of the batch can
continue. Deferred files receive one final retry pass; files that still fail
are recorded in the output manifest and can be resumed later without rerunning
completed files. An initial or final Acrobat accessibility check that produces
no progress output for three minutes is treated as stalled and is restarted;
the longer per-file ceiling remains available for OCR and autotagging.

- Word handles `.doc`, `.docm`, and `.docx` files.
- PDF uses local Adobe Acrobat automation and requires Adobe Acrobat Pro.
- PowerPoint handles `.ppt`, `.pptm`, and `.pptx` files. Converting legacy
  `.ppt` files requires desktop Microsoft PowerPoint.
- Excel preserves the legacy workflow: it converts `.xls` and `.xlsb` files
  to `.xlsx`; modern workbook files are copied to the output folder. Converting
  legacy files requires desktop Microsoft Excel.

## Bundled Python

The packaged application expects a Windows embeddable Python distribution at `fantasia/magic/python/python.exe` before `npm run build:portable`; the build command checks this explicitly. In development, Magic uses the system `python` available on `PATH`.

## Adding An Automation

Place the Python implementation in `scripts`, then add its metadata and input/output contract to `app/scripts-manifest.json`. Keep user-selected paths and output locations explicit in the manifest so Magic can present them before execution.

## Release

Before creating a release, update the Magic package version and the Magic entry
in `fantasia-site/content/products.json` together. The catalog must name the
matching `magic-v<version>` tag and `magic-application-v<version>.zip` asset.
Run the following from `fantasia/magic`:

```powershell
npm run release:verify
npm run package
```

Inspect the resulting ZIP outside Git, verify that it contains the expected
`magic-v<version>-portable.exe`, and record its SHA-256 in the release handoff.
Only then create a new matching GitHub release and attach that exact ZIP. Never
overwrite a published asset: rollback means directing users to the previous
signed-off release, not replacing its bytes. Update and deploy the protected
website only after the release asset is available and its catalog URL matches.
