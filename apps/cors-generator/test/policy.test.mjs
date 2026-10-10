import assert from "node:assert/strict";
import test from "node:test";
import {
  createPolicy,
  parseList,
  serializePolicy,
  validateDraft,
} from "../src/lib/cors-policy.ts";

const validDraft = {
  origins: "https://app.example.com\nhttps://admin.example.com",
  methods: ["GET", "HEAD"],
  allowedHeaders: "Authorization, Content-Type",
  exposeHeaders: "ETag\nLast-Modified",
  maxAgeSeconds: "3600",
};

test("parses comma- and newline-separated values without duplicates", () => {
  assert.deepEqual(parseList("ETag, Last-Modified\nETag"), [
    "ETag",
    "Last-Modified",
  ]);
});

test("creates a JSON policy compatible with the R2 policy shape", () => {
  const policy = createPolicy(validDraft);

  assert.deepEqual(policy, {
    AllowedOrigins: ["https://app.example.com", "https://admin.example.com"],
    AllowedMethods: ["GET", "HEAD"],
    AllowedHeaders: ["Authorization", "Content-Type"],
    ExposeHeaders: ["ETag", "Last-Modified"],
    MaxAgeSeconds: 3600,
  });
  assert.deepEqual(JSON.parse(serializePolicy(policy)), [policy]);
});

test("serializes the policy as compact JSON when minification is enabled", () => {
  const policy = createPolicy(validDraft);

  assert.equal(serializePolicy(policy, true), JSON.stringify([policy]));
  assert.match(serializePolicy(policy, false), /\n/u);
  assert.doesNotMatch(serializePolicy(policy, true), /\n/u);
});

test("reports missing origins and methods", () => {
  assert.match(
    validateDraft({ ...validDraft, origins: "" }) ?? "",
    /at least one allowed origin/u,
  );
  assert.match(
    validateDraft({ ...validDraft, methods: [] }) ?? "",
    /at least one allowed method/u,
  );
});

test("rejects negative, fractional, and unsafe max ages", () => {
  for (const maxAgeSeconds of ["-1", "1.5", "9007199254740992"]) {
    assert.match(
      validateDraft({ ...validDraft, maxAgeSeconds }) ?? "",
      /non-negative whole number/u,
    );
  }
});
