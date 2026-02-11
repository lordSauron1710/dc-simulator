"use client";

import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { computeDataCenter, type DataCenterModel } from "@/model";
import { useStore } from "@/state";
import type { Params, RenderQuality } from "@/state/types";

const FOOT_TO_WORLD = 0.115;
const FLOOR_SIZE = 280;
const WORLD_UP = new THREE.Vector3(0, 1, 0);
const TOUR_SCROLL_SENSITIVITY = 0.00055;
const TOUR_DAMPING = 9.5;
const ORBIT_DRAG_SPEED = 0.004;
const PAN_DRAG_SPEED = 1.15;
const ORBIT_PITCH_LIMIT = Math.PI * 0.43;
const DRAG_THRESHOLD_SQ = 9;
const WHEEL_ZOOM_SENSITIVITY = 0.0016;
const WHEEL_ZOOM_MIN_FACTOR = 0.38;
const WHEEL_ZOOM_MAX_FACTOR = 2.4;
const RACK_HOVER_FOCUS_DAMPING = 9.5;
const RACK_HOVER_TARGET_DAMPING = 12;
const RACK_HOVER_FOCUS_DISTANCE_SCALE = 0.52;
const QUALITY_PIXEL_RATIO_CAP: Record<RenderQuality, number> = {
  performance: 1,
  balanced: 1.5,
  quality: 2,
};

const PARAM_RANGES = {
  criticalLoadMW: { min: 0.5, max: 1000 },
  whitespaceAreaSqFt: { min: 5000, max: 1000000 },
  dataHalls: { min: 1, max: 100 },
  whitespaceRatio: { min: 0.25, max: 0.65 },
  rackPowerDensity: { min: 3, max: 80 },
  pue: { min: 1.05, max: 2 },
} as const;

type InteractiveKind = "building" | "hall" | "rack";

type DisposableObject3D = THREE.Object3D & {
  geometry?: THREE.BufferGeometry;
  material?: THREE.Material | THREE.Material[];
};

const INTERACTION_PRIORITY: Record<InteractiveKind, number> = {
  building: 1,
  hall: 2,
  rack: 3,
};

interface VisualProfile {
  baseColor: number;
  hoverColor: number;
  baseOpacity: number;
  hoverOpacity: number;
  baseEmissiveIntensity: number;
  hoverEmissiveIntensity: number;
}

interface InteractiveEntity {
  key: string;
  mesh: THREE.Mesh;
  type: InteractiveKind;
  id: string;
  profile: VisualProfile;
}

interface HoverTarget {
  type: InteractiveKind;
  id: string;
  entityKey: string | null;
  rackInstanceIndex: number | null;
}

interface RackColorProfile {
  base: THREE.Color;
  hover: THREE.Color;
  selected: THREE.Color;
}

interface CoolingPalette {
  shell: number;
  shellEdge: number;
  hall: number;
  hallEdge: number;
  containmentHot: number;
  containmentCold: number;
  flowAir: number;
  flowLiquid: number;
}

interface ContainmentGeometry {
  hallInset: number;
  hotLane: boolean;
  coldLane: boolean;
  fullEnclosure: boolean;
}

interface RedundancyLayout {
  color: number;
  modulePositions: Array<{ x: number; z: number }>;
  dualPaths: boolean;
}

interface ParamNorms {
  critical: number;
  area: number;
  halls: number;
  whitespace: number;
  density: number;
  pue: number;
}

interface SceneScale {
  norms: ParamNorms;
  loadPressure: number;
  buildingWidthFt: number;
  buildingDepthFt: number;
  buildingHeightFt: number;
  hallHeightFt: number;
  hallFieldWidthFt: number;
  hallFieldDepthFt: number;
  availableHallFieldWidthFt: number;
  availableHallFieldDepthFt: number;
  supportBandXFt: number;
  supportBandZFt: number;
  supportBandFt: number;
  plinthMarginFt: number;
  hallColumns: number;
  hallRows: number;
  hallCellWidthFt: number;
  hallCellDepthFt: number;
  hallWidthFt: number;
  hallDepthFt: number;
}

interface CameraTourSection {
  direction: THREE.Vector3;
  distanceScale: number;
  lookOffset: THREE.Vector3;
}

interface CameraTourLayout {
  center: THREE.Vector3;
  radius: number;
  fitDistance: number;
  near: number;
  far: number;
  sections: CameraTourSection[];
}

interface CameraTourPose {
  direction: THREE.Vector3;
  target: THREE.Vector3;
  distance: number;
  sectionIndex: number;
}

interface CameraTourState {
  layout: CameraTourLayout | null;
  progress: number;
  targetProgress: number;
  orbitAzimuth: number;
  orbitPolar: number;
  panOffset: THREE.Vector3;
  zoomOffset: number;
  currentTarget: THREE.Vector3;
  currentDirection: THREE.Vector3;
  currentDistance: number;
}

interface CameraDragState {
  pointerId: number | null;
  lastX: number;
  lastY: number;
  moved: boolean;
  suppressClick: boolean;
}

interface RackHoverFocusState {
  currentPoint: THREE.Vector3;
  targetPoint: THREE.Vector3;
  weight: number;
  targetWeight: number;
  hasPoint: boolean;
}

function disposeMaterial(material?: THREE.Material | THREE.Material[]): void {
  if (!material) {
    return;
  }

  if (Array.isArray(material)) {
    material.forEach((entry) => entry.dispose());
    return;
  }

  material.dispose();
}

function disposeObjectTree(object: THREE.Object3D): void {
  object.traverse((entry) => {
    const disposable = entry as DisposableObject3D;
    disposable.geometry?.dispose();
    disposeMaterial(disposable.material);
  });
}

function disableDepthWriteForTransparentMaterials(object: THREE.Object3D): void {
  object.traverse((entry) => {
    const disposable = entry as DisposableObject3D;
    const material = disposable.material;
    if (!material) {
      return;
    }

    const materials = Array.isArray(material) ? material : [material];
    materials.forEach((item) => {
      if (item.transparent) {
        item.depthWrite = false;
        item.depthTest = true;
      }
    });
  });
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function resolvePixelRatio(quality: RenderQuality, devicePixelRatio: number): number {
  const safeRatio = Number.isFinite(devicePixelRatio) && devicePixelRatio > 0 ? devicePixelRatio : 1;
  return Math.min(safeRatio, QUALITY_PIXEL_RATIO_CAP[quality]);
}

function worldFromFeet(valueFt: number): number {
  return valueFt * FOOT_TO_WORLD;
}

function normalize(value: number, min: number, max: number): number {
  if (max <= min) {
    return 0;
  }
  return clamp01((value - min) / (max - min));
}

function lerp(start: number, end: number, t: number): number {
  return start + (end - start) * t;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function blendHex(fromColor: number, toColor: number, amount: number): number {
  const from = new THREE.Color(fromColor);
  const to = new THREE.Color(toColor);
  from.lerp(to, clamp01(amount));
  return from.getHex();
}

function average(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }
  const total = values.reduce((sum, value) => sum + value, 0);
  return total / values.length;
}

function smoothstep(value: number): number {
  const t = clamp01(value);
  return t * t * (3 - 2 * t);
}

function damp(current: number, target: number, lambda: number, deltaSeconds: number): number {
  const amount = 1 - Math.exp(-lambda * Math.max(0, deltaSeconds));
  return current + (target - current) * amount;
}

function computeCameraFitDistance(camera: THREE.PerspectiveCamera, radius: number): number {
  const verticalFov = THREE.MathUtils.degToRad(camera.fov);
  const aspect = Math.max(0.1, camera.aspect || 1);
  const horizontalFov = 2 * Math.atan(Math.tan(verticalFov / 2) * aspect);
  const fitDistanceVertical = radius / Math.sin(verticalFov / 2);
  const fitDistanceHorizontal = radius / Math.sin(horizontalFov / 2);
  return Math.max(fitDistanceVertical, fitDistanceHorizontal) * 1.08;
}

function createCameraTourLayout(
  center: THREE.Vector3,
  size: THREE.Vector3,
  radius: number,
  fitDistance: number
): CameraTourLayout {
  return {
    center: center.clone(),
    radius,
    fitDistance,
    near: Math.max(0.1, fitDistance * 0.03),
    far: Math.max(500, fitDistance + radius * 6),
    sections: [
      {
        direction: new THREE.Vector3(0.78, 0.58, 0.74).normalize(),
        distanceScale: 1.06,
        lookOffset: new THREE.Vector3(0, size.y * 0.12, 0),
      },
      {
        direction: new THREE.Vector3(0.34, 0.24, 1.12).normalize(),
        distanceScale: 0.8,
        lookOffset: new THREE.Vector3(0, size.y * 0.07, 0),
      },
      {
        direction: new THREE.Vector3(-1.02, 0.34, 0.28).normalize(),
        distanceScale: 0.92,
        lookOffset: new THREE.Vector3(-size.x * 0.16, size.y * 0.12, 0),
      },
      {
        direction: new THREE.Vector3(0.88, 0.44, -0.64).normalize(),
        distanceScale: 0.9,
        lookOffset: new THREE.Vector3(size.x * 0.14, size.y * 0.16, -size.z * 0.08),
      },
      {
        direction: new THREE.Vector3(0.18, 1.08, 0.26).normalize(),
        distanceScale: 0.72,
        lookOffset: new THREE.Vector3(0, size.y * 0.16, 0),
      },
    ],
  };
}

function sampleCameraTour(layout: CameraTourLayout, progress: number): CameraTourPose {
  const sections = layout.sections;
  const segmentCount = Math.max(1, sections.length - 1);
  const scaledProgress = clamp01(progress) * segmentCount;
  const segmentIndex = Math.min(segmentCount - 1, Math.floor(scaledProgress));
  const segmentT = clamp01(scaledProgress - segmentIndex);
  const emphasizedSegmentT = smoothstep(segmentT);
  const current = sections[segmentIndex];
  const next = sections[Math.min(sections.length - 1, segmentIndex + 1)];

  const direction = current.direction.clone().lerp(next.direction, emphasizedSegmentT).normalize();
  const distanceScale = lerp(current.distanceScale, next.distanceScale, emphasizedSegmentT);
  const target = layout.center
    .clone()
    .add(current.lookOffset.clone().lerp(next.lookOffset, emphasizedSegmentT));

  return {
    direction,
    target,
    distance: layout.fitDistance * distanceScale,
    sectionIndex:
      emphasizedSegmentT < 0.5
        ? segmentIndex
        : Math.min(sections.length - 1, segmentIndex + 1),
  };
}

function normalizeSceneParams(params: Params): ParamNorms {
  return {
    critical: normalize(
      params.criticalLoadMW,
      PARAM_RANGES.criticalLoadMW.min,
      PARAM_RANGES.criticalLoadMW.max
    ),
    area: normalize(
      params.whitespaceAreaSqFt,
      PARAM_RANGES.whitespaceAreaSqFt.min,
      PARAM_RANGES.whitespaceAreaSqFt.max
    ),
    halls: normalize(params.dataHalls, PARAM_RANGES.dataHalls.min, PARAM_RANGES.dataHalls.max),
    whitespace: normalize(
      params.whitespaceRatio,
      PARAM_RANGES.whitespaceRatio.min,
      PARAM_RANGES.whitespaceRatio.max
    ),
    density: normalize(
      params.rackPowerDensity,
      PARAM_RANGES.rackPowerDensity.min,
      PARAM_RANGES.rackPowerDensity.max
    ),
    pue: normalize(params.pue, PARAM_RANGES.pue.min, PARAM_RANGES.pue.max),
  };
}

function tintHex(color: number, amount: number): number {
  const base = new THREE.Color(color);
  const target = amount >= 0 ? new THREE.Color(0xffffff) : new THREE.Color(0x000000);
  base.lerp(target, clamp01(Math.abs(amount)));
  return base.getHex();
}

function getCoolingPalette(coolingType: "Air-Cooled" | "DLC" | "Hybrid"): CoolingPalette {
  switch (coolingType) {
    case "DLC":
      return {
        shell: 0x0c3f45,
        shellEdge: 0x2dd4bf,
        hall: 0x0f766e,
        hallEdge: 0x5eead4,
        containmentHot: 0xef4444,
        containmentCold: 0x38bdf8,
        flowAir: 0x7dd3fc,
        flowLiquid: 0x2dd4bf,
      };
    case "Hybrid":
      return {
        shell: 0x173a5d,
        shellEdge: 0x60a5fa,
        hall: 0x25618d,
        hallEdge: 0x93c5fd,
        containmentHot: 0xf97316,
        containmentCold: 0x38bdf8,
        flowAir: 0x67e8f9,
        flowLiquid: 0x4ade80,
      };
    case "Air-Cooled":
    default:
      return {
        shell: 0x13314a,
        shellEdge: 0x7dd3fc,
        hall: 0x22466e,
        hallEdge: 0x70bdf5,
        containmentHot: 0xf97316,
        containmentCold: 0x38bdf8,
        flowAir: 0x60a5fa,
        flowLiquid: 0x67e8f9,
      };
  }
}

function getContainmentGeometry(
  containment: "None" | "Hot Aisle" | "Cold Aisle" | "Full Enclosure",
  coolingType: "Air-Cooled" | "DLC" | "Hybrid"
): ContainmentGeometry {
  const coolingInset =
    coolingType === "Air-Cooled" ? 0.04 : coolingType === "DLC" ? -0.03 : 0.01;

  switch (containment) {
    case "Hot Aisle":
      return { hallInset: 0.12 + coolingInset, hotLane: true, coldLane: false, fullEnclosure: false };
    case "Cold Aisle":
      return { hallInset: 0.12 + coolingInset, hotLane: false, coldLane: true, fullEnclosure: false };
    case "Full Enclosure":
      return { hallInset: 0.18 + coolingInset, hotLane: true, coldLane: true, fullEnclosure: true };
    case "None":
    default:
      return { hallInset: 0.08 + coolingInset, hotLane: false, coldLane: false, fullEnclosure: false };
  }
}

function getRedundancyLayout(
  redundancy: "N" | "N+1" | "2N",
  buildingWidthFt: number,
  buildingDepthFt: number
): RedundancyLayout {
  const front = buildingDepthFt / 2 + 18;
  const side = Math.min(buildingWidthFt * 0.32, 55);

  if (redundancy === "2N") {
    return {
      color: 0xdc2626,
      dualPaths: true,
      modulePositions: [
        { x: -side, z: front },
        { x: side, z: front },
        { x: -side, z: -front },
        { x: side, z: -front },
      ],
    };
  }

  if (redundancy === "N+1") {
    return {
      color: 0x0ea5e9,
      dualPaths: false,
      modulePositions: [
        { x: -side, z: front },
        { x: side, z: front },
        { x: 0, z: -front * 0.88 },
      ],
    };
  }

  return {
    color: 0xf59e0b,
    dualPaths: false,
    modulePositions: [{ x: 0, z: front }],
  };
}

function createVisualProfile(
  baseColor: number,
  baseOpacity: number,
  baseEmissiveIntensity: number
): VisualProfile {
  return {
    baseColor,
    hoverColor: tintHex(baseColor, 0.24),
    baseOpacity,
    hoverOpacity: Math.min(0.9, baseOpacity + 0.1),
    baseEmissiveIntensity,
    hoverEmissiveIntensity: baseEmissiveIntensity + 0.1,
  };
}

function createPipeSegment(
  start: THREE.Vector3,
  end: THREE.Vector3,
  radius: number,
  materialParams: THREE.MeshStandardMaterialParameters
): THREE.Mesh | null {
  const direction = new THREE.Vector3().subVectors(end, start);
  const length = direction.length();

  if (length < 0.001) {
    return null;
  }

  const mesh = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, length, 10),
    new THREE.MeshStandardMaterial(materialParams)
  );

  mesh.position.copy(start).add(end).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
  return mesh;
}

