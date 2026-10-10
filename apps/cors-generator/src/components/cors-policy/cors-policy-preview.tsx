import { Checkbox } from "@komikhq/ui/components/checkbox";
import { Button } from "@komikhq/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@komikhq/ui/components/card";
import { Textarea } from "@komikhq/ui/components/textarea";
import { Label } from "@komikhq/ui/components/label";

interface CorsPolicyPreviewProps {
  policyJson: string;
  validationError?: string;
  feedback: string;
  minify: boolean;
  onCopy: () => void;
  onDownload: () => void;
  onMinifyChange: (minify: boolean) => void;
}

export function CorsPolicyPreview({
  policyJson,
  validationError,
  feedback,
  minify,
  onCopy,
  onDownload,
  onMinifyChange,
}: CorsPolicyPreviewProps) {
  return (
    <Card
      role="region"
      aria-labelledby="policy-output"
    >
      <CardHeader>
        <CardTitle>
          <h2 id="policy-output">Generated JSON</h2>
        </CardTitle>
        <CardDescription>
          Copy the policy or download it as a JSON file.
        </CardDescription>
      </CardHeader>

      <CardContent className="grid gap-4">
        <Label
          htmlFor="minify-policy"
          className="flex w-fit cursor-pointer items-center gap-2 text-sm"
        >
          <Checkbox
            id="minify-policy"
            checked={minify}
            onCheckedChange={(checked) => onMinifyChange(checked === true)}
          />
          Minify JSON
        </Label>
        <Textarea
          aria-label="Generated CORS policy JSON"
          aria-invalid={Boolean(validationError)}
          aria-live="polite"
          className="min-h-72 resize-y rounded-lg bg-muted p-4 font-mono text-xs leading-6"
          readOnly
          value={policyJson || validationError || ""}
          spellCheck={false}
        />

        <div className="flex flex-wrap gap-3">
          <Button onClick={onCopy} disabled={!policyJson}>
            Copy to clipboard
          </Button>
          <Button
            variant="outline"
            onClick={onDownload}
            disabled={!policyJson}
          >
            Download JSON
          </Button>
        </div>
        <p className="min-h-5 text-sm text-muted-foreground" role="status">
          {feedback}
        </p>
        <p className="border-t pt-4 text-xs leading-5 text-muted-foreground">
          CORS controls browser access; it does not authenticate requests or
          make a public media endpoint private.
        </p>
      </CardContent>
    </Card>
  );
}
