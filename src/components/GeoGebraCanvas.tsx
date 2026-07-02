"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { DiagramModel, DiagramViewport } from "@/lib/diagram-types";
import type { EditorTool } from "@/lib/diagram-editor";
import type { PointCoordinate } from "@/lib/diagram-types";
import { DiagramCanvasFallback } from "./DiagramCanvasFallback";

interface GeoGebraCanvasProps {
  diagram: DiagramModel;
  selectedObjectIds?: string[];
  activeTool?: EditorTool;
  pendingPoints?: PointCoordinate[];
  coordinatesVisible?: boolean;
  useGeoGebraBridge?: boolean;
  onSelectObjects?: (ids: string[]) => void;
  onCanvasPoint?: (point: PointCoordinate) => void;
  onCommitDiagram?: (diagram: DiagramModel, message?: string) => void;
  onViewportChange?: (viewport: DiagramViewport) => void;
}

type GeoGebraApplet = {
  inject: (containerId: string) => void;
};

type GeoGebraAppletConstructor = new (
  params: Record<string, string | number | boolean>,
  enableRightClick?: boolean,
) => GeoGebraApplet;

declare global {
  interface Window {
    GGBApplet?: GeoGebraAppletConstructor;
  }
}

export function GeoGebraCanvas({
  diagram,
  selectedObjectIds = [],
  activeTool = "select",
  pendingPoints = [],
  coordinatesVisible = true,
  useGeoGebraBridge = false,
  onSelectObjects,
  onCanvasPoint,
  onCommitDiagram,
  onViewportChange,
}: GeoGebraCanvasProps) {
  const containerId = useId().replaceAll(":", "");
  const injectedRef = useRef(false);
  const [geogebraReady, setGeogebraReady] = useState(false);

  useEffect(() => {
    if (!useGeoGebraBridge) return;
    if (injectedRef.current || typeof window === "undefined") return;

    const inject = () => {
      if (!window.GGBApplet || injectedRef.current) return;

      injectedRef.current = true;
      const applet = new window.GGBApplet(
        {
          appName: "geometry",
          width: 860,
          height: 600,
          showToolBar: false,
          showAlgebraInput: false,
          showMenuBar: false,
          enableLabelDrags: false,
          enableShiftDragZoom: true,
          borderColor: "#e7e5e4",
        },
        true,
      );
      applet.inject(containerId);
      setGeogebraReady(true);
    };

    if (window.GGBApplet) {
      inject();
      return;
    }

    const existingScript = document.querySelector<HTMLScriptElement>("script[data-geogebra]");
    const script = existingScript ?? document.createElement("script");
    script.src = "https://www.geogebra.org/apps/deployggb.js";
    script.async = true;
    script.dataset.geogebra = "true";
    script.addEventListener("load", inject);

    if (!existingScript) {
      document.head.appendChild(script);
    }

    const timeout = window.setTimeout(() => setGeogebraReady(false), 1600);
    return () => {
      window.clearTimeout(timeout);
      script.removeEventListener("load", inject);
    };
  }, [containerId, useGeoGebraBridge]);

  return (
    <div className="relative h-full min-h-0">
      <div id={containerId} className={geogebraReady && useGeoGebraBridge ? "h-full min-h-0 w-full" : "hidden"} />
      {!geogebraReady || !useGeoGebraBridge ? (
        <DiagramCanvasFallback
          diagram={diagram}
          selectedObjectIds={selectedObjectIds}
          activeTool={activeTool}
          pendingPoints={pendingPoints}
          coordinatesVisible={coordinatesVisible}
          onSelectObjects={onSelectObjects}
          onCanvasPoint={onCanvasPoint}
          onCommitDiagram={onCommitDiagram}
          onViewportChange={onViewportChange}
        />
      ) : null}
    </div>
  );
}
