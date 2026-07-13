"use client";

import { useMemo, useState } from "react";
import {
  FilePlus2,
  Redo2,
  Undo2,
} from "lucide-react";
import { AccessGate } from "@/components/AccessGate";
import { AboutMenu } from "@/components/AboutMenu";
import { ExportHistoryPanel } from "@/components/ExportHistoryPanel";
import { FigureBuilderPanel } from "@/components/FigureBuilderPanel";
import { GeoGebraCanvas } from "@/components/GeoGebraCanvas";
import { InspectorTabs, type InspectorTab } from "@/components/InspectorTabs";
import { LayerPanel } from "@/components/LayerPanel";
import { PropertiesPanel } from "@/components/PropertiesPanel";
import { ProjectPanel } from "@/components/ProjectPanel";
import { TikZOutputPanel } from "@/components/TikZOutputPanel";
import { UserMenu } from "@/components/UserMenu";
import { VersionHistoryPanel } from "@/components/VersionHistoryPanel";
import { saveExport } from "@/lib/db/export-history";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { exportTikz } from "@/lib/tikz-exporter";
import { useDiagramEditor } from "@/hooks/useDiagramEditor";
import type { DiagramModel } from "@/lib/diagram-types";

export default function Home() {
  const {
    diagram,
    selectedObjectIds,
    setSelectedObjectIds,
    lintResult,
    statusMessage,
    setStatusMessage,
    activeTool,
    pendingPoints,
    activePenPathId,
    snapToGrid,
    setSnapToGrid,
    undo,
    redo,
    newBlankFigure,
    handleToolChange,
    handleCanvasPoint,
    handleCanvasDragCreate,
    handleGridChange,
    handleCoordinatesChange,
    updateSelectedObject,
    deleteSelectedObjects,
    handleLayerAction,
    handlePlotExpression,
    handleEditExpression,
    handleCanvasCommit,
    handleViewportChange,
    replaceDiagram,
  } = useDiagramEditor();

  const [activeInspectorTab, setActiveInspectorTab] = useState<InspectorTab>("algebra");
  const [includeCartesianExport, setIncludeCartesianExport] = useState(false);
  const cloudEnabled = isSupabaseConfigured();
  const [activePresetId, setActivePresetId] = useState("thesis-paper");
  const [exportRefreshToken, setExportRefreshToken] = useState(0);
  const [customTikzCode, setCustomTikzCode] = useState<string | null>(null);
  const showStatusToast = Boolean(statusMessage && statusMessage !== "Ready.");

  const tikz = useMemo(
    () => exportTikz(diagram, { includeCartesian: includeCartesianExport }),
    [diagram, includeCartesianExport],
  );

  const selectedObject = useMemo(
    () => diagram.objects.find((object) => object.id === selectedObjectIds[0]),
    [diagram.objects, selectedObjectIds],
  );

  const [savedDiagramId, setSavedDiagramId] = useState<string | null>(null);
  const tikzCode = customTikzCode ?? tikz.code;

  async function recordExport(format: "tikz" | "tex") {
    if (!cloudEnabled || !savedDiagramId) return;
    await saveExport(savedDiagramId, format, tikzCode, tikz.requiredPackages);
    setExportRefreshToken((current) => current + 1);
  }

  async function handleCopyTikz() {
    await navigator.clipboard.writeText(tikzCode);
    await recordExport("tikz");
    setStatusMessage("LaTeX copied.");
  }

  async function handleDownloadTex() {
    const blob = new Blob([tikzCode], { type: "text/x-tex;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    const rawName = typeof diagram.name === "string" ? diagram.name : "geotex-figure";
    const fileName = rawName
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "geotex-figure";
    anchor.download = `${fileName}.tex`;
    anchor.click();
    URL.revokeObjectURL(url);
    await recordExport("tex");
    setStatusMessage(".tex downloaded.");
  }

  function handleLoadDiagram(next: DiagramModel, diagramId: string, presetId?: string | null) {
    replaceDiagram(next, "Diagram loaded.");
    setSavedDiagramId(diagramId);
    if (presetId) setActivePresetId(presetId);
  }

  return (
    <AccessGate>
      {(session) => {
        const sessionCloudEnabled = cloudEnabled && !session.isGuest;
        const visibleInspectorTab =
          (activeInspectorTab === "cloud" && !sessionCloudEnabled) ? "style" : activeInspectorTab;

        return (
          <div className="relative flex h-dvh flex-col overflow-hidden bg-white text-black">
            <header className="studio-header">
              <div className="studio-brand">
                <h1 className="studio-title">GeoTeX Studio</h1>
              </div>

              <div className="studio-actions">
                <button type="button" onClick={undo} title="Undo (Cmd+Z)" className="icon-only shrink-0 disabled:cursor-not-allowed disabled:opacity-40">
                  <Undo2 className="h-4 w-4" aria-hidden />
                </button>
                <button type="button" onClick={redo} title="Redo (Cmd+Y)" className="icon-only shrink-0 disabled:cursor-not-allowed disabled:opacity-40">
                  <Redo2 className="h-4 w-4" aria-hidden />
                </button>
                <button type="button" onClick={newBlankFigure} title="New Diagram" className="icon-button-secondary shrink-0">
                  <FilePlus2 className="h-4 w-4" aria-hidden />
                  <span className="hidden sm:inline">New</span>
                </button>
                <AboutMenu
                  user={session}
                  cloudEnabled={sessionCloudEnabled}
                  onMessage={setStatusMessage}
                />
                <UserMenu user={session} onSignOut={() => void session.signOut()} />
              </div>
            </header>

            <main className="studio-shell">
              <aside className="studio-tools">
                <FigureBuilderPanel
                  activeTool={activeTool}
                  snapToGrid={snapToGrid}
                  gridVisible={diagram.gridVisible}
                  coordinatesVisible={diagram.coordinatesVisible ?? true}
                  hasSelection={selectedObjectIds.length > 0}
                  pendingCount={pendingPoints.length}
                  onToolChange={handleToolChange}
                  onSnapChange={setSnapToGrid}
                  onGridChange={handleGridChange}
                  onCoordinatesChange={handleCoordinatesChange}
                  onDeleteSelected={deleteSelectedObjects}
                />
              </aside>

              <section className="studio-canvas-panel">
                <div className="studio-canvas-frame">
                  <GeoGebraCanvas
                    diagram={diagram}
                    selectedObjectIds={selectedObjectIds}
                    activeTool={activeTool}
                    pendingPoints={pendingPoints}
                    activePenPathId={activePenPathId}
                    coordinatesVisible={diagram.coordinatesVisible ?? true}
                    onSelectObjects={setSelectedObjectIds}
                    onCanvasPoint={handleCanvasPoint}
                    onCanvasDragCreate={handleCanvasDragCreate}
                    onCommitDiagram={handleCanvasCommit}
                    onViewportChange={handleViewportChange}
                  />
                </div>
              </section>

              <aside className="studio-inspector">
                <InspectorTabs
                  activeTab={visibleInspectorTab}
                  objectCount={diagram.objects.length}
                  selectedCount={selectedObjectIds.length}
                  cloudEnabled={sessionCloudEnabled}
                  onChange={setActiveInspectorTab}
                />
                <div className="inspector-tab-panel">
                  {visibleInspectorTab === "style" ? (
                    <PropertiesPanel object={selectedObject} onChange={updateSelectedObject} />
                  ) : null}
                  {visibleInspectorTab === "algebra" ? (
                    <LayerPanel
                      diagram={diagram}
                      selectedObjectIds={selectedObjectIds}
                      onSelectObjects={setSelectedObjectIds}
                      onLayerAction={handleLayerAction}
                      onEditExpression={handleEditExpression}
                      onCreateExpression={handlePlotExpression}
                    />
                  ) : null}
                  {visibleInspectorTab === "tex" ? (
                    <>
                      <TikZOutputPanel
                        diagram={diagram}
                        code={tikzCode}
                        isCustom={customTikzCode !== null}
                        includeCartesian={includeCartesianExport}
                        onIncludeCartesianChange={(value) => {
                          setIncludeCartesianExport(value);
                          setCustomTikzCode(null);
                        }}
                        onCodeChange={(value) => setCustomTikzCode(value)}
                        onResetCode={() => setCustomTikzCode(null)}
                        onCopy={() => void handleCopyTikz()}
                        onDownload={() => void handleDownloadTex()}
                      />
                    </>
                  ) : null}
                  {visibleInspectorTab === "cloud" && sessionCloudEnabled ? (
                    <>
                      <ProjectPanel
                        cloudEnabled={sessionCloudEnabled}
                        diagram={diagram}
                        tikzCode={tikzCode}
                        lintResult={lintResult}
                        activePresetId={activePresetId}
                        savedDiagramId={savedDiagramId}
                        onLoadDiagram={handleLoadDiagram}
                        onSavedDiagram={setSavedDiagramId}
                        onMessage={setStatusMessage}
                      />
                      <div className="mt-3">
                        <VersionHistoryPanel
                          cloudEnabled={sessionCloudEnabled}
                          diagramId={savedDiagramId}
                          diagram={diagram}
                          tikzCode={tikzCode}
                          lintResult={lintResult}
                          onMessage={setStatusMessage}
                        />
                      </div>
                      <div className="mt-3">
                        <ExportHistoryPanel
                          cloudEnabled={sessionCloudEnabled}
                          diagramId={savedDiagramId}
                          refreshToken={exportRefreshToken}
                          onMessage={setStatusMessage}
                        />
                      </div>
                    </>
                  ) : null}
                </div>
              </aside>
            </main>
            {showStatusToast ? (
              <div key={statusMessage} className="studio-toast" role="status" aria-live="polite">
                {statusMessage}
              </div>
            ) : null}
          </div>
        );
      }}
    </AccessGate>
  );
}
