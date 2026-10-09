# Deployment guide

The Pages project and standalone Worker are independent deployments. Both use the same `@komikhq/media-core` package and bind an R2 bucket as `MEDIA_BUCKET`; choose the target that fits the hostname and project you need. You can deploy either or both.

## 1. Prepare the account and buckets

1. Install dependencies and run the checks:

   ```sh
   pnpm install
   pnpm typecheck
   pnpm test
   pnpm build
   ```

2. Authenticate Wrangler and check which Cloudflare account is selected:

   ```sh
   pnpm exec wrangler login
   pnpm exec wrangler whoami
   ```

3. Create or select the R2 bucket(s) in that account. The config placeholders are syntactically valid examples, not resources that this project creates. Replace the relevant `bucket_name` values in [Pages Wrangler config](./apps/pages/wrangler.jsonc) and [Worker Wrangler config](./apps/worker/wrangler.jsonc).

4. Keep the binding named `MEDIA_BUCKET`. The Worker uses Wrangler named environments; Workers bindings are not inherited automatically, so each environment has its own R2 binding in the config.

## 2. Choose the bucket layout

Separate buckets are **not required for each app or deployment target**:

| Runtime/configuration | R2 bucket |
| --- | --- |
| Pages production | Your chosen production bucket |
| Worker production | May use the same production bucket as Pages |
| Pages and Worker preview | Prefer a separate preview/test bucket |
| Local Pages or Worker development | Wrangler local R2 simulation; no Cloudflare bucket is required |

Sharing one production bucket between Pages and Worker is appropriate when both serve the same media catalog. Preview and production can technically share a bucket too, but previews would expose production objects and future code changes could accidentally operate against production if write features are added. Use different preview and production buckets when you need data isolation or safe preview testing.

Wrangler simulates R2 locally by default and stores local development state on the machine. A bucket name in the top-level config does not by itself make local development connect to that remote bucket. Do not enable a remote binding unless you intentionally want local code to access a real Cloudflare bucket.

There is no need to create a third, remotely hosted “local” bucket. A separate local Cloudflare bucket is optional if your team specifically wants a shared remote development dataset; it is not required for the unit tests or local simulation.

## 3. Run locally

The default commands use local bindings and local R2 simulation:

```sh
pnpm dev:pages
pnpm dev:worker
```

For local development using the Worker’s named preview configuration:

```sh
pnpm dev:worker:preview
```

The Pages command uses the base binding configuration for local development; Pages `env.preview` and `env.production` are deployment configuration overrides. Keep local test data non-sensitive. Wrangler state is ignored by Git.

## 4. Deploy Cloudflare Pages

Pages Functions run inside a Cloudflare Pages project. Create/select the Pages project in Cloudflare first, and make sure it uses the Pages V2 build system because this project defines its configuration in Wrangler. The Wrangler configuration is the source of truth for fields it defines; do not maintain conflicting dashboard values for those fields.

1. In [Pages Wrangler config](./apps/pages/wrangler.jsonc), set `env.production.r2_buckets[].bucket_name` and `env.preview.r2_buckets[].bucket_name`. These may point to different buckets; both may point to the production bucket if that is intentional.
2. Set the Pages project name (`name`) to the project configured in Cloudflare if it differs from `komikhq-media-pages`.
3. Deploy from the configured production branch:

   ```sh
   pnpm deploy:pages
   ```

   Wrangler infers the branch from Git when available. For an explicit branch, use:

   ```sh
   pnpm --filter @komikhq/pages exec wrangler pages deploy public --branch <production-branch>
   ```

4. Deploy a preview using a branch configured as a Pages preview branch:

   ```sh
   pnpm deploy:pages:preview
   ```

   This script uses branch name `preview`. If your Pages project uses another branch, either change that branch in [the Pages package scripts](./apps/pages/package.json) or run the explicit `wrangler pages deploy public --branch <preview-branch>` command shown above.

Pages selects its `env.production` or `env.preview` override according to whether the deployment branch is the configured production branch or a preview branch. Preview branch settings are configured in the Pages project; the `--branch` flag identifies the branch, it does not create that Pages project or its branch policy.

## 5. Deploy the standalone Worker

The Worker has its own name, bindings, URL, and deployment lifecycle. In [Worker Wrangler config](./apps/worker/wrangler.jsonc), set the top-level bucket to production and `env.preview.r2_buckets[].bucket_name` to the preview bucket (or intentionally reuse production).

```sh
pnpm deploy:worker
pnpm deploy:worker:preview
```

The first command explicitly deploys the top-level Worker environment; the second deploys the separate `komikhq-media-worker-preview` environment. A dry run can validate either configuration without publishing:

```sh
pnpm --filter @komikhq/worker exec wrangler deploy --dry-run --env=""
pnpm --filter @komikhq/worker exec wrangler deploy --dry-run --env preview
```

The preview deployment is a separate named Worker, not an automatic copy of production settings. The R2 binding is explicitly defined for it in Wrangler config.

The Worker config enables the `workers.dev` route, version Preview URLs, and Workers Cache. These are Worker-specific settings; they do not configure Pages. Workers Cache is private to this Worker, honors response `Cache-Control`, and is not controlled by zone Cache Rules. Pages uses its own caching configuration.

## 6. Import this monorepo from GitHub

You can connect the same GitHub repository to a Pages project and a separate Worker. They are independent Cloudflare projects and can each deploy automatically on pushes. Cloudflare Pages Git integration and Workers Builds are configured separately.

### Pages project

