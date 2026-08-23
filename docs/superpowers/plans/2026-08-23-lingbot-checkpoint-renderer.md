# LingBot Checkpoint Renderer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Happy Oyster showcase with a single apartment-fire trainer whose exploration, chosen consequence and counterfactual consequence are all rendered live by LingBot World 2.

**Architecture:** A focused `LingBotSession` wraps SDK transport and event acknowledgements; a `CheckpointDirector` owns capture/reset/restart jobs; a runtime reducer commits safety actions only after the matching generated branch publishes its first confirmed chunk. A LingBot-only viewport shows the live stream or a captured LingBot frame during transitions and never shows prepared disaster media.

**Tech Stack:** Next.js 14, React 18, TypeScript 5, `@reactor-models/lingbot-world-2`, Vitest, Playwright, Tailwind CSS.

**Spec:** `docs/superpowers/specs/2026-08-23-lingbot-checkpoint-renderer-design.md`

## Global Constraints

- LingBot World 2 renders every learner-visible disaster scene.
- The primary showcase supports only the reviewed apartment-fire episode.
- The app does not reveal training controls before the first real LingBot frame and first chunk are confirmed.
- Image or seed changes use `reset` followed by a new `start`; SDK events, not command resolution, determine readiness.
- Both counterfactual branches use the same captured checkpoint image and seed.
- The deterministic engine alone owns safety state, hazards, scoring and available actions.
- A branch action remains pending until the matching render job returns a confirmed first-chunk receipt.
- No MP4, fallback image or canvas-generated disaster scene may appear in the main runtime.
- Startup and branch failures remain visible, retryable and unscored.
- No additional runtime AI service or 3D renderer is added.
- Existing unrelated user changes must be preserved.
- Run `npm test`, `npm run lint`, `npm run typecheck`, `npm run build` and `npx playwright test` before completion.

## Preflight: Preserve the Existing Working Tree

The branch begins with verified but uncommitted Happy Oyster recovery changes. Preserve them as history before replacing that runtime.

- [ ] **Step 1: Confirm the expected dirty files**

Run:

```powershell
git status --short
```

Expected entries:

```text
M components/HappyOysterFireTrainer.tsx
M lib/happy-oyster/fire-client.ts
M tests/happy-oyster-fire-client.test.ts
M vitest.config.ts
?? lib/fire-training/visual-continuation.ts
?? tests/fire-visual-continuation.test.ts
```

- [ ] **Step 2: Verify the preserved implementation**

Run:

```powershell
npm test
npm run lint
npm run typecheck
```

Expected: all commands exit 0.

- [ ] **Step 3: Commit only the existing recovery changes**

```powershell
git add components/HappyOysterFireTrainer.tsx lib/happy-oyster/fire-client.ts tests/happy-oyster-fire-client.test.ts vitest.config.ts lib/fire-training/visual-continuation.ts tests/fire-visual-continuation.test.ts
git commit -m "fix: preserve Happy Oyster interaction recovery"
```

Expected: the specification commit, implementation-plan commit and this preservation commit are the only new commits before Task 1.

---

### Task 1: Decouple Fire Training Actions from Happy Oyster

**Files:**
- Create: `lib/fire-training/actions.ts`
- Modify: `lib/fire-training/reducer.ts`
- Modify: `lib/fire-training/content.ts`
- Modify: `lib/happy-oyster/fire-client.ts`
- Modify: `components/HappyOysterFireTrainer.tsx`
- Modify: `lib/fire-training/visual-continuation.ts`
- Test: `tests/fire-training-actions.test.ts`
- Test: `tests/fire-training-reducer.test.ts`

**Interfaces:**
- Produces: `FireAction`, `FIRE_ACTIONS`, `isFireAction(value)`.
- Consumers: the deterministic reducer, legacy Happy Oyster adapter during migration, scene contracts and the LingBot runtime reducer.

- [ ] **Step 1: Write the failing action-contract test**

Create `tests/fire-training-actions.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { FIRE_ACTIONS, isFireAction } from "../lib/fire-training/actions";

describe("fire training actions", () => {
  it("defines the reviewed action vocabulary independently of a renderer", () => {
    expect(FIRE_ACTIONS).toEqual([
      "ListenAlarm",
      "InspectSmoke",
      "FeelDoor",
      "OpenDoor",
      "CloseDoor",
      "KeepDoorClosed",
      "UsePhone",
      "SignalWindow",
      "CrouchLow",
    ]);
    expect(isFireAction("OpenDoor")).toBe(true);
    expect(isFireAction("Attack")).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test and verify the missing-module failure**

```powershell
npx vitest run tests/fire-training-actions.test.ts
```

Expected: FAIL because `lib/fire-training/actions.ts` does not exist.

- [ ] **Step 3: Add the renderer-independent action module**

Create `lib/fire-training/actions.ts`:

```ts
export const FIRE_ACTIONS = [
  "ListenAlarm",
  "InspectSmoke",
  "FeelDoor",
  "OpenDoor",
  "CloseDoor",
  "KeepDoorClosed",
  "UsePhone",
  "SignalWindow",
  "CrouchLow",
] as const;

export type FireAction = (typeof FIRE_ACTIONS)[number];

export function isFireAction(value: string): value is FireAction {
  return FIRE_ACTIONS.includes(value as FireAction);
}
```

- [ ] **Step 4: Replace renderer-owned action imports**

Update `lib/fire-training/reducer.ts`, `lib/fire-training/content.ts`, `lib/fire-training/visual-continuation.ts` and `components/HappyOysterFireTrainer.tsx` to import `FireAction` from `lib/fire-training/actions.ts`.

In `lib/happy-oyster/fire-client.ts`, keep the temporary compatibility aliases:

```ts
import { FIRE_ACTIONS, type FireAction } from "../fire-training/actions";

