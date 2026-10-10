import { CorsPolicyBuilder } from "./components/cors-policy/cors-policy-builder";

export function App() {
  return (
    <main className="mx-auto flex min-h-svh w-full max-w-6xl flex-col gap-10 px-5 py-12 sm:px-8 sm:py-16">
      <header className="flex flex-col gap-3">
        <p className="text-sm font-medium tracking-wide text-primary">
          KOMIKHQ MEDIA
        </p>
        <h1 className="font-heading text-4xl font-semibold tracking-tight sm:text-5xl">
          CORS policy generator
        </h1>
        <p className="max-w-2xl text-muted-foreground">
          Configure a browser-access policy and export JSON in the same shape
          used by Cloudflare R2.
        </p>
        <p className="text-xs text-muted-foreground">
          Press D to toggle light and dark appearance.
        </p>
      </header>
      <CorsPolicyBuilder />
    </main>
  );
}
