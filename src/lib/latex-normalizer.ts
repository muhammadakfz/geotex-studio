import type { DiagramObjectType, SemanticRole } from "./diagram-types";
import { isVectorRole } from "./diagram-types";

const greekLabels: Record<string, string> = {
  theta: "\\theta",
  alpha: "\\alpha",
  lambda: "\\lambda",
  omega: "\\omega",
};

const physicsLabels: Record<string, string> = {
  v0: "v_0",
  Fnet: "\\vec{F}_{net}",
  Efield: "\\vec{E}",
  Bfield: "\\vec{B}",
  acceleration: "\\vec{a}",
  mg: "mg",
};

const vectorLabels: Record<string, string> = {
  F: "\\vec{F}",
  N: "\\vec{N}",
  T: "\\vec{T}",
  v: "\\vec{v}",
  a: "\\vec{a}",
};

export function unwrapMathLabel(label: string): string {
  const trimmed = label.trim();
  if (trimmed.startsWith("$") && trimmed.endsWith("$") && trimmed.length > 1) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

export function wrapMathLabel(label: string): string {
  const trimmed = label.trim();
  if (!trimmed) {
    return "";
  }
  return trimmed.startsWith("$") && trimmed.endsWith("$") ? trimmed : `$${trimmed}$`;
}

export function normalizeLatexLabel(
  label: string | undefined,
  context?: { type?: DiagramObjectType; semanticRole?: SemanticRole },
): string {
  if (!label) {
    return "";
  }

  const raw = unwrapMathLabel(label);
  const exact = greekLabels[raw] ?? physicsLabels[raw];
  if (exact) {
    return wrapMathLabel(exact);
  }

  if (
    context?.type === "Vector" ||
    (context?.semanticRole ? isVectorRole(context.semanticRole) : false)
  ) {
    return wrapMathLabel(vectorLabels[raw] ?? raw);
  }

  if (/^[A-Z]$/.test(raw)) {
    return wrapMathLabel(raw);
  }

  if (/^[a-zA-Z]+[0-9]+$/.test(raw)) {
    return wrapMathLabel(raw.replace(/([a-zA-Z]+)([0-9]+)/, "$1_$2"));
  }

  return wrapMathLabel(raw);
}

export function isLatexSafeLabel(label: string | undefined): boolean {
  if (!label) {
    return true;
  }

  const trimmed = label.trim();
  return (
    (trimmed.startsWith("$") && trimmed.endsWith("$")) ||
    trimmed.includes("\\") ||
    trimmed.includes("_") ||
    trimmed.includes("^")
  );
}
