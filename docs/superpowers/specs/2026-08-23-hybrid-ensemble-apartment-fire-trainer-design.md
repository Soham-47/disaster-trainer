# Hybrid Ensemble Apartment-Fire Trainer — Design

> Status: Approved architecture change. Supersedes LingBot World 2 as the primary provider — Happy Oyster (persistent apartment world) becomes the only live generative provider.
> Date: 2026-08-23 · Branch owner: `feat/scenario-engine` (Soumodeep)

## Summary

Build a third approach combining Happy Oyster's immersive exploration with a deterministic local 2.5D renderer for safety-critical interactions, consequences, replay, and fallback.

Happy Oyster supplies atmosphere and free movement when available. The local renderer supplies repeatability and reliability. A deterministic training controller remains the sole authority for progression, safety classification, exposure, scoring, and debrief content.

This differs from:

- Krishna's full local 3D/Rapier renderer: no complete physics-based world is required.
- The Happy Oyster redesign: the provider is not trusted to render or reproduce every consequence.

## Runtime Architecture

### 1. Provider exploration layer

Use the validated persistent Happy Oyster apartment world for:

- Free first-person exploration.
- Ambient fire, smoke, lighting, and movement.
- Initial discovery of the alarm, smoke, door, phone, window, flashlight, and cloth.

Provider events may update visual status only. They must never mutate training state.

### 2. Local 2.5D canonical scene layer

Implement a lightweight layered Canvas renderer with:

- Authored bedroom depth layers and hotspots.
- Camera pan/zoom or discrete view zones.
- Door, smoke, warm-light, visibility, and alarm-state layers.
- Optional captured Happy Oyster frame as the background.
- Deterministic visual states for safe and unsafe branches.
- Keyboard and mouse fallback controls.

At each safety-critical moment, capture the current provider frame and transition to the local scene. The local renderer then owns:

- Cue inspection.
- Warm-door decision.
- Door-opening consequences.
- Smoke and exposure presentation.
- Counterfactual replay.
- Recovery and debrief visuals.

If Happy Oyster is unavailable, the same local scene runs the complete training episode in reduced form.

### 3. Deterministic training controller

Use one reducer/state machine for both live and fallback modes.

```ts
type SessionMode = "provider" | "local-fallback";

type FireStage =
  | "orient"
  | "explore"
  | "inspect-cues"
  | "decision"
  | "consequence"
  | "counterfactual"
  | "debrief"
  | "complete";

type FireSnapshot = {
  stage: FireStage;
  discoveredCueIds: string[];
  completedActionIds: string[];
  chosenBranch?: "open-door" | "keep-door-closed";
  exposure: number;
  penalties: number;
  cameraPreset: string;
  doorOpen: boolean;
  smokeLevel: number;
  lightIntensity: number;
};
```

The controller must produce identical training outcomes for identical action sequences in both modes.

## Core Flow

1. Attempt to connect to the saved Happy Oyster world.
2. If a valid first frame is not received within the startup budget, enter local fallback mode.
3. Allow exploration and cue discovery.
4. When the learner inspects the door or selects a branch:
   - capture the provider frame if available;
   - save a `FireSnapshot`;
   - transition to the local canonical scene.
5. Render the selected safe or unsafe consequence locally.
6. Restore the saved snapshot.
7. Render the opposite branch locally.
8. Return to provider exploration only if the provider is still healthy; otherwise continue locally.
9. Run the shared debrief and scoring flow.

Provider restart is optional presentation behavior. It must not be required for correctness, replay, or assessment.

## Interfaces

Create a renderer-neutral coordinator:

```ts
interface FireRuntime {
  start(): Promise<void>;
  move(direction: AdventureDirection): void;
  look(delta: { x: number; y: number }): void;
  interact(action: ReviewedFireAction): void;
  captureFrame(): Promise<string | undefined>;
  enterDecisionScene(): Promise<void>;
  restore(snapshot: FireSnapshot): Promise<void>;
  stop(): Promise<void>;
}
```

Implement two adapters:

```ts
class HappyOysterExplorationAdapter implements FireRuntime {}
class LocalCanvasFallbackAdapter implements FireRuntime {}
```

The coordinator selects the provider adapter when startup succeeds and switches to the local adapter on timeout, stream failure, invalid world state, or provider restart failure.

All actions must pass through the deterministic controller before reaching either adapter. Unreviewed or unavailable actions are rejected locally.

## UI

Keep the immersive presentation minimal:

- Full-screen provider video or local Canvas.
- Objective in the upper-left.
- Exposure state in the upper-right.
- Center reticle.
- Contextual interaction prompt.
- Short transition indicator when entering a local decision scene.
- Developer-only diagnostics drawer.

Do not show provider prompts, raw world IDs, technical logs, generation status, or the old multi-disaster controls.

## Testing and Acceptance Criteria

### Automated tests

- The same action sequence produces the same controller snapshot in provider and fallback modes.
- Unsafe and safer branches produce deterministic exposure and scoring.
- Snapshot restore deeply restores door, smoke, exposure, stage, cues, and branch state.
- Unreviewed actions never reach the provider or local renderer.
- Provider timeout enters local fallback without losing training progress.
- Stream loss during exploration transitions safely to local mode.
- Captured frames are valid data URLs and never become the source of training truth.
- Local branch rendering remains stable across repeated replays.
- Keyboard, mouse, blur, pointer-lock loss, and unmount stop movement.
- The application never scores a failed or incomplete startup as a valid run.

### Live qualification

- Happy Oyster world attaches successfully in at least four of five runs.
- First frame arrives within 20 seconds in at least four runs.
- Provider movement visibly responds within 1.5 seconds.
- Local decision scene appears without a blank frame or stale interaction state.
- Safe and unsafe consequences are visibly distinct within five seconds.
- Counterfactual replay is repeatable and uses the same saved snapshot.
- Local fallback completes the entire episode if the provider is unavailable.
- Both provider and local modes maintain responsive UI performance at 60 FPS.
- A safety reviewer approves the cues, action gating, consequence logic, and debrief.

## Assumptions

- React 18 remains the application baseline.
- Happy Oyster remains the only live generative provider.
- The local renderer is layered 2.5D Canvas, not Three.js/Rapier.
- The provider is used for immersion, not safety truth or exact replay.
- Exact pixel-identical replay of provider video is not required.
- The local fallback must preserve the training outcome and assessment, even if it offers less spatial freedom than the provider experience.
- Existing American Red Cross-aligned safety guidance remains the source for debrief language.