export const REVIEWED_FIRE_ACTIONS = FIRE_ACTIONS;
export type ReviewedFireAction = FireAction;
```

- [ ] **Step 5: Run focused and full tests**

```powershell
npx vitest run tests/fire-training-actions.test.ts tests/fire-training-reducer.test.ts tests/happy-oyster-fire-client.test.ts
npm run typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit**

```powershell
git add lib/fire-training/actions.ts lib/fire-training/reducer.ts lib/fire-training/content.ts lib/fire-training/visual-continuation.ts lib/happy-oyster/fire-client.ts components/HappyOysterFireTrainer.tsx tests/fire-training-actions.test.ts tests/fire-training-reducer.test.ts
git commit -m "refactor: decouple fire actions from renderer"
```

---

### Task 2: Add Pending-Render Runtime State

**Files:**
- Create: `lib/fire-training/runtime.ts`
- Test: `tests/fire-training-runtime.test.ts`

**Interfaces:**
- Consumes: `FireAction`, `FireTrainingState`, `fireTrainingReducer`.
- Produces: `TrainerRuntimeState`, `FireRuntime`, `FireRuntimeEvent`, `createFireRuntime()`, `fireRuntimeReducer()`.

- [ ] **Step 1: Write failing tests for render-gated action commits**

Create `tests/fire-training-runtime.test.ts` with these cases:

```ts
import { describe, expect, it } from "vitest";
import { createFireRuntime, fireRuntimeReducer } from "../lib/fire-training/runtime";

function reachDecision() {
  let state = fireRuntimeReducer(createFireRuntime(), { type: "LIVE_READY" });
  for (const action of ["ListenAlarm", "InspectSmoke", "FeelDoor"] as const) {
    state = fireRuntimeReducer(state, { type: "LOCAL_ACTION", action });
  }
  return state;
}

describe("fire runtime", () => {
  it("does not commit a branch action before its render receipt", () => {
    let state = reachDecision();
    state = fireRuntimeReducer(state, {
      type: "CHECKPOINT_READY",
      checkpointId: "fire-door-checkpoint",
    });
    state = fireRuntimeReducer(state, {
      type: "BRANCH_REQUESTED",
      jobId: 7,
      action: "OpenDoor",
    });

    expect(state.training.initialDecision).toBeNull();
    expect(state.pendingAction).toEqual({ jobId: 7, action: "OpenDoor" });

    state = fireRuntimeReducer(state, {
      type: "BRANCH_RENDERED",
      receipt: { jobId: 7, firstChunkIndex: 1, startedAt: 100, firstFrameAt: 140 },
    });
    expect(state.training.initialDecision).toBe("OpenDoor");
    expect(state.phase).toBe("consequence");
  });

  it("ignores stale render receipts", () => {
    let state = reachDecision();
    state = fireRuntimeReducer(state, { type: "CHECKPOINT_READY", checkpointId: "cp" });
    state = fireRuntimeReducer(state, { type: "BRANCH_REQUESTED", jobId: 9, action: "KeepDoorClosed" });
    const stale = fireRuntimeReducer(state, {
      type: "BRANCH_RENDERED",
      receipt: { jobId: 8, firstChunkIndex: 1, startedAt: 100, firstFrameAt: 140 },
    });
    expect(stale).toEqual(state);
  });

  it("keeps the decision retryable after a branch failure", () => {
    let state = reachDecision();
    state = fireRuntimeReducer(state, { type: "CHECKPOINT_READY", checkpointId: "cp" });
    state = fireRuntimeReducer(state, { type: "BRANCH_REQUESTED", jobId: 3, action: "OpenDoor" });
    state = fireRuntimeReducer(state, { type: "BRANCH_FAILED", jobId: 3, message: "first frame timeout" });
    expect(state.training.initialDecision).toBeNull();
    expect(state.phase).toBe("decision_ready");
    expect(state.error).toBe("first frame timeout");
  });

  it("commits the alternative only after its matching render receipt", () => {
    let state = reachDecision();
    state = fireRuntimeReducer(state, { type: "CHECKPOINT_READY", checkpointId: "cp" });
    state = fireRuntimeReducer(state, { type: "BRANCH_REQUESTED", jobId: 4, action: "KeepDoorClosed" });
    state = fireRuntimeReducer(state, {
      type: "BRANCH_RENDERED",
      receipt: { jobId: 4, firstChunkIndex: 1, startedAt: 100, firstFrameAt: 140 },
    });
    state = fireRuntimeReducer(state, { type: "ALTERNATIVE_REQUESTED", jobId: 5, action: "OpenDoor" });
    expect(state.training.alternativeDecision).toBeNull();
    state = fireRuntimeReducer(state, {
      type: "ALTERNATIVE_RENDERED",
      receipt: { jobId: 5, firstChunkIndex: 1, startedAt: 200, firstFrameAt: 250 },
    });
    expect(state.training.alternativeDecision).toBe("OpenDoor");
    expect(state.phase).toBe("alternative");
  });
});
```

- [ ] **Step 2: Run the tests and verify RED**

```powershell
npx vitest run tests/fire-training-runtime.test.ts
```

Expected: FAIL because the runtime module does not exist.

- [ ] **Step 3: Implement the runtime types and reducer**

Create `lib/fire-training/runtime.ts` with this public shape:

```ts
import type { FireAction } from "./actions";
import { createFireTrainingState, fireTrainingReducer, type FireTrainingState } from "./reducer";

export type TrainerRuntimeState =
  | "booting"
  | "orienting"
  | "exploring"
  | "checkpointing"
  | "decision_ready"
  | "branch_rendering"
  | "consequence"
  | "rewinding"
  | "alternative_rendering"
  | "alternative"
  | "debrief"
  | "fatal";

export type LingBotRenderReceipt = {
  jobId: number;
  firstChunkIndex: number;
  startedAt: number;
  firstFrameAt: number;
};

export type FireRuntime = {
  phase: TrainerRuntimeState;
  training: FireTrainingState;
  checkpointId: string | null;
  pendingAction: { jobId: number; action: FireAction } | null;
  error: string | null;
};
```

