export const ALLOWED_METHODS = ["GET", "HEAD"] as const;

export type AllowedMethod = (typeof ALLOWED_METHODS)[number];

export interface CorsPolicy {
  AllowedOrigins: string[];
  AllowedMethods: AllowedMethod[];
  AllowedHeaders: string[];
  ExposeHeaders: string[];
  MaxAgeSeconds: number;
}

export interface CorsPolicyDraft {
  origins: string;
  methods: AllowedMethod[];
  allowedHeaders: string;
  exposeHeaders: string;
  maxAgeSeconds: string;
}

export function parseList(value: string): string[] {
  return [
    ...new Set(
      value
        .split(/[\n,]/u)
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  ];
}

export function validateDraft(
  draft: CorsPolicyDraft,
): string | undefined {
  if (parseList(draft.origins).length === 0) {
    return "Add at least one allowed origin.";
  }

  if (draft.methods.length === 0) {
    return "Select at least one allowed method.";
  }

  const maxAge = Number(draft.maxAgeSeconds);
  if (
    draft.maxAgeSeconds.trim() === "" ||
    !Number.isSafeInteger(maxAge) ||
    maxAge < 0
  ) {
    return "Max age must be a non-negative whole number.";
  }

  return undefined;
}

export function createPolicy(draft: CorsPolicyDraft): CorsPolicy {
  return {
    AllowedOrigins: parseList(draft.origins),
    AllowedMethods: ALLOWED_METHODS.filter((method) =>
      draft.methods.includes(method),
    ),
    AllowedHeaders: parseList(draft.allowedHeaders),
    ExposeHeaders: parseList(draft.exposeHeaders),
    MaxAgeSeconds: Number(draft.maxAgeSeconds),
  };
}

export function serializePolicy(policy: CorsPolicy): string {
  return JSON.stringify([policy], null, 2);
}
