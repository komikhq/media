import { useMemo, useState } from "react";
import {
  ALLOWED_METHODS,
  createPolicy,
  serializePolicy,
  validateDraft,
  type AllowedMethod,
  type CorsPolicyDraft,
} from "../lib/cors-policy";

const INITIAL_DRAFT: CorsPolicyDraft = {
  origins: "https://app.example.com",
  methods: ["GET", "HEAD"],
  allowedHeaders: "",
  exposeHeaders: "ETag\nLast-Modified\nContent-Length",
  maxAgeSeconds: "3600",
};

export function useCorsPolicy() {
  const [draft, setDraft] = useState(INITIAL_DRAFT);
  const [feedback, setFeedback] = useState("");

  const validationError = useMemo(() => validateDraft(draft), [draft]);
  const policyJson = useMemo(
    () =>
      validationError
        ? ""
        : serializePolicy(createPolicy(draft)),
    [draft, validationError],
  );

  function updateDraft<Key extends keyof CorsPolicyDraft>(
    key: Key,
    value: CorsPolicyDraft[Key],
  ) {
    setDraft((current) => ({ ...current, [key]: value }));
    setFeedback("");
  }

  function toggleMethod(method: AllowedMethod) {
    const methods = draft.methods.includes(method)
      ? draft.methods.filter((item) => item !== method)
      : ALLOWED_METHODS.filter(
          (item) => item === method || draft.methods.includes(item),
        );
    updateDraft("methods", methods);
  }

  return {
    draft,
    feedback,
    policyJson,
    setFeedback,
    toggleMethod,
    updateDraft,
    validationError,
  };
}
