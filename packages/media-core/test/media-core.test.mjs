import assert from "node:assert/strict";
import test from "node:test";
import { handleMediaRequest, objectKeyFromPath } from "../src/index.ts";

test("maps root and URL-encoded paths to object keys", () => {
  assert.equal(objectKeyFromPath("/"), "index.html");
  assert.equal(objectKeyFromPath("/chapters/one/page%201.webp"), "chapters/one/page 1.webp");
});

test("rejects malformed, ambiguous, and traversing paths", () => {
  for (const path of [
    "",
    "chapter/page.webp",
    "/../private.jpg",
    "/%2e%2e/private.jpg",
    "/chapter//page.webp",
    "/chapter/",
    "/chapter%2Fpage.webp",
    "/chapter%5Cpage.webp",
    "/bad%ZZ",
    "/control%00char",
  ]) {
    assert.equal(objectKeyFromPath(path), null, `expected ${path} to be rejected`);
  }
});

function makeObject(body = "image bytes") {
  const encoded = new TextEncoder().encode(body);
  return {
    body: new ReadableStream({
      start(controller) {
        controller.enqueue(encoded);
        controller.close();
      },
    }),
    size: encoded.byteLength,
    httpEtag: '"media-etag"',
    uploaded: new Date("2026-09-01T12:34:56.000Z"),
    writeHttpMetadata(headers) {
      headers.set("Content-Type", "image/webp");
      headers.set("Content-Language", "en");
    },
  };
}

test("GET streams the object with metadata and cache headers", async () => {
  const object = makeObject();
  const calls = [];
  const bucket = {
    async get(key) {
      calls.push(["get", key]);
      return object;
    },
    async head(key) {
      calls.push(["head", key]);
      return object;
    },
  };

  const response = await handleMediaRequest(
    new Request("https://media.example/chapters/one/page.webp?download=1"),
    bucket,
  );

  assert.deepEqual(calls, [["get", "chapters/one/page.webp"]]);
  assert.equal(await response.text(), "image bytes");
  assert.equal(response.headers.get("Content-Type"), "image/webp");
  assert.equal(response.headers.get("Content-Language"), "en");
  assert.equal(response.headers.get("ETag"), '"media-etag"');
  assert.equal(response.headers.get("Last-Modified"), "Tue, 01 Sep 2026 12:34:56 GMT");
  assert.equal(response.headers.get("Content-Length"), "11");
  assert.equal(
    response.headers.get("Cache-Control"),
    "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800",
  );
});

test("HEAD returns object metadata without requesting a body", async () => {
  const object = makeObject();
  const calls = [];
  const bucket = {
    async get(key) {
      calls.push(["get", key]);
      return object;
    },
    async head(key) {
      calls.push(["head", key]);
      return object;
    },
  };

  const response = await handleMediaRequest(
    new Request("https://media.example/cover.webp", { method: "HEAD" }),
    bucket,
  );

  assert.deepEqual(calls, [["head", "cover.webp"]]);
  assert.equal(response.status, 200);
  assert.equal(response.body, null);
  assert.equal(response.headers.get("Content-Length"), "11");
});

test("unsupported methods return 405 with Allow and never access R2", async () => {
  const response = await handleMediaRequest(
    new Request("https://media.example/cover.webp", { method: "POST" }),
    {
      async get() {
        assert.fail("POST must not access R2");
      },
      async head() {
        assert.fail("POST must not access R2");
      },
    },
  );

  assert.equal(response.status, 405);
  assert.equal(response.headers.get("Allow"), "GET, HEAD");
  assert.equal(response.headers.get("Cache-Control"), "no-store");
});

test("CORS policy adds configured headers to allowed object responses", async () => {
  const response = await handleMediaRequest(
    new Request("https://media.example/cover.webp", {
      headers: { Origin: "https://app.example.com" },
    }),
    {
      async get() {
        return makeObject();
      },
      async head() {
        return null;
      },
    },
    JSON.stringify([
      {
        AllowedOrigins: ["https://app.example.com"],
        AllowedMethods: ["GET", "HEAD"],
        ExposeHeaders: ["ETag", "Content-Length"],
      },
    ]),
  );

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("Access-Control-Allow-Origin"), "https://app.example.com");
  assert.equal(response.headers.get("Access-Control-Expose-Headers"), "ETag, Content-Length");
  assert.equal(response.headers.get("Vary"), "Origin");
});