Implement the event union used by the tests. `LOCAL_ACTION` may submit only non-visual cue/resource actions. `BRANCH_RENDERED` must compare `receipt.jobId` to `pendingAction.jobId` before calling `fireTrainingReducer` with `SUBMIT_ACTION`. `ALTERNATIVE_REQUESTED` must enter the existing reducer's counterfactual restore sequence without committing the alternative action; `ALTERNATIVE_RENDERED` commits it only after matching the pending job. `CloseDoor` is a visual branch action and must use the same pending-render gate as the pivotal decision.

- [ ] **Step 4: Run focused tests**

```powershell
npx vitest run tests/fire-training-runtime.test.ts tests/fire-training-reducer.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add lib/fire-training/runtime.ts tests/fire-training-runtime.test.ts
git commit -m "feat: gate fire actions on rendered branches"
```

---

### Task 3: Introduce LingBot Session Contracts

**Files:**
- Create: `lib/lingbot/types.ts`
- Create: `lib/lingbot/session.ts`
- Create: `lib/lingbot/errors.ts`
- Test: `tests/lingbot-session.test.ts`
- Reference: `lib/reactor/client.ts`
- Reference: `tests/reactor-adapter.test.ts`

**Interfaces:**
- Produces: `LingBotFileRef`, `LingBotSceneContract`, `LingBotCheckpoint`, `LingBotRenderJob`, `LingBotSessionPort`, `LingBotSession`.
- Consumes: `/api/reactor-token` and `@reactor-models/lingbot-world-2`.

- [ ] **Step 1: Write the failing session tests**

Create `tests/lingbot-session.test.ts` using a hoisted fake `LingbotWorld2Model`. Cover these exact behaviors:

```ts
it("does not resolve initial render before image, prompt, video and first chunk are confirmed");
it("registers event waiters before issuing their commands");
it("sends no navigation command before SDK status ready");
it("resets and restarts with the supplied file reference and seed");
it("applies a bounded prompt and camera delta at a chunk boundary");
it("rejects command_error instead of activating fallback media");
it("rejects first-frame timeout without fabricating a render receipt");
it("sends all four navigation axes to idle during stopNavigation");
it("disconnects and removes every SDK subscription");
```

The reset assertion must verify this order:

```ts
expect(commandNames).toEqual([
  "reset",
  "setSeed",
  "setAttnWindow",
  "setImage",
  "setPrompt",
  "start",
]);
```

- [ ] **Step 2: Run the session test and verify RED**

```powershell
npx vitest run tests/lingbot-session.test.ts
```

Expected: FAIL because the LingBot modules do not exist.

- [ ] **Step 3: Define the public types**

Create `lib/lingbot/types.ts`:

```ts
import type { LingbotWorld2Model } from "@reactor-models/lingbot-world-2";
import type { FireTrainingState } from "../fire-training/reducer";
import type { LingBotRenderReceipt } from "../fire-training/runtime";

export type LingBotNavigationInput = {
  forward: boolean;
  backward: boolean;
  left: boolean;
  right: boolean;
  lookHorizontal: "left" | "right" | "idle";
  lookVertical: "up" | "down" | "idle";
};

export type LingBotFileRef = Awaited<ReturnType<LingbotWorld2Model["uploadFile"]>>;

export type LingBotSceneContract = {
  id: string;
  seed: number;
  invariantPrompt: string;
  branchPrompt: string;
  requiredVisualFacts: string[];
  forbiddenVisualFacts: string[];
  cameraPose: number[];
  attentionWindow: "small" | "large" | "auto";
  maximumFirstFrameMs: number;
};

export type LingBotCheckpoint = {
  id: string;
  frameDataUrl: string;
  uploadedFileRef: LingBotFileRef;
  seed: number;
  worldState: FireTrainingState;
  createdAt: number;
};

export type LingBotRenderJob = {
  jobId: number;
  kind: "initial" | "branch" | "alternative";
  checkpoint: LingBotCheckpoint | null;
  scene: LingBotSceneContract;
};

export type LingBotSessionPort = {
  connect(): Promise<void>;
  uploadReference(source: Blob): Promise<LingBotFileRef>;
  render(job: LingBotRenderJob, reference: LingBotFileRef): Promise<LingBotRenderReceipt>;
  applyDelta(input: {
    jobId: number;
    prompt: string;
    cameraPose: number[];
    attentionWindow: "small" | "large" | "auto";
  }): Promise<LingBotRenderReceipt>;
  pauseAtChunkBoundary(): Promise<void>;
  waitForNextChunk(): Promise<number>;
  setNavigation(input: LingBotNavigationInput): Promise<void>;
  stopNavigation(): Promise<void>;
  getStream(): MediaStream | null;
  disconnect(): Promise<void>;
};
```

- [ ] **Step 4: Implement errors and session transport**

Create `lib/lingbot/errors.ts` with `LingBotTimeoutError`, `LingBotCommandError` and `LingBotTransportError`, each containing a stable `code`.

Create `lib/lingbot/session.ts` by extracting the proven token, SDK-ready, upload, event-waiting and navigation behavior from `lib/reactor/client.ts`. Do not copy `currentMode`, `activeFallbackAsset`, `useFallback` or prepared-media behavior.

The `render()` method must:

