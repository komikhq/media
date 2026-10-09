import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { parse } from "jsonc-parser";
import { buildDeployConfig } from "../scripts/generate-deploy-config.mjs";

const source = await readFile(new URL("../wrangler.jsonc", import.meta.url), "utf8");

test("Worker deploy config uses project-specific names and R2 buckets", () => {
  const generated = parse(
    buildDeployConfig(source, {
      DEPLOY_WORKER_NAME: "media-catalog-a",
      DEPLOY_R2_BUCKET_NAME: "catalog-a",
      DEPLOY_R2_PREVIEW_BUCKET_NAME: "catalog-a-preview",
    }),
  );

  assert.equal(generated.name, "media-catalog-a");
  assert.equal(generated.r2_buckets[0].bucket_name, "catalog-a");
  assert.equal(generated.previews.r2_buckets[0].bucket_name, "catalog-a-preview");
  assert.equal(generated.env.preview.name, "media-catalog-a-preview");
  assert.equal(generated.env.preview.r2_buckets[0].bucket_name, "catalog-a-preview");
});

test("Worker deploy config fails when deployment variables are missing", () => {
  assert.throws(
    () => buildDeployConfig(source, {}),
    /Missing required deployment variable DEPLOY_WORKER_NAME/,
  );
});
