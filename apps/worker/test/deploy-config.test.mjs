import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { parse } from "jsonc-parser";
import { buildDeployConfig } from "../scripts/generate-deploy-config.ts";

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
  assert.equal(generated.vars.CORS_POLICY, "[]");
  assert.equal(generated.previews.r2_buckets[0].bucket_name, "catalog-a-preview");
  assert.equal(generated.env.preview.name, "media-catalog-a-preview");
  assert.equal(generated.env.preview.vars.CORS_POLICY, "[]");
  assert.equal(generated.env.preview.r2_buckets[0].bucket_name, "catalog-a-preview");
});

test("Worker deploy config uses the template name when no project name is provided", () => {
  const generated = parse(
    buildDeployConfig(source, {
      DEPLOY_R2_BUCKET_NAME: "catalog-a",
      DEPLOY_R2_PREVIEW_BUCKET_NAME: "catalog-a-preview",
    }),
  );

  assert.equal(generated.name, "komikhq-media-worker");
  assert.equal(generated.env.preview.name, "komikhq-media-worker-preview");
});