```ts
async render(job: LingBotRenderJob, reference: LingBotFileRef) {
  const startedAt = Date.now();
  if (job.kind !== "initial") await this.resetAndWait();
  await this.model.setSeed({ seed: job.scene.seed });
  await this.model.setAttnWindow({ attn_window: job.scene.attentionWindow });
  if (job.scene.cameraPose.length > 0) {
    await this.model.setCameraPose({ camera_pose: job.scene.cameraPose });
  }
  await this.setImageAndWait(reference);
  await this.setPromptAndWait(`${job.scene.invariantPrompt} ${job.scene.branchPrompt}`.trim());
  const firstChunk = this.waitForNextChunk();
  await this.startAndWaitForVideo();
  const firstChunkIndex = await firstChunk;
  return { jobId: job.jobId, firstChunkIndex, startedAt, firstFrameAt: Date.now() };
}
```

Register the first-chunk waiter before calling `start()` so the first event cannot be missed.

`applyDelta()` must register a next-chunk waiter, set the attention window, optional camera pose and prompt, wait for `prompt_accepted`, then resolve only after that next chunk completes. It does not call `reset` or `start`.

- [ ] **Step 5: Run focused tests and typecheck**

```powershell
npx vitest run tests/lingbot-session.test.ts tests/reactor-adapter.test.ts
npm run typecheck
```

Expected: PASS. Existing `ReactorClient` remains unchanged for legacy tests.

- [ ] **Step 6: Commit**

```powershell
git add lib/lingbot/types.ts lib/lingbot/session.ts lib/lingbot/errors.ts tests/lingbot-session.test.ts
git commit -m "feat: add event-driven LingBot session"
```

---

### Task 4: Implement Checkpoint Capture and Branch Direction

**Files:**
- Create: `lib/lingbot/frame-capture.ts`
- Create: `lib/lingbot/checkpoint-director.ts`
- Test: `tests/lingbot-frame-capture.test.ts`
- Test: `tests/lingbot-checkpoint-director.test.ts`

**Interfaces:**
- Consumes: `LingBotSessionPort`, `LingBotSceneContract`, `FireTrainingState`.
- Produces: `captureVideoFrame(video)`, `CheckpointDirector.prepareCheckpoint()`, `CheckpointDirector.renderBranch()`, `CheckpointDirector.cancel()`.

- [ ] **Step 1: Write failing frame-capture tests**

Cover:

```ts
it("rejects video with zero dimensions");
it("captures at 1280 by 720 with JPEG quality 0.82");
it("rejects an empty canvas result");
```

Inject a canvas factory into `captureVideoFrame` so the test asserts `drawImage`, width, height and `toDataURL("image/jpeg", 0.82)` without adding a DOM test dependency.

- [ ] **Step 2: Write failing director tests**

Cover:

```ts
it("stops navigation and pauses before uploading a checkpoint");
it("uploads a checkpoint only once and reuses its file reference");
it("passes the same checkpoint and seed to both branches");
it("retries the same branch contract once after a timeout");
it("rejects receipts from a cancelled job");
```

- [ ] **Step 3: Verify RED**

```powershell
npx vitest run tests/lingbot-frame-capture.test.ts tests/lingbot-checkpoint-director.test.ts
```

Expected: FAIL because both modules are missing.

- [ ] **Step 4: Implement frame capture**

Create `lib/lingbot/frame-capture.ts` with:

```ts
export type CanvasFactory = () => HTMLCanvasElement;

export function captureVideoFrame(
  video: HTMLVideoElement,
  createCanvas: CanvasFactory = () => document.createElement("canvas")
): string {
  if (video.readyState < 2 || video.videoWidth === 0 || video.videoHeight === 0) {
    throw new Error("LingBot video is not ready for checkpoint capture.");
  }
  const canvas = createCanvas();
  canvas.width = 1280;
  canvas.height = 720;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Checkpoint canvas context is unavailable.");
  context.drawImage(video, 0, 0, 1280, 720);
  const frame = canvas.toDataURL("image/jpeg", 0.82);
  if (!frame.startsWith("data:image/jpeg;base64,") || frame.length < 100) {
    throw new Error("Checkpoint capture was empty.");
  }
  return frame;
}
```

- [ ] **Step 5: Implement the director**

`CheckpointDirector` must own `nextJobId`, `activeJobId`, the cached checkpoint and a one-retry loop. `prepareCheckpoint()` must call `stopNavigation()`, await `waitForNextChunk()`, await `pauseAtChunkBoundary()`, then invoke `capture()` so the JPEG comes from the confirmed paused boundary. Convert the resulting data URL to `Blob` with `fetch(frameDataUrl).then(response => response.blob())` before `uploadReference`.

Public methods:

```ts
prepareCheckpoint(input: {
  id: string;
  capture: () => string;
  seed: number;
  worldState: FireTrainingState;
}): Promise<LingBotCheckpoint>;

renderBranch(input: {
  kind: "branch" | "alternative";
  checkpoint: LingBotCheckpoint;
  scene: LingBotSceneContract;
}): Promise<LingBotRenderReceipt>;

cancel(): void;
```

If file-reference reuse is rejected by `render()`, re-upload the stored frame once inside the same job and update the cached checkpoint before the normal timeout retry is counted.

- [ ] **Step 6: Run focused tests**

```powershell
npx vitest run tests/lingbot-frame-capture.test.ts tests/lingbot-checkpoint-director.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit**

```powershell
git add lib/lingbot/frame-capture.ts lib/lingbot/checkpoint-director.ts tests/lingbot-frame-capture.test.ts tests/lingbot-checkpoint-director.test.ts
git commit -m "feat: add LingBot checkpoint branch director"
```

---

### Task 5: Lock the Apartment-Fire Scene Contracts

**Files:**
- Create: `lib/fire-training/lingbot-scenes.ts`
- Test: `tests/fire-training-lingbot-scenes.test.ts`
- Modify: `lib/fire-training/content.ts`

**Interfaces:**
- Produces: `FIRE_INITIAL_SCENE`, `FIRE_UNSAFE_SCENE`, `FIRE_SAFE_SCENE`, `FIRE_RECOVERY_SCENE`, `sceneForFireAction(action)`.
- Consumers: `LingBotFireTrainer` and `CheckpointDirector`.

- [ ] **Step 1: Write failing scene-contract tests**

```ts
import { describe, expect, it } from "vitest";
import {
  FIRE_INITIAL_SCENE,
  FIRE_RECOVERY_SCENE,
  FIRE_SAFE_SCENE,
  FIRE_UNSAFE_SCENE,
  sceneForFireAction,
} from "../lib/fire-training/lingbot-scenes";

