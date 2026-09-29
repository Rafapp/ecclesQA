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

Update the package version, validate the desktop app, run `npm run build`, and attach the generated portable executable to a matching GitHub release.
