import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { parse, printParseErrorCode, type ParseError } from "jsonc-parser";

interface R2Binding {
  binding: string;
  bucket_name: string;
}

interface WorkerEnvironment {
  name?: string;
  r2_buckets?: R2Binding[];
}

interface WorkerConfig {
  name: string;
  r2_buckets?: R2Binding[];
  previews?: {
    r2_buckets?: R2Binding[];
  };
  env?: Record<string, WorkerEnvironment>;
}

type DeployEnvironment = Record<string, string | undefined>;

const configPath = new URL("../wrangler.jsonc", import.meta.url);
const outputPath = new URL("../wrangler.deploy.jsonc", import.meta.url);

function parseConfig(source: string): WorkerConfig {
  const errors: ParseError[] = [];
  const config = parse(source, errors, { allowTrailingComma: true }) as WorkerConfig;
  if (errors.length) {
    const details = errors
      .map((error) => `${printParseErrorCode(error.error)} at offset ${error.offset}`)
      .join(", ");
    throw new Error(`Invalid Worker wrangler.jsonc: ${details}`);
  }
  return config;
}

function requiredEnv(env: DeployEnvironment, name: string): string {
  const value = env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required deployment variable ${name}`);
  }
  return value;
}

function findBinding(
  bindings: R2Binding[] | undefined,
  section: string,
  binding: string,
): R2Binding {
  const entry = bindings?.find((item) => item.binding === binding);
  if (!entry) {
    throw new Error(`Missing ${section} binding "${binding}" in Worker wrangler.jsonc`);
  }
  return entry;
}

export function buildDeployConfig(
  source: string,
  env: DeployEnvironment,
): string {
  const config = parseConfig(source);
  const name = requiredEnv(env, "DEPLOY_WORKER_NAME");
  const productionBucket = requiredEnv(env, "DEPLOY_R2_BUCKET_NAME");
  const previewBucket = requiredEnv(env, "DEPLOY_R2_PREVIEW_BUCKET_NAME");

  config.name = name;
  findBinding(config.r2_buckets, "r2_buckets", "MEDIA_BUCKET").bucket_name =
    productionBucket;

  findBinding(
    config.previews?.r2_buckets,
    "previews.r2_buckets",
    "MEDIA_BUCKET",
  ).bucket_name = previewBucket;

  const namedPreview = config.env?.preview;
  if (!namedPreview) {
    throw new Error('Missing env.preview in Worker wrangler.jsonc');
  }
  findBinding(
    namedPreview.r2_buckets,
    "env.preview.r2_buckets",
    "MEDIA_BUCKET",
  ).bucket_name = previewBucket;
  namedPreview.name = env.DEPLOY_WORKER_PREVIEW_NAME?.trim() || `${name}-preview`;

  return `${JSON.stringify(config, null, 2)}\n`;
}

async function main(): Promise<void> {
  const source = await readFile(configPath, "utf8");
  const output = buildDeployConfig(source, process.env);
  await writeFile(outputPath, output, "utf8");
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  await main();
}