describe("fire LingBot scenes", () => {
  it("uses one fixed checkpoint seed for both futures", () => {
    expect(FIRE_UNSAFE_SCENE.seed).toBe(FIRE_SAFE_SCENE.seed);
  });

  it("changes only the branch delta between counterfactual futures", () => {
    expect(FIRE_UNSAFE_SCENE.invariantPrompt).toBe(FIRE_SAFE_SCENE.invariantPrompt);
    expect(FIRE_UNSAFE_SCENE.branchPrompt).not.toBe(FIRE_SAFE_SCENE.branchPrompt);
  });

  it("maps reviewed door actions to the correct scene", () => {
    expect(sceneForFireAction("OpenDoor").id).toBe("fire-door-open");
    expect(sceneForFireAction("KeepDoorClosed").id).toBe("fire-door-closed");
    expect(sceneForFireAction("CloseDoor").id).toBe("fire-door-reclosed");
  });

  it("forbids text, people, extra exits and invented advice in every scene", () => {
    for (const scene of [FIRE_INITIAL_SCENE, FIRE_UNSAFE_SCENE, FIRE_SAFE_SCENE, FIRE_RECOVERY_SCENE]) {
      expect(scene.forbiddenVisualFacts).toEqual(expect.arrayContaining([
        "people",
        "captions or readable text",
        "additional doors or exits",
        "model-generated safety advice",
      ]));
    }
  });
});
```

- [ ] **Step 2: Verify RED**

```powershell
npx vitest run tests/fire-training-lingbot-scenes.test.ts
```

Expected: FAIL because the scene module does not exist.

- [ ] **Step 3: Implement the exact contracts**

Use `/references/bedroom-fire-v2.png` for the initial image. Use seed `42069` for initial generation and seed `77117` for both checkpoint branches.

The shared invariant must be exactly:

```text
First-person view from inside the same compact apartment bedroom at night. Preserve the exact door position, bed, window, wall colors, lighting, camera height and room geometry from the reference image. The learner remains inside the bedroom. Photorealistic stable geometry, continuous shot. No people, captions or readable text, signs, additional doors or exits, additional rooms, camera cuts, invented actions, or model-generated safety advice.
```

Unsafe delta:

```text
The previously closed warm bedroom door is now visibly open inward. Dense dark smoke and intense orange hallway light enter through the opening. Visibility worsens quickly. The learner remains inside the bedroom and does not cross the doorway. Hold this consequence consistently.
```

Safer delta:

```text
The bedroom door visibly remains fully closed in the same position. Smoke stays concentrated beneath the door gap instead of filling the room. The learner remains inside near the window while communicating and signaling for help. Hold this consequence consistently.
```

Recovery delta:

```text
From the same smoke-exposed bedroom, the previously opened bedroom door is now visibly closed again. Smoke already admitted remains in the room but no additional hallway smoke enters. The learner remains low inside the bedroom. Preserve the same geometry and camera position and hold the recovered barrier consistently.
```

`FIRE_RECOVERY_SCENE` uses fixed seed `77118` because it begins from the generated unsafe consequence rather than the original decision checkpoint. The controller captures a recovery checkpoint immediately before `CloseDoor`; repeated recovery renders reuse that checkpoint and seed.

- [ ] **Step 4: Run tests**

```powershell
npx vitest run tests/fire-training-lingbot-scenes.test.ts tests/fire-training-reducer.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add lib/fire-training/lingbot-scenes.ts lib/fire-training/content.ts tests/fire-training-lingbot-scenes.test.ts
git commit -m "feat: lock LingBot apartment fire scenes"
```

---

### Task 6: Build the LingBot-Only Viewport

**Files:**
- Create: `components/LingBotViewport.tsx`
- Create: `lib/lingbot/use-navigation-controls.ts`
- Test: `tests/lingbot-navigation-controls.test.ts`

**Interfaces:**
- Consumes: `MediaStream`, `TrainerRuntimeState`, `captureVideoFrame`, `LingBotNavigationInput`.
- Produces: `onCaptureReady(capture: () => string)`, `onNavigation(input)`, `onVideoReady()`.

- [ ] **Step 1: Write failing navigation-lifecycle tests**

Create `tests/lingbot-navigation-controls.test.ts` covering:

```ts
it("maps WASD key state to longitudinal and lateral controls");
it("returns every axis to idle on key-up");
it("returns every axis to idle on window blur");
it("returns every axis to idle when controls become disabled");
it("returns every axis to idle on disposal");
```

- [ ] **Step 2: Verify RED**

```powershell
npx vitest run tests/lingbot-navigation-controls.test.ts
```

Expected: FAIL because the navigation controller does not exist.

- [ ] **Step 3: Implement the navigation controller**

Create `lib/lingbot/use-navigation-controls.ts`. Reuse `navigationFromKeys` and `idleNavigation` from `lib/player/navigation.ts`. The hook must accept `enabled` and `sendNavigation`; its cleanup must call `sendNavigation(idleNavigation)` exactly once.

- [ ] **Step 4: Implement `LingBotViewport`**

The component props must be:

```ts
type LingBotViewportProps = {
  stream: MediaStream | null;
  phase: TrainerRuntimeState;
  transitionFrame: string | null;
  transitionLabel: string | null;
  navigationEnabled: boolean;
  onNavigation: (input: LingBotNavigationInput) => void;
  onCaptureReady: (capture: (() => string) | null) => void;
  onVideoReady: () => void;
};
```

Render rules:

- Attach `stream` to `video.srcObject`.
- Call `onVideoReady` only after `loadeddata`, non-zero dimensions and `readyState >= 2`.
- Show `transitionFrame` only during checkpointing, branch rendering, rewinding or alternative rendering.
- Otherwise show the live `<video>`.
- When neither exists, show a neutral black loading surface with no disaster illustration.
- Do not accept a fallback asset prop.
- Do not render `<img>` or fallback `<video>` elements.

- [ ] **Step 5: Run tests and typecheck**

```powershell
npx vitest run tests/lingbot-navigation-controls.test.ts tests/navigation.test.ts
npm run typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit**

