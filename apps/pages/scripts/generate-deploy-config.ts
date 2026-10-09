import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { parse, printParseErrorCode, type ParseError } from "jsonc-parser";

interface R2Binding {
  binding: string;
  bucket_name: string;
}

interface PagesEnvironment {
  r2_buckets?: R2Binding[];
}

interface PagesConfig {
  name: string;
  pages_build_output_dir?: string;
  r2_buckets?: R2Binding[];
  env?: Record<string, PagesEnvironment>;
}

type DeployEnvironment = Record<string, string | undefined>;

const configPath = new URL("../wrangler.jsonc", import.meta.url);

function parseConfig(source: string): PagesConfig {
  const errors: ParseError[] = [];
  const config = parse(source, errors, { allowTrailingComma: true }) as PagesConfig;
  if (errors.length) {
    const details = errors
      .map((error) => `${printParseErrorCode(error.error)} at offset ${error.offset}`)
      .join(", ");
    throw new Error(`Invalid Pages wrangler.jsonc: ${details}`);
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
  config: PagesConfig,
  environment: "default" | "production" | "preview",
  binding: string,
): R2Binding {
  const bindings =
    environment === "default"
      ? config.r2_buckets
      : config.env?.[environment]?.r2_buckets;
  const entry = bindings?.find((item) => item.binding === binding);
  if (!entry) {
    throw new Error(
      `Missing ${environment} R2 binding "${binding}" in Pages wrangler.jsonc`,
    );
  }
  return entry;
}

export function buildDeployConfig(
  source: string,
  env: DeployEnvironment,
): string {
  const config = parseConfig(source);
  const projectName = requiredEnv(env, "DEPLOY_PAGES_PROJECT_NAME");
  const productionBucket = requiredEnv(env, "DEPLOY_R2_BUCKET_NAME");
  const previewBucket = requiredEnv(env, "DEPLOY_R2_PREVIEW_BUCKET_NAME");

  config.name = projectName;
  config.pages_build_output_dir = "./public";
  findBinding(config, "default", "MEDIA_BUCKET").bucket_name = productionBucket;
  findBinding(config, "production", "MEDIA_BUCKET").bucket_name = productionBucket;
  findBinding(config, "preview", "MEDIA_BUCKET").bucket_name = previewBucket;

  return `${JSON.stringify(config, null, 2)}\n`;
}

async function main(): Promise<void> {
  const source = await readFile(configPath, "utf8");
  const output = buildDeployConfig(source, process.env);
  await writeFile(configPath, output, "utf8");
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  await main();
}
