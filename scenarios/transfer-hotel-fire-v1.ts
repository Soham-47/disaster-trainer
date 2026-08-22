import { composeScenario } from "../lib/scenario/engine";
import { structureFirePack } from "./structure-fire-v1";

export const hotelTransferScenario = composeScenario(structureFirePack, {
  disasterType: "structure_fire",
  environment: "hotel",
  timeOfDay: "night",
  occupancy: "family",
  mobilityConstraint: "none",
  infrastructureState: "normal",
  severity: "active_danger",
});
