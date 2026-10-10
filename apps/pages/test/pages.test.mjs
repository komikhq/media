import assert from "node:assert/strict";
import test from "node:test";
import { onRequest as onCatchAllRequest } from "../functions/[[path]].ts";
import { onRequest as onRootRequest } from "../functions/index.ts";

function makeBucket() {
  const calls = [];
  const object = {
    body: new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode("page image"));
        controller.close();
      },
    }),
    size: 10,
    httpEtag: '"pages-etag"',
    uploaded: new Date("2026-09-01T12:34:56.000Z"),
    writeHttpMetadata(headers) {
      headers.set("Content-Type", "image/webp");
    },
  };

  return {
    calls,
    bucket: {
      async get(key) {
        calls.push(["get", key]);
        return object;
      },
      async head(key) {
        calls.push(["head", key]);
        return object;
      },
    },
  };
}

test("Pages root and catch-all use the shared R2 delivery behavior", async () => {
  const { bucket, calls } = makeBucket();
  const corsPolicy = JSON.stringify([
    {
      AllowedOrigins: ["https://app.example.com"],
      AllowedMethods: ["GET", "HEAD"],
    },
  ]);
  const root = await onRootRequest({
    request: new Request("https://media.example/", {
      headers: { Origin: "https://app.example.com" },
    }),
    env: { MEDIA_BUCKET: bucket, CORS_POLICY: corsPolicy },
  });
  const image = await onCatchAllRequest({
    request: new Request("https://media.example/chapters/ch1/page.webp", {
      headers: { Origin: "https://app.example.com" },
    }),
    env: { MEDIA_BUCKET: bucket, CORS_POLICY: corsPolicy },
  });

  assert.deepEqual(calls, [
    ["get", "index.html"],
    ["get", "chapters/ch1/page.webp"],
  ]);
  assert.equal(root.status, 200);
  assert.equal(await root.text(), "page image");
  assert.equal(root.headers.get("Access-Control-Allow-Origin"), "https://app.example.com");
  assert.equal(image.headers.get("ETag"), '"pages-etag"');
  assert.equal(image.headers.get("Access-Control-Allow-Origin"), "https://app.example.com");
  assert.equal(
    image.headers.get("Cache-Control"),
    "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800",
  );
});
