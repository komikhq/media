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

3. Create or select the R2 buckets in that account. The tracked Wrangler files are templates/local-development configuration; production bucket names are selected independently for each Pages or Worker project using one of the options below.

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

## Configure CORS

Pages Functions and the standalone Worker apply CORS from the `CORS_POLICY`
runtime variable using the same R2-style JSON array format. This variable is a
plain string, not a secret. The default value `[]` disables CORS headers.
Configure it with a value such as:

```json
[{"AllowedOrigins":["https://app.example.com"],"AllowedMethods":["GET","HEAD"],"AllowedHeaders":["Authorization","Content-Type"],"ExposeHeaders":["ETag","Last-Modified","Content-Length"],"MaxAgeSeconds":3600}]
```

For Pages, add `CORS_POLICY` under **Settings → Bindings → Variables and
Secrets** for both Preview and Production, using the appropriate policy for
each environment. The Pages Wrangler file in this repository is only for local
type generation; it does not configure deployed Pages settings.

For the Worker, set `vars.CORS_POLICY` in
[apps/worker/wrangler.jsonc](./apps/worker/wrangler.jsonc), including
`env.preview.vars` for the named preview environment. Workers Builds branch
Previews use the top-level policy. The deploy-config generator preserves these
values.

Use the R2 fields `AllowedOrigins`, `AllowedMethods`, `AllowedHeaders`,
`ExposeHeaders`, and `MaxAgeSeconds`. This media endpoint supports only `GET`
and `HEAD`; other methods remain unsupported regardless of policy. Allowed
origins support exact values, `*`, and a single hostname wildcard such as
`https://*.example.com`. The handler validates the JSON and returns a
non-cacheable 500 with an error log if the policy is malformed. Allowed
preflight requests return 204; disallowed preflights return 403. CORS is a
browser access policy, not authentication or authorization.

This setting is independent from the R2 bucket's own CORS rules: requests go
through the Pages Function or Worker, and the shared handler adds CORS headers
to its responses. Configure this variable on each deployment target that
serves the media.

## 4. Deploy Cloudflare Pages

Pages Functions run inside a Cloudflare Pages project. Create/select the Pages project in Cloudflare first. Pages deployment configuration is managed fully in the Dashboard; this repository intentionally does not include a `wrangler.jsonc` Pages deployment config. That prevents Pages Git integration from discovering a shared config and makes each project's settings and R2 binding independent.

In **Settings → Builds & deployments**, set **Root directory** to `apps/pages`, **Build output directory** to `public`, and use this build command:

```sh
pnpm --filter @komikhq/media-core build && pnpm --filter @komikhq/pages build
```

In **Settings → Functions**, configure the compatibility date/flags. In **Settings → Bindings**, add an R2 binding named `MEDIA_BUCKET` separately for **Production** and **Preview**, selecting the bucket intended for that Pages project. Configure any other runtime bindings, variables, and secrets there too. Repeat the settings for each Pages project connected to this repository.

`apps/pages/wrangler.local.jsonc` is only used to generate local TypeScript binding declarations. Its non-standard name keeps Pages Git integration from auto-discovering it as the project's deployment config. Local development uses Wrangler CLI flags to bind a local R2 simulation; Cloudflare Dashboard bindings are not automatically available on a developer machine.

### Deploy Pages manually with Wrangler

For a Pages project managed through the Dashboard, deploy the already-built `public` directory:

```sh
pnpm deploy:pages
```

Wrangler infers the branch from Git when available. For an explicit branch, use:

```sh
pnpm --filter @komikhq/pages exec wrangler pages deploy public --branch <production-branch>
```

Deploy a preview using a branch configured as a Pages preview branch:

```sh
pnpm deploy:pages:preview
```

This script uses branch name `preview`. If your Pages project uses another branch, either change that branch in [the Pages package scripts](./apps/pages/package.json) or run the explicit `wrangler pages deploy public --branch <preview-branch>` command shown above.

