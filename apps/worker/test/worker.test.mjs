import assert from "node:assert/strict";
import test from "node:test";
import worker from "../src/index.ts";

test("standalone Worker uses the shared R2 delivery behavior", async () => {
  const calls = [];
  const object = {
    body: new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode("worker image"));
        controller.close();
      },
    }),
    size: 12,
    httpEtag: '"worker-etag"',
    uploaded: new Date("2026-09-01T12:34:56.000Z"),
    writeHttpMetadata(headers) {
      headers.set("Content-Type", "image/webp");
    },
  };

  const response = await worker.fetch(
    new Request("https://media.example/chapter/page.webp", {
      headers: { Origin: "https://app.example.com" },
    }),
    {
      CORS_POLICY: JSON.stringify([
        {
          AllowedOrigins: ["https://app.example.com"],
          AllowedMethods: ["GET", "HEAD"],
        },
      ]),
      MEDIA_BUCKET: {
        async get(key) {
          calls.push(["get", key]);
          return object;
        },
        async head(key) {
          calls.push(["head", key]);
          return object;
        },
      },
    },
  );

  assert.deepEqual(calls, [["get", "chapter/page.webp"]]);
  assert.equal(response.status, 200);
  assert.equal(await response.text(), "worker image");
  assert.equal(response.headers.get("Access-Control-Allow-Origin"), "https://app.example.com");
  assert.equal(response.headers.get("ETag"), '"worker-etag"');
  assert.equal(
    response.headers.get("Cache-Control"),
    "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800",
  );
});
