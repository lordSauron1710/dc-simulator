export { computeDataCenter } from "./dataCenter";
export type {
  DataCenterModel,
  FacilityLoadSummary,
  AreaSummary,
  HallDescription,
  HallRow,
  RowPackingSummary,
} from "./dataCenter";
export {
  buildDefaultCampusFromParams,
  buildRackRange,
  formatCampusId,
  formatZoneId,
  formatHallId,
  formatRackId,
  formatRackGroupId,
} from "./campus";
export type {
  Campus,
  CampusProperties,
  Zone,
  ZoneHallDefaults,
  ZoneRackRules,
  Hall,
  HallProfile,
  RackGroup,
  Rack,
  EntityMetadata,
  RedundancyProfile,
  CoolingProfile,
  ContainmentProfile,
} from "./campus";
export {
  applyCampusPropertyPatch,
  applyRackProfilePatchByScope,
  CAMPUS_PARAM_LIMITS,
  computeDataCenterFromCampus,
  deriveParamsFromCampus,
  reconcileCampus,
  validateCampus,
} from "./campusBuilder";
export type {
  CampusValidationIssue,
  CampusParameterScope,
  ParameterScopeLevel,
  RackProfilePatch,
  CampusPropertyPatch,
} from "./campusBuilder";