```powershell
git add components/LingBotViewport.tsx lib/lingbot/use-navigation-controls.ts tests/lingbot-navigation-controls.test.ts
git commit -m "feat: add LingBot-only training viewport"
```

---

### Task 7: Implement the Single-Scenario LingBot Controller

**Files:**
- Create: `lib/fire-training/use-lingbot-fire-controller.ts`
- Create: `components/LingBotFireTrainer.tsx`
- Create: `components/LingBotDiagnostics.tsx`
- Modify: `app/page.tsx`
- Test: `tests/lingbot-fire-controller.test.ts`

**Interfaces:**
- Consumes: `LingBotSession`, `CheckpointDirector`, fire runtime reducer, scene contracts and viewport capture callback.
- Produces: the complete learner flow on `/`.

- [ ] **Step 1: Write failing controller tests around a fake session**

Cover:

```ts
it("keeps the interface behind the boot gate until first frame and chunk receipt");
it("requires three cue actions before preparing the door checkpoint");
it("does not expose door choices until checkpoint upload completes");
it("keeps OpenDoor pending until the unsafe render receipt arrives");
it("renders CloseDoor from an unsafe recovery checkpoint before committing it");
it("restores the same checkpoint for the alternative");
it("keeps a failed branch retryable without committing safety state");
it("ignores a receipt from a previous job");
it("reaches debrief only after both live futures render");
```

- [ ] **Step 2: Verify RED**

```powershell
npx vitest run tests/lingbot-fire-controller.test.ts
```

Expected: FAIL because the controller module does not exist.

- [ ] **Step 3: Implement the controller hook**

The hook returns:

```ts
type LingBotFireController = {
  runtime: FireRuntime;
  stream: MediaStream | null;
  transitionFrame: string | null;
  transitionLabel: string | null;
  startupError: string | null;
  branchLatencyMs: number | null;
  start(): Promise<void>;
  submit(action: FireAction): Promise<void>;
  retryBranch(): Promise<void>;
  startAlternative(): Promise<void>;
  setCapture(capture: (() => string) | null): void;
  setNavigation(input: LingBotNavigationInput): void;
  dispose(): Promise<void>;
};
```

Rules:

- `start()` creates the initial render job and dispatches `LIVE_READY` only after its receipt.
- `submit()` dispatches cue/resource actions locally until the decision stage.
- At the decision stage it prepares the checkpoint before enabling choices.
- `OpenDoor` and `KeepDoorClosed` dispatch `BRANCH_REQUESTED`, render from the decision checkpoint, then dispatch `BRANCH_RENDERED`.
- `CloseDoor` captures the current unsafe stream as a recovery checkpoint, renders `FIRE_RECOVERY_SCENE`, and commits only after its matching receipt.
- `CrouchLow` sends a bounded camera/prompt delta and waits for the next chunk before committing; `UsePhone` and `SignalWindow` remain controlled resource actions without claiming a visible object mutation.
- A rejected render dispatches `BRANCH_FAILED`; it never dispatches `SUBMIT_ACTION` directly.
- `startAlternative()` uses the original checkpoint and the opposite scene contract.
- `dispose()` cancels the director, stops navigation and disconnects the session.

- [ ] **Step 4: Implement the trainer UI**

`components/LingBotFireTrainer.tsx` must render:

- boot gate with `Connecting to LingBot World 2`, current startup stage and retry;
- `LingBotViewport` after live readiness;
- immediate priority and concise prompt;
- cue/action cards from `availableFireActions(runtime.training)`;
- decision cards only in `decision_ready`;
- captured-frame transition with branch label;
- retry panel after `BRANCH_FAILED`;
- consequence controls and counterfactual rewind;
- existing source-grounded debrief content;
- technical diagnostics only when `new URLSearchParams(window.location.search).get("debug") === "1"`.

No learner-facing copy may contain `fallback`, raw prompt text, a file path, seed or SDK command name.

- [ ] **Step 5: Switch the main route**

Replace `app/page.tsx` with:

```tsx
"use client";

import { LingBotFireTrainer } from "@/components/LingBotFireTrainer";

export default function CounterfactualDisasterTrainerPage() {
  return <LingBotFireTrainer />;
}
```

- [ ] **Step 6: Run focused tests and build**

```powershell
npx vitest run tests/lingbot-fire-controller.test.ts tests/fire-training-runtime.test.ts tests/fire-training-reducer.test.ts
npm run typecheck
npm run build
```

Expected: PASS.

- [ ] **Step 7: Commit**

```powershell
git add lib/fire-training/use-lingbot-fire-controller.ts components/LingBotFireTrainer.tsx components/LingBotDiagnostics.tsx app/page.tsx tests/lingbot-fire-controller.test.ts
git commit -m "feat: launch LingBot apartment fire trainer"
```

---

### Task 8: Add Deterministic Browser Test Mode and Full E2E Coverage

**Files:**
- Create: `lib/lingbot/mock-session.ts`
- Create: `lib/lingbot/session-factory.ts`
- Create: `tests/lingbot-mock-session.test.ts`
- Create: `tests/e2e/lingbot-fire.spec.ts`
- Modify: `components/LingBotFireTrainer.tsx`
- Modify: `playwright.config.ts`
- Delete: `tests/e2e/happy-oyster-fire.spec.ts`

