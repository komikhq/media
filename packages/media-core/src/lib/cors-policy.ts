import type { CorsRule } from "../types/index.js";

const HTTP_TOKEN = /^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/u;
const MEDIA_METHODS = ["GET", "HEAD"] as const;

function isMediaMethod(method: string): method is (typeof MEDIA_METHODS)[number] {
  return MEDIA_METHODS.some((allowedMethod) => allowedMethod === method);
}

function stringArray(
  value: unknown,
  field: string,
  required: boolean,
): string[] {
  if (value === undefined && !required) {
    return [];
  }
  if (
    !Array.isArray(value) ||
    value.some((item) => typeof item !== "string" || item.length === 0)
  ) {
    throw new Error(`CORS_POLICY ${field} must be an array of non-empty strings`);
  }
  return value;
}

function isValidOriginPattern(pattern: string): boolean {
  if (pattern === "*") {
    return true;
  }
  if (
    !/^https?:\/\/[^/?#]+$/iu.test(pattern) ||
    (pattern.match(/\*/gu)?.length ?? 0) > 1
  ) {
    return false;
  }

  try {
    const candidate = pattern.replace("*", "cors-wildcard");
    const url = new URL(candidate);
    return (
      (url.protocol === "http:" || url.protocol === "https:") &&
      url.username === "" &&
      url.password === "" &&
      url.pathname === "/" &&
      url.search === "" &&
      url.hash === "" &&
      (!pattern.includes("*") || url.hostname.includes("cors-wildcard"))
    );
  } catch {
    return false;
  }
}

export function parseCorsPolicy(policyJson: string | undefined): CorsRule[] {
  if (policyJson === undefined || policyJson.trim() === "") {
    return [];
  }

  const parsed: unknown = JSON.parse(policyJson);
  if (!Array.isArray(parsed)) {
    throw new Error("CORS_POLICY must be a JSON array");
  }

  return parsed.map((value, index) => {
    if (value === null || typeof value !== "object" || Array.isArray(value)) {
      throw new Error(`CORS_POLICY rule ${index} must be an object`);
    }
    const rule = value as Record<string, unknown>;
    const allowedOrigins = stringArray(rule.AllowedOrigins, "AllowedOrigins", true);
    const allowedMethods = stringArray(rule.AllowedMethods, "AllowedMethods", true)
      .map((method) => method.toUpperCase());
    const allowedHeaders = stringArray(rule.AllowedHeaders, "AllowedHeaders", false);
    const exposeHeaders = stringArray(rule.ExposeHeaders, "ExposeHeaders", false);
    const maxAgeSeconds = rule.MaxAgeSeconds;

    if (allowedOrigins.some((origin) => !isValidOriginPattern(origin))) {
      throw new Error(`CORS_POLICY rule ${index} contains an invalid AllowedOrigins value`);
    }
    if (allowedMethods.some((method) => !HTTP_TOKEN.test(method))) {
      throw new Error(`CORS_POLICY rule ${index} contains an invalid AllowedMethods value`);
    }
    for (const [field, headers] of [
      ["AllowedHeaders", allowedHeaders],
      ["ExposeHeaders", exposeHeaders],
    ] as const) {
      if (headers.some((header) => !HTTP_TOKEN.test(header) && header !== "*")) {
        throw new Error(`CORS_POLICY rule ${index} contains an invalid ${field} value`);
      }
    }
    if (
      maxAgeSeconds !== undefined &&
      (typeof maxAgeSeconds !== "number" ||
        !Number.isSafeInteger(maxAgeSeconds) ||
        maxAgeSeconds < 0)
    ) {
      throw new Error(`CORS_POLICY rule ${index} has an invalid MaxAgeSeconds value`);
    }

    return {
      allowedOrigins,
      allowedMethods,
      allowedHeaders,
      exposeHeaders,
      ...(maxAgeSeconds === undefined ? {} : { maxAgeSeconds }),
    };
  });
}

function originMatches(pattern: string, origin: string): boolean {
  const validOrigin =
    origin === "null" ||
    (!origin.includes("*") && isValidOriginPattern(origin));
  if (!validOrigin) {
    return false;
  }
  if (pattern === "*") {
    return true;
  }
  const expression = new RegExp(
    `^${pattern.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&").replace("\\*", ".*")}$`,
    "u",
  );
  return expression.test(origin);
}

export function findCorsRule(
  rules: CorsRule[],
  origin: string,
  method: string,
  requestedHeaders: string[] = [],
): CorsRule | undefined {
  return rules.find((rule) => {
    if (
      !rule.allowedOrigins.some((pattern) => originMatches(pattern, origin)) ||
      !rule.allowedMethods.includes(method.toUpperCase())
    ) {
      return false;
    }

    const allowedHeaders = rule.allowedHeaders.map((header) => header.toLowerCase());
    return requestedHeaders.every((header) =>
      allowedHeaders.includes(header.toLowerCase()) ||
      (allowedHeaders.includes("*") && header.toLowerCase() !== "authorization"),
    );
  });
}

function setVaryOrigin(headers: Headers): void {
  const vary = headers.get("Vary");
  if (!vary?.split(",").some((value) => value.trim().toLowerCase() === "origin")) {
    headers.append("Vary", "Origin");
  }
}

function corsOriginValue(rule: CorsRule, origin: string): string {
  return rule.allowedOrigins.includes("*") ? "*" : origin;
}

export function addCorsHeaders(
  response: Response,
  rule: CorsRule,
  origin: string,
): Response {
  const headers = new Headers(response.headers);
  headers.set("Access-Control-Allow-Origin", corsOriginValue(rule, origin));
  if (rule.exposeHeaders.length > 0) {
    headers.set("Access-Control-Expose-Headers", rule.exposeHeaders.join(", "));
  }
  if (corsOriginValue(rule, origin) !== "*") {
    setVaryOrigin(headers);
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function preflightResponse(request: Request, rules: CorsRule[]): Response {
  const origin = request.headers.get("Origin");
  const method = request.headers.get("Access-Control-Request-Method");
  const requestedHeaders = (request.headers.get("Access-Control-Request-Headers") ?? "")
    .split(",")
    .map((header) => header.trim())
    .filter(Boolean);

  if (!origin || !method) {
    return new Response(null, { status: 400, headers: { "Cache-Control": "no-store" } });
  }

  const rule = findCorsRule(rules, origin, method, requestedHeaders);
  if (!rule || !isMediaMethod(method.toUpperCase())) {
    return new Response(null, { status: 403, headers: { "Cache-Control": "no-store" } });
  }

  const headers = new Headers({
    "Access-Control-Allow-Origin": corsOriginValue(rule, origin),
    "Access-Control-Allow-Methods": rule.allowedMethods
      .filter(isMediaMethod)
      .join(", "),
    "Cache-Control": "no-store",
  });
  if (requestedHeaders.length > 0) {
    const allowedHeaders = rule.allowedHeaders.map((header) => header.toLowerCase());
    headers.set(
      "Access-Control-Allow-Headers",
      allowedHeaders.includes("*")
        ? requestedHeaders.join(", ")
        : rule.allowedHeaders.join(", "),
    );
  }
  if (rule.maxAgeSeconds !== undefined) {
    headers.set("Access-Control-Max-Age", String(rule.maxAgeSeconds));
  }
  if (corsOriginValue(rule, origin) !== "*") {
    setVaryOrigin(headers);
  }

  return new Response(null, { status: 204, headers });
}

export function handleCorsPreflight(request: Request, rules: CorsRule[]): Response {
  return preflightResponse(request, rules);
}
