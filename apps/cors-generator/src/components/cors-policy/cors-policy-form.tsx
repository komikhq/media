import { Checkbox } from "@komikhq/ui/components/checkbox";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@komikhq/ui/components/card";
import { Input } from "@komikhq/ui/components/input";
import { Label } from "@komikhq/ui/components/label";
import { Textarea } from "@komikhq/ui/components/textarea";
import {
  ALLOWED_METHODS,
  type AllowedMethod,
  type CorsPolicyDraft,
} from "../../lib/cors-policy";
import { PolicyField } from "./policy-field";

interface CorsPolicyFormProps {
  draft: CorsPolicyDraft;
  onDraftChange: <Key extends keyof CorsPolicyDraft>(
    key: Key,
    value: CorsPolicyDraft[Key],
  ) => void;
  onToggleMethod: (method: AllowedMethod) => void;
}

const textAreaClassName = "min-h-24 resize-y";

export function CorsPolicyForm({
  draft,
  onDraftChange,
  onToggleMethod,
}: CorsPolicyFormProps) {
  return (
    <Card
      role="region"
      aria-labelledby="policy-settings"
    >
      <CardHeader>
        <CardTitle>
          <h2 id="policy-settings">Policy settings</h2>
        </CardTitle>
        <CardDescription>
          Enter multiple values on separate lines or separated by commas.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-6">

      <PolicyField
        id="allowed-origins"
        label="Allowed origins"
        hint="Use a full origin, such as https://app.example.com."
      >
        <Textarea
          id="allowed-origins"
          className={textAreaClassName}
          value={draft.origins}
          onChange={(event) => onDraftChange("origins", event.target.value)}
          spellCheck={false}
        />
      </PolicyField>

      <fieldset className="grid gap-3">
        <legend className="text-sm font-medium">Allowed methods</legend>
        <div className="flex flex-wrap gap-2">
          {ALLOWED_METHODS.map((method) => (
            <Label
              key={method}
              htmlFor={`method-${method.toLowerCase()}`}
              className="flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm"
            >
              <Checkbox
                id={`method-${method.toLowerCase()}`}
                checked={draft.methods.includes(method)}
                onCheckedChange={() => onToggleMethod(method)}
              />
              {method}
            </Label>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          The KomikHQ media endpoint currently supports read-only GET and HEAD
          requests.
        </p>
      </fieldset>

      <PolicyField id="allowed-headers" label="Allowed request headers">
        <Textarea
          id="allowed-headers"
          className={textAreaClassName}
          value={draft.allowedHeaders}
          onChange={(event) =>
            onDraftChange("allowedHeaders", event.target.value)
          }
          placeholder="Content-Type"
          spellCheck={false}
        />
      </PolicyField>

      <PolicyField
        id="expose-headers"
        label="Exposed response headers"
        hint="These can be read by browser JavaScript."
      >
        <Textarea
          id="expose-headers"
          className={textAreaClassName}
          value={draft.exposeHeaders}
          onChange={(event) =>
            onDraftChange("exposeHeaders", event.target.value)
          }
          spellCheck={false}
        />
      </PolicyField>

      <PolicyField
        id="max-age"
        label="Max age (seconds)"
        hint="How long browsers may cache the preflight response."
      >
        <Input
          id="max-age"
          type="number"
          min="0"
          step="1"
          value={draft.maxAgeSeconds}
          onChange={(event) =>
            onDraftChange("maxAgeSeconds", event.target.value)
          }
        />
      </PolicyField>
      </CardContent>
    </Card>
  );
}
