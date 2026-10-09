import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { parse } from "jsonc-parser";
import { buildDeployConfig } from "../scripts/generate-deploy-config.mjs";

const source = await readFile(new URL("../wrangler.jsonc", import.meta.url), "utf8");

test("Pages deploy config uses the project's name and per-environment R2 buckets", () => {
  const generated = parse(
    buildDeployConfig(source, {
      DEPLOY_PAGES_PROJECT_NAME: "media-catalog-a",
      DEPLOY_R2_BUCKET_NAME: "catalog-a",
      DEPLOY_R2_PREVIEW_BUCKET_NAME: "catalog-a-preview",
    }),
  );

  assert.equal(generated.name, "media-catalog-a");
  assert.equal(generated.pages_build_output_dir, "./public");
  assert.equal(generated.r2_buckets[0].bucket_name, "catalog-a");
  assert.equal(generated.env.production.r2_buckets[0].bucket_name, "catalog-a");
  assert.equal(generated.env.preview.r2_buckets[0].bucket_name, "catalog-a-preview");
});

test("Pages deploy config fails when deployment variables are missing", () => {
  assert.throws(
    () => buildDeployConfig(source, {}),
    /Missing required deployment variable DEPLOY_PAGES_PROJECT_NAME/,
  );
});
