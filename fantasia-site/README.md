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
npm run build
npm run start
npm run export:worker
npx wrangler deploy --config worker/wrangler.jsonc
```
