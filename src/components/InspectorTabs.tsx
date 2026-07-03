"use client";

import { Cloud, Code2, FunctionSquare, SlidersHorizontal } from "lucide-react";

export type InspectorTab = "style" | "algebra" | "tex" | "cloud";

interface InspectorTabsProps {
  activeTab: InspectorTab;
  objectCount: number;
  selectedCount: number;
  cloudEnabled: boolean;
  onChange: (tab: InspectorTab) => void;
}

const tabs = [
  { id: "style", label: "Style", icon: SlidersHorizontal },
  { id: "algebra", label: "Algebra", icon: FunctionSquare },
  { id: "tex", label: "TeX", icon: Code2 },
  { id: "cloud", label: "Cloud", icon: Cloud },
] satisfies { id: InspectorTab; label: string; icon: typeof SlidersHorizontal }[];

export function InspectorTabs({
  activeTab,
  objectCount,
  selectedCount,
  cloudEnabled,
  onChange,
}: InspectorTabsProps) {
  return (
    <div className="inspector-tabs" aria-label="Inspector sections">
      {tabs
        .filter((tab) => tab.id !== "cloud" || cloudEnabled)
        .map((tab) => {
          const Icon = tab.icon;
          const badgeValue =
            tab.id === "style"
              ? selectedCount
              : tab.id === "algebra"
                ? objectCount
                : null;
          const badge = badgeValue && badgeValue > 0 ? badgeValue : null;

          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onChange(tab.id)}
              aria-pressed={activeTab === tab.id}
              className={activeTab === tab.id ? "inspector-tab-active" : "inspector-tab"}
            >
              <Icon className="h-3.5 w-3.5" aria-hidden />
              <span>{tab.label}</span>
              {badge !== null ? <span className="inspector-tab-badge">{badge}</span> : null}
            </button>
          );
        })}
    </div>
  );
}
