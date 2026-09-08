# User-required setup

These are the remaining actions that require an account decision, institutional approval, or physical access. Development can continue without them.

## 1. Completed: real-Chrome reporting check

Completed September 8, 2026. The popup bug and suggestion workflow was confirmed working in Chrome. Keep the following regression check for future releases:

1. Open `chrome://extensions`.
2. Reload Wand, which should still point to `fantasia/wand/dist`.
3. Click the Wand toolbar icon.
4. Create one disposable bug report and one suggestion. Confirm each reports that it was saved and copied.
5. Select **Export saved reports** and confirm Chrome downloads a JSON file.
6. Open Rafael's Test Course in UDOIT. Use **Report bug** and **Suggest** in the bottom Wand panel and confirm the same save-and-copy behavior.

Do not include sensitive student information in test reports.

## 2. Deferred: central bug and suggestion delivery

Per the September 8 decision, wait for University IT before connecting automatic submission. Wand currently saves up to 50 reports locally and copies each report for manual sharing. When the discussion resumes, decide:

- Who owns the report inbox and who may read it.
- Whether reports should create GitHub issues, service-desk tickets, or records in a small HTTPS API.
- Authentication requirements for university users.
- Data-retention expectations and whether page URLs are allowed.
- Whether screenshots may be included. They are not collected today.

For the secondary desktop, expose a report service only through institution-approved HTTPS and authentication. Do not forward an unauthenticated port from the public internet. Once the endpoint and credentials are chosen, add them as deployment secrets rather than committing them.

## 3. Deferred: team distribution and IT

Ask University IT whether they can centrally deploy Wand through Chrome Enterprise policies or a private organizational Chrome Web Store listing. Provide the extension's purpose, requested Canvas/UDOIT host access, source repository, privacy behavior, and release ZIP. Managed deployment would remove the unpacked-extension and Developer mode steps.

Until University IT responds, keep using the current internal testing process. Do not publish a new Wand package solely to establish a temporary distribution path.

## 4. Completed: enable the public GitHub Pages site

Completed September 8, 2026: GitHub Pages is configured to use GitHub Actions and the site is live at `https://rafapp.github.io/ecclesQA/`.

If a university-owned custom domain is approved later, add it through the same Pages settings and follow IT's DNS instructions. The managed Sites publisher was unavailable in the current workspace, so GitHub Pages is the active free deployment path.

## 5. Sorcerer workstation

Before configuring the secondary desktop as a Sorcerer worker, record:

- Windows edition and whether automatic sign-in is prohibited.
- Adobe applications and licensed versions installed.
- Whether jobs may access Box, Canvas, or network shares.
- Where input, output, quarantine, and backup folders should live.
- How the machine will receive authenticated HTTPS jobs and report health.
- Who may approve destructive or high-volume jobs.

Do not expose Adobe automation, file shares, remote desktop, or raw job-runner ports directly to the internet.