function createRoutingLine(
  points: THREE.Vector3[],
  color: number,
  opacity: number
): THREE.Line | null {
  if (points.length < 2) {
    return null;
  }

  const line = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints(points),
    new THREE.LineBasicMaterial({
      color,
      transparent: true,
      opacity,
    })
  );

  return line;
}

function makeEntityKey(type: InteractiveKind, id: string): string {
  return `${type}:${id}`;
}

function formatRackId(index: number): string {
  return `R-${String(index).padStart(4, "0")}`;
}

function sameHoverTarget(previous: HoverTarget | null, next: HoverTarget | null): boolean {
  if (!previous && !next) {
    return true;
  }

  if (!previous || !next) {
    return false;
  }

  return (
    previous.type === next.type &&
    previous.id === next.id &&
    previous.entityKey === next.entityKey &&
    previous.rackInstanceIndex === next.rackInstanceIndex
  );
}

function resolveEntityKey(
  object: THREE.Object3D | null,
  objectToEntityKey: Map<string, string>
): string | null {
  let current: THREE.Object3D | null = object;

  while (current) {
    const key = objectToEntityKey.get(current.uuid);
    if (key) {
      return key;
    }
    current = current.parent;
  }

  return null;
}

interface HallPacking {
  columns: number;
  rows: number;
  hallWidthFt: number;
  hallDepthFt: number;
}

function chooseHallPacking(
  hallCount: number,
  footprintAspect: number,
  candidates: Array<{ widthFt: number; depthFt: number }>
): HallPacking {
  const safeFootprintAspect = Math.max(0.08, footprintAspect);
  const validCandidates =
    candidates.length > 0 ? candidates : [{ widthFt: 20, depthFt: 40 }];

  let best: HallPacking = {
    columns: 1,
    rows: hallCount,
    hallWidthFt: validCandidates[0].widthFt,
    hallDepthFt: validCandidates[0].depthFt,
  };
  let bestScore = Number.POSITIVE_INFINITY;

  for (const candidate of validCandidates) {
    const hallAspect = candidate.widthFt / Math.max(candidate.depthFt, 0.01);

    for (let columns = 1; columns <= hallCount; columns += 1) {
      const rows = Math.ceil(hallCount / columns);
      const gridAspect = (columns * hallAspect) / Math.max(rows, 1);
      const aspectPenalty = Math.abs(
        Math.log(Math.max(0.08, gridAspect) / safeFootprintAspect)
      );
      const emptyCells = columns * rows - hallCount;
      const density = hallCount / Math.max(1, columns * rows);
      const stretch = Math.max(columns, rows) / Math.max(1, Math.min(columns, rows));
      const score =
        aspectPenalty * 5 +
        emptyCells * 0.55 +
        (1 - density) * 2.2 +
        (stretch - 1) * 0.08;

      if (score < bestScore) {
        bestScore = score;
        best = {
          columns,
          rows,
          hallWidthFt: candidate.widthFt,
          hallDepthFt: candidate.depthFt,
        };
      }
    }
  }

  return best;
}

function deriveSceneScale(params: Params, model: DataCenterModel): SceneScale {
  const norms = normalizeSceneParams(params);
  const footprintAreaSqFt = Math.max(model.area.grossFacilitySqFt, 1);
  const whitespaceAreaSqFt = Math.max(model.area.whitespaceSqFt, 1);
  const loadPressure = clamp01(model.rackCount / Math.max(model.rackCapacityBySpace, 1));
  const supportShare = normalize(1 - params.whitespaceRatio, 0.35, 0.75);
  const coolingAspectOffset =
    params.coolingType === "Air-Cooled" ? 0.18 : params.coolingType === "DLC" ? -0.12 : 0.04;
  const buildingAspectRatio = Math.max(
    1.05,
    lerp(1.2, 1.92, norms.whitespace) + coolingAspectOffset
  );

  const buildingWidthFt = Math.sqrt(footprintAreaSqFt / buildingAspectRatio);
  const buildingDepthFt = footprintAreaSqFt / buildingWidthFt;
  const redundancyHeightFt =
    params.redundancy === "2N" ? 4 : params.redundancy === "N+1" ? 2 : 0;
  const areaHeightLiftFt = lerp(1.5, 12, Math.pow(norms.area, 0.72));
  const loadHeightLiftFt = lerp(0, 7, loadPressure);
  const buildingHeightFt =
    lerp(16, 28, norms.critical) +
    lerp(0, 8, norms.pue) +
    redundancyHeightFt +
    areaHeightLiftFt +
    loadHeightLiftFt;

  const coolingPlenumFt =
    params.coolingType === "Air-Cooled" ? 2.6 : params.coolingType === "Hybrid" ? 1.6 : 0.8;
  const hallHeightFt =
    lerp(8, 13, norms.density) +
    coolingPlenumFt +
    lerp(0, 2, norms.critical) +
    lerp(0.5, 4.5, loadPressure) +
    lerp(0, 2.5, norms.area);

  const hallCount = Math.max(1, model.halls.length);
  const footprintAspect = buildingWidthFt / Math.max(buildingDepthFt, 0.01);
  const hallWidthsFt = model.halls.map((hall) => hall.dimensionsFt.width);
  const hallLengthsFt = model.halls.map((hall) => hall.dimensionsFt.length);
  const hallGrossAreasSqFt = model.halls.map((hall) => hall.grossSqFt);
  const avgHallAspect = clamp01(
    (average(hallLengthsFt.map((lengthFt, index) => lengthFt / Math.max(hallWidthsFt[index], 1))) -
      1) /
      2.5
  );
  const hallAspectRatio = lerp(1.2, 3.5, avgHallAspect);
  const avgHallGrossSqFt = Math.max(256, average(hallGrossAreasSqFt));
  const grossShortSideFt = Math.sqrt(avgHallGrossSqFt / hallAspectRatio);
  const grossLongSideFt = grossShortSideFt * hallAspectRatio;
  const hallPacking = chooseHallPacking(hallCount, footprintAspect, [
    { widthFt: grossShortSideFt, depthFt: grossLongSideFt },
    { widthFt: grossLongSideFt, depthFt: grossShortSideFt },
  ]);

  const columns = hallPacking.columns;
  const rows = hallPacking.rows;
  const baseHallWidthFt = Math.max(10, hallPacking.hallWidthFt);
  const baseHallDepthFt = Math.max(10, hallPacking.hallDepthFt);

  const baseCirculationFactor = lerp(1.04, 1.2, Math.sqrt(norms.halls));
  const containmentCirculationBoost =
    params.containment === "Full Enclosure"
      ? 0.05
      : params.containment === "Hot Aisle" || params.containment === "Cold Aisle"
        ? 0.025
        : 0;
  const loadCirculationBias = lerp(0.03, -0.03, loadPressure);
  const circulationFactor = Math.min(
    1.28,
    Math.max(0.98, baseCirculationFactor + containmentCirculationBoost + loadCirculationBias)
  );

  const rawHallFieldWidthFt = baseHallWidthFt * columns * circulationFactor;
  const rawHallFieldDepthFt = baseHallDepthFt * rows * circulationFactor;
  const fieldAspect = rawHallFieldWidthFt / Math.max(rawHallFieldDepthFt, 0.01);
  const modeledFieldAreaSqFt = Math.max(1, rawHallFieldWidthFt * rawHallFieldDepthFt);
  const hallCoreAreaSqFt = Math.max(1, baseHallWidthFt * baseHallDepthFt * hallCount);
  const targetFieldAreaSqFt = Math.max(
    modeledFieldAreaSqFt,
    hallCoreAreaSqFt * 1.03,
    whitespaceAreaSqFt * lerp(0.88, 0.98, norms.whitespace)
  );
  let hallFieldWidthFt = Math.sqrt(targetFieldAreaSqFt * fieldAspect);
  let hallFieldDepthFt = targetFieldAreaSqFt / Math.max(hallFieldWidthFt, 0.01);

  const minPerimeterSupportFt = lerp(6, 20, supportShare) + lerp(1, 4, norms.pue);
  const maxHallFieldWidthFt = Math.max(26, buildingWidthFt - minPerimeterSupportFt * 2);
  const maxHallFieldDepthFt = Math.max(26, buildingDepthFt - minPerimeterSupportFt * 2);
  const hallFieldFitScale = Math.min(
    1,
    maxHallFieldWidthFt / Math.max(hallFieldWidthFt, 0.01),
    maxHallFieldDepthFt / Math.max(hallFieldDepthFt, 0.01)
  );
  hallFieldWidthFt *= hallFieldFitScale;
  hallFieldDepthFt *= hallFieldFitScale;

  const supportBandXFt = Math.max(8, (buildingWidthFt - hallFieldWidthFt) / 2);
  const supportBandZFt = Math.max(8, (buildingDepthFt - hallFieldDepthFt) / 2);
  const supportBandFt = Math.min(supportBandXFt, supportBandZFt);
  const availableHallFieldWidthFt = Math.max(20, hallFieldWidthFt * 0.985);
  const availableHallFieldDepthFt = Math.max(20, hallFieldDepthFt * 0.985);
  const hallCellWidthFt = availableHallFieldWidthFt / columns;
  const hallCellDepthFt = availableHallFieldDepthFt / rows;

  const rawHallWidthFt = baseHallWidthFt * hallFieldFitScale;
  const rawHallDepthFt = baseHallDepthFt * hallFieldFitScale;
  const maxAisleRatio = clamp01(lerp(0.08, 0.2, Math.sqrt(norms.halls)) + containmentCirculationBoost * 0.25);
  const maxHallWidthFt = Math.max(10, hallCellWidthFt * (1 - maxAisleRatio));
  const maxHallDepthFt = Math.max(10, hallCellDepthFt * (1 - maxAisleRatio));
  const widthScale = Math.max(0.74, Math.min(1.48, maxHallWidthFt / Math.max(rawHallWidthFt, 0.01)));
  const depthScale = Math.max(0.74, Math.min(1.48, maxHallDepthFt / Math.max(rawHallDepthFt, 0.01)));
  const hallWidthFt = Math.max(8, rawHallWidthFt * widthScale);
  const hallDepthFt = Math.max(8, rawHallDepthFt * depthScale);
  const plinthMarginFt = lerp(34, 68, norms.area);

  return {
    norms,
    loadPressure,
    buildingWidthFt,
    buildingDepthFt,
    buildingHeightFt,
    hallHeightFt,
    hallFieldWidthFt,
    hallFieldDepthFt,
    availableHallFieldWidthFt,
    availableHallFieldDepthFt,
    supportBandXFt,
    supportBandZFt,
    supportBandFt,
    plinthMarginFt,
    hallColumns: columns,
    hallRows: rows,
    hallCellWidthFt,
    hallCellDepthFt,
    hallWidthFt,
    hallDepthFt,
  };
}

