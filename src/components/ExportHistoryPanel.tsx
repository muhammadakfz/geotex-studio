"use client";

import { useCallback, useEffect, useState } from "react";
import { History, RefreshCw } from "lucide-react";
import { getExportHistory, type ExportHistory } from "@/lib/db/export-history";

interface ExportHistoryPanelProps {
  cloudEnabled: boolean;
  diagramId: string | null;
  refreshToken: number;
  onMessage: (message: string) => void;
}

export function ExportHistoryPanel({ cloudEnabled, diagramId, refreshToken, onMessage }: ExportHistoryPanelProps) {
  const [exports, setExports] = useState<ExportHistory[]>([]);
  const [busy, setBusy] = useState(false);

  const loadExports = useCallback(async () => {
    if (!cloudEnabled || !diagramId) return;
    setBusy(true);
    const result = await getExportHistory(diagramId);
    setBusy(false);
    if (result.error) {
      onMessage(result.error);
      return;
    }
    setExports(result.data ?? []);
  }, [cloudEnabled, diagramId, onMessage]);

  useEffect(() => {
    let cancelled = false;
    if (!cloudEnabled || !diagramId) return;

    getExportHistory(diagramId).then((result) => {
      if (cancelled) return;
      if (result.error) {
        onMessage(result.error);
        return;
      }
      setExports(result.data ?? []);
    });

    return () => {
      cancelled = true;
    };
  }, [cloudEnabled, diagramId, onMessage, refreshToken]);

  return (
    <section className="tool-panel">
      <div className="panel-heading">
        <span>Export History</span>
        <span className="status-pill">{exports.length}</span>
      </div>
      <button
        type="button"
        onClick={() => void loadExports()}
        disabled={busy || !cloudEnabled || !diagramId}
        title="Refresh export history"
        className="icon-button-secondary disabled:cursor-not-allowed disabled:opacity-50"
      >
        <RefreshCw className="h-4 w-4" aria-hidden />
        Refresh
      </button>
      <div className="panel-list">
        {exports.length === 0 ? (
          <p className="panel-empty">
            <History className="h-4 w-4" aria-hidden />
            No exports yet.
          </p>
        ) : (
          exports.map((item) => (
            <div key={item.id} className="panel-list-card">
              <div className="panel-list-title">{item.export_format}</div>
              <div className="panel-list-copy">{item.required_packages.join(", ")}</div>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
