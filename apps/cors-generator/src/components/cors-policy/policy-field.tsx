import type { ReactNode } from "react";
import { Label } from "@komikhq/ui/components/label";

interface PolicyFieldProps {
  id: string;
  label: string;
  hint?: string;
  children: ReactNode;
}

export function PolicyField({
  id,
  label,
  hint,
  children,
}: PolicyFieldProps) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
