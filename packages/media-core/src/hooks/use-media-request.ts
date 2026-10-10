import {
  addCorsHeaders,
  findCorsRule,
  handleCorsPreflight,
  parseCorsPolicy,
} from "../lib/cors-policy.js";
import { errorResponseForRequest, responseForObject } from "../lib/media-response.js";
import { objectKeyFromPath } from "../lib/object-key.js";
import type { CorsRule, R2BucketReader } from "../types/index.js";

async function fetchMedia(
  request: Request,
  bucket: R2BucketReader,
): Promise<Response> {
  if (request.method !== "GET" && request.method !== "HEAD") {
    return errorResponseForRequest(request, 405, { Allow: "GET, HEAD" });
  }

  const key = objectKeyFromPath(new URL(request.url).pathname);
  if (key === null) {
    return errorResponseForRequest(request, 400);
  }

  try {
    const object =
      request.method === "HEAD"
        ? await bucket.head(key)
        : await bucket.get(key);

    if (object === null) {
      return errorResponseForRequest(request, 404);
    }

    if (request.method === "HEAD") {
      return responseForObject(object, null);
    }

    if (object.body === undefined) {
      throw new Error(`R2 returned no body for GET key "${key}"`);
    }

    return responseForObject(object, object.body);
  } catch (error) {
    const requestId = request.headers.get("cf-ray") ?? request.headers.get("x-request-id");
    console.error("Media delivery failed", { requestId, error });
    return errorResponseForRequest(request, 500);
  }
}

export async function handleMediaRequest(
  request: Request,
  bucket: R2BucketReader,
  corsPolicyJson?: string,
): Promise<Response> {
  let corsRules: CorsRule[];
  try {
    corsRules = parseCorsPolicy(corsPolicyJson);
  } catch (error) {
    console.error("Invalid media CORS policy", error);
    return errorResponseForRequest(request, 500);
  }

  if (request.method === "OPTIONS") {
    return handleCorsPreflight(request, corsRules);
  }

  const response = await fetchMedia(request, bucket);
  const origin = request.headers.get("Origin");
  if (!origin) {
    return response;
  }

  const rule = findCorsRule(corsRules, origin, request.method);
  return rule ? addCorsHeaders(response, rule, origin) : response;
}
