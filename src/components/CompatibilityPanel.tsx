import { AlertCircle, CheckCircle2 } from "lucide-react";
import type { DiagramModel } from "@/lib/diagram-types";
import type { LintResult } from "@/lib/linter";

interface CompatibilityPanelProps {
  diagram: DiagramModel;
  lintResult: LintResult;
}

function StatusRow({ label, ok }: { label: string; ok: boolean }) {
  const Icon = ok ? CheckCircle2 : AlertCircle;
  return (
    <div className="flex items-center justify-between gap-3 border-b border-stone-100 py-2 last:border-0">
      <span className="text-sm text-stone-700">{label}</span>
      <Icon className={`h-4 w-4 ${ok ? "text-emerald-600" : "text-amber-600"}`} aria-hidden />
    </div>
  );
}

export function CompatibilityPanel({ diagram, lintResult }: CompatibilityPanelProps) {
  const hasLatexIssue = lintResult.findings.some((finding) => finding.ruleId === "latex-label-required");
  const hasColorIssue = lintResult.findings.some((finding) => finding.ruleId === "grayscale-safe-colors");
  const pgfplotsNotRequired = diagram.objects.every(
    (object) => object.type !== "FunctionPlot" || object.samples.length > 0,
  );

  return (
    <section className="tool-panel">
      <div className="panel-heading">
        <span>Compatibility</span>
        <span className="status-pill">TeX</span>
      </div>
      <div className="rounded-md border border-stone-200 bg-white px-3">
        <StatusRow label="Required packages: tikz, arrows.meta, angles, quotes, calc" ok />
        <StatusRow label="Pure TikZ export" ok />
        <StatusRow label="PGFPlots not required" ok={pgfplotsNotRequired} />
        <StatusRow label="Grayscale-safe" ok={!hasColorIssue} />
        <StatusRow label="Print suitability" ok={lintResult.score >= 75} />
        <StatusRow label="Beamer suitability" ok={lintResult.score >= 70} />
        <StatusRow label="LaTeX-safe labels" ok={!hasLatexIssue} />
      </div>
    </section>
  );
}
