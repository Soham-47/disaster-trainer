import { ExperienceState } from "@/lib/scenario/types";

export type PlayerAction =
  | { type: "START_SCENARIO"; scenarioId: string }
  | { type: "ORIENT_COMPLETE" }
  | { type: "SELECT_CHOICE"; choiceId: string }
  | { type: "CONSEQUENCE_COMPLETE" }
  | { type: "START_REWIND" }
  | { type: "REWIND_COMPLETE" }
  | { type: "ALTERNATIVE_COMPLETE" }
  | { type: "DEBRIEF_NEXT" }
  | { type: "SUBMIT_TRANSFER"; choiceId: string }
  | { type: "RESTART" }
  | { type: "FAIL"; error: string };

export type PlayerState = {
  current: ExperienceState;
  scenarioId: string | null;
  initialChoiceId: string | null;
  transferChoiceId: string | null;
  isRewinding: boolean;
  errorMessage: string | null;
  startedAt: number | null;
};

export const initialPlayerState: PlayerState = {
  current: "entry",
  scenarioId: null,
  initialChoiceId: null,
  transferChoiceId: null,
  isRewinding: false,
  errorMessage: null,
  startedAt: null,
};

export function playerReducer(state: PlayerState, action: PlayerAction): PlayerState {
  switch (action.type) {
    case "START_SCENARIO":
      return {
        ...initialPlayerState,
        current: "orient",
        scenarioId: action.scenarioId,
        startedAt: Date.now(),
      };
    case "ORIENT_COMPLETE":
      if (state.current !== "orient") return state;
      return { ...state, current: "decision" };

    case "SELECT_CHOICE":
      if (state.current !== "decision") return state;
      return { ...state, current: "consequence", initialChoiceId: action.choiceId };

    case "CONSEQUENCE_COMPLETE":
      if (state.current !== "consequence") return state;
      return { ...state, current: "rewind", isRewinding: true };

    case "START_REWIND":
      return { ...state, isRewinding: true };

    case "REWIND_COMPLETE":
      if (state.current !== "rewind") return state;
      return { ...state, current: "alternative", isRewinding: false };

    case "ALTERNATIVE_COMPLETE":
      if (state.current !== "alternative") return state;
      return { ...state, current: "debrief" };

    case "DEBRIEF_NEXT":
      if (state.current !== "debrief") return state;
      return { ...state, current: "transfer" };

    case "SUBMIT_TRANSFER":
      if (state.current !== "transfer") return state;
      return { ...state, current: "result", transferChoiceId: action.choiceId };

    case "RESTART":
      return initialPlayerState;

    case "FAIL":
      return { ...state, current: "error", errorMessage: action.error };

    default:
      return state;
  }
}
