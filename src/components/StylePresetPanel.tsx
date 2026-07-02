"use client";

import { Save } from "lucide-react";
import { useState } from "react";
import { createUserStylePreset } from "@/lib/db/style-presets";
import { getStylePreset, systemStylePresets } from "@/lib/style-presets";

interface StylePresetPanelProps {
  activePresetId: string;
  cloudEnabled: boolean;
  onChange: (presetId: string) => void;
  onMessage: (message: string) => void;
}

export function StylePresetPanel({ activePresetId, cloudEnabled, onChange, onMessage }: StylePresetPanelProps) {
  const [busy, setBusy] = useState(false);
  const activePreset = getStylePreset(activePresetId);

  async function saveCustomPreset() {
    if (!cloudEnabled) {
      onMessage("Connect storage before saving custom presets.");
      return;
    }

    setBusy(true);
    const result = await createUserStylePreset(
      `${activePreset.name} Custom`,
      "custom",
      activePreset.config,
    );
    setBusy(false);
    onMessage(result.error ?? "Custom preset saved.");
  }

  return (
    <section className="tool-panel">
      <div className="panel-heading">
        <span>Style Preset</span>
        <span className="status-pill">{activePreset.category}</span>
      </div>
      <select
        value={activePresetId}
        onChange={(event) => onChange(event.target.value)}
        className="h-10 w-full rounded-md border border-stone-200 bg-white px-3 text-sm outline-none transition focus:border-stone-500"
      >
        {systemStylePresets.map((preset) => (
          <option key={preset.id} value={preset.id}>
            {preset.name}
          </option>
        ))}
      </select>
      <button
        type="button"
        onClick={saveCustomPreset}
        disabled={busy || !cloudEnabled}
        title="Save as Custom Preset"
        className="icon-button-secondary mt-3 w-full disabled:cursor-not-allowed disabled:opacity-50"
      >
        <Save className="h-4 w-4" aria-hidden />
        Save as Custom Preset
      </button>
    </section>
  );
}
