import { renderMediaErrorPage } from "@komikhq/ui/media-error-page";
import type { ErrorDetail, R2ObjectMetadata } from "../types/index.js";

const CACHE_CONTROL =
  "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800";

const ERROR_DETAILS: Record<number, ErrorDetail> = {
  400: {
    code: "BAD_REQUEST",
    title: "That request does not look right",
    description: "Check the URL and try again. The requested path could not be understood.",
  },
  404: {
    code: "NOT_FOUND",
    title: "We could not find that media",
    description: "The file may have moved, or the address may be incorrect.",
  },
  405: {
    code: "METHOD_NOT_ALLOWED",
    title: "This request method is not supported",
    description: "This media endpoint only accepts GET and HEAD requests.",
  },
  500: {
    code: "INTERNAL_ERROR",
    title: "We could not load this media",
    description: "Something went wrong while retrieving the file. Please try again shortly.",
  },
};

export function responseForObject(
  object: R2ObjectMetadata,
  body: BodyInit | null,
): Response {
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("ETag", object.httpEtag);
  headers.set("Last-Modified", object.uploaded.toUTCString());
  headers.set("Content-Length", String(object.size));
  headers.set("Cache-Control", CACHE_CONTROL);

  return new Response(body, { headers });
}

export function errorResponseForRequest(
  request: Request,
  status: number,
  headers?: HeadersInit,
): Response {
  const responseHeaders = new Headers(headers);
  responseHeaders.set("Cache-Control", "no-store");
  const requestId = request.headers.get("cf-ray") ?? request.headers.get("x-request-id");
  const detail = ERROR_DETAILS[status] ?? ERROR_DETAILS[500];

  if (request.headers.get("accept")?.includes("text/html")) {
    responseHeaders.set("Content-Type", "text/html; charset=utf-8");
    const body = request.method === "HEAD"
      ? null
      : renderMediaErrorPage({ status, ...detail, requestId });
    return new Response(body, { status, headers: responseHeaders });
  }

  responseHeaders.set("Content-Type", "application/json; charset=utf-8");
  return new Response(
    request.method === "HEAD"
      ? null
      : JSON.stringify({
          error: detail.code,
          message: detail.description,
          ...(requestId ? { requestId } : {}),
        }),
    { status, headers: responseHeaders },
  );
}
