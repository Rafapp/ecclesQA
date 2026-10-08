# Project Fantasia site

The shared installation and release site for Wand, Magic, and Sorcerer.

## Local development

```bash
npm install
npm run dev
```

## Validation

```bash
npm run lint
npm run build
```

Product information and Wand capability status come from `content/products.json`. Run `npm run docs:sync` after updating the catalog.

## Protected Cloudflare deployment

The production site is served by a Cloudflare Worker with an application-level password gate. Local secrets belong in ignored `worker/.dev.vars`; production secrets are configured in Cloudflare as `SITE_PASSWORD` and `SESSION_SECRET`.

```bash
npm run deploy:protected
```

Do not use bare `wrangler deploy` for production: it deploys Vinext's generated
static Worker and omits the password-gate handler. Before deployment, an
authorized operator must create an ignored production `.env` file containing
the two existing secret values and set `FANTASIA_SECRETS_FILE` to that file.
`deploy:protected` builds the site, exports the assets for
`worker/wrangler.jsonc`, uploads a candidate Worker with that file, verifies
both password-gate secret bindings before it receives traffic, polls the live
login page, and rolls back to the prior healthy Worker version if any
post-deployment check fails. It never reads or prints secret values.

## Sorcerer operational visibility

The detailed Sorcerer dashboard stays on the server workstation. The boundary
and a safe future shared-health design are documented in
[`OPERATIONS.md`](OPERATIONS.md). Do not expose the workstation dashboard or
its service port through the website.
