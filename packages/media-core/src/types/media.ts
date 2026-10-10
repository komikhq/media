export interface R2ObjectMetadata {
  readonly size: number;
  readonly httpEtag: string;
  readonly uploaded: Date;
  readonly body?: ReadableStream<Uint8Array>;
  writeHttpMetadata(headers: Headers): void;
}

export interface R2BucketReader {
  get(key: string): Promise<R2ObjectMetadata | null>;
  head(key: string): Promise<R2ObjectMetadata | null>;
}

export interface CorsRule {
  allowedOrigins: string[];
  allowedMethods: string[];
  allowedHeaders: string[];
  exposeHeaders: string[];
  maxAgeSeconds?: number;
}

export interface ErrorDetail {
  code: string;
  title: string;
  description: string;
}