1. In Cloudflare Dashboard, open **Workers & Pages** > **Create application** > **Pages** > **Connect to Git**, authorize GitHub, and select this repository.
2. Set the **Production branch** (usually `main`).
3. Under **Build settings**, set:
   - **Root directory**: `apps/pages`
   - **Build command**: `pnpm --filter @komikhq/media-core build && pnpm --filter @komikhq/pages build`
   - **Build output directory**: `public`
   - **Framework preset**: none
4. Ensure the project uses Pages Build System V2 or later. The Wrangler config in `apps/pages` is the source of truth for the settings and R2 bindings it declares. Set the preview and production bucket names in [the Pages Wrangler config](./apps/pages/wrangler.jsonc) before connecting/deploying.
5. Save and deploy. Pushes to the production branch create production deployments; other enabled branches and pull requests create Pages previews. Configure **Settings** > **Builds & deployments** > **Branch control** to choose which branches may create previews.

The build command compiles the shared workspace package and verifies the Pages Functions bundle. The Functions files stay in `apps/pages/functions`, while `public` is the Pages assets output directory. Keep the entire repository available to the build; the shared package and pnpm workspace files are outside the Pages root directory.

`apps/pages/public/_routes.json` excludes favicon, icon, and logo paths from the catch-all Function so those files are served as static Pages assets. The Worker has a separate `public` asset directory configured in Wrangler; its matching static files are served before its R2 handler.

Media delivery errors are generated by the shared package: browser requests that accept HTML get the branded light/dark error page, while other clients get JSON. These application pages cover invalid paths, missing objects, unsupported methods, and R2 read failures. They cannot replace Cloudflare error pages for failures that happen before the Function or Worker executes, such as platform or edge errors.

### Worker project

1. Create the Worker from **Workers & Pages** > **Create application** > **Get started** > **Import a repository**, or connect an existing Worker under its **Settings** > **Builds**.
2. Connect the same GitHub repository and configure:
   - **Root directory**: `apps/worker`
   - **Production branch**: usually `main`
   - **Build command**: `pnpm --filter @komikhq/media-core build`
   - **Deploy command**: `pnpm run deploy`
   - **Preview command**: `pnpm exec wrangler preview`
3. Make the Worker name in Cloudflare match `name` in [the Worker Wrangler config](./apps/worker/wrangler.jsonc), currently `komikhq-media-worker`. Set its production bucket there before enabling production builds.
4. For branch previews, configure the preview R2 binding with a test bucket in the `previews` block of the Wrangler config. Previews use branch-oriented Workers Previews settings; they do **not** automatically select the named Wrangler `env.preview`. The repository config includes a placeholder `previews.r2_buckets` binding that must be changed to the intended preview bucket.
5. Enable preview builds and select the production branch in the Worker Builds settings. Production-branch pushes deploy the Worker; non-production branch builds use the Preview command and create/update a branch Preview. Preview URLs are public unless you separately restrict access.

`pnpm deploy:worker:preview` is different: it manually deploys the named Wrangler environment `env.preview` as its own Worker. Do not set that script as the Workers Builds Preview command unless you specifically intend each preview build to deploy/update that named Worker instead of using branch-isolated Previews.

### Monorepo builds and deployment safety

- Pages and the Worker can both be connected to the repository. By default, changes anywhere in the repository may trigger both builds. Configure Pages build watch paths and Workers Builds watch paths if you want to deploy only when the corresponding `apps/...` or shared `packages/media-core/...` paths change. Include root workspace manifests and lockfile as dependencies in both watch rules.
- The Pages and Worker Git integrations are separate; importing one does not connect the other.
- First verify the build settings and that the configured R2 binding is the intended resource. Do not configure a production bucket for previews unless exposing production media to preview builds is intentional.
- Do not mix Git-connected automatic deployments and manual Wrangler deployments without deciding which workflow owns releases. A manual deploy also updates the same target.
- Pages Git integration is not interchangeable with Direct Upload; Cloudflare currently does not let a Git-connected Pages project switch later to Direct Upload. Choose Git integration intentionally.

## 7. Public hostname and caching

Configure a KomikHQ-controlled public hostname for the selected Pages project or Worker. For Pages subdomains, register the hostname in the Pages project and configure its required DNS CNAME at the DNS provider. An apex hostname requires the domain's zone and nameservers to be on Cloudflare in the account that owns the Pages project.

Do not use an R2 `r2.dev` URL or an R2 custom-domain endpoint as the public media URL. The Worker uses Workers Cache and response `Cache-Control` headers; Cloudflare zone Cache Rules do not control that cache. Pages does not use the Worker's cache setting, so configure and verify Pages caching separately for the public hostname and media paths. Invalidate the applicable cache after replacing an object at the same key; immutable, versioned paths avoid that invalidation step for new releases.

## Cloudflare references

- [Pages Functions Wrangler configuration](https://developers.cloudflare.com/pages/functions/wrangler-configuration/)
- [Pages Functions deployment commands](https://developers.cloudflare.com/workers/wrangler/commands/pages/)
- [Workers Wrangler environments](https://developers.cloudflare.com/workers/wrangler/environments/)
- [Workers local development and bindings](https://developers.cloudflare.com/workers/local-development/)
- [Use R2 from Workers](https://developers.cloudflare.com/r2/api/workers/workers-api-usage/)
- [Pages custom domains](https://developers.cloudflare.com/pages/configuration/custom-domains/)
- [Pages Git integration](https://developers.cloudflare.com/pages/get-started/git-integration/)
- [Pages monorepos](https://developers.cloudflare.com/pages/configuration/monorepos/)
- [Workers Builds](https://developers.cloudflare.com/workers/ci-cd/builds/)
- [Workers Builds monorepos](https://developers.cloudflare.com/workers/ci-cd/builds/advanced-setups/)
- [Workers Previews configuration](https://developers.cloudflare.com/workers/previews/configuration/)
