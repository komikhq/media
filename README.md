# KomikHQ media

This pnpm workspace serves read-only media from R2 through two separate deployment targets:

- `apps/pages`: Cloudflare Pages Functions.
- `apps/worker`: a standalone Cloudflare Worker.
- `packages/media-core`: shared path validation, R2 access, response metadata, and cache policy.

Both targets expose the same URL-to-object mapping. `/` resolves to the R2 key `index.html`; other valid paths map to their decoded, slash-separated object keys. Query strings do not affect the key.

## Setup and checks

Use the pinned pnpm version (`12.10.1`):

```sh
pnpm install
pnpm typecheck
pnpm test
pnpm build
```

`pnpm install:workspace` is available as a frozen-lockfile install for CI.

## Deployment

See [DEPLOYMENT.md](./DEPLOYMENT.md) for setup steps, the distinction between Pages and a standalone Worker, local development, and bucket/environment guidance.

Quick commands:

```sh
pnpm dev:pages
pnpm dev:worker
pnpm deploy:pages
pnpm deploy:pages:preview
pnpm deploy:worker
pnpm deploy:worker:preview
```

No production deployment, DNS/domain setup, or Cloudflare resource provisioning is performed by the scaffold.

## CDN caching and invalidation

Successful object responses carry `Cache-Control: public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800`. Error responses are marked `no-store`. The Worker/Pages Function and these headers alone do not guarantee that Cloudflare's global CDN caches the response. Configure and verify a Cache Rule for the eventual public hostname and media paths so it honors the response cache policy.

If an object is overwritten at the same key, purge that URL through Cloudflare's cache before expecting all cached copies to update. Prefer versioned object paths for immutable releases; keep the purge procedure available for mutable keys. No cache purge integration is provisioned here.
