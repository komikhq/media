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
