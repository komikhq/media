import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { parse, printParseErrorCode } from "jsonc-parser";

const configPath = new URL("../wrangler.jsonc", import.meta.url);
const outputPath = new URL("../wrangler.deploy.jsonc", import.meta.url);

function parseConfig(source) {
  const errors = [];
  const config = parse(source, errors, { allowTrailingComma: true });
  if (errors.length) {
    const details = errors
      .map((error) => `${printParseErrorCode(error.error)} at offset ${error.offset}`)
      .join(", ");
    throw new Error(`Invalid Worker wrangler.jsonc: ${details}`);
  }
  return config;
}

function requiredEnv(env, name) {
  const value = env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required deployment variable ${name}`);
  }
  return value;
}

function findBinding(config, section, binding) {
  const entry = config[section]?.find((item) => item.binding === binding);
  if (!entry) {
    throw new Error(`Missing ${section} binding "${binding}" in Worker wrangler.jsonc`);
  }
  return entry;
}

export function buildDeployConfig(source, env) {
  const config = parseConfig(source);
  const name = requiredEnv(env, "DEPLOY_WORKER_NAME");
  const productionBucket = requiredEnv(env, "DEPLOY_R2_BUCKET_NAME");
  const previewBucket = requiredEnv(env, "DEPLOY_R2_PREVIEW_BUCKET_NAME");

  config.name = name;
  findBinding(config, "r2_buckets", "MEDIA_BUCKET").bucket_name = productionBucket;

  const previewBinding = config.previews?.r2_buckets?.find(
    (item) => item.binding === "MEDIA_BUCKET",
  );
  if (!previewBinding) {
    throw new Error('Missing previews.r2_buckets binding "MEDIA_BUCKET" in Worker wrangler.jsonc');
  }
  previewBinding.bucket_name = previewBucket;

  const namedPreview = config.env?.preview;
  const namedPreviewBinding = namedPreview?.r2_buckets?.find(
    (item) => item.binding === "MEDIA_BUCKET",
  );
  if (!namedPreviewBinding) {
    throw new Error('Missing env.preview.r2_buckets binding "MEDIA_BUCKET" in Worker wrangler.jsonc');
  }
  namedPreviewBinding.bucket_name = previewBucket;
  namedPreview.name = env.DEPLOY_WORKER_PREVIEW_NAME?.trim() || `${name}-preview`;

  return `${JSON.stringify(config, null, 2)}\n`;
}

async function main() {
  const source = await readFile(configPath, "utf8");
  const output = buildDeployConfig(source, process.env);
  await writeFile(outputPath, output, "utf8");
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  await main();
}
