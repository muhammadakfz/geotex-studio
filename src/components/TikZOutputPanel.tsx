import katex from "katex";
import { Clipboard, Download, RotateCcw } from "lucide-react";
import type { DiagramModel } from "@/lib/diagram-types";
import { unwrapMathLabel } from "@/lib/latex-normalizer";

interface TikZOutputPanelProps {
  diagram: DiagramModel;
  code: string;
  isCustom: boolean;
  includeCartesian: boolean;
  onIncludeCartesianChange: (value: boolean) => void;
  onCodeChange: (value: string) => void;
  onResetCode: () => void;
  onCopy: () => void;
  onDownload: () => void;
}

function LatexPreview({ diagram }: { diagram: DiagramModel }) {
  const labels = diagram.objects
    .map((object) => object.label)
    .filter((label): label is string => Boolean(label))
    .slice(0, 6);

  return (
    <div className="latex-preview">
      {labels.map((label, index) => (
        <span
          key={`${label}-${index}`}
          className="latex-chip"
          dangerouslySetInnerHTML={{
            __html: katex.renderToString(unwrapMathLabel(label), {
              throwOnError: false,
              displayMode: false,
            }),
          }}
        />
      ))}
    </div>
  );
}

export function TikZOutputPanel({
  diagram,
  code,
  isCustom,
  includeCartesian,
  onIncludeCartesianChange,
  onCodeChange,
  onResetCode,
  onCopy,
  onDownload,
}: TikZOutputPanelProps) {
  return (
    <section className="tool-panel">
      <div className="panel-heading">
        <span>LaTeX / TikZ</span>
        <span className="status-pill">{isCustom ? "edited" : includeCartesian ? "cartesian" : "objects"}</span>
      </div>
      <LatexPreview diagram={diagram} />
      <label className="pixel-toggle">
        Cartesian guide
        <input
          type="checkbox"
          checked={includeCartesian}
          onChange={(event) => onIncludeCartesianChange(event.currentTarget.checked)}
          className="h-4 w-4 accent-black"
        />
      </label>
      <textarea
        value={code}
        onChange={(event) => onCodeChange(event.currentTarget.value)}
        spellCheck={false}
        className="code-editor"
        aria-label="Editable LaTeX TikZ code"
      />
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" onClick={onCopy} title="Copy TikZ" className="icon-button">
          <Clipboard className="h-4 w-4" aria-hidden />
          Copy
        </button>
        <button type="button" onClick={onDownload} title="Download .tex" className="icon-button-secondary">
          <Download className="h-4 w-4" aria-hidden />
          .tex
        </button>
        <button type="button" onClick={onResetCode} disabled={!isCustom} title="Reset generated code" className="icon-button-secondary disabled:cursor-not-allowed disabled:opacity-45">
          <RotateCcw className="h-4 w-4" aria-hidden />
          Reset
        </button>
      </div>
    </section>
  );
}
