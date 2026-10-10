import { useCorsPolicy } from "../../hooks/use-cors-policy";
import { CorsPolicyForm } from "./cors-policy-form";
import { CorsPolicyPreview } from "./cors-policy-preview";

export function CorsPolicyBuilder() {
  const {
    draft,
    feedback,
    minify,
    policyJson,
    setFeedback,
    toggleMethod,
    updateDraft,
    updateMinify,
    validationError,
  } = useCorsPolicy();

  async function copyPolicy() {
    try {
      await navigator.clipboard.writeText(policyJson);
      setFeedback("Policy copied to clipboard.");
    } catch (error) {
      console.error("Could not copy the CORS policy.", error);
      setFeedback("Clipboard access failed. Select and copy the JSON manually.");
    }
  }

  function downloadPolicy() {
    const url = URL.createObjectURL(
      new Blob([policyJson], { type: "application/json" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = "r2-cors-policy.json";
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <CorsPolicyForm
        draft={draft}
        onDraftChange={updateDraft}
        onToggleMethod={toggleMethod}
      />
      <CorsPolicyPreview
        policyJson={policyJson}
        validationError={validationError}
        feedback={feedback}
        minify={minify}
        onCopy={copyPolicy}
        onDownload={downloadPolicy}
        onMinifyChange={updateMinify}
      />
    </div>
  );
}
