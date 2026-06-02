# Magic — developer notes

## Commands (run from `fantasia/magic`)

```bash
npm install
npm start          # dev: launches Electron directly
npm run build      # produces dist/magic-v1.0.0-portable.exe
```

## Bundling Python (required before `npm run build`)

The packaged `.exe` ships its own Python so users don't need anything installed.

1. Download the **Windows embeddable package** for Python 3.x from https://python.org/downloads/windows/
   (e.g. `python-3.12.x-embed-amd64.zip`)
2. Unzip it into `fantasia/magic/python/` — that directory should contain `python.exe`, `python312.zip`, etc.
3. Run `npm run build`. `electron-builder.yml` copies `python/` into the app's resources automatically.

In dev (`npm start`) the app falls back to the system `python` in PATH.

## Adding a new script

1. Drop the `.py` file into `fantasia/magic/scripts/`.
2. Add an entry to `fantasia/magic/app/scripts-manifest.json`:

```json
{
  "id": "unique-id",
  "name": "Display Name",
  "description": "What this script does, shown in the table.",
  "scriptFile": "your_script.py"
}
```

3. Bump the version in `package.json` and rebuild.

## Release

`npm run build` outputs `dist/magic-v<version>-portable.exe`.
Zip that single file and attach it to the GitHub release — users unzip and double-click.
