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

## 4. Cloudflare password-protected site

The public GitHub Pages deployment must be disabled after the protected Cloudflare Worker is verified. In GitHub, open **Settings → Pages** and select **Unpublish site**. Do not leave `https://rafapp.github.io/ecclesQA/` available because it bypasses the password gate.

Cloudflare deploys the site from the connected GitHub repository. Use these commands in the Cloudflare deployment screen:

```text
Build command:
cd fantasia-site && npm ci && npm run docs:check && npm run build && (npm run start > /tmp/fantasia-site.log 2>&1 &) && npm run export:worker

Deploy command:
cd fantasia-site && npx wrangler deploy --config worker/wrangler.jsonc
```

After the first deployment, add these two values in **Workers & Pages → fantasia-site → Settings → Variables and Secrets** as **Secrets**, not plaintext variables:

- `SITE_PASSWORD`: the shared team password.
- `SESSION_SECRET`: a distinct, long random string used only to sign login sessions.

Do not commit or send either value. The worker serves only the login page until the password is verified server-side.

## 5. Sorcerer workstation

Before configuring the secondary desktop as a Sorcerer worker, record:

- Windows edition and whether automatic sign-in is prohibited.
- Adobe applications and licensed versions installed.
- Whether jobs may access Box, Canvas, or network shares.
- Where input, output, quarantine, and backup folders should live.
- How the machine will receive authenticated HTTPS jobs and report health.
- Who may approve destructive or high-volume jobs.

Do not expose Adobe automation, file shares, remote desktop, or raw job-runner ports directly to the internet.
