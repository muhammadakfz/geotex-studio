"use client";

import { useCallback, useEffect, useState } from "react";
import { GitCommitVertical, RefreshCw } from "lucide-react";
import type { DiagramModel } from "@/lib/diagram-types";
import type { LintResult } from "@/lib/linter";
import { createDiagramVersion, getDiagramVersions, type DiagramVersion } from "@/lib/db/diagram-versions";

interface VersionHistoryPanelProps {
  cloudEnabled: boolean;
  diagramId: string | null;
  diagram: DiagramModel;
  tikzCode: string;
  lintResult: LintResult;
  onMessage: (message: string) => void;
}

export function VersionHistoryPanel({
  cloudEnabled,
  diagramId,
  diagram,
  tikzCode,
  lintResult,
  onMessage,
}: VersionHistoryPanelProps) {
  const [versions, setVersions] = useState<DiagramVersion[]>([]);
  const [busy, setBusy] = useState(false);

  const loadVersions = useCallback(async () => {
    if (!cloudEnabled || !diagramId) return;
    const result = await getDiagramVersions(diagramId);
    if (result.error) {
      onMessage(result.error);
      return;
    }
    setVersions(result.data ?? []);
  }, [cloudEnabled, diagramId, onMessage]);

  useEffect(() => {
    let cancelled = false;
    if (!cloudEnabled || !diagramId) return;

    getDiagramVersions(diagramId).then((result) => {
      if (cancelled) return;
      if (result.error) {
        onMessage(result.error);
        return;
      }
      setVersions(result.data ?? []);
    });

    return () => {
      cancelled = true;
    };
  }, [cloudEnabled, diagramId, onMessage]);

  async function saveVersion() {
    if (!diagramId) {
      onMessage("Save Diagram before saving a version.");
      return;
    }

    setBusy(true);
    const result = await createDiagramVersion(
      diagramId,
      diagram,
      tikzCode,
      lintResult.score,
      lintResult.findings,
    );
    setBusy(false);

    if (result.error || !result.data) {
      onMessage(result.error ?? "Could not save version.");
      return;
    }

    setVersions((current) => [result.data, ...current]);
    onMessage("Version saved.");
  }

  return (
    <section className="tool-panel">
      <div className="panel-heading">
        <span>Version History</span>
        <span className="status-pill">{versions.length}</span>
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={saveVersion}
          disabled={busy || !cloudEnabled || !diagramId}
          title="Save as Version"
          className="icon-button disabled:cursor-not-allowed disabled:opacity-50"
        >
          <GitCommitVertical className="h-4 w-4" aria-hidden />
          Save as Version
        </button>
        <button
          type="button"
          onClick={() => void loadVersions()}
          disabled={busy || !cloudEnabled || !diagramId}
          title="Refresh versions"
          className="icon-only disabled:cursor-not-allowed disabled:opacity-50"
        >
          <RefreshCw className="h-4 w-4" aria-hidden />
        </button>
      </div>
      <div className="mt-3 max-h-40 space-y-2 overflow-auto">
        {versions.length === 0 ? (
          <p className="text-sm text-stone-500">No saved versions.</p>
        ) : (
          versions.map((version) => (
            <div key={version.id} className="rounded-md border border-stone-200 bg-white px-3 py-2 text-sm">
              <div className="font-semibold text-stone-900">Version {version.version_number}</div>
              <div className="text-xs text-stone-500">Score {version.linter_score ?? "-"}</div>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
