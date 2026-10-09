import { CircleAlert, FileQuestion, House, ServerCrash, ShieldAlert } from "lucide";

const CACHE_CONTROL =
  "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800";

const ERROR_DETAILS: Record<
  number,
  { code: string; title: string; description: string; icon: IconNode }
> = {
  400: {
    code: "BAD_REQUEST",
    title: "That request does not look right",
    description: "Check the URL and try again. The requested path could not be understood.",
    icon: CircleAlert,
  },
  404: {
    code: "NOT_FOUND",
    title: "We could not find that media",
    description: "The file may have moved, or the address may be incorrect.",
    icon: FileQuestion,
  },
  405: {
    code: "METHOD_NOT_ALLOWED",
    title: "This request method is not supported",
    description: "This media endpoint only accepts GET and HEAD requests.",
    icon: ShieldAlert,
  },
  500: {
    code: "INTERNAL_ERROR",
    title: "We could not load this media",
    description: "Something went wrong while retrieving the file. Please try again shortly.",
    icon: ServerCrash,
  },
};

type IconNode = readonly [
  string,
  Readonly<Record<string, string | number | undefined>>,
][];

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

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/gu, (character) => {
    switch (character) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      default:
        return "&#39;";
    }
  });
}

function renderIcon(icon: IconNode): string {
  const children = icon
    .map(([tag, attributes]) => {
      const serializedAttributes = Object.entries(attributes)
        .filter(([, value]) => value !== undefined)
        .map(([name, value]) => ` ${name}="${escapeHtml(String(value))}"`)
        .join("");
      return `<${tag}${serializedAttributes}/>`;
    })
    .join("");

  return `<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${children}</svg>`;
}

