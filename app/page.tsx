"use client";

import { ExperiencePlayer } from "@/components/ExperiencePlayer";
import { structureFireScenario } from "@/scenarios/structure-fire-v1";
import { hotelTransferScenario } from "@/scenarios/transfer-hotel-fire-v1";

export default function CounterfactualDisasterTrainerPage() {
  return <ExperiencePlayer scenario={structureFireScenario} transferScenario={hotelTransferScenario} />;
}