**Interfaces:**
- Produces: `createLingBotSession({ allowMock, search })`.
- The mock is available only when `NODE_ENV !== "production"` and `?mockWorld=1` is present.

- [ ] **Step 1: Write failing mock-factory tests**

Cover:

```ts
it("returns the real session by default");
it("returns the mock only outside production with mockWorld=1");
it("refuses mockWorld=1 in production");
it("emits a new synthetic stream receipt for each branch job");
it("records identical file reference and seed for both mock branches");
```

- [ ] **Step 2: Verify RED**

```powershell
npx vitest run tests/lingbot-mock-session.test.ts
```

Expected: FAIL because the mock and factory do not exist.

- [ ] **Step 3: Implement the development-only mock**

The mock must implement `LingBotSessionPort`, use a canvas `captureStream(16)` source in the browser, change the canvas color and branch label internally for test observability, and return receipts asynchronously. The learner UI must never render the internal branch label.

Factory guard:

```ts
export function shouldUseMock(search: string, nodeEnv: string | undefined): boolean {
  return nodeEnv !== "production" && new URLSearchParams(search).get("mockWorld") === "1";
}
```

- [ ] **Step 4: Write the complete Playwright flow**

`tests/e2e/lingbot-fire.spec.ts` must use `/?mockWorld=1` and verify:

```ts
test("completes the live-render contract through unsafe and alternative futures");
test("does not reveal choices before checkpoint readiness");
test("does not commit exposure before branch receipt");
test("keeps a failed branch retryable");
test("sends navigation idle on blur and overlays");
test("never renders prepared media, raw prompts or fallback labels");
test("keeps controls usable in a 390 by 844 viewport");
test("shows diagnostics only with debug=1");
```

Add stable `data-testid` attributes only where role/text selectors cannot identify runtime state.

- [ ] **Step 5: Run browser tests**

```powershell
npx playwright test tests/e2e/lingbot-fire.spec.ts
```

Expected: all tests pass using one worker.

- [ ] **Step 6: Run production build and verify mock exclusion**

```powershell
npm run build
```

Expected: build exits 0. A Playwright request to `/?mockWorld=1` against `next start` must still use the real-session boot gate, not mock visuals.

- [ ] **Step 7: Commit**

```powershell
git add lib/lingbot/mock-session.ts lib/lingbot/session-factory.ts components/LingBotFireTrainer.tsx playwright.config.ts tests/lingbot-mock-session.test.ts tests/e2e/lingbot-fire.spec.ts
git rm tests/e2e/happy-oyster-fire.spec.ts
git commit -m "test: verify LingBot checkpoint training flow"
```

---

### Task 9: Remove the Happy Oyster Showcase and Prepared Branch Runtime

**Files:**
- Delete: `components/HappyOysterFireTrainer.tsx`
- Delete: `components/HappyOysterWorldLab.tsx`
- Delete: `app/world-lab/page.tsx`
- Delete: `app/api/happy-oyster-session/route.ts`
- Delete: `lib/happy-oyster/controls.ts`
- Delete: `lib/happy-oyster/fire-client.ts`
- Delete: `lib/fire-training/visual-continuation.ts`
- Delete: `tests/happy-oyster-controls.test.ts`
- Delete: `tests/happy-oyster-fire-client.test.ts`
- Delete: `tests/happy-oyster-session-route.test.ts`
- Delete: `tests/fire-visual-continuation.test.ts`
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `README.md`
- Test: `tests/no-prepared-runtime.test.ts`

**Interfaces:**
- Removes the Happy Oyster SDK and every main-runtime prepared-continuation mapping.
- Keeps the generic legacy scenario library temporarily unlinked from `/` so future content work is not mixed into this migration.

- [ ] **Step 1: Write the failing no-prepared-runtime test**

Create `tests/no-prepared-runtime.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

describe("primary runtime renderer", () => {
  it("contains no Happy Oyster or prepared media dependency", () => {
    const root = process.cwd();
    const page = fs.readFileSync(path.join(root, "app/page.tsx"), "utf8");
    const trainer = fs.readFileSync(path.join(root, "components/LingBotFireTrainer.tsx"), "utf8");
    const packageJson = fs.readFileSync(path.join(root, "package.json"), "utf8");
    expect(page + trainer + packageJson).not.toMatch(/HappyOyster|happy-oyster|fallbacks\//);
  });
});
```

- [ ] **Step 2: Run the test and verify RED**

```powershell
npx vitest run tests/no-prepared-runtime.test.ts
```

Expected: FAIL because `package.json` still contains Happy Oyster.

- [ ] **Step 3: Remove the legacy runtime files and dependency**

Use `git rm` on the exact files listed above, then run:

```powershell
npm uninstall @reactor-models/happy-oyster
```

Do not remove generic scenario packs, generic simulation-engine tests or reference images in this task.

- [ ] **Step 4: Update README**

Document:

- one live apartment-fire showcase;
- LingBot-only visible rendering;
- required `REACTOR_API_KEY`;
- startup and branch retry behavior;
- `?debug=1` diagnostics;
- `?mockWorld=1` development browser tests;
- exact local commands.

- [ ] **Step 5: Run focused and full tests**

