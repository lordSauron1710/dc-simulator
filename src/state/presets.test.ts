import { describe, expect, it } from "vitest";
import { DATA_CENTER_PRESETS, detectPresetId, getPresetById } from "./presets";

describe("preset helpers", () => {
  it("returns a preset by id", () => {
    const preset = getPresetById("ai-liquid");

    expect(preset).not.toBeNull();
    expect(preset?.label).toBe("AI Liquid Cluster");
    expect(preset?.params.rackPowerDensity).toBe(42);
  });

  it("detects every shipped preset from its exact params", () => {
    DATA_CENTER_PRESETS.forEach((preset) => {
      expect(detectPresetId(preset.params)).toBe(preset.id);
    });
  });

  it("returns null when params drift away from a preset", () => {
    const base = DATA_CENTER_PRESETS[0];
    const customParams = {
      ...base.params,
      rackPowerDensity: base.params.rackPowerDensity + 1,
    };

    expect(detectPresetId(customParams)).toBeNull();
  });
});
