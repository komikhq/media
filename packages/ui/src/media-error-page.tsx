import { WarningCircle } from "@phosphor-icons/react";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server.edge";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "./components/card";
import { Separator } from "./components/separator";
import uiStyles from "./styles/theme.css?inline";

export interface MediaErrorPageProps {
  status: number;
  code: string;
  title: string;
  description: string;
  requestId: string | null;
}

function MediaErrorPage({
  status,
  code,
  title,
  description,
  requestId,
}: MediaErrorPageProps) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="color-scheme" content="light dark" />
        <title>{`${status} ${code.replaceAll("_", " ")}`}</title>
        <style>{uiStyles}</style>
      </head>
      <body className="min-h-svh bg-background font-sans text-foreground">
        <main className="mx-auto grid min-h-svh w-full max-w-5xl place-items-center p-6">
          <Card className="w-full max-w-xl border-border bg-card shadow-lg">
            <CardHeader className="gap-4 p-8">
              <div className="flex items-center gap-2 text-primary">
                <WarningCircle aria-hidden="true" size={20} weight="duotone" />
                <span className="font-mono text-xs font-semibold uppercase tracking-wider">
                  {`HTTP ${status} · ${code}`}
                </span>
              </div>
              <CardTitle>
                <h1 className="font-heading text-3xl font-semibold tracking-tight sm:text-4xl">
                  {title}
                </h1>
              </CardTitle>
              <CardDescription className="text-base leading-relaxed">
                {description}
              </CardDescription>
            </CardHeader>

            {requestId && (
              <>
                <div className="px-8">
                  <Separator decorative />
                </div>
                <CardContent className="px-8 py-5">
                  <dl className="flex flex-wrap items-center justify-between gap-2 text-sm">
                    <dt className="text-muted-foreground">Request ID</dt>
                    <dd className="m-0 break-all font-mono text-xs text-foreground">
                      {requestId}
                    </dd>
                  </dl>
                </CardContent>
              </>
            )}

            <CardFooter className="justify-between border-t border-border px-8 py-5 text-sm text-muted-foreground">
              <span className="font-medium text-foreground">KomikHQ Media</span>
              <span>Media delivery</span>
            </CardFooter>
          </Card>
        </main>
      </body>
    </html>
  );
}

export function renderMediaErrorPage(props: MediaErrorPageProps): string {
  return `<!doctype html>${renderToStaticMarkup(
    createElement(MediaErrorPage, props),
  )}`;
}
