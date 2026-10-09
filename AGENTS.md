# Project Guidelines

## Project Purpose

Build `komikhq/media`, a pnpm workspace monorepo for serving KomikHQ media stored in Cloudflare R2 through Cloudflare Pages Functions and, where needed, standalone Cloudflare Workers.

Public media must be served from a KomikHQ-controlled custom hostname. Do not expose or rely on R2's public `r2.dev` URL or an R2 custom-domain endpoint as the public delivery URL.

## Architecture

- Keep deployable applications under `apps/` and reusable workspace packages under `packages/`.
- Keep R2 object access, URL-to-object-key mapping, response metadata, and cache policy consistent across deployment targets. Share this logic through a workspace package when both targets need it.
- Use a Pages Function catch-all route for requests intended to resolve to R2 objects. Preserve the request path when deriving the object key, and handle missing objects and unsupported methods explicitly.
- Bind R2 using Wrangler configuration or Cloudflare project bindings. Use typed bindings; never hardcode credentials or duplicate binding definitions in application code.
- Treat Pages and Workers as separate deployment targets with their own configuration and deployment commands. Do not assume that initializing one creates or configures the other.
- A Pages custom subdomain may use external DNS: register the custom domain in the Pages project and configure the required CNAME at the DNS provider. An apex domain requires the zone and nameservers to be configured with Cloudflare for the account owning the Pages project.
- Do not claim that routing through a Function alone guarantees CDN caching. Set and verify explicit cache behavior for media responses, including appropriate cache-control headers and a documented invalidation strategy.

## Workspace and Tooling

- Use pnpm workspaces. Declare workspace globs in the root `pnpm-workspace.yaml`.
- Keep dependencies at the narrowest applicable workspace level; use the `workspace:` protocol for internal package dependencies.
- Install and invoke Wrangler as a project dependency through pnpm. Keep Wrangler configuration close to the app it deploys.
- Prefer TypeScript and generated Cloudflare binding types where practical. Keep local development bindings aligned with deployed bindings.
- Do not introduce a framework or additional monorepo orchestration tool unless the project needs it.

## Implementation Conventions

- Validate and normalize request paths before using them as R2 keys. Prevent malformed paths or path traversal from selecting unintended objects.
- Support only the HTTP methods required by the media-delivery contract. Return explicit status codes and relevant headers for unsupported methods and missing objects.
- Stream object bodies; do not buffer entire media files in memory.
- Preserve relevant R2 object metadata in HTTP responses, including content type, entity tag, modification time, and content length when available.
- Make cache keys and cache-control policy appropriate to the URL and media mutability. Do not cache errors as successful media responses.
- Keep public delivery read-only unless a separately documented requirement authorizes writes.
- Surface operational errors explicitly. Do not silently convert R2 or cache failures into successful empty responses.

## Validation

- Run the relevant app's type check, tests, and build after changing its code or configuration.
- Test shared delivery behavior against both Pages Functions and Workers when both use the shared package.
- Cover path-to-key mapping, missing objects, unsupported methods, metadata propagation, and cache headers in tests.
- Use local Wrangler development with an R2 binding or a suitable test fixture; do not require production credentials for routine tests.
- Do not deploy, change DNS, or modify production Cloudflare resources unless explicitly requested.
