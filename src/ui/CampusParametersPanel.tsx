"use client";

import { useEffect, useMemo, useState } from "react";
import { Dropdown } from "./Dropdown";
import {
  applyCampusPropertyPatch,
  applyRackProfilePatchByScope,
  deriveParamsFromReconciledCampus,
  reconcileCampus,
  validateCampus,
} from "@/model";
import type { Campus, CoolingType, ContainmentType, Hall, Params, Redundancy, Zone } from "@/state";

const REDUNDANCY_OPTIONS: Redundancy[] = ["N", "N+1", "2N"];
const CONTAINMENT_OPTIONS: ContainmentType[] = ["None", "Hot Aisle", "Cold Aisle", "Full Enclosure"];
const COOLING_OPTIONS: CoolingType[] = ["Air-Cooled", "DLC", "Hybrid"];

type ScopeLevel = "campus" | "zone" | "hall";

export interface ParameterFocusRequest {
  zoneId: string | null;
  hallId: string | null;
  nonce: number;
}

interface CampusParametersPanelProps {
  campus: Campus;
  params: Params;
  onCampusChange: (campus: Campus, params: Params) => void;
  focusRequest?: ParameterFocusRequest;
}

function parseNumberOrFallback(raw: string, fallback: number): number {
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function findZone(campus: Campus, zoneId: string | null) {
  if (!zoneId) {
    return campus.zones[0] ?? null;
  }
  return campus.zones.find((zone) => zone.id === zoneId) ?? campus.zones[0] ?? null;
}

function findHall(campus: Campus, hallId: string | null) {
  if (!hallId) {
    return null;
  }

  for (const zone of campus.zones) {
    const hall = zone.halls.find((entry) => entry.id === hallId);
    if (hall) {
      return { zoneId: zone.id, hall };
    }
  }

  return null;
}

function resolveScopeHalls(campus: Campus, level: ScopeLevel, zoneId: string | null, hallId: string | null) {
  if (level === "campus") {
    return campus.zones.flatMap((zone) => zone.halls.map((hall) => ({ zoneId: zone.id, hall })));
  }

  if (level === "zone") {
    const zone = findZone(campus, zoneId);
    return zone ? zone.halls.map((hall) => ({ zoneId: zone.id, hall })) : [];
  }

  const hallMatch = findHall(campus, hallId);
  if (!hallMatch) {
    return [];
  }
  return [{ zoneId: hallMatch.zoneId, hall: hallMatch.hall }];
}

function resolveScopeProfile(campus: Campus, level: ScopeLevel, zoneId: string | null, hallId: string | null, fallback: Params) {
  const halls = resolveScopeHalls(campus, level, zoneId, hallId);
  if (halls.length === 0) {
    return {
      rackDensityKW: fallback.rackPowerDensity,
      redundancy: fallback.redundancy,
      containment: fallback.containment,
      coolingType: fallback.coolingType,
    };
  }

  const first = halls[0].hall.profile;
  return {
    rackDensityKW: first.rackDensityKW,
    redundancy: first.redundancy,
    containment: first.containment,
    coolingType: first.coolingType,
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

export function CampusParametersPanel({ campus, params, onCampusChange, focusRequest }: CampusParametersPanelProps) {
  const [scopeLevel, setScopeLevel] = useState<ScopeLevel>("campus");
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(campus.zones[0]?.id ?? null);
  const [selectedHallId, setSelectedHallId] = useState<string | null>(campus.zones[0]?.halls[0]?.id ?? null);

  const selectedZone = useMemo(() => findZone(campus, selectedZoneId), [campus, selectedZoneId]);
  const selectedHall = useMemo(
    () => selectedZone?.halls.find((hall) => hall.id === selectedHallId) ?? null,
    [selectedHallId, selectedZone]
  );

  useEffect(() => {
    const zone = findZone(campus, selectedZoneId);
    if (!zone) {
      setSelectedZoneId(null);
      setSelectedHallId(null);
      return;
    }

    if (zone.id !== selectedZoneId) {
      setSelectedZoneId(zone.id);
    }

    if (!zone.halls.some((hall) => hall.id === selectedHallId)) {
      setSelectedHallId(zone.halls[0]?.id ?? null);
    }
  }, [campus, selectedHallId, selectedZoneId]);

  useEffect(() => {
    if (!focusRequest || focusRequest.nonce === 0) {
      return;
    }

    if (focusRequest.hallId) {
      const hallMatch = findHall(campus, focusRequest.hallId);
      if (hallMatch) {
        setScopeLevel("hall");
        setSelectedZoneId(hallMatch.zoneId);
        setSelectedHallId(hallMatch.hall.id);
        return;
      }
    }

    if (focusRequest.zoneId) {
      const zone = findZone(campus, focusRequest.zoneId);
      if (zone) {
        setScopeLevel("zone");
        setSelectedZoneId(zone.id);
        setSelectedHallId(zone.halls[0]?.id ?? null);
      }
    }
  }, [campus, focusRequest]);

  const scopeHalls = useMemo(
    () => resolveScopeHalls(campus, scopeLevel, selectedZoneId, selectedHallId),
    [campus, scopeLevel, selectedHallId, selectedZoneId]
  );

  const scopeProfile = useMemo(
    () => resolveScopeProfile(campus, scopeLevel, selectedZoneId, selectedHallId, params),
    [campus, params, scopeLevel, selectedHallId, selectedZoneId]
  );

  const scopeRackCount = scopeHalls.reduce((sum, entry) => sum + entry.hall.rackCount, 0);
  const selectedHallInheritedFromZone = useMemo(
    () => (selectedZone && selectedHall ? isHallProfileInheritedFromZone(selectedHall, selectedZone) : null),
    [selectedHall, selectedZone]
  );
  const scopeImpactLine = useMemo(() => {
    if (scopeLevel === "campus") {
      return `Next profile change will update ${scopeHalls.length.toLocaleString()} hall(s) (${scopeRackCount.toLocaleString()} racks) across campus and refresh defaults in ${campus.zones.length.toLocaleString()} zone(s).`;
    }

    if (scopeLevel === "zone" && selectedZone) {
      return `Next profile change will update ${scopeHalls.length.toLocaleString()} hall(s) (${scopeRackCount.toLocaleString()} racks) in ${selectedZone.metadata.name || selectedZone.id} and refresh this zone's hall defaults.`;
    }

    if (scopeLevel === "hall" && selectedHall) {
      return `Next profile change will update only ${selectedHall.metadata.name || selectedHall.id} (${selectedHall.rackCount.toLocaleString()} racks). Zone defaults stay unchanged.`;
    }

    return "Select a valid scope target before applying profile changes.";
  }, [campus.zones.length, scopeHalls.length, scopeLevel, scopeRackCount, selectedHall, selectedZone]);

  const commitCampus = (nextCampus: Campus) => {
    const reconciled = reconcileCampus(nextCampus);
    const issues = validateCampus(reconciled);
    if (issues.length > 0) {
      return;
    }

    onCampusChange(reconciled, deriveParamsFromReconciledCampus(reconciled, params));
  };

  const applyRackProfilePatch = (patch: {
    rackDensityKW?: number;
    redundancy?: Redundancy;
    containment?: ContainmentType;
    coolingType?: CoolingType;
  }) => {
    const nextCampus = applyRackProfilePatchByScope(
      campus,
      {
        level: scopeLevel,
        zoneId: selectedZoneId,
        hallId: selectedHallId,
      },
      patch
    );
    commitCampus(nextCampus);
  };

  const resetSelectedHallToZoneDefaults = () => {
    if (!selectedZone || !selectedHall) {
      return;
    }

    const nextCampus = applyRackProfilePatchByScope(
      campus,
      {
        level: "hall",
        zoneId: selectedZone.id,
        hallId: selectedHall.id,
      },
      {
        rackDensityKW: selectedZone.hallDefaults.rackDensityKW,
        redundancy: selectedZone.hallDefaults.redundancy,
        containment: selectedZone.hallDefaults.containment,
        coolingType: selectedZone.hallDefaults.coolingType,
      }
    );
    commitCampus(nextCampus);
  };

  return (
    <div className="campus-parameters">
      <div className="builder-flow-header">
        <div>
          <div className="param-section-title">Rack Parameters</div>
          <p className="builder-helper">Tune rack-module profiles at campus, zone, or individual data hall scope.</p>
        </div>
      </div>

      <div className="param-section">
        <div className="param-section-title">Scope</div>
        <div className="builder-grid builder-grid-two">
          <Dropdown
            label="Level"
            value={scopeLevel === "campus" ? "Campus" : scopeLevel === "zone" ? "Zone" : "Data Hall"}
            options={["Campus", "Zone", "Data Hall"]}
            onChange={(value) => {
              if (value === "Campus") {
                setScopeLevel("campus");
                return;
              }
              if (value === "Zone") {
                setScopeLevel("zone");
                return;
              }
              setScopeLevel("hall");
            }}
          />

          {scopeLevel !== "campus" ? (
            <Dropdown
              label="Zone"
              value={selectedZone?.metadata.name || selectedZone?.id || "No Zone"}
              options={campus.zones.map((zone) => zone.metadata.name || zone.id)}
              onChange={(value) => {
                const zone = campus.zones.find((entry) => (entry.metadata.name || entry.id) === value);
                if (!zone) {
                  return;
                }
                setSelectedZoneId(zone.id);
                setSelectedHallId(zone.halls[0]?.id ?? null);
              }}
            />
          ) : null}

          {scopeLevel === "hall" ? (
            <Dropdown
              label="Data Hall"
              value={selectedZone?.halls.find((hall) => hall.id === selectedHallId)?.metadata.name || selectedHallId || "No Hall"}
              options={(selectedZone?.halls ?? []).map((hall) => hall.metadata.name || hall.id)}
              onChange={(value) => {
                const hall = selectedZone?.halls.find((entry) => (entry.metadata.name || entry.id) === value);
                if (!hall) {
                  return;
                }
                setSelectedHallId(hall.id);
              }}
            />
          ) : null}
        </div>
        <p className="builder-helper">
          Active scope currently targets {scopeRackCount.toLocaleString()} racks across {scopeHalls.length} data hall(s).
        </p>
        {scopeLevel === "hall" && selectedHall && selectedZone ? (
          <div className="builder-hall-override-row">
            <span>Selected Hall Status</span>
            <span className={`builder-profile-badge ${selectedHallInheritedFromZone ? "inherited" : "overridden"}`}>
              {selectedHallInheritedFromZone ? "Inherited from Zone" : "Overridden"}
            </span>
            {!selectedHallInheritedFromZone ? (
              <button type="button" className="builder-btn builder-btn-small" onClick={resetSelectedHallToZoneDefaults}>
                Reset to Zone Defaults
              </button>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="param-section">
        <div className="param-section-title">Rack Module Profile</div>
        <p className="builder-impact-line">{scopeImpactLine}</p>
        <div className="builder-grid builder-grid-two">
          <label className="builder-field">
            <span>Rack Density (kW/rack)</span>
            <input
              type="number"
              min={3}
              max={80}
              step={1}
              className="input-field"
              value={scopeProfile.rackDensityKW}
              onChange={(event) => {
                applyRackProfilePatch({
                  rackDensityKW: parseNumberOrFallback(event.target.value, scopeProfile.rackDensityKW),
                });
              }}
            />
          </label>
          <Dropdown
            label="Redundancy"
            value={scopeProfile.redundancy}
            options={REDUNDANCY_OPTIONS}
            onChange={(value) => applyRackProfilePatch({ redundancy: value as Redundancy })}
          />
          <Dropdown
            label="Containment"
            value={scopeProfile.containment}
            options={CONTAINMENT_OPTIONS}
            onChange={(value) => applyRackProfilePatch({ containment: value as ContainmentType })}
          />
          <Dropdown
            label="Cooling"
            value={scopeProfile.coolingType}
            options={COOLING_OPTIONS}
            onChange={(value) => applyRackProfilePatch({ coolingType: value as CoolingType })}
          />
        </div>
      </div>

      <div className="param-section">
        <div className="param-section-title">Campus Facility Targets</div>
        <div className="builder-grid builder-grid-two">
          <label className="builder-field">
            <span>Target PUE (1.05-2.00)</span>
            <input
              type="number"
              min={1.05}
              max={2}
              step={0.01}
              className="input-field"
              value={campus.properties.targetPUE}
              onChange={(event) => {
                const parsed = parseNumberOrFallback(event.target.value, campus.properties.targetPUE);
                commitCampus(applyCampusPropertyPatch(campus, { targetPUE: parsed }));
              }}
            />
          </label>
          <label className="builder-field">
            <span>Whitespace Ratio (0.25-0.65)</span>
            <input
              type="number"
              min={0.25}
              max={0.65}
              step={0.01}
              className="input-field"
              value={campus.properties.whitespaceRatio}
              onChange={(event) => {
                const parsed = parseNumberOrFallback(event.target.value, campus.properties.whitespaceRatio);
                commitCampus(applyCampusPropertyPatch(campus, { whitespaceRatio: parsed }));
              }}
            />
          </label>
        </div>
      </div>

    </div>
  );
}