function renderErrorPage(status: number, requestId: string | null): string {
  const detail = ERROR_DETAILS[status] ?? ERROR_DETAILS[500];
  const requestIdMarkup = requestId
    ? `<div class="request-meta"><span>Ray ID</span><code>${escapeHtml(requestId)}</code></div>`
    : "";

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="color-scheme" content="light dark">
    <meta name="theme-color" content="#ffffff" media="(prefers-color-scheme: light)">
    <meta name="theme-color" content="#09090b" media="(prefers-color-scheme: dark)">
    <title>${status} ${detail.code.replaceAll("_", " ")}</title>
    <link rel="icon" href="/favicon.svg" type="image/svg+xml">
    <style>
      :root {
        color-scheme: light dark;
        font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        font-synthesis: none;
        text-rendering: optimizeLegibility;
        -webkit-font-smoothing: antialiased;
        --background: #fff;
        --foreground: #09090b;
        --muted: #71717a;
        --border: #e4e4e7;
        --surface: #fafafa;
        --accent: #c2410c;
        --accent-soft: #fff7ed;
        --ring: #c2410c;
      }
      @media (prefers-color-scheme: dark) {
        :root {
          --background: #09090b;
          --foreground: #fafafa;
          --muted: #a1a1aa;
          --border: #27272a;
          --surface: #111113;
          --accent: #fb923c;
          --accent-soft: #1c1510;
          --ring: #fb923c;
        }
      }
      * { box-sizing: border-box; }
      body {
        min-width: 320px;
        min-height: 100vh;
        margin: 0;
        background: var(--background);
        color: var(--foreground);
      }
      .shell {
        display: flex;
        min-height: 100vh;
        flex-direction: column;
        width: min(100% - 48px, 1080px);
        margin: 0 auto;
      }
      header {
        display: flex;
        height: 88px;
        align-items: center;
        border-bottom: 1px solid var(--border);
      }
      .brand {
        display: inline-flex;
        align-items: center;
        gap: 12px;
        color: var(--foreground);
        font-size: 15px;
        font-weight: 650;
        letter-spacing: -.025em;
        text-decoration: none;
      }
      .brand img { width: 34px; height: 34px; object-fit: contain; }
      main {
        display: grid;
        flex: 1;
        align-content: center;
        justify-items: center;
        padding: 72px 0 88px;
      }
      .content { width: min(100%, 560px); }
      .status {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        min-height: 30px;
        padding: 4px 10px;
        border: 1px solid color-mix(in srgb, var(--accent) 24%, var(--border));
        border-radius: 999px;
        background: var(--accent-soft);
        color: var(--accent);
        font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
        font-size: 12px;
        font-weight: 600;
        letter-spacing: .04em;
      }
      .status svg { width: 15px; height: 15px; }
      h1 {
        margin: 24px 0 12px;
        font-size: clamp(2rem, 6vw, 3.25rem);
        font-weight: 650;
        letter-spacing: -.055em;
        line-height: 1.08;
      }
      .description {
        max-width: 480px;
        margin: 0;
        color: var(--muted);
        font-size: 16px;
        line-height: 1.75;
      }
      .details {
        display: flex;
        align-items: center;
        gap: 10px;
        margin-top: 32px;
        padding: 16px;
        border: 1px solid var(--border);
        border-radius: 10px;
        background: var(--surface);
      }
      .details-icon { display: grid; width: 32px; height: 32px; place-items: center; color: var(--muted); }
      .details-icon svg { width: 18px; height: 18px; }
      .details-copy { display: grid; gap: 3px; }
      .details-copy strong { font-size: 13px; font-weight: 600; }
      .details-copy span { color: var(--muted); font-size: 12px; }
      .request-meta {
        display: flex;
        flex-wrap: wrap;
        justify-content: space-between;
        gap: 8px;
        margin-top: 18px;
        color: var(--muted);
        font-size: 12px;
      }
      .request-meta code {
        max-width: 100%;
        overflow-wrap: anywhere;
        color: var(--foreground);
        font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      }
      footer {
        display: flex;
        min-height: 68px;
        align-items: center;
        justify-content: space-between;
        gap: 16px;
        border-top: 1px solid var(--border);
        color: var(--muted);
        font-size: 12px;
      }
      .footer-status { display: inline-flex; align-items: center; gap: 8px; }
      .footer-status svg { width: 15px; height: 15px; }
      @media (max-width: 520px) {
        .shell { width: min(100% - 32px, 1080px); }
        header { height: 72px; }
        main { justify-items: start; padding: 56px 0 64px; }
        footer { align-items: flex-start; flex-direction: column; justify-content: center; padding: 16px 0; }
      }
      @media (prefers-reduced-motion: reduce) {
        *, *::before, *::after { scroll-behavior: auto !important; }
      }
    </style>
  </head>
  <body>
    <div class="shell">
      <header>
        <div class="brand">
          <picture>
            <source srcset="/logo-mark-dark.svg" media="(prefers-color-scheme: dark)">
            <img src="/logo-mark-light.svg" alt="">
          </picture>
          <span>KomikHQ Media</span>
        </div>
      </header>
      <main>
        <section class="content" aria-labelledby="error-title">
          <div class="status">${renderIcon(detail.icon)}<span>HTTP ${status}</span></div>
          <h1 id="error-title">${detail.title}</h1>
          <p class="description">${detail.description}</p>
          <div class="details">
            <span class="details-icon">${renderIcon(House)}</span>
            <div class="details-copy">
              <strong>Media delivery</strong>
              <span>The requested file was not delivered.</span>
            </div>
          </div>
          ${requestIdMarkup}
        </section>
      </main>
      <footer>
        <span>KomikHQ Media</span>
        <span class="footer-status">${renderIcon(House)}Media delivery service</span>
      </footer>
    </div>
  </body>
</html>`;
}

function errorResponseForRequest(
  request: Request,
  status: number,
  headers?: HeadersInit,
): Response {
  const responseHeaders = new Headers(headers);
  responseHeaders.set("Cache-Control", "no-store");
  const requestId = request.headers.get("cf-ray") ?? request.headers.get("x-request-id");

  if (request.headers.get("accept")?.includes("text/html")) {
    responseHeaders.set("Content-Type", "text/html; charset=utf-8");
    return new Response(
      request.method === "HEAD" ? null : renderErrorPage(status, requestId),
      { status, headers: responseHeaders },
    );
  }

  responseHeaders.set("Content-Type", "application/json; charset=utf-8");
  const detail = ERROR_DETAILS[status] ?? ERROR_DETAILS[500];
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

export async function handleMediaRequest(
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
