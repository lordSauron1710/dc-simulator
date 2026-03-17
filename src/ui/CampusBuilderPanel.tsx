"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  deriveParamsFromReconciledCampus,
  formatHallId,
  formatRackGroupId,
  formatZoneId,
  reconcileCampus,
  validateCampus,
  type CampusValidationIssue,
} from "@/model";
import type { Campus, Hall, Params, Selection, Zone } from "@/state";

type SelectionKind = "campus" | "zone" | "hall";
type BuilderSelectionState = {
  kind: SelectionKind;
  zoneId: string | null;
  hallId: string | null;
};

interface CampusBuilderPanelProps {
  campus: Campus;
  params: Params;
  selection: Selection;
  onSelectionChange?: (selection: Selection) => void;
  onCampusChange: (campus: Campus, params: Params) => void;
  onOpenHallParameters?: (zoneId: string, hallId: string) => void;
}

const HALL_PREVIEW_COUNT = 3;
const HALL_PAGE_SIZE = 8;

function parseNumberOrFallback(raw: string, fallback: number): number {
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function resolveZone(campus: Campus, zoneId: string | null): Zone | null {
  if (!zoneId) {
    return campus.zones[0] ?? null;
  }
  return campus.zones.find((zone) => zone.id === zoneId) ?? campus.zones[0] ?? null;
}

function resolveHall(zone: Zone | null, hallId: string | null): Hall | null {
  if (!zone) {
    return null;
  }
  if (!hallId) {
    return zone.halls[0] ?? null;
  }
  return zone.halls.find((hall) => hall.id === hallId) ?? zone.halls[0] ?? null;
}

function parseTrailingNumber(value: string): number | null {
  const match = value.match(/\d+/);
  if (!match) {
    return null;
  }

  const parsed = Number(match[0]);
  return Number.isFinite(parsed) ? parsed : null;
}

function findHallByRackId(campus: Campus, rackId: string) {
  const rackIndex = parseTrailingNumber(rackId);
  if (rackIndex === null) {
    return null;
  }

  for (const zone of campus.zones) {
    const hall = zone.halls.find((entry) => rackIndex >= entry.rackStartIndex && rackIndex <= entry.rackEndIndex);
    if (hall) {
      return { zone, hall };
    }
  }

  return null;
}

function deriveBuilderSelection(campus: Campus, selection: Selection): BuilderSelectionState {
  const firstZone = campus.zones[0] ?? null;
  const firstHall = firstZone?.halls[0] ?? null;

  if (selection.type === "zone") {
    const zone = resolveZone(campus, selection.id);
    if (zone) {
      return { kind: "zone", zoneId: zone.id, hallId: zone.halls[0]?.id ?? null };
    }
  }

  if (selection.type === "hall") {
    for (const zone of campus.zones) {
      const hall = zone.halls.find((entry) => entry.id === selection.id);
      if (hall) {
        return { kind: "hall", zoneId: zone.id, hallId: hall.id };
      }
    }
  }

  if (selection.type === "rack") {
    const match = findHallByRackId(campus, selection.id);
    if (match) {
      return { kind: "hall", zoneId: match.zone.id, hallId: match.hall.id };
    }
  }

  return {
    kind: "campus",
    zoneId: firstZone?.id ?? null,
    hallId: firstHall?.id ?? null,
  };
}

function deriveGlobalSelection(campus: Campus, builderSelection: BuilderSelectionState): Selection {
  if (builderSelection.kind === "zone" && builderSelection.zoneId) {
    return { id: builderSelection.zoneId, type: "zone" };
  }

  if (builderSelection.kind === "hall" && builderSelection.hallId) {
    return { id: builderSelection.hallId, type: "hall" };
  }

  return { id: campus.id, type: "campus" };
}

function replaceZone(campus: Campus, zoneId: string, nextZone: Zone): Campus {
  return {
    ...campus,
    zones: campus.zones.map((zone) => (zone.id === zoneId ? nextZone : zone)),
  };
}

function replaceHall(zone: Zone, hallId: string, nextHall: Hall): Zone {
  return {
    ...zone,
    halls: zone.halls.map((hall) => (hall.id === hallId ? nextHall : hall)),
  };
}

function syncHallRackCount(hall: Hall, rackCount: number): Hall {
  const groupId = hall.rackGroups[0]?.id ?? formatRackGroupId(hall.id, 1);
  const groupName = hall.rackGroups[0]?.name || "Default Group";

  return {
    ...hall,
    rackCount,
    rackGroups: [
      {
        id: groupId,
        name: groupName,
        rackCount,
      },
    ],
  };
}

function isHallProfileInheritedFromZone(hall: Hall, zone: Zone): boolean {
  return (
    hall.profile.rackDensityKW === zone.hallDefaults.rackDensityKW
    && hall.profile.redundancy === zone.hallDefaults.redundancy
    && hall.profile.containment === zone.hallDefaults.containment
    && hall.profile.coolingType === zone.hallDefaults.coolingType
  );
}

export function CampusBuilderPanel({
  campus,
  params,
  selection,
  onSelectionChange,
  onCampusChange,
  onOpenHallParameters,
}: CampusBuilderPanelProps) {
  const [draft, setDraft] = useState<Campus>(() => reconcileCampus(campus));
  const [issues, setIssues] = useState<CampusValidationIssue[]>(() => validateCampus(campus));
  const [builderSelection, setBuilderSelection] = useState<BuilderSelectionState>({
    kind: "campus",
    zoneId: campus.zones[0]?.id ?? null,
    hallId: campus.zones[0]?.halls[0]?.id ?? null,
  });
  const selectionSyncSourceRef = useRef<"external" | "internal">("external");
  const [expandedZones, setExpandedZones] = useState<Record<string, boolean>>({});
  const [zoneHallVisibility, setZoneHallVisibility] = useState<Record<string, number>>({});
  const updateBuilderSelection = useCallback(
    (next: React.SetStateAction<BuilderSelectionState>, source: "external" | "internal" = "internal") => {
      selectionSyncSourceRef.current = source;
      setBuilderSelection(next);
    },
    []
  );

  useEffect(() => {
    const next = reconcileCampus(campus);
    setDraft(next);
    setIssues(validateCampus(next));
  }, [campus]);

  useEffect(() => {
    const next = deriveBuilderSelection(draft, selection);
    updateBuilderSelection((current) => {
      if (
        current.kind === next.kind &&
        current.zoneId === next.zoneId &&
        current.hallId === next.hallId
      ) {
        return current;
      }
      return next;
    }, "external");
  }, [draft, selection, updateBuilderSelection]);

  useEffect(() => {
    setExpandedZones((current) => {
      const next = { ...current };
      let changed = false;

      draft.zones.forEach((zone) => {
        if (next[zone.id] === undefined) {
          next[zone.id] = zone.id === builderSelection.zoneId || zone.halls.length <= HALL_PAGE_SIZE;
          changed = true;
        }
      });

      Object.keys(next).forEach((zoneId) => {
        if (!draft.zones.some((zone) => zone.id === zoneId)) {
          delete next[zoneId];
          changed = true;
        }
      });

      return changed ? next : current;
    });

    setZoneHallVisibility((current) => {
      const next = { ...current };
      let changed = false;

      draft.zones.forEach((zone) => {
        const minimumVisible = Math.min(HALL_PAGE_SIZE, zone.halls.length);
        const currentVisible = next[zone.id];

        if (currentVisible === undefined) {
          next[zone.id] = minimumVisible;
          changed = true;
          return;
        }

        const clamped = Math.max(minimumVisible, Math.min(currentVisible, zone.halls.length));
        if (clamped !== currentVisible) {
          next[zone.id] = clamped;
          changed = true;
        }
      });

      Object.keys(next).forEach((zoneId) => {
        if (!draft.zones.some((zone) => zone.id === zoneId)) {
          delete next[zoneId];
          changed = true;
        }
      });

      return changed ? next : current;
    });
  }, [builderSelection.zoneId, draft.zones]);

  const selectedZone = useMemo(() => resolveZone(draft, builderSelection.zoneId), [builderSelection.zoneId, draft]);
  const selectedHall = useMemo(() => resolveHall(selectedZone, builderSelection.hallId), [builderSelection.hallId, selectedZone]);

  useEffect(() => {
    if (!selectedZone) {
      updateBuilderSelection((current) => ({ ...current, zoneId: null, hallId: null, kind: "campus" }));
      return;
    }

    if (!draft.zones.some((zone) => zone.id === builderSelection.zoneId)) {
      updateBuilderSelection((current) => ({
        ...current,
        zoneId: selectedZone.id,
        hallId: selectedZone.halls[0]?.id ?? null,
      }));
    }
  }, [builderSelection.zoneId, draft.zones, selectedZone, updateBuilderSelection]);

  useEffect(() => {
    if (!selectedZone) {
      return;
    }

    if (selectedZone.halls.length === 0) {
      updateBuilderSelection((current) => ({ ...current, hallId: null }));
      return;
    }

    if (!selectedZone.halls.some((hall) => hall.id === builderSelection.hallId)) {
      updateBuilderSelection((current) => ({ ...current, hallId: selectedZone.halls[0].id }));
    }
  }, [builderSelection.hallId, selectedZone, updateBuilderSelection]);

  useEffect(() => {
    if (!onSelectionChange) {
      return;
    }

    if (selectionSyncSourceRef.current !== "internal") {
      return;
    }

    const nextSelection = deriveGlobalSelection(draft, builderSelection);
    selectionSyncSourceRef.current = "external";
    if (selection.type === nextSelection.type && selection.id === nextSelection.id) {
      return;
    }

    onSelectionChange(nextSelection);
  }, [builderSelection, draft, onSelectionChange, selection.id, selection.type]);

  const totals = useMemo(() => {
    const halls = draft.zones.flatMap((zone) => zone.halls);
    const racks = halls.reduce((sum, hall) => sum + hall.rackCount, 0);

    return {
      zones: draft.zones.length,
      halls: halls.length,
      racks,
    };
  }, [draft]);

  const zoneRackTotal = useMemo(() => {
    if (!selectedZone) {
      return 0;
    }
    return selectedZone.halls.reduce((sum, hall) => sum + hall.rackCount, 0);
  }, [selectedZone]);

  const selectionScope = useMemo(() => {
    if (builderSelection.kind === "hall" && selectedZone && selectedHall) {
      return {
        label: `${selectedZone.metadata.name || selectedZone.id} / ${selectedHall.metadata.name || selectedHall.id}`,
        guidance: "Hall edits update only this hall's structure. Use Rack Parameters for technical profile overrides.",
        halls: 1,
        racks: selectedHall.rackCount,
      };
    }

    if (builderSelection.kind === "zone" && selectedZone) {
      return {
        label: selectedZone.metadata.name || selectedZone.id,
        guidance: "Zone rules set rack-count guardrails and defaults for every hall in this zone.",
        halls: selectedZone.halls.length,
        racks: zoneRackTotal,
      };
    }

    return {
      label: draft.metadata.name || "Campus",
      guidance: "Campus edits shape global structure. Runtime KPIs stay in the Inspector panel on the right.",
      halls: totals.halls,
      racks: totals.racks,
    };
  }, [builderSelection.kind, draft.metadata.name, selectedHall, selectedZone, totals.halls, totals.racks, zoneRackTotal]);

  const selectionIssues = useMemo(() => {
    if (builderSelection.kind === "campus") {
      return issues;
    }

    const tokens = new Set<string>();
    if (selectedZone) {
      if (selectedZone.metadata.name.trim()) {
        tokens.add(selectedZone.metadata.name.trim().toLowerCase());
      }
      tokens.add(selectedZone.id.toLowerCase());
      tokens.add(`zone ${selectedZone.zoneIndex}`.toLowerCase());
    }
    if (selectedHall) {
      if (selectedHall.metadata.name.trim()) {
        tokens.add(selectedHall.metadata.name.trim().toLowerCase());
      }
      tokens.add(selectedHall.id.toLowerCase());
      tokens.add(`hall ${selectedHall.hallIndex}`.toLowerCase());
    }

    const lookup = Array.from(tokens).filter(Boolean);
    if (lookup.length === 0) {
      return [];
    }

    return issues.filter((issue) => {
      const path = issue.path.toLowerCase();
      return lookup.some((token) => path.includes(token));
    });
  }, [builderSelection.kind, issues, selectedHall, selectedZone]);

  const commitDraft = useCallback(
    (next: Campus) => {
      const nextIssues = validateCampus(next);
      setIssues(nextIssues);

      if (nextIssues.length === 0) {
        const reconciled = reconcileCampus(next);
        setDraft(reconciled);
        onCampusChange(reconciled, deriveParamsFromReconciledCampus(reconciled, params));
        return;
      }

      setDraft(next);
    },
    [onCampusChange, params]
  );

  const addZone = () => {
    const nextZoneIndex = draft.zones.length + 1;
    const zoneId = formatZoneId(nextZoneIndex);
    const nextHallIndex = draft.zones.reduce((sum, zone) => sum + zone.halls.length, 0) + 1;
    const hallId = formatHallId(nextHallIndex);
    const sourceZone = draft.zones[0];
    const defaultRackCount = sourceZone?.rackRules.defaultRackCount ?? 120;

    const nextZone: Zone = {
      id: zoneId,
      zoneIndex: nextZoneIndex,
      metadata: {
        name: `Zone ${String.fromCharCode(64 + Math.min(nextZoneIndex, 26))}`,
      },
      hallDefaults: sourceZone?.hallDefaults ?? {
        rackDensityKW: params.rackPowerDensity,
        redundancy: params.redundancy,
        containment: params.containment,
        coolingType: params.coolingType,
      },
      rackRules: sourceZone?.rackRules ?? {
        minRackCount: 4,
        maxRackCount: 450,
        defaultRackCount,
        step: 2,
      },
      halls: [
        {
          id: hallId,
          hallIndex: nextHallIndex,
          rackCount: defaultRackCount,
          rackStartIndex: 0,
          rackEndIndex: 0,
          metadata: {
            name: `Hall ${nextHallIndex}`,
          },
          profile: {
            rackDensityKW: sourceZone?.hallDefaults.rackDensityKW ?? params.rackPowerDensity,
            redundancy: sourceZone?.hallDefaults.redundancy ?? params.redundancy,
            containment: sourceZone?.hallDefaults.containment ?? params.containment,
            coolingType: sourceZone?.hallDefaults.coolingType ?? params.coolingType,
          },
          rackGroups: [
            {
              id: formatRackGroupId(hallId, 1),
              name: "Default Group",
              rackCount: defaultRackCount,
            },
          ],
          racks: [],
        },
      ],
    };

    commitDraft({ ...draft, zones: [...draft.zones, nextZone] });
    updateBuilderSelection({ kind: "zone", zoneId, hallId });
  };

  const removeZone = (zoneId: string) => {
    if (draft.zones.length <= 1) {
      return;
    }

    commitDraft({
      ...draft,
      zones: draft.zones.filter((zone) => zone.id !== zoneId),
    });
  };

  const addHall = (zone: Zone) => {
    const nextHallIndex = draft.zones.reduce((sum, entry) => sum + entry.halls.length, 0) + 1;
    const hallId = formatHallId(nextHallIndex);
    const rackCount = zone.rackRules.defaultRackCount;

    const hall: Hall = {
      id: hallId,
      hallIndex: nextHallIndex,
      rackCount,
      rackStartIndex: 0,
      rackEndIndex: 0,
      metadata: { name: `Hall ${nextHallIndex}` },
      profile: {
        rackDensityKW: zone.hallDefaults.rackDensityKW,
        redundancy: zone.hallDefaults.redundancy,
        containment: zone.hallDefaults.containment,
        coolingType: zone.hallDefaults.coolingType,
      },
      rackGroups: [
        {
          id: formatRackGroupId(hallId, 1),
          name: "Default Group",
          rackCount,
        },
      ],
      racks: [],
    };

    commitDraft(replaceZone(draft, zone.id, { ...zone, halls: [...zone.halls, hall] }));
    updateBuilderSelection({ kind: "hall", zoneId: zone.id, hallId });
  };

  const removeHall = (zone: Zone, hallId: string) => {
    if (zone.halls.length <= 1) {
      return;
    }

    const nextZone: Zone = {
      ...zone,
      halls: zone.halls.filter((hall) => hall.id !== hallId),
    };

    commitDraft(replaceZone(draft, zone.id, nextZone));
  };

  const updateZone = (zoneId: string, updater: (zone: Zone) => Zone) => {
    const zone = draft.zones.find((entry) => entry.id === zoneId);
    if (!zone) {
      return;
    }
    commitDraft(replaceZone(draft, zoneId, updater(zone)));
  };

  const updateHall = (zoneId: string, hallId: string, updater: (hall: Hall, zone: Zone) => Hall) => {
    const zone = draft.zones.find((entry) => entry.id === zoneId);
    if (!zone) {
      return;
    }

    const hall = zone.halls.find((entry) => entry.id === hallId);
    if (!hall) {
      return;
    }

    const nextZone = replaceHall(zone, hallId, updater(hall, zone));
    commitDraft(replaceZone(draft, zoneId, nextZone));
  };

  const toggleZoneExpanded = (zoneId: string) => {
    setExpandedZones((current) => ({
      ...current,
      [zoneId]: !(current[zoneId] ?? true),
    }));
  };

  const showMoreHalls = (zoneId: string, hallCount: number) => {
    setZoneHallVisibility((current) => ({
      ...current,
      [zoneId]: Math.min(
        hallCount,
        (current[zoneId] ?? Math.min(HALL_PAGE_SIZE, hallCount)) + HALL_PAGE_SIZE
      ),
    }));
  };

  const showLessHalls = (zoneId: string, hallCount: number) => {
    setZoneHallVisibility((current) => ({
      ...current,
      [zoneId]: Math.max(
        Math.min(HALL_PAGE_SIZE, hallCount),
        (current[zoneId] ?? Math.min(HALL_PAGE_SIZE, hallCount)) - HALL_PAGE_SIZE
      ),
    }));
  };

  return (
    <div className="campus-builder">
      <div className="builder-flow-header">
        <div>
          <div className="param-section-title">Campus Builder</div>
          <p className="builder-helper">Build structure first: Campus → Zones → Data Halls → Rack counts.</p>
        </div>
        <button type="button" className="builder-btn" onClick={addZone}>Add Zone</button>
      </div>

      <div className="builder-summary-inline">
        <span>{totals.zones} zones</span>
        <span>{totals.halls} halls</span>
        <span>{totals.racks.toLocaleString()} racks</span>
      </div>

      <div className="builder-tree">
        <div className={`builder-node builder-node-campus ${builderSelection.kind === "campus" ? "active" : ""}`}>
          <button
            type="button"
            className="builder-node-main"
            onClick={() => updateBuilderSelection((current) => ({ ...current, kind: "campus" }))}
          >
            <span className="builder-node-title">Campus</span>
            <span className="builder-node-meta">{draft.metadata.name || "Untitled Campus"}</span>
          </button>
        </div>

        {draft.zones.map((zone) => {
          const zoneRackTotal = zone.halls.reduce((sum, hall) => sum + hall.rackCount, 0);
          const isZoneExpanded = expandedZones[zone.id] ?? (zone.id === builderSelection.zoneId || zone.halls.length <= HALL_PAGE_SIZE);
          const visibleLimit = Math.min(
            zone.halls.length,
            zoneHallVisibility[zone.id] ?? Math.min(HALL_PAGE_SIZE, zone.halls.length)
          );
          const selectedHallForZone = builderSelection.zoneId === zone.id
            ? zone.halls.find((hall) => hall.id === builderSelection.hallId) ?? null
            : null;
          const previewHalls = zone.halls.filter((hall, index) => index < HALL_PREVIEW_COUNT || hall.id === selectedHallForZone?.id);
          const previewHallIds = new Set(previewHalls.map((hall) => hall.id));
          const previewHiddenCount = zone.halls.reduce(
            (hidden, hall) => hidden + (previewHallIds.has(hall.id) ? 0 : 1),
            0
          );
          const visibleHalls = zone.halls.filter((hall, index) => index < visibleLimit || hall.id === selectedHallForZone?.id);
          const minVisible = Math.min(HALL_PAGE_SIZE, zone.halls.length);
          const canShowMore = zone.halls.length > visibleLimit;
          const canShowLess = visibleLimit > minVisible;
          const showMoreCount = Math.min(HALL_PAGE_SIZE, Math.max(0, zone.halls.length - visibleLimit));

          return (
            <div key={zone.id} className="builder-zone-block">
              <div className={`builder-node builder-node-zone ${builderSelection.zoneId === zone.id && builderSelection.kind !== "hall" ? "active" : ""}`}>
                <button
                  type="button"
                  className="builder-node-main"
                  onClick={() => updateBuilderSelection({ kind: "zone", zoneId: zone.id, hallId: zone.halls[0]?.id ?? null })}
                >
                  <span className="builder-node-title">Zone</span>
                  <span className="builder-node-meta">{zone.metadata.name || zone.id} • {zone.halls.length} halls • {zoneRackTotal} racks</span>
                </button>
                <div className="builder-node-actions">
                  <button type="button" className="builder-btn builder-btn-small" onClick={() => addHall(zone)}>+ Hall</button>
                  <button
                    type="button"
                    className="builder-btn builder-btn-small"
                    onClick={() => removeZone(zone.id)}
                    disabled={draft.zones.length <= 1}
                  >
                    Remove
                  </button>
                </div>
              </div>

              <div className="builder-zone-toolbar">
                <button
                  type="button"
                  className="builder-btn builder-btn-small"
                  onClick={() => toggleZoneExpanded(zone.id)}
                >
                  {isZoneExpanded ? "Collapse Halls" : `Show Halls (${zone.halls.length})`}
                </button>
                {isZoneExpanded && canShowMore ? (
                  <button
                    type="button"
                    className="builder-btn builder-btn-small"
                    onClick={() => showMoreHalls(zone.id, zone.halls.length)}
                  >
                    {`Show +${showMoreCount}`}
                  </button>
                ) : null}
                {isZoneExpanded && canShowLess ? (
                  <button
                    type="button"
                    className="builder-btn builder-btn-small"
                    onClick={() => showLessHalls(zone.id, zone.halls.length)}
                  >
                    Show Less
                  </button>
                ) : null}
                {!isZoneExpanded && previewHiddenCount > 0 ? (
                  <span className="builder-zone-note">{`+${previewHiddenCount} hidden halls`}</span>
                ) : null}
              </div>

              {isZoneExpanded ? (
                <div className="builder-hall-list">
                  {visibleHalls.map((hall) => {
                    const inheritedFromZone = isHallProfileInheritedFromZone(hall, zone);
                    return (
                      <div key={hall.id} className={`builder-hall-row ${builderSelection.hallId === hall.id && builderSelection.zoneId === zone.id ? "active" : ""}`}>
                      <button
                        type="button"
                        className="builder-hall-select"
                        onClick={() => updateBuilderSelection({ kind: "hall", zoneId: zone.id, hallId: hall.id })}
                      >
                        <span className="builder-hall-select-name">{hall.metadata.name || hall.id}</span>
                        <span className={`builder-profile-badge ${inheritedFromZone ? "inherited" : "overridden"}`}>
                          {inheritedFromZone ? "Inherited" : "Overridden"}
                        </span>
                      </button>
                      <button
                        type="button"
                        className="builder-btn builder-btn-small builder-hall-remove"
                        onClick={() => removeHall(zone, hall.id)}
                        disabled={zone.halls.length <= 1}
                      >
                        Remove
                      </button>
                      <div className="builder-hall-stepper">
                        <span className="builder-hall-unit">Racks</span>
                        <button
                          type="button"
                          className="builder-step-btn"
                          onClick={() => {
                            const nextRackCount = clamp(
                              hall.rackCount - zone.rackRules.step,
                              zone.rackRules.minRackCount,
                              zone.rackRules.maxRackCount
                            );
                            updateHall(zone.id, hall.id, (current) => syncHallRackCount(current, nextRackCount));
                          }}
                        >
                          -
                        </button>
                        <input
                          type="number"
                          min={zone.rackRules.minRackCount}
                          max={zone.rackRules.maxRackCount}
                          step={zone.rackRules.step}
                          className="input-field builder-rack-count"
                          value={hall.rackCount}
                          onChange={(event) => {
                            const parsed = parseNumberOrFallback(event.target.value, hall.rackCount);
                            const nextRackCount = clamp(
                              Math.round(parsed),
                              zone.rackRules.minRackCount,
                              zone.rackRules.maxRackCount
                            );
                            updateHall(zone.id, hall.id, (current) => syncHallRackCount(current, nextRackCount));
                          }}
                        />
                        <button
                          type="button"
                          className="builder-step-btn"
                          onClick={() => {
                            const nextRackCount = clamp(
                              hall.rackCount + zone.rackRules.step,
                              zone.rackRules.minRackCount,
                              zone.rackRules.maxRackCount
                            );
                            updateHall(zone.id, hall.id, (current) => syncHallRackCount(current, nextRackCount));
                          }}
                        >
                          +
                        </button>
                      </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="builder-hall-preview-list">
                  {previewHalls.map((hall) => {
                    const inheritedFromZone = isHallProfileInheritedFromZone(hall, zone);
                    return (
                    <button
                      type="button"
                      key={hall.id}
                      className={`builder-hall-preview ${builderSelection.hallId === hall.id && builderSelection.zoneId === zone.id ? "active" : ""}`}
                      onClick={() => updateBuilderSelection({ kind: "hall", zoneId: zone.id, hallId: hall.id })}
                    >
                      <span className="builder-hall-preview-name">
                        <span>{hall.metadata.name || hall.id}</span>
                        <span className={`builder-profile-badge ${inheritedFromZone ? "inherited" : "overridden"}`}>
                          {inheritedFromZone ? "Inherited" : "Overridden"}
                        </span>
                      </span>
                      <span className="builder-hall-preview-meta">{`${hall.rackCount.toLocaleString()} racks`}</span>
                    </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="param-section builder-details">
        <div className="param-section-title">Edit Selected Node</div>
        <div className="builder-context-head">
          <div className="builder-context-title">{selectionScope.label}</div>
          <p className="builder-helper">{selectionScope.guidance}</p>
        </div>
        <div className="builder-context-metrics">
          <div className="builder-context-metric">
            <span>Affected Halls</span>
            <strong>{selectionScope.halls.toLocaleString()}</strong>
          </div>
          <div className="builder-context-metric">
            <span>Affected Racks</span>
            <strong>{selectionScope.racks.toLocaleString()}</strong>
          </div>
          <div className="builder-context-metric">
            <span>Scope Issues</span>
            <strong>{selectionIssues.length.toLocaleString()}</strong>
          </div>
        </div>

        {builderSelection.kind === "campus" ? (
          <>
            <label className="builder-field">
              <span>Campus Name</span>
              <input
                type="text"
                className="input-field"
                value={draft.metadata.name}
                onChange={(event) => {
                  commitDraft({
                    ...draft,
                    metadata: { ...draft.metadata, name: event.target.value },
                  });
                }}
              />
            </label>
          </>
        ) : null}

        {builderSelection.kind === "zone" && selectedZone ? (
          <>
            <label className="builder-field">
              <span>Zone Name</span>
              <input
                type="text"
                className="input-field"
                value={selectedZone.metadata.name}
                onChange={(event) => updateZone(selectedZone.id, (zone) => ({
                  ...zone,
                  metadata: { ...zone.metadata, name: event.target.value },
                }))}
              />
            </label>
            <div className="builder-grid builder-grid-two">
              <label className="builder-field">
                <span>Rack Min</span>
                <input
                  type="number"
                  min={1}
                  className="input-field"
                  value={selectedZone.rackRules.minRackCount}
                  onChange={(event) => updateZone(selectedZone.id, (zone) => ({
                    ...zone,
                    rackRules: {
                      ...zone.rackRules,
                      minRackCount: parseNumberOrFallback(event.target.value, zone.rackRules.minRackCount),
                    },
                  }))}
                />
              </label>
              <label className="builder-field">
                <span>Rack Max</span>
                <input
                  type="number"
                  min={1}
                  className="input-field"
                  value={selectedZone.rackRules.maxRackCount}
                  onChange={(event) => updateZone(selectedZone.id, (zone) => ({
                    ...zone,
                    rackRules: {
                      ...zone.rackRules,
                      maxRackCount: parseNumberOrFallback(event.target.value, zone.rackRules.maxRackCount),
                    },
                  }))}
                />
              </label>
            </div>
            <div className="builder-grid builder-grid-two">
              <label className="builder-field">
                <span>Default Rack Count</span>
                <input
                  type="number"
                  min={selectedZone.rackRules.minRackCount}
                  max={selectedZone.rackRules.maxRackCount}
                  className="input-field"
                  value={selectedZone.rackRules.defaultRackCount}
                  onChange={(event) => updateZone(selectedZone.id, (zone) => {
                    const parsed = parseNumberOrFallback(event.target.value, zone.rackRules.defaultRackCount);
                    return {
                      ...zone,
                      rackRules: {
                        ...zone.rackRules,
                        defaultRackCount: clamp(
                          Math.round(parsed),
                          zone.rackRules.minRackCount,
                          zone.rackRules.maxRackCount
                        ),
                      },
                    };
                  })}
                />
              </label>
              <label className="builder-field">
                <span>Rack Step</span>
                <input
                  type="number"
                  min={1}
                  className="input-field"
                  value={selectedZone.rackRules.step}
                  onChange={(event) => updateZone(selectedZone.id, (zone) => ({
                    ...zone,
                    rackRules: {
                      ...zone.rackRules,
                      step: parseNumberOrFallback(event.target.value, zone.rackRules.step),
                    },
                  }))}
                />
              </label>
            </div>
          </>
        ) : null}

        {builderSelection.kind === "hall" && selectedZone && selectedHall ? (
          <>
            <label className="builder-field">
              <span>Data Hall Name</span>
              <input
                type="text"
                className="input-field"
                value={selectedHall.metadata.name}
                onChange={(event) => updateHall(selectedZone.id, selectedHall.id, (hall) => ({
                  ...hall,
                  metadata: { ...hall.metadata, name: event.target.value },
                }))}
              />
            </label>
            <label className="builder-field">
              <span>Rack Count</span>
              <input
                type="number"
                min={selectedZone.rackRules.minRackCount}
                max={selectedZone.rackRules.maxRackCount}
                step={selectedZone.rackRules.step}
                className="input-field"
                value={selectedHall.rackCount}
                onChange={(event) => {
                  const parsed = parseNumberOrFallback(event.target.value, selectedHall.rackCount);
                  const nextRackCount = clamp(
                    Math.round(parsed),
                    selectedZone.rackRules.minRackCount,
                    selectedZone.rackRules.maxRackCount
                  );
                  updateHall(selectedZone.id, selectedHall.id, (hall) => syncHallRackCount(hall, nextRackCount));
                }}
              />
            </label>
            <p className="builder-helper">
              Zone guardrails: min {selectedZone.rackRules.minRackCount}, max {selectedZone.rackRules.maxRackCount},
              step {selectedZone.rackRules.step}.
            </p>
            <div className="builder-inline-actions">
              <button
                type="button"
                className="builder-btn"
                onClick={() => onOpenHallParameters?.(selectedZone.id, selectedHall.id)}
                disabled={!onOpenHallParameters}
              >
                Tune Technical Parameters
              </button>
            </div>
          </>
        ) : null}
      </div>

      <div className={`builder-validation ${issues.length > 0 ? "has-errors" : "is-valid"}`}>
        <div className="builder-validation-title">
          {issues.length > 0 ? `Configuration issues (${issues.length})` : "Configuration valid"}
        </div>
        {issues.length > 0 ? (
          <>
            {builderSelection.kind !== "campus" ? (
              <p className="builder-validation-scope">
                {selectionIssues.length > 0
                  ? `${selectionIssues.length} issue(s) match this selection.`
                  : `No direct issues in this selection. Remaining issues are in other campus nodes.`}
              </p>
            ) : null}
            <ul className="builder-validation-list">
              {(builderSelection.kind === "campus" ? issues : selectionIssues.length > 0 ? selectionIssues : issues).slice(0, 6).map((issue) => (
              <li key={`${issue.path}-${issue.message}`}>
                <strong>{issue.path}:</strong> {issue.message} {issue.recommendation}
              </li>
            ))}
            </ul>
          </>
        ) : (
          <p className="builder-helper">Live sync is on. Structure edits update the 3D scene and right inspector immediately.</p>
        )}
      </div>
    </div>
  );
}
