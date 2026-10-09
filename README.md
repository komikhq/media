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

Successful object responses carry `Cache-Control: public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800`. Error responses are marked `no-store`.

The standalone Worker enables Workers Cache in Wrangler; Workers Cache honors these response headers and is separate from the zone cache. Zone Cache Rules do not control Workers Cache. Pages does not use the Worker `cache` setting, so Pages caching must be configured separately and verified for the public hostname and media paths.

If an object is overwritten at the same key, invalidate the applicable cache before expecting all cached copies to update. Prefer versioned object paths for immutable releases; no cache purge integration is provisioned here.
