import katex from "katex";
import { Clipboard, Download } from "lucide-react";
import type { DiagramModel } from "@/lib/diagram-types";
import { unwrapMathLabel } from "@/lib/latex-normalizer";

interface TikZOutputPanelProps {
  diagram: DiagramModel;
  code: string;
  onCopy: () => void;
  onDownload: () => void;
}

function LatexPreview({ diagram }: { diagram: DiagramModel }) {
  const labels = diagram.objects
    .map((object) => object.label)
    .filter((label): label is string => Boolean(label))
    .slice(0, 6);

  return (
    <div className="flex flex-wrap gap-2">
      {labels.map((label, index) => (
        <span
          key={`${label}-${index}`}
          className="rounded-md border border-stone-200 bg-white px-2 py-1 text-sm"
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

export function TikZOutputPanel({ diagram, code, onCopy, onDownload }: TikZOutputPanelProps) {
  return (
    <section className="tool-panel">
      <div className="panel-heading">
        <span>TikZ Output</span>
        <span className="status-pill">semantic</span>
      </div>
      <LatexPreview diagram={diagram} />
      <pre className="mt-3 max-h-96 overflow-auto rounded-md border border-stone-200 bg-stone-950 p-4 text-xs leading-6 text-stone-100">
        <code>{code}</code>
      </pre>
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" onClick={onCopy} title="Copy TikZ" className="icon-button">
          <Clipboard className="h-4 w-4" aria-hidden />
          Copy TikZ
        </button>
        <button type="button" onClick={onDownload} title="Download .tex" className="icon-button-secondary">
          <Download className="h-4 w-4" aria-hidden />
          Download .tex
        </button>
      </div>
    </section>
  );
}