export function Viewport() {
  const { state, select } = useStore();
  const { params } = state;
  const model = useMemo(() => computeDataCenter(params), [params]);

  const mountRef = useRef<HTMLDivElement | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const layoutGroupRef = useRef<THREE.Group | null>(null);
  const floorRef = useRef<THREE.Mesh | null>(null);
  const gridRef = useRef<THREE.GridHelper | null>(null);
  const interactiveRef = useRef<InteractiveEntity[]>([]);
  const hoveredRef = useRef<HoverTarget | null>(null);
  const raycastTargetsRef = useRef<THREE.Object3D[]>([]);
  const entityByKeyRef = useRef<Map<string, InteractiveEntity>>(new Map());
  const objectToEntityKeyRef = useRef<Map<string, string>>(new Map());
  const rackMeshRef = useRef<THREE.InstancedMesh | null>(null);
  const rackInstanceIdsRef = useRef<string[]>([]);
  const rackIdToInstanceRef = useRef<Map<string, number>>(new Map());
  const rackColorProfileRef = useRef<RackColorProfile | null>(null);
  const rackVisualStateRef = useRef<{ hoveredIndex: number | null; selectedIndex: number | null }>({
    hoveredIndex: null,
    selectedIndex: null,
  });
  const selectionRef = useRef(state.selection);
  const viewModeRef = useRef(state.viewMode);
  const scrollFlowEnabledRef = useRef(state.ui.scrollFlowEnabled);
  const qualityRef = useRef(state.quality);
  const resetCameraRef = useRef<() => void>(() => {});
  const cameraTourRef = useRef<CameraTourState>({
    layout: null,
    progress: 0,
    targetProgress: 0,
    orbitAzimuth: 0,
    orbitPolar: 0,
    panOffset: new THREE.Vector3(),
    zoomOffset: 0,
    currentTarget: new THREE.Vector3(),
    currentDirection: new THREE.Vector3(0.78, 0.58, 0.74).normalize(),
    currentDistance: worldFromFeet(400),
  });
  const cameraDragRef = useRef<CameraDragState>({
    pointerId: null,
    lastX: 0,
    lastY: 0,
    moved: false,
    suppressClick: false,
  });
  const rackHoverFocusRef = useRef<RackHoverFocusState>({
    currentPoint: new THREE.Vector3(),
    targetPoint: new THREE.Vector3(),
    weight: 0,
    targetWeight: 0,
    hasPoint: false,
  });
  const renderSceneRef = useRef<() => void>(() => {});
  const applyVisualStateRef = useRef<() => void>(() => {});

  useEffect(() => {
    const mountElement = mountRef.current;
    if (!mountElement) {
      return undefined;
    }

    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0x141920, 35, 220);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(52, 1, 0.1, 500);
    camera.position.set(42, 30, 38);
    camera.lookAt(0, 0, 0);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: "high-performance",
    });
    rendererRef.current = renderer;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.setPixelRatio(resolvePixelRatio(qualityRef.current, window.devicePixelRatio || 1));
    renderer.setSize(mountElement.clientWidth, mountElement.clientHeight, false);
    mountElement.appendChild(renderer.domElement);

    const hemisphere = new THREE.HemisphereLight(0xaec4ff, 0x11151d, 0.55);
    scene.add(hemisphere);

    const keyLight = new THREE.DirectionalLight(0xffffff, 1.05);
    keyLight.position.set(28, 40, 20);
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0x7dd3fc, 0.45);
    rimLight.position.set(-24, 20, -16);
    scene.add(rimLight);

    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(FLOOR_SIZE, FLOOR_SIZE),
      new THREE.MeshStandardMaterial({
        color: 0x0f1318,
        roughness: 1,
        metalness: 0,
      })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.02;
    scene.add(floor);
    floorRef.current = floor;

    const grid = new THREE.GridHelper(FLOOR_SIZE * 0.78, 96, 0x334155, 0x1f2937);
    const gridMaterials = Array.isArray(grid.material) ? grid.material : [grid.material];
    gridMaterials.forEach((material) => {
      material.transparent = true;
      material.opacity = 0.4;
    });
    scene.add(grid);
    gridRef.current = grid;

    const layoutGroup = new THREE.Group();
    scene.add(layoutGroup);
    layoutGroupRef.current = layoutGroup;

    let frameHandle: number | null = null;
    let frameTimestamp = 0;
    let needsRender = false;

    const tourDirection = new THREE.Vector3();
    const tourRight = new THREE.Vector3();
    const tourTarget = new THREE.Vector3();
    const tourCameraPosition = new THREE.Vector3();
    const yawQuaternion = new THREE.Quaternion();
    const pitchQuaternion = new THREE.Quaternion();
    const selectedHallFocusPoint = new THREE.Vector3();

    const updateSelectedHallFocus = () => {
      const focus = rackHoverFocusRef.current;
      const selection = selectionRef.current;
      if (selection.type !== "hall") {
        focus.targetWeight = 0;
        return;
      }

      const hallEntity = entityByKeyRef.current.get(makeEntityKey("hall", selection.id));
      if (!hallEntity || hallEntity.type !== "hall") {
        focus.targetWeight = 0;
        return;
      }

      selectedHallFocusPoint.setFromMatrixPosition(hallEntity.mesh.matrixWorld);
      selectedHallFocusPoint.y += worldFromFeet(1.2);

      focus.targetPoint.copy(selectedHallFocusPoint);
      if (!focus.hasPoint) {
        focus.currentPoint.copy(selectedHallFocusPoint);
      }
      focus.hasPoint = true;
      focus.targetWeight = 1;
    };

    const updateCameraFromTour = (deltaSeconds: number): boolean => {
      const tour = cameraTourRef.current;
      if (!tour.layout) {
        return false;
      }

      const nextProgress = damp(
        tour.progress,
        tour.targetProgress,
        TOUR_DAMPING,
        deltaSeconds
      );
      const resolvedProgress =
        Math.abs(nextProgress - tour.targetProgress) < 0.00012
          ? tour.targetProgress
          : nextProgress;
      let changed = Math.abs(resolvedProgress - tour.progress) > 0.00001;
      tour.progress = resolvedProgress;

      const pose = sampleCameraTour(tour.layout, tour.progress);
      const minZoomOffset = pose.distance * (WHEEL_ZOOM_MIN_FACTOR - 1);
      const maxZoomOffset = pose.distance * (WHEEL_ZOOM_MAX_FACTOR - 1);
      tour.zoomOffset = clamp(tour.zoomOffset, minZoomOffset, maxZoomOffset);
      let resolvedDistance = Math.max(tour.layout.near * 3, pose.distance + tour.zoomOffset);
      yawQuaternion.setFromAxisAngle(WORLD_UP, tour.orbitAzimuth);
      tourDirection.copy(pose.direction).applyQuaternion(yawQuaternion).normalize();
      tourRight.crossVectors(tourDirection, WORLD_UP);
      if (tourRight.lengthSq() < 1e-6) {
        tourRight.set(1, 0, 0);
      } else {
        tourRight.normalize();
      }
      pitchQuaternion.setFromAxisAngle(tourRight, tour.orbitPolar);
      tourDirection.applyQuaternion(pitchQuaternion).normalize();

      tourTarget.copy(pose.target).add(tour.panOffset);
      updateSelectedHallFocus();
      const focus = rackHoverFocusRef.current;
      const focusWeightTarget = focus.targetWeight;
      const easedFocusWeight = damp(
        focus.weight,
        focusWeightTarget,
        RACK_HOVER_FOCUS_DAMPING,
        deltaSeconds
      );
      focus.weight = Math.abs(easedFocusWeight - focusWeightTarget) < 0.0008
        ? focusWeightTarget
        : easedFocusWeight;

      if (focus.hasPoint) {
        focus.currentPoint.lerp(
          focus.targetPoint,
          1 - Math.exp(-RACK_HOVER_TARGET_DAMPING * deltaSeconds)
        );
      }

      if (focus.weight > 0.0005 && focus.hasPoint) {
        const appliedWeight = Math.min(1, focus.weight * 0.86);
        tourTarget.lerp(focus.currentPoint, appliedWeight);
        const selectionDistance = Math.max(
          tour.layout.near * 2.4,
          pose.distance * RACK_HOVER_FOCUS_DISTANCE_SCALE
        );
        resolvedDistance = THREE.MathUtils.lerp(
          resolvedDistance,
          selectionDistance,
          appliedWeight
        );
      }
      if (focus.targetWeight === 0 && focus.weight < 0.0004) {
        focus.hasPoint = false;
      }
      tourCameraPosition.copy(tourTarget).addScaledVector(tourDirection, resolvedDistance);

      if (
        tour.currentTarget.distanceToSquared(tourTarget) > 1e-6 ||
        tour.currentDirection.distanceToSquared(tourDirection) > 1e-6 ||
        Math.abs(tour.currentDistance - resolvedDistance) > 0.0001
      ) {
        changed = true;
      }

      tour.currentTarget.copy(tourTarget);
      tour.currentDirection.copy(tourDirection);
      tour.currentDistance = resolvedDistance;

      camera.position.copy(tourCameraPosition);
      camera.lookAt(tourTarget);

      const near = tour.layout.near;
      const far = tour.layout.far;
      if (Math.abs(camera.near - near) > 0.0001 || Math.abs(camera.far - far) > 0.0001) {
        camera.near = near;
        camera.far = far;
        camera.updateProjectionMatrix();
        changed = true;
      }

      return changed;
    };

    const tick = (timestamp: number) => {
      const deltaSeconds =
        frameTimestamp === 0 ? 1 / 60 : Math.min(0.05, (timestamp - frameTimestamp) / 1000);
      frameTimestamp = timestamp;

      const cameraChanged = updateCameraFromTour(deltaSeconds);
      if (needsRender || cameraChanged) {
        renderer.render(scene, camera);
        needsRender = false;
      }

      const tour = cameraTourRef.current;
      const progressAnimating = Math.abs(tour.targetProgress - tour.progress) > 0.00015;
      const dragging = cameraDragRef.current.pointerId !== null;
      if (needsRender || cameraChanged || progressAnimating || dragging) {
        frameHandle = window.requestAnimationFrame(tick);
        return;
      }

      frameHandle = null;
      frameTimestamp = 0;
    };

    const renderScene = () => {
      needsRender = true;
      if (frameHandle === null) {
        frameTimestamp = 0;
        frameHandle = window.requestAnimationFrame(tick);
      }
    };
    renderSceneRef.current = renderScene;

      const resetCameraToCurrentSection = () => {
        const tour = cameraTourRef.current;
        if (!tour.layout) {
        return;
      }

      const resolvedProgress = clamp01(tour.targetProgress);
      tour.progress = resolvedProgress;
        tour.targetProgress = resolvedProgress;
        tour.orbitAzimuth = 0;
        tour.orbitPolar = 0;
        tour.panOffset.set(0, 0, 0);
        tour.zoomOffset = 0;
        renderScene();
      };
    resetCameraRef.current = resetCameraToCurrentSection;

    const applyVisualState = () => {
      const hovered = hoveredRef.current;
      const hoveredKey = hovered?.entityKey ?? null;

      interactiveRef.current.forEach((entity) => {
        const material = entity.mesh.material;
        if (!(material instanceof THREE.MeshStandardMaterial)) {
          return;
        }

        const hoveredMatch = hoveredKey === entity.key;
        material.color.setHex(hoveredMatch ? entity.profile.hoverColor : entity.profile.baseColor);
        material.opacity = hoveredMatch
          ? entity.profile.hoverOpacity
          : entity.profile.baseOpacity;
        material.emissiveIntensity = hoveredMatch
          ? entity.profile.hoverEmissiveIntensity
          : entity.profile.baseEmissiveIntensity;
      });

      const rackMesh = rackMeshRef.current;
      const rackProfile = rackColorProfileRef.current;
      if (!rackMesh || !rackProfile) {
        return;
      }

      const hoveredIndex = hovered?.type === "rack" ? hovered.rackInstanceIndex : null;
      const selection = selectionRef.current;
      const selectedIndex =
        selection.type === "rack"
          ? rackIdToInstanceRef.current.get(selection.id) ?? null
          : null;
      const previousState = rackVisualStateRef.current;
      let rackColorsChanged = false;

      const restoreBaseColor = (index: number | null) => {
        if (index === null || index < 0 || index >= rackMesh.count) {
          return;
        }

        if (index === hoveredIndex || index === selectedIndex) {
          return;
        }

        rackMesh.setColorAt(index, rackProfile.base);
        rackColorsChanged = true;
      };

      if (previousState.hoveredIndex !== hoveredIndex) {
        restoreBaseColor(previousState.hoveredIndex);
      }

      if (previousState.selectedIndex !== selectedIndex) {
        restoreBaseColor(previousState.selectedIndex);
      }

      if (selectedIndex !== null && selectedIndex >= 0 && selectedIndex < rackMesh.count) {
        rackMesh.setColorAt(
          selectedIndex,
          selectedIndex === hoveredIndex ? rackProfile.hover : rackProfile.selected
        );
        rackColorsChanged = true;
      }

      if (
        hoveredIndex !== null &&
        hoveredIndex >= 0 &&
        hoveredIndex < rackMesh.count &&
        hoveredIndex !== selectedIndex
      ) {
        rackMesh.setColorAt(hoveredIndex, rackProfile.hover);
        rackColorsChanged = true;
      }

      if (rackColorsChanged && rackMesh.instanceColor) {
        rackMesh.instanceColor.needsUpdate = true;
      }

      rackVisualStateRef.current = {
        hoveredIndex,
        selectedIndex,
      };
    };
    applyVisualStateRef.current = applyVisualState;

    const resizeRenderer = () => {
      const width = mountElement.clientWidth;
      const height = mountElement.clientHeight;
      if (width === 0 || height === 0) {
        return;
      }

      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setPixelRatio(resolvePixelRatio(qualityRef.current, window.devicePixelRatio || 1));
      renderer.setSize(width, height, false);

      const tour = cameraTourRef.current;
      if (tour.layout) {
        tour.layout.fitDistance = computeCameraFitDistance(camera, tour.layout.radius);
        tour.layout.near = Math.max(0.1, tour.layout.fitDistance * 0.03);
        tour.layout.far = Math.max(500, tour.layout.fitDistance + tour.layout.radius * 6);
      }

      renderScene();
    };

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    const panRight = new THREE.Vector3();
    const panUp = new THREE.Vector3();

    const pickInteractive = (event: PointerEvent): HoverTarget | null => {
      const bounds = renderer.domElement.getBoundingClientRect();
      if (bounds.width === 0 || bounds.height === 0) {
        return null;
      }

      pointer.x = ((event.clientX - bounds.left) / bounds.width) * 2 - 1;
      pointer.y = -((event.clientY - bounds.top) / bounds.height) * 2 + 1;

      raycaster.setFromCamera(pointer, camera);
      const intersections = raycaster.intersectObjects(raycastTargetsRef.current, true);

      let bestTarget: HoverTarget | null = null;
      let bestPriority = -1;
      for (const hit of intersections) {
        const rackMesh = rackMeshRef.current;
        if (
          rackMesh &&
          hit.object === rackMesh &&
          hit.instanceId !== undefined &&
          hit.instanceId !== null
        ) {
          const rackId = rackInstanceIdsRef.current[hit.instanceId];
          if (rackId) {
            const priority = INTERACTION_PRIORITY.rack;
            if (priority > bestPriority) {
              bestTarget = {
                type: "rack",
                id: rackId,
                entityKey: null,
                rackInstanceIndex: hit.instanceId,
              };
              bestPriority = priority;
            }
          }
          continue;
        }

        const entityKey = resolveEntityKey(hit.object, objectToEntityKeyRef.current);
        if (!entityKey) {
          continue;
        }

        const candidate = entityByKeyRef.current.get(entityKey);
        if (candidate) {
          const priority = INTERACTION_PRIORITY[candidate.type];
          if (priority > bestPriority) {
            bestTarget = {
              type: candidate.type,
              id: candidate.id,
              entityKey: candidate.key,
              rackInstanceIndex: null,
            };
            bestPriority = priority;
          }
        }
      }

      return bestTarget;
    };

    const setPointerCursor = () => {
      if (cameraDragRef.current.pointerId !== null) {
        mountElement.style.cursor = "grabbing";
        return;
      }
      mountElement.style.cursor = hoveredRef.current ? "pointer" : "default";
    };

    const applyCameraDrag = (deltaX: number, deltaY: number, forcePan: boolean) => {
      const tour = cameraTourRef.current;
      if (!tour.layout) {
        return;
      }

      if (forcePan) {
        const viewportHeight = Math.max(1, mountElement.clientHeight);
        const worldPerPixel =
          ((2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2)) /
            viewportHeight) *
          tour.currentDistance *
          PAN_DRAG_SPEED;

        panRight.crossVectors(tour.currentDirection, WORLD_UP);
        if (panRight.lengthSq() < 1e-6) {
          panRight.set(1, 0, 0);
        } else {
          panRight.normalize();
        }
        panUp.crossVectors(panRight, tour.currentDirection).normalize();

        tour.panOffset.addScaledVector(panRight, deltaX * worldPerPixel);
        tour.panOffset.addScaledVector(panUp, deltaY * worldPerPixel);

        const maxPan = tour.layout.radius * 0.8;
        if (tour.panOffset.length() > maxPan) {
          tour.panOffset.setLength(maxPan);
        }
        return;
      }

      tour.orbitAzimuth -= deltaX * ORBIT_DRAG_SPEED;
      tour.orbitPolar = clamp(
        tour.orbitPolar + deltaY * ORBIT_DRAG_SPEED,
        -ORBIT_PITCH_LIMIT,
        ORBIT_PITCH_LIMIT
      );
    };

    const handlePointerDown = (event: PointerEvent) => {
      if (event.button !== 0) {
        return;
      }

      cameraDragRef.current.pointerId = event.pointerId;
      cameraDragRef.current.lastX = event.clientX;
      cameraDragRef.current.lastY = event.clientY;
      cameraDragRef.current.moved = false;
      cameraDragRef.current.suppressClick = false;
      if (renderer.domElement.setPointerCapture) {
        renderer.domElement.setPointerCapture(event.pointerId);
      }
      setPointerCursor();
    };

    const handlePointerMove = (event: PointerEvent) => {
      const drag = cameraDragRef.current;
      if (drag.pointerId === event.pointerId) {
        const deltaX = event.clientX - drag.lastX;
        const deltaY = event.clientY - drag.lastY;
        drag.lastX = event.clientX;
        drag.lastY = event.clientY;

        if (deltaX === 0 && deltaY === 0) {
          return;
        }

        const movementSq = deltaX * deltaX + deltaY * deltaY;
        if (!drag.moved && movementSq >= DRAG_THRESHOLD_SQ) {
          drag.moved = true;
          drag.suppressClick = true;
        }

        if (!drag.moved) {
          return;
        }

        const isShiftPan = event.shiftKey;
        const forcePan = isShiftPan || viewModeRef.current === "pan";
        applyCameraDrag(deltaX, deltaY, forcePan);
        renderScene();
        return;
      }

      if (drag.pointerId !== null) {
        return;
      }

      const nextHover = pickInteractive(event);
      const previous = hoveredRef.current;
      if (sameHoverTarget(previous, nextHover)) {
        return;
      }

      hoveredRef.current = nextHover;
      setPointerCursor();
      applyVisualState();
      renderScene();
    };

    const handlePointerRelease = (event: PointerEvent) => {
      const drag = cameraDragRef.current;
      if (drag.pointerId !== event.pointerId) {
        return;
      }

      if (renderer.domElement.hasPointerCapture(event.pointerId)) {
        renderer.domElement.releasePointerCapture(event.pointerId);
      }

      drag.pointerId = null;
      drag.lastX = 0;
      drag.lastY = 0;
      drag.moved = false;
      setPointerCursor();
      renderScene();
    };

    const handlePointerLeave = () => {
      if (cameraDragRef.current.pointerId !== null) {
        return;
      }

      if (!hoveredRef.current) {
        setPointerCursor();
        return;
      }

      hoveredRef.current = null;
      setPointerCursor();
      applyVisualState();
      renderScene();
    };

    const handleClick = (event: PointerEvent) => {
      if (cameraDragRef.current.suppressClick) {
        cameraDragRef.current.suppressClick = false;
        return;
      }

      const hit = pickInteractive(event);
      if (!hit) {
        return;
      }
      select({ id: hit.id, type: hit.type });
      renderScene();
    };

    const handleWheel = (event: WheelEvent) => {
      const tour = cameraTourRef.current;
      if (!tour.layout) {
        return;
      }

      event.preventDefault();
      if (scrollFlowEnabledRef.current) {
        const nextProgress = clamp01(
          tour.targetProgress + event.deltaY * TOUR_SCROLL_SENSITIVITY
        );
        if (Math.abs(nextProgress - tour.targetProgress) < 0.00001) {
          return;
        }

        tour.targetProgress = nextProgress;
      } else {
        const baseDistance = sampleCameraTour(tour.layout, tour.targetProgress).distance;
        const minZoomOffset = baseDistance * (WHEEL_ZOOM_MIN_FACTOR - 1);
        const maxZoomOffset = baseDistance * (WHEEL_ZOOM_MAX_FACTOR - 1);
        const zoomDelta = event.deltaY * baseDistance * WHEEL_ZOOM_SENSITIVITY;
        const nextZoomOffset = clamp(tour.zoomOffset + zoomDelta, minZoomOffset, maxZoomOffset);
        if (Math.abs(nextZoomOffset - tour.zoomOffset) < 0.0001) {
          return;
        }
        tour.zoomOffset = nextZoomOffset;
      }
      renderScene();
    };

    const resizeObserver =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(() => resizeRenderer())
        : null;

    renderer.domElement.style.touchAction = "none";
    renderer.domElement.addEventListener("pointerdown", handlePointerDown);
    renderer.domElement.addEventListener("pointermove", handlePointerMove);
    renderer.domElement.addEventListener("pointerup", handlePointerRelease);
    renderer.domElement.addEventListener("pointercancel", handlePointerRelease);
    renderer.domElement.addEventListener("pointerleave", handlePointerLeave);
    renderer.domElement.addEventListener("click", handleClick);
    renderer.domElement.addEventListener("wheel", handleWheel, { passive: false });
    resizeRenderer();
    renderScene();
    window.addEventListener("resize", resizeRenderer);
    resizeObserver?.observe(mountElement);

    return () => {
      if (frameHandle !== null) {
        window.cancelAnimationFrame(frameHandle);
        frameHandle = null;
      }

      renderer.domElement.removeEventListener("pointerdown", handlePointerDown);
      renderer.domElement.removeEventListener("pointermove", handlePointerMove);
      renderer.domElement.removeEventListener("pointerup", handlePointerRelease);
      renderer.domElement.removeEventListener("pointercancel", handlePointerRelease);
      renderer.domElement.removeEventListener("pointerleave", handlePointerLeave);
      renderer.domElement.removeEventListener("click", handleClick);
      renderer.domElement.removeEventListener("wheel", handleWheel);
      window.removeEventListener("resize", resizeRenderer);
      resizeObserver?.disconnect();
      mountElement.style.cursor = "default";

      disposeObjectTree(scene);

      renderer.renderLists.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      rendererRef.current = null;
      resetCameraRef.current = () => {};

      if (renderer.domElement.parentElement === mountElement) {
        mountElement.removeChild(renderer.domElement);
      }

      cameraRef.current = null;
      sceneRef.current = null;
      layoutGroupRef.current = null;
      floorRef.current = null;
      gridRef.current = null;
      interactiveRef.current = [];
      hoveredRef.current = null;
      raycastTargetsRef.current = [];
      rackMeshRef.current = null;
      rackInstanceIdsRef.current = [];
      rackIdToInstanceRef.current.clear();
      rackColorProfileRef.current = null;
      rackVisualStateRef.current = { hoveredIndex: null, selectedIndex: null };
      entityByKeyRef.current.clear();
      objectToEntityKeyRef.current.clear();
      cameraTourRef.current = {
        layout: null,
        progress: 0,
        targetProgress: 0,
        orbitAzimuth: 0,
        orbitPolar: 0,
        panOffset: new THREE.Vector3(),
        currentTarget: new THREE.Vector3(),
        currentDirection: new THREE.Vector3(0.78, 0.58, 0.74).normalize(),
        currentDistance: worldFromFeet(400),
        zoomOffset: 0,
      };
      cameraDragRef.current = {
        pointerId: null,
        lastX: 0,
        lastY: 0,
        moved: false,
        suppressClick: false,
      };
      rackHoverFocusRef.current = {
        currentPoint: new THREE.Vector3(),
        targetPoint: new THREE.Vector3(),
        weight: 0,
        targetWeight: 0,
        hasPoint: false,
      };
    };
  }, [select]);

  useEffect(() => {
    const scene = sceneRef.current;
    const camera = cameraRef.current;
    const layoutGroup = layoutGroupRef.current;
    if (!scene || !camera || !layoutGroup) {
      return;
    }

    hoveredRef.current = null;
    raycastTargetsRef.current = [];
    interactiveRef.current = [];
    rackMeshRef.current = null;
    rackInstanceIdsRef.current = [];
    rackIdToInstanceRef.current.clear();
    rackColorProfileRef.current = null;
    rackVisualStateRef.current = { hoveredIndex: null, selectedIndex: null };
    rackHoverFocusRef.current.weight = 0;
    rackHoverFocusRef.current.targetWeight = 0;
    rackHoverFocusRef.current.hasPoint = false;
    entityByKeyRef.current.clear();
    objectToEntityKeyRef.current.clear();

    while (layoutGroup.children.length > 0) {
      const child = layoutGroup.children[0];
      layoutGroup.remove(child);
      disposeObjectTree(child);
    }

    // Parameter-driven visual mapping:
    // - criticalLoadMW: vertical scale and utility module sizing
    // - whitespaceAreaSqFt: overall footprint
    // - dataHalls: hall count and grid packing
    // - whitespaceRatio: support-space band around whitespace
    // - rackPowerDensity: hall fill height/intensity
    // - redundancy: external utility topology (N, N+1, 2N)
    // - pue: efficiency tint + plant intensity
    // - coolingType: infrastructure style + palette
    // - containment: aisle/containment overlays
    const scale = deriveSceneScale(params, model);
    const {
      critical: criticalNorm,
      area: areaNorm,
      halls: hallsNorm,
      density: densityNorm,
      pue: pueNorm,
    } = scale.norms;

    const palette = getCoolingPalette(params.coolingType);
    const containment = getContainmentGeometry(params.containment, params.coolingType);
    const efficiencyAccent = blendHex(0x22d3ee, 0xf97316, pueNorm);
    const thermalCoolColor =
      params.coolingType === "DLC"
        ? blendHex(palette.flowLiquid, palette.containmentCold, 0.3)
        : params.coolingType === "Hybrid"
          ? blendHex(palette.flowAir, palette.flowLiquid, 0.42)
          : blendHex(palette.flowAir, palette.containmentCold, 0.2);
    const thermalHotColor = blendHex(palette.containmentHot, 0xef4444, 0.45);
    const thermalSuppression =
      params.coolingType === "Air-Cooled" ? 1 : params.coolingType === "Hybrid" ? 0.74 : 0.5;

    const buildingWidthFt = scale.buildingWidthFt;
    const buildingDepthFt = scale.buildingDepthFt;
    const buildingHeightFt = scale.buildingHeightFt;
    const hallHeightFt = scale.hallHeightFt;

    const buildingWidth = worldFromFeet(buildingWidthFt);
    const buildingDepth = worldFromFeet(buildingDepthFt);
    const buildingHeight = worldFromFeet(buildingHeightFt);
    const hallHeight = worldFromFeet(hallHeightFt);
    const baseY = 0.02;

    const supportBandX = worldFromFeet(scale.supportBandXFt);
    const hallFieldWidth = worldFromFeet(scale.hallFieldWidthFt);
    const hallFieldDepth = worldFromFeet(scale.hallFieldDepthFt);

    const plinthMargin = worldFromFeet(scale.plinthMarginFt);
    const plinth = new THREE.Mesh(
      new THREE.BoxGeometry(
        buildingWidth + plinthMargin,
        worldFromFeet(4),
        buildingDepth + plinthMargin
      ),
      new THREE.MeshStandardMaterial({
        color: blendHex(0x111827, efficiencyAccent, lerp(0.02, 0.22, pueNorm)),
        roughness: 0.88,
        metalness: 0.04,
      })
    );
    plinth.position.y = worldFromFeet(2);
    layoutGroup.add(plinth);
    const buildingInteractionTargets: THREE.Object3D[] = [plinth];

    const serviceDeck = new THREE.Mesh(
      new THREE.BoxGeometry(buildingWidth, worldFromFeet(1.6), buildingDepth),
      new THREE.MeshStandardMaterial({
        color: tintHex(0x172134, -0.08),
        roughness: 0.9,
        metalness: 0.02,
      })
    );
    serviceDeck.position.y = worldFromFeet(0.9);
    layoutGroup.add(serviceDeck);
    buildingInteractionTargets.push(serviceDeck);

    const whitespaceDeck = new THREE.Mesh(
      new THREE.BoxGeometry(hallFieldWidth, worldFromFeet(1.75), hallFieldDepth),
      new THREE.MeshStandardMaterial({
        color: blendHex(0x0b2238, palette.shellEdge, 0.25),
        roughness: 0.78,
        metalness: 0.04,
      })
    );
    whitespaceDeck.position.y = worldFromFeet(2);
    layoutGroup.add(whitespaceDeck);
    buildingInteractionTargets.push(whitespaceDeck);

    const shellBaseColor = blendHex(palette.shell, efficiencyAccent, lerp(0.1, 0.3, pueNorm));
    const shellOpacity = Math.min(0.48, lerp(0.16, 0.34, pueNorm) + lerp(0.02, 0.1, areaNorm));
    const shellEmissive = lerp(0.08, 0.2, pueNorm);

    const buildingMesh = new THREE.Mesh(
      new THREE.BoxGeometry(buildingWidth, buildingHeight, buildingDepth),
      new THREE.MeshStandardMaterial({
        color: shellBaseColor,
        emissive: tintHex(shellBaseColor, -0.38),
        emissiveIntensity: shellEmissive,
        roughness: 0.46,
        metalness: 0.08,
        transparent: true,
        opacity: shellOpacity,
        depthWrite: false,
        side: THREE.DoubleSide,
      })
    );
    buildingMesh.renderOrder = -1;
    buildingMesh.position.y = baseY + buildingHeight / 2;
    layoutGroup.add(buildingMesh);
    buildingInteractionTargets.push(buildingMesh);

    const buildingEdges = new THREE.LineSegments(
      new THREE.EdgesGeometry(buildingMesh.geometry),
      new THREE.LineBasicMaterial({
        color: palette.shellEdge,
        transparent: true,
        opacity: lerp(0.3, 0.62, pueNorm),
      })
    );
    buildingEdges.renderOrder = 6;
    buildingEdges.position.copy(buildingMesh.position);
    layoutGroup.add(buildingEdges);
    buildingInteractionTargets.push(buildingEdges);

    const roofPlantCount = Math.max(1, Math.round(lerp(1, 4, pueNorm)));
    const roofPlantWidthFt = Math.max(8, (buildingWidthFt * 0.65) / roofPlantCount);
    const roofPlantHeightFt = lerp(4, 11, pueNorm);
    const roofPlantDepthFt = lerp(6.5, 14.5, pueNorm);
    const roofPlantWidth = worldFromFeet(roofPlantWidthFt);
    const roofPlantHeight = worldFromFeet(roofPlantHeightFt);
    const roofPlantDepth = worldFromFeet(roofPlantDepthFt);
    const roofStartX = -((roofPlantCount - 1) * roofPlantWidth) / 2;

    for (let index = 0; index < roofPlantCount; index += 1) {
      const roofPlant = new THREE.Mesh(
        new THREE.BoxGeometry(roofPlantWidth * 0.84, roofPlantHeight, roofPlantDepth),
        new THREE.MeshStandardMaterial({
          color: blendHex(0x334155, efficiencyAccent, 0.35),
          emissive: blendHex(0x111827, efficiencyAccent, 0.2),
          emissiveIntensity: 0.14 + pueNorm * 0.12,
          roughness: 0.4,
          metalness: 0.25,
          transparent: true,
          opacity: 0.62,
        })
      );
      roofPlant.position.set(
        roofStartX + index * roofPlantWidth,
        baseY + buildingHeight + roofPlantHeight / 2 + worldFromFeet(0.4),
        -buildingDepth * 0.2
      );
      layoutGroup.add(roofPlant);
      buildingInteractionTargets.push(roofPlant);
    }

    const hallCount = model.halls.length;
    const columns = scale.hallColumns;
    const availableWidth = worldFromFeet(scale.availableHallFieldWidthFt);
    const availableDepth = worldFromFeet(scale.availableHallFieldDepthFt);
    const cellWidth = worldFromFeet(scale.hallCellWidthFt);
    const cellDepth = worldFromFeet(scale.hallCellDepthFt);
    const hallInset = clamp01(containment.hallInset * 0.65 + lerp(0.005, 0.025, hallsNorm));
    const hallWidth = worldFromFeet(scale.hallWidthFt * (1 - hallInset * 0.06));
    const hallDepth = worldFromFeet(scale.hallDepthFt * (1 - hallInset * 0.06));
    const hallY = baseY + hallHeight / 2;
    const hallBaseOpacity = lerp(0.5, 0.8, densityNorm);
    const hallBaseEmissive = Math.min(
      0.36,
      lerp(0.1, 0.24, pueNorm) + lerp(0.03, 0.1, densityNorm)
    );

    const entities: InteractiveEntity[] = [];
    const hallAirTapPoints: Array<{ point: THREE.Vector3; entityKey: string }> = [];
    const hallLiquidTapPoints: Array<{ point: THREE.Vector3; entityKey: string }> = [];
    const hallPowerTapPoints: Array<{ point: THREE.Vector3; entityKey: string; hallIndex: number }> = [];
    const registerEntity = (entity: InteractiveEntity, targets: THREE.Object3D[]) => {
      entities.push(entity);
      entityByKeyRef.current.set(entity.key, entity);

      targets.forEach((target) => {
        raycastTargetsRef.current.push(target);
        objectToEntityKeyRef.current.set(target.uuid, entity.key);
      });
    };

    const trayColor = blendHex(0x64748b, palette.shellEdge, lerp(0.18, 0.44, pueNorm));
    const trayThickness = Math.max(worldFromFeet(0.24), hallHeight * 0.024);
    const trayWidth = Math.max(worldFromFeet(0.72), hallWidth * 0.052);
    const trayY = hallY + hallHeight * 0.43;

    const rackBaseColorHex = blendHex(0x334155, palette.hallEdge, lerp(0.24, 0.52, densityNorm));
    const rackProfile: RackColorProfile = {
      base: new THREE.Color(rackBaseColorHex),
      hover: new THREE.Color(blendHex(rackBaseColorHex, 0xffffff, 0.34)),
      selected: new THREE.Color(blendHex(rackBaseColorHex, 0x22d3ee, 0.54)),
    };
    const maxRackInstances = Math.max(0, model.rackCount);
    const rackMesh = new THREE.InstancedMesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshStandardMaterial({
        color: rackBaseColorHex,
        emissive: tintHex(rackBaseColorHex, -0.28),
        emissiveIntensity: lerp(0.12, 0.24, densityNorm),
        roughness: 0.4,
        metalness: 0.2,
      }),
      Math.max(1, maxRackInstances)
    );
    rackMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    rackMesh.count = 0;
    rackMesh.renderOrder = 8;
    layoutGroup.add(rackMesh);
    raycastTargetsRef.current.push(rackMesh);
    rackMeshRef.current = rackMesh;
    rackColorProfileRef.current = rackProfile;

    const rackInstanceIds: string[] = new Array(maxRackInstances);
    const rackIdToInstance = new Map<string, number>();
    let rackCursor = 0;
    const rackMatrix = new THREE.Matrix4();
    const rackPosition = new THREE.Vector3();
    const rackScale = new THREE.Vector3();
    const rackFacingFront = new THREE.Quaternion();
    const rackFacingBack = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI);

    model.halls.forEach((hall, index) => {
      const row = Math.floor(index / columns);
      const col = index % columns;
      const hallsBeforeRow = row * columns;
      const hallsRemaining = hallCount - hallsBeforeRow;
      const hallsInRow = Math.min(columns, hallsRemaining);
      const rowPaddingCells = (columns - hallsInRow) / 2;
      const x = -availableWidth / 2 + (rowPaddingCells + col + 0.5) * cellWidth;
      const z = -availableDepth / 2 + cellDepth / 2 + row * cellDepth;
      const hallId = hall.id;
      const hallEntityKey = makeEntityKey("hall", hallId);
      const airTapPoint = new THREE.Vector3(x, hallY + hallHeight * 0.36, z);
      const liquidTapPoint = new THREE.Vector3(x - hallWidth * 0.42, hallY + hallHeight * 0.22, z);
      const powerTapPoint = new THREE.Vector3(x + hallWidth * 0.36, hallY + hallHeight * 0.3, z);
      const hallInteractionTargets: THREE.Object3D[] = [];

      const hallBaseColor = blendHex(palette.hall, efficiencyAccent, lerp(0.06, 0.22, pueNorm));
      const hallMesh = new THREE.Mesh(
        new THREE.BoxGeometry(hallWidth, hallHeight, hallDepth),
        new THREE.MeshStandardMaterial({
          color: hallBaseColor,
          emissive: tintHex(hallBaseColor, -0.38),
          emissiveIntensity: hallBaseEmissive,
          roughness: 0.52,
          metalness: 0.05,
          transparent: true,
          opacity: hallBaseOpacity,
        })
      );
      hallMesh.position.set(x, hallY, z);
      layoutGroup.add(hallMesh);
      hallInteractionTargets.push(hallMesh);

      const hallEdges = new THREE.LineSegments(
        new THREE.EdgesGeometry(hallMesh.geometry),
        new THREE.LineBasicMaterial({
          color: palette.hallEdge,
          transparent: true,
          opacity: lerp(0.32, 0.6, densityNorm),
        })
      );
      hallEdges.position.copy(hallMesh.position);
      layoutGroup.add(hallEdges);
      hallInteractionTargets.push(hallEdges);

      const utilization = hall.capacity > 0 ? clamp01(hall.rackCount / hall.capacity) : 0;
      const rowCount = Math.max(1, hall.rows.length);
      const rowBandWidth = hallWidth * lerp(0.68, 0.82, utilization);
      const rowPitch = rowBandWidth / rowCount;
      const rowStartX = x - rowBandWidth / 2 + rowPitch / 2;
      const rowUsableDepth = hallDepth * lerp(0.72, 0.9, clamp01(utilization + 0.15));
      const rackHeight = Math.max(
        worldFromFeet(4.6),
        Math.min(hallHeight * 0.72, worldFromFeet(lerp(6.2, 9.2, densityNorm)))
      );
      const rackY = baseY + worldFromFeet(0.35) + rackHeight / 2;
      let rackOrdinal = hall.rackStartIndex > 0 ? hall.rackStartIndex : rackCursor + 1;

      hall.rows.forEach((hallRow, rowIndex) => {
        if (hallRow.rackCount <= 0 || rackCursor >= maxRackInstances) {
          return;
        }

        const rowX = rowStartX + rowPitch * rowIndex;
        const hasCrossAisle = hallRow.rackCount >= 14;
        const slotCount = hallRow.rackCount + (hasCrossAisle ? 1 : 0);
        const rackPitchDepth = rowUsableDepth / Math.max(1, slotCount);
        const rackWidth = Math.max(worldFromFeet(1), Math.min(worldFromFeet(2.4), rowPitch * 0.62));
        const rackDepth = Math.max(
          worldFromFeet(0.95),
          Math.min(worldFromFeet(4), rackPitchDepth * 0.72)
        );
        const rowStartZ = z - rowUsableDepth / 2 + rackPitchDepth / 2;
        const splitIndex = Math.floor(hallRow.rackCount / 2);
        const rackRotation = rowIndex % 2 === 0 ? rackFacingFront : rackFacingBack;

        for (
          let rackIndex = 0;
          rackIndex < hallRow.rackCount && rackCursor < maxRackInstances;
          rackIndex += 1
        ) {
          const slotIndex = hasCrossAisle && rackIndex >= splitIndex ? rackIndex + 1 : rackIndex;
          const rackZ = rowStartZ + slotIndex * rackPitchDepth;
          const rackId = formatRackId(rackOrdinal);

          rackPosition.set(rowX, rackY, rackZ);
          rackScale.set(rackWidth, rackHeight, rackDepth);
          rackMatrix.compose(rackPosition, rackRotation, rackScale);
          rackMesh.setMatrixAt(rackCursor, rackMatrix);
          rackMesh.setColorAt(rackCursor, rackProfile.base);

          rackInstanceIds[rackCursor] = rackId;
          rackIdToInstance.set(rackId, rackCursor);
          rackCursor += 1;
          rackOrdinal += 1;
        }
      });

      const thermalBase = clamp01(
        densityNorm * 0.58 +
          utilization * 0.42 +
          scale.loadPressure * 0.16
      );
      const thermalIntensity = clamp01(
        thermalBase * thermalSuppression + pueNorm * 0.08
      );
      const thermalPlaneCount =
        params.coolingType === "Air-Cooled"
          ? hallsNorm > 0.7
            ? 2
            : 3
          : params.coolingType === "Hybrid"
            ? 2
            : 1;

      for (let layerIndex = 0; layerIndex < thermalPlaneCount; layerIndex += 1) {
        const layerT =
          thermalPlaneCount <= 1 ? 0.5 : layerIndex / (thermalPlaneCount - 1);
        const planeWidth = hallWidth * lerp(0.58, 0.86, thermalIntensity) * (1 - layerT * 0.12);
        const planeDepth = hallDepth * lerp(0.62, 0.92, thermalIntensity) * (1 - layerT * 0.12);
        const layerColor = blendHex(
          thermalCoolColor,
          thermalHotColor,
          clamp01(thermalIntensity * (0.72 + layerT * 0.38))
        );
        const thermalPlane = new THREE.Mesh(
          new THREE.PlaneGeometry(planeWidth, planeDepth),
          new THREE.MeshStandardMaterial({
            color: layerColor,
            emissive: tintHex(layerColor, -0.2),
            emissiveIntensity: 0.2 + thermalIntensity * 0.16,
            roughness: 0.52,
            metalness: 0.06,
            transparent: true,
            opacity:
              (params.coolingType === "DLC" ? 0.2 : params.coolingType === "Hybrid" ? 0.24 : 0.3) +
              thermalIntensity * 0.18 -
              layerT * 0.06,
            side: THREE.DoubleSide,
          })
        );
        thermalPlane.rotation.x = -Math.PI / 2;
        thermalPlane.position.set(
          x,
          rackY +
            rackHeight * (0.45 + layerT * 0.22) +
            worldFromFeet(0.35 + layerT * 0.35),
          z
        );
        layoutGroup.add(thermalPlane);
        hallInteractionTargets.push(thermalPlane);
      }

      const airIndicatorCount =
        params.coolingType === "Air-Cooled"
          ? hallsNorm > 0.7
            ? 2
            : 3
          : params.coolingType === "Hybrid"
            ? 2
            : 0;
      for (let indicatorIndex = 0; indicatorIndex < airIndicatorCount; indicatorIndex += 1) {
        const indicatorSpread =
          airIndicatorCount <= 1
            ? 0
            : -0.26 + (indicatorIndex / (airIndicatorCount - 1)) * 0.52;
        const indicatorHeight = hallHeight * lerp(0.16, 0.3, thermalIntensity);
        const airColumn = new THREE.Mesh(
          new THREE.CylinderGeometry(
            worldFromFeet(0.14),
            worldFromFeet(0.18),
            indicatorHeight,
            8
          ),
          new THREE.MeshStandardMaterial({
            color: blendHex(palette.flowAir, thermalHotColor, 0.26),
            emissive: tintHex(palette.flowAir, -0.18),
            emissiveIntensity: 0.22,
            roughness: 0.34,
            metalness: 0.2,
            transparent: true,
            opacity: params.coolingType === "Air-Cooled" ? 0.38 : 0.28,
          })
        );
        const airColumnX = x + hallWidth * indicatorSpread;
        const airColumnZ = z + (indicatorIndex % 2 === 0 ? -hallDepth * 0.14 : hallDepth * 0.14);
        airColumn.position.set(
          airColumnX,
          rackY + rackHeight * 0.8 + indicatorHeight / 2,
          airColumnZ
        );
        layoutGroup.add(airColumn);
        hallInteractionTargets.push(airColumn);

        const airTip = new THREE.Mesh(
          new THREE.ConeGeometry(worldFromFeet(0.26), worldFromFeet(0.56), 8),
          new THREE.MeshStandardMaterial({
            color: blendHex(palette.flowAir, 0xffffff, 0.24),
            emissive: tintHex(palette.flowAir, -0.16),
            emissiveIntensity: 0.18,
            roughness: 0.36,
            metalness: 0.16,
            transparent: true,
            opacity: params.coolingType === "Air-Cooled" ? 0.42 : 0.3,
          })
        );
        airTip.position.set(
          airColumnX,
          airColumn.position.y + indicatorHeight / 2 + worldFromFeet(0.28),
          airColumnZ
        );
        layoutGroup.add(airTip);
        hallInteractionTargets.push(airTip);
      }

      const liquidIndicatorCount =
        params.coolingType === "DLC"
          ? hallsNorm > 0.7
            ? 2
            : 3
          : params.coolingType === "Hybrid"
            ? 2
            : 0;
      for (let indicatorIndex = 0; indicatorIndex < liquidIndicatorCount; indicatorIndex += 1) {
        const zOffset =
          liquidIndicatorCount <= 1
            ? 0
            : -hallDepth * 0.24 +
              (indicatorIndex / (liquidIndicatorCount - 1)) * hallDepth * 0.48;
        const ribbon = new THREE.Mesh(
          new THREE.BoxGeometry(hallWidth * 0.72, worldFromFeet(0.18), worldFromFeet(0.34)),
          new THREE.MeshStandardMaterial({
            color: palette.flowLiquid,
            emissive: tintHex(palette.flowLiquid, -0.12),
            emissiveIntensity: 0.24,
            roughness: 0.3,
            metalness: 0.26,
            transparent: true,
            opacity: params.coolingType === "DLC" ? 0.46 : 0.34,
          })
        );
        ribbon.position.set(x - hallWidth * 0.03, rackY + rackHeight * 0.42, z + zOffset);
        layoutGroup.add(ribbon);
        hallInteractionTargets.push(ribbon);
      }

      const traySpine = new THREE.Mesh(
        new THREE.BoxGeometry(trayWidth, trayThickness, hallDepth * 0.9),
        new THREE.MeshStandardMaterial({
          color: trayColor,
          emissive: tintHex(trayColor, -0.2),
          emissiveIntensity: 0.12,
          roughness: 0.42,
          metalness: 0.32,
          transparent: true,
          opacity: 0.74,
        })
      );
      traySpine.position.set(x - hallWidth * 0.34, trayY, z);
      layoutGroup.add(traySpine);
      hallInteractionTargets.push(traySpine);

      const trayBranchCount = Math.max(1, Math.min(4, rowCount));
      for (let branchIndex = 0; branchIndex < trayBranchCount; branchIndex += 1) {
        const branchZ =
          z -
          hallDepth * 0.36 +
          (trayBranchCount <= 1
            ? hallDepth * 0.36
            : (branchIndex / (trayBranchCount - 1)) * hallDepth * 0.72);
        const trayBranch = new THREE.Mesh(
          new THREE.BoxGeometry(hallWidth * 0.68, trayThickness * 0.88, trayWidth * 0.78),
          new THREE.MeshStandardMaterial({
            color: blendHex(trayColor, palette.shellEdge, 0.16),
            emissive: tintHex(trayColor, -0.24),
            emissiveIntensity: 0.1,
            roughness: 0.44,
            metalness: 0.3,
            transparent: true,
            opacity: 0.68,
          })
        );
        trayBranch.position.set(x - hallWidth * 0.04, trayY, branchZ);
        layoutGroup.add(trayBranch);
        hallInteractionTargets.push(trayBranch);
      }

      if (params.coolingType === "Air-Cooled" || params.coolingType === "Hybrid") {
        const ductCount = params.coolingType === "Air-Cooled" ? 2 : 1;
        for (let ductIndex = 0; ductIndex < ductCount; ductIndex += 1) {
          const duct = new THREE.Mesh(
            new THREE.BoxGeometry(hallWidth * 0.88, hallHeight * 0.08, hallDepth * 0.14),
            new THREE.MeshStandardMaterial({
              color: palette.flowAir,
              emissive: tintHex(palette.flowAir, -0.12),
              emissiveIntensity: 0.2,
              roughness: 0.32,
              metalness: 0.22,
              transparent: true,
              opacity: 0.45,
            })
          );
          const zOffset = ductCount === 1 ? 0 : ductIndex === 0 ? -hallDepth * 0.2 : hallDepth * 0.2;
          duct.position.set(x, hallY + hallHeight * 0.34, z + zOffset);
          layoutGroup.add(duct);
          hallInteractionTargets.push(duct);
        }
      }

      if (params.coolingType === "DLC" || params.coolingType === "Hybrid") {
        const manifold = new THREE.Mesh(
          new THREE.CylinderGeometry(hallHeight * 0.035, hallHeight * 0.035, hallDepth * 0.88, 8),
          new THREE.MeshStandardMaterial({
            color: palette.flowLiquid,
            emissive: tintHex(palette.flowLiquid, -0.1),
            emissiveIntensity: 0.22,
            roughness: 0.28,
            metalness: 0.28,
            transparent: true,
            opacity: 0.56,
          })
        );
        manifold.rotation.x = Math.PI / 2;
        manifold.position.set(x - hallWidth * 0.42, hallY + hallHeight * 0.22, z);
        layoutGroup.add(manifold);
        hallInteractionTargets.push(manifold);
      }

      const containmentWallThickness = Math.max(worldFromFeet(0.3), hallWidth * 0.015);
      const containmentWallHeight = containment.fullEnclosure ? hallHeight * 0.78 : hallHeight * 0.54;
      const containmentWallY = baseY + worldFromFeet(0.4) + containmentWallHeight / 2;

      if (containment.hotLane) {
        const hotLaneWidth = hallWidth * 0.16;
        const hotLane = new THREE.Mesh(
          new THREE.BoxGeometry(hotLaneWidth, hallHeight * 0.05, hallDepth * 0.9),
          new THREE.MeshStandardMaterial({
            color: palette.containmentHot,
            emissive: tintHex(palette.containmentHot, -0.22),
            emissiveIntensity: 0.3,
            roughness: 0.35,
            metalness: 0.15,
            transparent: true,
            opacity: 0.42,
          })
        );
        hotLane.position.set(x, baseY + hallHeight * 0.06, z);
        layoutGroup.add(hotLane);
        hallInteractionTargets.push(hotLane);

        for (const direction of [-1, 1]) {
          const hotWall = new THREE.Mesh(
            new THREE.BoxGeometry(containmentWallThickness, containmentWallHeight, hallDepth * 0.9),
            new THREE.MeshStandardMaterial({
              color: blendHex(palette.containmentHot, 0xffffff, 0.08),
              emissive: tintHex(palette.containmentHot, -0.24),
              emissiveIntensity: 0.2,
              roughness: 0.38,
              metalness: 0.16,
              transparent: true,
              opacity: 0.34,
            })
          );
          hotWall.position.set(
            x + direction * hotLaneWidth * 0.5,
            containmentWallY,
            z
          );
          layoutGroup.add(hotWall);
          hallInteractionTargets.push(hotWall);
        }
      }

      if (containment.coldLane) {
        const laneOffset = hallWidth * 0.28;
        const coldLaneWidth = hallWidth * 0.1;
        for (const direction of [-1, 1]) {
          const coldLane = new THREE.Mesh(
            new THREE.BoxGeometry(coldLaneWidth, hallHeight * 0.04, hallDepth * 0.9),
            new THREE.MeshStandardMaterial({
              color: palette.containmentCold,
              emissive: tintHex(palette.containmentCold, -0.2),
              emissiveIntensity: 0.22,
              roughness: 0.32,
              metalness: 0.12,
              transparent: true,
              opacity: 0.4,
            })
          );
          coldLane.position.set(x + laneOffset * direction, baseY + hallHeight * 0.05, z);
          layoutGroup.add(coldLane);
          hallInteractionTargets.push(coldLane);

          for (const wallSide of [-1, 1]) {
            const coldWall = new THREE.Mesh(
              new THREE.BoxGeometry(containmentWallThickness, containmentWallHeight * 0.92, hallDepth * 0.9),
              new THREE.MeshStandardMaterial({
                color: blendHex(palette.containmentCold, 0xffffff, 0.1),
                emissive: tintHex(palette.containmentCold, -0.24),
                emissiveIntensity: 0.18,
                roughness: 0.38,
                metalness: 0.14,
                transparent: true,
                opacity: 0.3,
              })
            );
            coldWall.position.set(
              x + laneOffset * direction + wallSide * coldLaneWidth * 0.5,
              containmentWallY,
              z
            );
            layoutGroup.add(coldWall);
            hallInteractionTargets.push(coldWall);
          }
        }
      }

      if (containment.fullEnclosure) {
        const capHeight = Math.max(worldFromFeet(0.6), hallHeight * 0.12);
        const cap = new THREE.Mesh(
          new THREE.BoxGeometry(hallWidth * 0.98, capHeight, hallDepth * 0.98),
          new THREE.MeshStandardMaterial({
            color: blendHex(palette.containmentCold, 0xffffff, 0.2),
            emissive: tintHex(palette.containmentCold, -0.2),
            emissiveIntensity: 0.25,
            roughness: 0.36,
            metalness: 0.18,
            transparent: true,
            opacity: 0.3,
          })
        );
        cap.position.set(x, hallY + hallHeight / 2 - capHeight / 2, z);
        layoutGroup.add(cap);
        hallInteractionTargets.push(cap);

        const enclosureWallOpacity = 0.28;
        const enclosureWallDepth = hallDepth * 0.98;
        const enclosureWallWidth = hallWidth * 0.98;

        for (const direction of [-1, 1]) {
          const sideWall = new THREE.Mesh(
            new THREE.BoxGeometry(containmentWallThickness, hallHeight * 0.78, enclosureWallDepth),
            new THREE.MeshStandardMaterial({
              color: blendHex(palette.containmentCold, 0xffffff, 0.15),
              emissive: tintHex(palette.containmentCold, -0.22),
              emissiveIntensity: 0.2,
              roughness: 0.36,
              metalness: 0.16,
              transparent: true,
              opacity: enclosureWallOpacity,
            })
          );
          sideWall.position.set(
            x + direction * enclosureWallWidth * 0.5,
            baseY + hallHeight * 0.41,
            z
          );
          layoutGroup.add(sideWall);
          hallInteractionTargets.push(sideWall);
        }

        for (const direction of [-1, 1]) {
          const frontBackWall = new THREE.Mesh(
            new THREE.BoxGeometry(enclosureWallWidth, hallHeight * 0.78, containmentWallThickness),
            new THREE.MeshStandardMaterial({
              color: blendHex(palette.containmentCold, 0xffffff, 0.12),
              emissive: tintHex(palette.containmentCold, -0.22),
              emissiveIntensity: 0.2,
              roughness: 0.36,
              metalness: 0.16,
              transparent: true,
              opacity: enclosureWallOpacity,
            })
          );
          frontBackWall.position.set(
            x,
            baseY + hallHeight * 0.41,
            z + direction * enclosureWallDepth * 0.5
          );
          layoutGroup.add(frontBackWall);
          hallInteractionTargets.push(frontBackWall);
        }
      }

      const hallProfile = createVisualProfile(hallBaseColor, hallBaseOpacity, hallBaseEmissive);
      const entity: InteractiveEntity = {
        key: hallEntityKey,
        mesh: hallMesh,
        type: "hall",
        id: hallId,
        profile: hallProfile,
      };

      registerEntity(entity, [hallMesh]);
      hallAirTapPoints.push({ point: airTapPoint, entityKey: hallEntityKey });
      hallLiquidTapPoints.push({ point: liquidTapPoint, entityKey: hallEntityKey });
      hallPowerTapPoints.push({
        point: powerTapPoint,
        entityKey: hallEntityKey,
        hallIndex: hall.hallIndex,
      });
    });

    const trayTrunkSpan = hallFieldDepth + hallDepth * 0.62;
    for (const direction of [-1, 1]) {
      const trayTrunk = new THREE.Mesh(
        new THREE.BoxGeometry(trayWidth * 1.12, trayThickness * 1.04, trayTrunkSpan),
        new THREE.MeshStandardMaterial({
          color: blendHex(trayColor, palette.shellEdge, 0.2),
          emissive: tintHex(trayColor, -0.18),
          emissiveIntensity: 0.12,
          roughness: 0.42,
          metalness: 0.34,
          transparent: true,
          opacity: 0.72,
        })
      );
      trayTrunk.position.set(
        direction * (hallFieldWidth / 2 + hallWidth * 0.38),
        trayY,
        0
      );
      layoutGroup.add(trayTrunk);
      buildingInteractionTargets.push(trayTrunk);
    }

    rackMesh.count = rackCursor;
    rackMesh.instanceMatrix.needsUpdate = true;
    if (rackMesh.instanceColor) {
      rackMesh.instanceColor.needsUpdate = true;
    }
    rackInstanceIdsRef.current = rackInstanceIds.slice(0, rackCursor);
    rackIdToInstanceRef.current = rackIdToInstance;

    const coolingPlantX = buildingWidth / 2 + supportBandX * 0.64;
    const airNetworkEnabled = params.coolingType === "Air-Cooled" || params.coolingType === "Hybrid";
    const liquidNetworkEnabled = params.coolingType === "DLC" || params.coolingType === "Hybrid";

    if (airNetworkEnabled) {
      const trunkY = hallY + hallHeight * 0.52;
      const supplyZ = -hallFieldDepth / 2 - hallDepth * 0.62;
      const returnZ = hallFieldDepth / 2 + hallDepth * 0.62;
      const trunkStartX = -hallFieldWidth / 2;
      const trunkEndX = hallFieldWidth / 2;
      const airRadius = Math.max(worldFromFeet(0.45), hallHeight * 0.03);

      const airSupplyTrunk = createPipeSegment(
        new THREE.Vector3(trunkStartX, trunkY, supplyZ),
        new THREE.Vector3(trunkEndX, trunkY, supplyZ),
        airRadius,
        {
          color: palette.flowAir,
          emissive: tintHex(palette.flowAir, -0.16),
          emissiveIntensity: 0.2,
          roughness: 0.3,
          metalness: 0.3,
          transparent: true,
          opacity: 0.56,
        }
      );
      if (airSupplyTrunk) {
        layoutGroup.add(airSupplyTrunk);
        buildingInteractionTargets.push(airSupplyTrunk);
      }

      const airReturnTrunk = createPipeSegment(
        new THREE.Vector3(trunkStartX, trunkY, returnZ),
        new THREE.Vector3(trunkEndX, trunkY, returnZ),
        airRadius * 0.92,
        {
          color: tintHex(palette.flowAir, 0.12),
          emissive: tintHex(palette.flowAir, -0.08),
          emissiveIntensity: 0.18,
          roughness: 0.34,
          metalness: 0.24,
          transparent: true,
          opacity: 0.48,
        }
      );
      if (airReturnTrunk) {
        layoutGroup.add(airReturnTrunk);
        buildingInteractionTargets.push(airReturnTrunk);
      }

      hallAirTapPoints.forEach(({ point: tapPoint }) => {
        const branchStart = new THREE.Vector3(tapPoint.x, trunkY, supplyZ);
        const branchEnd = new THREE.Vector3(tapPoint.x, trunkY, tapPoint.z);
        const dropEnd = new THREE.Vector3(tapPoint.x, tapPoint.y, tapPoint.z);

        const branch = createPipeSegment(branchStart, branchEnd, airRadius * 0.72, {
          color: palette.flowAir,
          emissive: tintHex(palette.flowAir, -0.14),
          emissiveIntensity: 0.2,
          roughness: 0.34,
          metalness: 0.24,
          transparent: true,
          opacity: 0.5,
        });
        if (branch) {
          layoutGroup.add(branch);
        }

        const drop = createPipeSegment(branchEnd, dropEnd, airRadius * 0.64, {
          color: tintHex(palette.flowAir, 0.05),
          emissive: tintHex(palette.flowAir, -0.12),
          emissiveIntensity: 0.18,
          roughness: 0.34,
          metalness: 0.24,
          transparent: true,
          opacity: 0.48,
        });
        if (drop) {
          layoutGroup.add(drop);
        }
      });

      const airPlant = new THREE.Mesh(
        new THREE.BoxGeometry(
          worldFromFeet(lerp(10, 16, pueNorm)),
          worldFromFeet(lerp(7, 10, pueNorm)),
          worldFromFeet(lerp(9, 14, pueNorm))
        ),
        new THREE.MeshStandardMaterial({
          color: blendHex(0x334155, palette.flowAir, 0.35),
          emissive: tintHex(palette.flowAir, -0.2),
          emissiveIntensity: 0.2,
          roughness: 0.38,
          metalness: 0.26,
          transparent: true,
          opacity: 0.7,
        })
      );
      const airPlantWidth = worldFromFeet(lerp(10, 16, pueNorm));
      const airPlantHeight = worldFromFeet(lerp(7, 10, pueNorm));
      airPlant.position.set(coolingPlantX + airPlantWidth * 0.92, baseY + airPlantHeight / 2, supplyZ);
      layoutGroup.add(airPlant);
      buildingInteractionTargets.push(airPlant);

      const plantToTrunk = createPipeSegment(
        new THREE.Vector3(coolingPlantX + worldFromFeet(5), baseY + worldFromFeet(7), supplyZ),
        new THREE.Vector3(trunkEndX, trunkY, supplyZ),
        airRadius * 0.86,
        {
          color: palette.flowAir,
          emissive: tintHex(palette.flowAir, -0.16),
          emissiveIntensity: 0.2,
          roughness: 0.3,
          metalness: 0.3,
          transparent: true,
          opacity: 0.54,
        }
      );
      if (plantToTrunk) {
        layoutGroup.add(plantToTrunk);
        buildingInteractionTargets.push(plantToTrunk);
      }
    }

    if (liquidNetworkEnabled) {
      const headerY = hallY + hallHeight * 0.24;
      const headerX = hallFieldWidth / 2 + hallWidth * 0.45;
      const supplyX = headerX;
      const returnX = headerX + worldFromFeet(3);
      const liquidRadius = Math.max(worldFromFeet(0.32), hallHeight * 0.022);

      const supplyHeader = createPipeSegment(
        new THREE.Vector3(supplyX, headerY, -hallFieldDepth / 2),
        new THREE.Vector3(supplyX, headerY, hallFieldDepth / 2),
        liquidRadius,
        {
          color: palette.flowLiquid,
          emissive: tintHex(palette.flowLiquid, -0.12),
          emissiveIntensity: 0.24,
          roughness: 0.26,
          metalness: 0.32,
          transparent: true,
          opacity: 0.62,
        }
      );
      if (supplyHeader) {
        layoutGroup.add(supplyHeader);
        buildingInteractionTargets.push(supplyHeader);
      }

      const returnHeader = createPipeSegment(
        new THREE.Vector3(returnX, headerY, -hallFieldDepth / 2),
        new THREE.Vector3(returnX, headerY, hallFieldDepth / 2),
        liquidRadius * 0.92,
        {
          color: tintHex(palette.flowLiquid, 0.12),
          emissive: tintHex(palette.flowLiquid, -0.08),
          emissiveIntensity: 0.22,
          roughness: 0.28,
          metalness: 0.3,
          transparent: true,
          opacity: 0.56,
        }
      );
      if (returnHeader) {
        layoutGroup.add(returnHeader);
        buildingInteractionTargets.push(returnHeader);
      }

      hallLiquidTapPoints.forEach(({ point: tapPoint }) => {
        const branchSupplyStart = new THREE.Vector3(supplyX, tapPoint.y, tapPoint.z);
        const branchReturnStart = new THREE.Vector3(returnX, tapPoint.y, tapPoint.z);

        const supplyBranch = createPipeSegment(branchSupplyStart, tapPoint, liquidRadius * 0.72, {
          color: palette.flowLiquid,
          emissive: tintHex(palette.flowLiquid, -0.12),
          emissiveIntensity: 0.24,
          roughness: 0.28,
          metalness: 0.3,
          transparent: true,
          opacity: 0.58,
        });
        if (supplyBranch) {
          layoutGroup.add(supplyBranch);
        }

        const returnBranch = createPipeSegment(
          new THREE.Vector3(tapPoint.x + liquidRadius * 1.8, tapPoint.y - liquidRadius * 1.5, tapPoint.z),
          branchReturnStart,
          liquidRadius * 0.6,
          {
            color: tintHex(palette.flowLiquid, 0.12),
            emissive: tintHex(palette.flowLiquid, -0.06),
            emissiveIntensity: 0.2,
            roughness: 0.28,
            metalness: 0.28,
            transparent: true,
            opacity: 0.52,
          }
        );
        if (returnBranch) {
          layoutGroup.add(returnBranch);
        }
      });

      const pumpSkid = new THREE.Mesh(
        new THREE.BoxGeometry(
          worldFromFeet(11),
          worldFromFeet(8),
          worldFromFeet(15)
        ),
        new THREE.MeshStandardMaterial({
          color: blendHex(0x334155, palette.flowLiquid, 0.42),
          emissive: tintHex(palette.flowLiquid, -0.18),
          emissiveIntensity: 0.24,
          roughness: 0.34,
          metalness: 0.24,
          transparent: true,
          opacity: 0.72,
        })
      );
      pumpSkid.position.set(returnX + worldFromFeet(6), baseY + worldFromFeet(4), 0);
      layoutGroup.add(pumpSkid);
      buildingInteractionTargets.push(pumpSkid);
    }

    const redundancy = getRedundancyLayout(params.redundancy, buildingWidthFt, buildingDepthFt);
    const utilityHeight = worldFromFeet(lerp(8, 20, criticalNorm) + lerp(1, 7, pueNorm));
    const utilityWidth = worldFromFeet(lerp(9, 20, criticalNorm));
    const utilityDepth = worldFromFeet(lerp(8, 16, pueNorm));
    const pathColor = blendHex(redundancy.color, palette.shellEdge, 0.2);
    const powerModuleAnchors: THREE.Vector3[] = [];

    redundancy.modulePositions.forEach((position) => {
      const moduleX = worldFromFeet(position.x);
      const moduleZ = worldFromFeet(position.z);

      const module = new THREE.Mesh(
        new THREE.BoxGeometry(utilityWidth, utilityHeight, utilityDepth),
        new THREE.MeshStandardMaterial({
          color: redundancy.color,
          emissive: tintHex(redundancy.color, -0.3),
          emissiveIntensity: 0.2,
          roughness: 0.46,
          metalness: 0.18,
          transparent: true,
          opacity: 0.42,
        })
      );
      module.position.set(moduleX, baseY + utilityHeight / 2, moduleZ);
      layoutGroup.add(module);
      buildingInteractionTargets.push(module);

      powerModuleAnchors.push(new THREE.Vector3(moduleX, baseY + utilityHeight * 0.88, moduleZ));

      const target = new THREE.Vector3(
        Math.sign(position.x) * worldFromFeet(Math.max(2, buildingWidthFt * 0.18)),
        baseY + buildingHeight * 0.38,
        Math.sign(position.z) * worldFromFeet(Math.max(2, buildingDepthFt / 2 - 2.2))
      );
      const points = [new THREE.Vector3(moduleX, baseY + utilityHeight * 0.8, moduleZ), target];

      const path = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(points),
        new THREE.LineBasicMaterial({
          color: pathColor,
          transparent: true,
          opacity: 0.68,
        })
      );
      layoutGroup.add(path);
      buildingInteractionTargets.push(path);

      if (redundancy.dualPaths) {
        const backupTarget = target.clone();
        backupTarget.y += worldFromFeet(2.6);
        backupTarget.x += position.x >= 0 ? -worldFromFeet(5.2) : worldFromFeet(5.2);
        const backupPath = new THREE.Line(
          new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(moduleX, baseY + utilityHeight * 0.72, moduleZ),
            backupTarget,
          ]),
          new THREE.LineBasicMaterial({
            color: tintHex(pathColor, 0.15),
            transparent: true,
            opacity: 0.64,
          })
        );
        layoutGroup.add(backupPath);
        buildingInteractionTargets.push(backupPath);
      }
    });

    const overheadBusY = hallY + hallHeight * 0.46;
    const powerCorridorX = hallFieldWidth / 2 + hallWidth * 0.56;
    const powerRoutePrimaryColor = blendHex(redundancy.color, 0xffffff, 0.12);
    const powerRouteSecondaryColor = tintHex(powerRoutePrimaryColor, 0.2);

    const addPowerRoute = (
      from: THREE.Vector3,
      to: THREE.Vector3,
      color: number,
      opacity: number
    ) => {
      const corridorX = to.x >= 0 ? powerCorridorX : -powerCorridorX;
      const line = createRoutingLine(
        [
          from,
          new THREE.Vector3(from.x, overheadBusY, from.z),
          new THREE.Vector3(corridorX, overheadBusY, from.z),
          new THREE.Vector3(corridorX, overheadBusY, to.z),
          new THREE.Vector3(to.x, overheadBusY, to.z),
          to,
        ],
        color,
        opacity
      );

      if (!line) {
        return;
      }

      layoutGroup.add(line);
    };

    const selectNearestAnchors = (target: THREE.Vector3) =>
      powerModuleAnchors
        .slice()
        .sort(
          (left, right) =>
            left.distanceToSquared(target) - right.distanceToSquared(target)
        );

    hallPowerTapPoints.forEach(({ point: tapPoint, hallIndex }) => {
      if (powerModuleAnchors.length === 0) {
        return;
      }

      const nearestAnchors = selectNearestAnchors(tapPoint);
      const primaryAnchor = nearestAnchors[0];
      const secondaryAnchor =
        nearestAnchors[1] ?? nearestAnchors[0];

      addPowerRoute(primaryAnchor, tapPoint, powerRoutePrimaryColor, 0.7);

      if (params.redundancy === "N+1") {
        const plusOneAnchor = nearestAnchors[Math.min(2, nearestAnchors.length - 1)] ?? secondaryAnchor;
        if (hallIndex % 2 === 0 || hallPowerTapPoints.length <= 3) {
          addPowerRoute(plusOneAnchor, tapPoint, powerRouteSecondaryColor, 0.5);
        }
      }

      if (params.redundancy === "2N") {
        addPowerRoute(secondaryAnchor, tapPoint, powerRouteSecondaryColor, 0.58);
      }
    });

    const buildingProfile = createVisualProfile(shellBaseColor, shellOpacity, shellEmissive);
    const buildingEntity: InteractiveEntity = {
      key: makeEntityKey("building", "B-01"),
      mesh: buildingMesh,
      type: "building",
      id: "B-01",
      profile: buildingProfile,
    };
    registerEntity(buildingEntity, [buildingMesh]);

    disableDepthWriteForTransparentMaterials(layoutGroup);

    interactiveRef.current = entities;

    const bounds = new THREE.Box3().setFromObject(layoutGroup);
    const size = bounds.getSize(new THREE.Vector3());
    const center = bounds.getCenter(new THREE.Vector3());
    const radius = Math.max(worldFromFeet(30), size.length() * 0.52);
    const fitDistance = computeCameraFitDistance(camera, radius);
    const cameraTourLayout = createCameraTourLayout(center, size, radius, fitDistance);
    const depthBias = clamp01(
      (buildingDepth - buildingWidth) / Math.max(buildingDepth, buildingWidth)
    );
    cameraTourLayout.sections[0].direction
      .set(0.78 - depthBias * 0.16, 0.58, 0.74 + depthBias * 0.12)
      .normalize();
    cameraTourLayout.sections[3].direction
      .set(0.88 - depthBias * 0.08, 0.44, -0.64 - depthBias * 0.16)
      .normalize();

    const tour = cameraTourRef.current;
    const previousLayout = tour.layout;
    tour.layout = cameraTourLayout;
    if (!previousLayout) {
      tour.progress = 0;
      tour.targetProgress = 0;
      tour.orbitAzimuth = 0;
      tour.orbitPolar = 0;
      tour.panOffset.set(0, 0, 0);
      tour.zoomOffset = 0;
    } else {
      const scaleRatio = cameraTourLayout.radius / Math.max(previousLayout.radius, 0.001);
      tour.panOffset.multiplyScalar(clamp(scaleRatio, 0.4, 2.4));
      tour.zoomOffset *= clamp(scaleRatio, 0.4, 2.4);
      tour.progress = clamp01(tour.progress);
      tour.targetProgress = clamp01(tour.targetProgress);
    }

    const maxPan = cameraTourLayout.radius * 0.8;
    if (tour.panOffset.length() > maxPan) {
      tour.panOffset.setLength(maxPan);
    }
    const poseForZoomClamp = sampleCameraTour(cameraTourLayout, tour.progress);
    const minZoomOffset = poseForZoomClamp.distance * (WHEEL_ZOOM_MIN_FACTOR - 1);
    const maxZoomOffset = poseForZoomClamp.distance * (WHEEL_ZOOM_MAX_FACTOR - 1);
    tour.zoomOffset = clamp(tour.zoomOffset, minZoomOffset, maxZoomOffset);

    const footprintSpan = Math.max(size.x, size.z);
    const floorSize = Math.max(FLOOR_SIZE, footprintSpan * 2.8);
    const floor = floorRef.current;
    if (floor) {
      const floorScale = floorSize / FLOOR_SIZE;
      floor.scale.set(floorScale, floorScale, 1);
      floor.position.set(center.x, baseY - worldFromFeet(0.2), center.z);
    }

    const grid = gridRef.current;
    if (grid) {
      const gridScale = floorSize / FLOOR_SIZE;
      grid.scale.set(gridScale, 1, gridScale);
      grid.position.set(center.x, baseY - worldFromFeet(0.08), center.z);
    }

    if (scene.fog instanceof THREE.Fog) {
      scene.fog.near = Math.max(30, fitDistance * 0.55);
      scene.fog.far = Math.max(260, fitDistance + radius * 4.5);
    }

    applyVisualStateRef.current();
    renderSceneRef.current();
  }, [model, params]);

  useEffect(() => {
    selectionRef.current = state.selection;
    applyVisualStateRef.current();
    renderSceneRef.current();
  }, [state.selection]);

  useEffect(() => {
    viewModeRef.current = state.viewMode;
  }, [state.viewMode]);

  useEffect(() => {
    const wasEnabled = scrollFlowEnabledRef.current;
    scrollFlowEnabledRef.current = state.ui.scrollFlowEnabled;
    if (!wasEnabled && state.ui.scrollFlowEnabled) {
      const tour = cameraTourRef.current;
      tour.zoomOffset = 0;
      renderSceneRef.current();
    }
  }, [state.ui.scrollFlowEnabled]);

  useEffect(() => {
    qualityRef.current = state.quality;
    if (typeof window === "undefined") {
      return;
    }

    const mountElement = mountRef.current;
    const renderer = rendererRef.current;
    if (!mountElement || !renderer) {
      return;
    }

    renderer.setPixelRatio(resolvePixelRatio(state.quality, window.devicePixelRatio || 1));
    renderer.setSize(mountElement.clientWidth, mountElement.clientHeight, false);
    renderSceneRef.current();
  }, [state.quality]);

  useEffect(() => {
    if (state.ui.cameraResetNonce <= 0) {
      return;
    }
    resetCameraRef.current();
  }, [state.ui.cameraResetNonce]);

  return <div ref={mountRef} className="viewport" aria-label="3D data center viewport" />;
}