```powershell
npx vitest run tests/no-prepared-runtime.test.ts
npm test
npm run typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit**

```powershell
git add package.json package-lock.json README.md tests/no-prepared-runtime.test.ts
git commit -m "refactor: remove Happy Oyster showcase runtime"
```

---

### Task 10: Add Live Validation Instrumentation

**Files:**
- Create: `lib/lingbot/metrics.ts`
- Create: `tests/lingbot-metrics.test.ts`
- Create: `tests/e2e/lingbot-fire-live.spec.ts`
- Create: `docs/validation/lingbot-fire-live-matrix.md`
- Modify: `components/LingBotDiagnostics.tsx`

**Interfaces:**
- Produces: `LingBotTimingMetrics`, `recordStage()`, `durationBetween()`.
- The live E2E file runs only when `RUN_LIVE_LINGBOT=1`.

- [ ] **Step 1: Write failing metric tests**

```ts
import { describe, expect, it } from "vitest";
import { createTimingMetrics, durationBetween, recordStage } from "../lib/lingbot/metrics";

describe("LingBot timing metrics", () => {
  it("measures branch request to first frame", () => {
    let metrics = createTimingMetrics();
    metrics = recordStage(metrics, "branch_requested", 1000);
    metrics = recordStage(metrics, "first_frame", 7250);
    expect(durationBetween(metrics, "branch_requested", "first_frame")).toBe(6250);
  });
});
```

- [ ] **Step 2: Verify RED**

```powershell
npx vitest run tests/lingbot-metrics.test.ts
```

Expected: FAIL because the metrics module does not exist.

- [ ] **Step 3: Implement metrics and diagnostics**

Store timestamps for token request, connected, image accepted, prompt accepted, generation started, first frame, checkpoint uploaded, branch requested and first branch chunk. The diagnostics drawer displays durations but never changes runtime behavior.

- [ ] **Step 4: Add the opt-in live Playwright test**

At the top of `tests/e2e/lingbot-fire-live.spec.ts`:

```ts
import { expect, test } from "@playwright/test";

test.skip(process.env.RUN_LIVE_LINGBOT !== "1", "Set RUN_LIVE_LINGBOT=1 for paid live validation");
```

The test must start `/`, wait for the live model indicator, complete the three cues, capture the branch latency shown by `?debug=1`, render one selected consequence and render the alternative. It asserts no prepared-media element exists. It does not claim semantic visual correctness.

- [ ] **Step 5: Add the manual semantic matrix**

Create `docs/validation/lingbot-fire-live-matrix.md` with ten rows per branch and these columns:

```text
Run | API success | initial continuity | door state | smoke state | invented content | branch latency ms | reviewer | notes
```

Include the acceptance targets from the specification and instructions to mark a run semantically valid only after human review.

- [ ] **Step 6: Run tests**

```powershell
npx vitest run tests/lingbot-metrics.test.ts
npx playwright test tests/e2e/lingbot-fire-live.spec.ts
```

Expected: unit test passes; live browser test is skipped unless explicitly enabled.

- [ ] **Step 7: Commit**

```powershell
git add lib/lingbot/metrics.ts components/LingBotDiagnostics.tsx tests/lingbot-metrics.test.ts tests/e2e/lingbot-fire-live.spec.ts docs/validation/lingbot-fire-live-matrix.md
git commit -m "test: instrument live LingBot validation"
```

---

### Task 11: Final Reliability Gate

**Files:**
- Modify only files required by failures discovered in this task.

**Interfaces:**
- Verifies the entire specification and leaves a clean worktree.

- [ ] **Step 1: Run the complete automated verification sequentially**

Do not run `next build` and `tsc` concurrently because both access `.next/types`.

```powershell
npm test
npm run lint
npm run build
npm run typecheck
npx playwright test
```

Expected:

- all Vitest files pass;
- no ESLint warnings or errors;
- production build exits 0;
- TypeScript exits 0 after the build has completed;
- all non-live Playwright tests pass;
- the paid live test is skipped.

- [ ] **Step 2: Verify runtime exclusions**

```powershell
rg -n "HappyOyster|happy-oyster|prepared continuation|fallbacks/" app/page.tsx components/LingBotFireTrainer.tsx components/LingBotViewport.tsx lib/lingbot package.json
```

Expected: no matches.

- [ ] **Step 3: Verify the branch contract in code**

```powershell
rg -n "reset|generation_reset|image_accepted|prompt_accepted|generation_started|chunk_complete|pendingAction|jobId" lib/lingbot lib/fire-training components/LingBotFireTrainer.tsx
```

Expected: each lifecycle signal and render-gating field is present in its designated module.

- [ ] **Step 4: Inspect repository state**

```powershell
git status --short
git log --oneline -12
```

Expected: no uncommitted changes and one focused commit per completed task.

- [ ] **Step 5: Run one manual live smoke test**

```powershell
$env:RUN_LIVE_LINGBOT="1"
npx playwright test tests/e2e/lingbot-fire-live.spec.ts
Remove-Item Env:RUN_LIVE_LINGBOT
```

Expected: startup, selected branch and alternative each publish a real LingBot stream. If Reactor capacity or transport prevents the run, record the API failure in the validation matrix and do not claim live acceptance.

- [ ] **Step 6: Keep verification fixes attached to their owning task**

If verification exposes a defect, return to the task that introduced it, add a failing regression test, apply the minimal fix, rerun the complete verification sequence, and commit the exact files from that task. Do not create a catch-all commit and do not stage unrelated files.

## Execution Notes

- The existing `lib/reactor/client.ts`, `SimulationPlayer.tsx`, `WorldViewport.tsx` and generic scenario engine remain available as migration references until Task 9. New code must not import their fallback behavior.
- Do not use `setPrompt` alone for the pivotal door branches; the reference image and seed change contract requires full reset and restart.
- Do not advance `FireTrainingState` from SDK callbacks directly. SDK callbacks resolve a render receipt; the runtime reducer decides whether the receipt matches the current pending action.
- Do not add a semantic vision model to inspect LingBot frames. Human review owns the live visual matrix.
- If the SDK's uploaded file reference is not reusable after `reset`, the director performs one explicit re-upload from the stored JPEG and records the extra latency.
- If the single-session median branch latency exceeds 12 seconds after Task 10, create a separate approved design for optional dual-session prewarming; it is not part of this plan.
