# Magic

Magic is the Project Fantasia Windows desktop app for running local Eccles School automation scripts. It was revived from the `magic-v1.0.0` release and is maintained under `fantasia/magic`.

## Commands

Run these from `fantasia/magic`:

```bash
npm install
npm start
npm run build
npm run package
```

`npm start` launches the Electron app. `npm run build` creates a portable Windows executable in `dist`. `npm run package` creates a local release archive.

## Layout

- `app/main.js` starts Electron and manages the script runner.
- `app/renderer` contains the desktop UI.
- `app/scripts-manifest.json` registers the automations shown in Magic.
- `scripts` contains the bundled automation implementations.

## Bundled Python

The packaged application expects a Windows embeddable Python distribution in `fantasia/magic/python` before `npm run build`. In development, Magic uses the system `python` available on `PATH`.

## Adding An Automation

Place the Python implementation in `scripts`, then add its metadata and input/output contract to `app/scripts-manifest.json`. Keep user-selected paths and output locations explicit in the manifest so Magic can present them before execution.

## Release

Update the package version, validate the desktop app, run `npm run build`, and attach the generated portable executable to a matching GitHub release.
