import { CheckCircle2, ListChecks, Sparkles, Wand2 } from "lucide-react";
import type { LintResult } from "@/lib/linter";

interface DiagramLinterPanelProps {
  result: LintResult;
  onRun: () => void;
  onApplyFixes: () => void;
}

export function DiagramLinterPanel({ result, onRun, onApplyFixes }: DiagramLinterPanelProps) {
  return (
    <section className="tool-panel">
      <div className="panel-heading">
        <span>Diagram Linter</span>
        <span className="status-pill">Grade {result.grade}</span>
      </div>
      <div className="flex items-end justify-between gap-4">
        <div>
          <div className="text-5xl font-semibold tracking-normal text-stone-950">{result.score}</div>
          <p className="text-sm text-stone-500">Quality score</p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={onRun} title="Run Diagram Linter" className="icon-button">
            <ListChecks className="h-4 w-4" aria-hidden />
            Run Diagram Linter
          </button>
          <button type="button" onClick={onApplyFixes} title="Apply Safe Fixes" className="icon-button-secondary">
            <Wand2 className="h-4 w-4" aria-hidden />
            Apply Safe Fixes
          </button>
        </div>
      </div>
      <div className="mt-4 max-h-72 space-y-2 overflow-auto pr-1">
        {result.findings.length === 0 ? (
          <div className="flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
            <CheckCircle2 className="h-4 w-4" aria-hidden />
            No lint findings.
          </div>
        ) : (
          result.findings.map((finding, index) => (
            <div key={`${finding.ruleId}-${index}`} className="rounded-md border border-stone-200 bg-white p-3">
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs font-semibold uppercase tracking-[0.14em] text-stone-500">
                  {finding.ruleId}
                </span>
                <span className={`severity-${finding.severity}`}>{finding.severity}</span>
              </div>
              <p className="mt-2 text-sm text-stone-800">{finding.message}</p>
              {finding.suggestedFix ? (
                <p className="mt-1 flex gap-2 text-xs text-stone-500">
                  <Sparkles className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  {finding.suggestedFix}
                </p>
              ) : null}
            </div>
          ))
        )}
      </div>
    </section>
  );
}