test("CORS preflight validates configured origin, method, and headers without accessing R2", async () => {
  const bucket = {
    async get() {
      assert.fail("preflight must not access R2");
    },
    async head() {
      assert.fail("preflight must not access R2");
    },
  };
  const policy = JSON.stringify([
    {
      AllowedOrigins: ["https://*.example.com"],
      AllowedMethods: ["GET", "HEAD"],
      AllowedHeaders: ["Content-Type", "X-Requested-By"],
      ExposeHeaders: ["ETag"],
      MaxAgeSeconds: 3600,
    },
  ]);
  const response = await handleMediaRequest(
    new Request("https://media.example/cover.webp", {
      method: "OPTIONS",
      headers: {
        Origin: "https://reader.app.example.com",
        "Access-Control-Request-Method": "GET",
        "Access-Control-Request-Headers": "content-type, x-requested-by",
      },
    }),
    bucket,
    policy,
  );

  assert.equal(response.status, 204);
  assert.equal(
    response.headers.get("Access-Control-Allow-Origin"),
    "https://reader.app.example.com",
  );
  assert.equal(response.headers.get("Access-Control-Allow-Methods"), "GET, HEAD");
  assert.equal(
    response.headers.get("Access-Control-Allow-Headers"),
    "Content-Type, X-Requested-By",
  );
  assert.equal(response.headers.get("Access-Control-Max-Age"), "3600");
  assert.equal(response.headers.get("Vary"), "Origin");
});

test("CORS rejects origins, methods, and headers outside the policy", async () => {
  const bucket = {
    async get() {
      assert.fail("preflight must not access R2");
    },
    async head() {
      assert.fail("preflight must not access R2");
    },
  };
  const policy = JSON.stringify([
    {
      AllowedOrigins: ["https://app.example.com"],
      AllowedMethods: ["GET"],
      AllowedHeaders: ["Content-Type"],
    },
  ]);

  for (const [origin, method, headers] of [
    ["https://other.example.com", "GET", ""],
    ["https://app.example.com", "HEAD", ""],
    ["https://app.example.com", "GET", "authorization"],
  ]) {
    const response = await handleMediaRequest(
      new Request("https://media.example/cover.webp", {
        method: "OPTIONS",
        headers: {
          Origin: origin,
          "Access-Control-Request-Method": method,
          ...(headers ? { "Access-Control-Request-Headers": headers } : {}),
        },
      }),
      bucket,
      policy,
    );
    assert.equal(response.status, 403);
    assert.equal(response.headers.get("Access-Control-Allow-Origin"), null);
  }
});

test("CORS applies to error responses only when the request matches the policy", async () => {
  const response = await handleMediaRequest(
    new Request("https://media.example/missing.webp", {
      headers: { Origin: "https://app.example.com" },
    }),
    {
      async get() {
        return null;
      },
      async head() {
        return null;
      },
    },
    JSON.stringify([
      {
        AllowedOrigins: ["*"],
        AllowedMethods: ["GET"],
      },
    ]),
  );

  assert.equal(response.status, 404);
  assert.equal(response.headers.get("Access-Control-Allow-Origin"), "*");
  assert.equal(response.headers.get("Vary"), null);
});

test("invalid CORS configuration returns a logged non-cacheable 500", async () => {
  const originalConsoleError = console.error;
  const logs = [];
  console.error = (...args) => logs.push(args);
  try {
    const response = await handleMediaRequest(
      new Request("https://media.example/cover.webp"),
      {
        async get() {
          assert.fail("invalid policy must not access R2");
        },
        async head() {
          assert.fail("invalid policy must not access R2");
        },
      },
      '{"AllowedOrigins":',
    );

    assert.equal(response.status, 500);
    assert.equal(response.headers.get("Cache-Control"), "no-store");
    assert.equal(logs.length, 1);
    assert.equal(logs[0][0], "Invalid media CORS policy");
  } finally {
    console.error = originalConsoleError;
  }
});

