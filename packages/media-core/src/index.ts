const CACHE_CONTROL =
  "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800";

interface R2ObjectMetadata {
  readonly size: number;
  readonly httpEtag: string;
  readonly uploaded: Date;
  readonly body?: ReadableStream<Uint8Array>;
  writeHttpMetadata(headers: Headers): void;
}

interface R2BucketReader {
  get(key: string): Promise<R2ObjectMetadata | null>;
  head(key: string): Promise<R2ObjectMetadata | null>;
}

export function objectKeyFromPath(pathname: string): string | null {
  if (!pathname.startsWith("/") || pathname.includes("\\") || pathname.includes("?")) {
    return null;
  }

  if (pathname === "/") {
    return "index.html";
  }

  const encodedSegments = pathname.slice(1).split("/");
  if (encodedSegments.some((segment) => segment.length === 0)) {
    return null;
  }

  const segments: string[] = [];
  for (const encodedSegment of encodedSegments) {
    let segment: string;
    try {
      segment = decodeURIComponent(encodedSegment);
    } catch {
      return null;
    }

    if (
      segment === "." ||
      segment === ".." ||
      segment.includes("/") ||
      segment.includes("\\") ||
      /[\u0000-\u001f\u007f]/u.test(segment)
    ) {
      return null;
    }

    segments.push(segment);
  }

  return segments.join("/");
}

function responseForObject(
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

function errorResponse(status: number, headers?: HeadersInit): Response {
  const responseHeaders = new Headers(headers);
  responseHeaders.set("Cache-Control", "no-store");
  return new Response(null, { status, headers: responseHeaders });
}

export async function handleMediaRequest(
  request: Request,
  bucket: R2BucketReader,
): Promise<Response> {
  if (request.method !== "GET" && request.method !== "HEAD") {
    return errorResponse(405, { Allow: "GET, HEAD" });
  }

  const key = objectKeyFromPath(new URL(request.url).pathname);
  if (key === null) {
    return errorResponse(400);
  }

  const object =
    request.method === "HEAD"
      ? await bucket.head(key)
      : await bucket.get(key);

  if (object === null) {
    return errorResponse(404);
  }

  if (request.method === "HEAD") {
    return responseForObject(object, null);
  }

  if (object.body === undefined) {
    throw new Error(`R2 returned no body for GET key "${key}"`);
  }

  return responseForObject(object, object.body);
}