The `--branch` flag identifies the branch, it does not create the Pages project or its branch policy. Wrangler CLI deployments use the settings configured for the Pages project in the Dashboard.

## 5. Deploy the standalone Worker

The Worker has its own name, bindings, URL, and deployment lifecycle. Keep [Worker Wrangler config](./apps/worker/wrangler.jsonc) as the tracked template/local-development config. Its deploy script generates the ignored `wrangler.deploy.jsonc` from per-project `DEPLOY_*` variables and passes that file to Wrangler with `--config`.

Set these variables for each Worker project:

| Variable | Required | Purpose |
| --- | --- | --- |
| `DEPLOY_WORKER_NAME` | No | Production Worker name; set per project when the tracked default name does not match |
| `DEPLOY_R2_BUCKET_NAME` | Yes | Production R2 bucket |
| `DEPLOY_R2_PREVIEW_BUCKET_NAME` | Yes | Branch Preview and named preview R2 bucket; keep separate from production unless sharing is intentional |
| `DEPLOY_WORKER_PREVIEW_NAME` | No | Named preview Worker name; defaults to `<Worker name>-preview` |

Wrangler requires a Worker `name`, and Workers Builds does not document a build variable from which the target name can be detected. If `DEPLOY_WORKER_NAME` is omitted, the generator retains `name` from the tracked config (`komikhq-media-worker`) and prints a warning; separate Worker projects should set `DEPLOY_WORKER_NAME` to avoid targeting the same Worker. `DEPLOY_WORKER_PREVIEW_NAME` is optional and defaults to `<Worker name>-preview`.

For Workers Builds, keep the Worker root directory at `apps/worker`, build with the existing shared-package build step, and set the **Deploy command** to `pnpm run deploy`. That command generates the per-project config and deploys production. Branch previews use the Worker Builds Preview workflow and the generated preview bucket binding. The separate manual `pnpm deploy:worker:preview` command deploys the named `env.preview` Worker using the same generated config.

```sh
pnpm deploy:worker
pnpm deploy:worker:preview
```

The first command explicitly deploys the top-level Worker environment; the second deploys the separately named preview Worker. A dry run can validate the template config without publishing:

```sh
pnpm --filter @komikhq/worker exec wrangler deploy --dry-run --env=""
pnpm --filter @komikhq/worker exec wrangler deploy --dry-run --env preview
```

The preview deployment is a separate named Worker, not an automatic copy of production settings. The generator explicitly sets its name and R2 binding.

The Worker config enables the `workers.dev` route, version Preview URLs, and Workers Cache. These are Worker-specific settings; they do not configure Pages. Workers Cache is private to this Worker, honors response `Cache-Control`, and is not controlled by zone Cache Rules. Pages uses its own caching configuration.

## 6. Import this monorepo from GitHub

You can connect the same GitHub repository to a Pages project and a separate Worker. They are independent Cloudflare projects and can each deploy automatically on pushes. Cloudflare Pages Git integration and Workers Builds are configured separately.

### Pages project

1. In Cloudflare Dashboard, open **Workers & Pages** > **Create application** > **Pages** > **Connect to Git**, authorize GitHub, and select this repository.
2. Set the **Production branch** (usually `main`).
3. Under **Build settings**, set:
   - **Root directory**: `apps/pages`
   - **Build command**: use the Dashboard-managed or generated-config command in Section 4
   - **Build output directory**: `public`
   - **Framework preset**: none
4. Configure the Pages project entirely in the Dashboard as described in Section 4; there is no Pages deployment Wrangler config in the repository.
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
   - **Preview command**: `pnpm run deploy:branch-preview`
3. Configure the required `DEPLOY_*` variables above for this Worker project. The generator sets the Worker name and R2 bindings for production, branch Previews, and the named preview environment.
4. Branch previews use branch-oriented Workers Previews settings; they do **not** automatically select the named Wrangler `env.preview`. Both use the bucket supplied as `DEPLOY_R2_PREVIEW_BUCKET_NAME`.
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