test("browser errors return the branded HTML page with a safe Ray ID", async () => {
  const response = await handleMediaRequest(
    new Request("https://media.example/not-found.webp", {
      headers: {
        Accept: "text/html",
        "cf-ray": 'ray-<script>alert("x")</script>',
      },
    }),
    {
      async get() {
        return null;
      },
      async head() {
        return null;
      },
    },
  );

  const html = await response.text();
  assert.equal(response.status, 404);
  assert.equal(response.headers.get("Content-Type"), "text/html; charset=utf-8");
  assert.equal(response.headers.get("Cache-Control"), "no-store");
  assert.match(html, /We could not find that media/u);
  assert.match(html, /HTTP 404/u);
  assert.match(html, /ray-&lt;script&gt;alert\(&quot;x&quot;\)&lt;\/script&gt;/u);
  assert.doesNotMatch(html, /<script>alert/u);
  assert.match(html, /prefers-color-scheme: dark/u);
  assert.match(html, /<svg/u);
});

test("browser method errors return the branded page and preserve Allow", async () => {
  const response = await handleMediaRequest(
    new Request("https://media.example/cover.webp", {
      method: "POST",
      headers: { Accept: "text/html" },
    }),
    {
      async get() {
        assert.fail("unsupported methods must not access R2");
      },
      async head() {
        assert.fail("unsupported methods must not access R2");
      },
    },
  );

  assert.equal(response.status, 405);
  assert.equal(response.headers.get("Allow"), "GET, HEAD");
  assert.equal(response.headers.get("Cache-Control"), "no-store");
  assert.match(await response.text(), /This request method is not supported/u);
});

test("non-browser errors return JSON and preserve request IDs", async () => {
  const response = await handleMediaRequest(
    new Request("https://media.example/not-found.webp", {
      headers: { Accept: "application/json", "cf-ray": "ray-id-123" },
    }),
    {
      async get() {
        return null;
      },
      async head() {
        return null;
      },
    },
  );

  assert.equal(response.status, 404);
  assert.equal(response.headers.get("Content-Type"), "application/json; charset=utf-8");
  assert.deepEqual(await response.json(), {
    error: "NOT_FOUND",
    message: "The file may have moved, or the address may be incorrect.",
    requestId: "ray-id-123",
  });
});

test("invalid paths return 400 and missing objects return 404", async () => {
  const calls = [];
  const bucket = {
    async get(key) {
      calls.push(key);
      return null;
    },
    async head(key) {
      calls.push(key);
      return null;
    },
  };

  const invalid = await handleMediaRequest(
    new Request("https://media.example/chapter%2Fpage.webp"),
    bucket,
  );
  const missing = await handleMediaRequest(
    new Request("https://media.example/not-found.webp"),
    bucket,
  );

  assert.equal(invalid.status, 400);
  assert.equal(invalid.headers.get("Cache-Control"), "no-store");
  assert.equal(missing.status, 404);
  assert.equal(missing.headers.get("Cache-Control"), "no-store");
  assert.deepEqual(calls, ["not-found.webp"]);
});

test("R2 read failures return a generic, non-cacheable 500 and log the failure", async () => {
  const failure = new Error("R2 unavailable");
  const originalConsoleError = console.error;
  const logs = [];
  console.error = (...args) => logs.push(args);
  try {
    const response = await handleMediaRequest(
      new Request("https://media.example/cover.webp", {
        headers: { Accept: "application/json", "cf-ray": "ray-error-456" },
      }),
      {
        async get() {
          throw failure;
        },
        async head() {
          throw failure;
        },
      },
    );

    assert.equal(response.status, 500);
    assert.equal(response.headers.get("Cache-Control"), "no-store");
    assert.deepEqual(await response.json(), {
      error: "INTERNAL_ERROR",
      message: "Something went wrong while retrieving the file. Please try again shortly.",
      requestId: "ray-error-456",
    });
    assert.equal(logs.length, 1);
    assert.equal(logs[0][0], "Media delivery failed");
    assert.equal(logs[0][1].error, failure);
  } finally {
    console.error = originalConsoleError;
  }
});
