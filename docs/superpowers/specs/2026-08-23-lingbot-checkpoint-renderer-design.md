# LingBot Checkpoint Renderer Design

**Date:** 2026-08-23  
**Status:** Approved design  
**Primary renderer:** Reactor LingBot World 2  
**Showcase scenario:** One apartment fire

## 1. Purpose

Rebuild the showcase so every learner-visible disaster scene is rendered by LingBot World 2. The learner must navigate a live generated apartment, inspect controlled warning cues, make a constrained safety decision, see a newly generated consequence, rewind to the same captured decision frame, and see the alternative generated from that frame.

The current Happy Oyster implementation attaches a previously built Adventure world and sends generic interaction verbs. It cannot direct a reliable visual consequence or verify object state. The current prepared MP4 continuations hide that limitation but do not demonstrate runtime world-model branching. The replacement must remove prepared disaster media from the judge-facing flow.

## 2. Product Goals

- Render the complete apartment-fire experience through LingBot World 2.
- Keep first-person movement and camera look active during orientation and exploration.
- Inspect three controlled cues before the pivotal door decision.
- Capture a real frame from the live stream at the decision checkpoint.
- Generate both futures from the same captured frame, prompt invariants and seed.
- Keep safety rules, actions, hazards and scoring deterministic in application code.
- Hide the learner interface until a real LingBot video frame has arrived.
- Fail visibly and retryably when LingBot cannot render; never substitute a prerecorded consequence.
- Complete the judge-facing orientation-to-debrief loop in approximately two minutes when the API is healthy.

## 3. Non-Goals

- Multiple disaster families in the primary showcase.
- Arbitrary learner-authored scenarios.
- Open-ended natural-language safety actions.
- Pixel-identical branch output.
- Structured collision detection, object identifiers or spatial truth from LingBot.
- Automatic semantic verification of generated pixels through another AI service.
- Certificates, leaderboards, achievements, multiplayer or institutional dashboards.
- Claims that the simulation is certified training.

## 4. Authoritative Boundaries

LingBot World 2 is the visible renderer. It provides a reference-image-conditioned video stream, prompt changes, a fixed seed read at generation start, navigation controls, pause/reset/start lifecycle commands and chunk-level events. Reference-image and seed changes require `reset` followed by a new `start`. Setter commands apply at chunk boundaries and SDK events are the source of truth.

The application remains authoritative for:

- available learner actions;
- cue discovery;
- safety classification;
- hazard exposure;
- recovery rules;
- assessment and score eligibility;
- checkpoint identity;
- which prompt contract belongs to a branch.

No model output may directly mutate the deterministic training state.

References:

- [LingBot World 2 API](https://www.reactor.inc/models/lingbot-world-2/api)
- [American Red Cross Home Fire Safety](https://www.redcross.org/content/dam/redcross/atg/PDF_s/Preparedness___Disaster_Recovery/Disaster_Preparedness/Home_Fire/FireFAQs.pdf)

## 5. Runtime Architecture

The runtime has five bounded units.

### 5.1 `LingBotSession`

Owns the Reactor token, SDK connection, uploaded image references, SDK subscriptions, video track, command acknowledgements, timeouts and cleanup. It exposes event-driven methods and never owns training state.

### 5.2 `CheckpointDirector`

Owns render jobs. It stops navigation, waits for chunk boundaries, pauses generation, accepts a captured video frame, uploads and caches that frame, resets generation, reapplies the scene contract and waits for a confirmed replacement stream. It rejects stale SDK events by render-job identifier.

### 5.3 `FireTrainingEngine`

Owns the reviewed apartment-fire stages, cues, constrained actions, hazards, exposure, recovery path, counterfactual sequence and score. It records a learner action as pending while a visual branch renders and commits the corresponding transition only after a render receipt is returned.

### 5.4 `LingBotFireTrainer`

Coordinates the session, director and training engine. It owns learner-facing runtime state but contains no raw SDK command sequencing.

### 5.5 `LingBotViewport`

Attaches the current LingBot `MediaStream`, renders the last captured frame during transitions, captures frames through a canvas, maps keyboard and pointer input to navigation state, and sends idle controls on every interruption boundary.

## 6. Core Contracts

```ts
type LingBotSceneContract = {
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

type LingBotCheckpoint = {
  id: string;
  frameDataUrl: string;
  uploadedFileRef: unknown;
  seed: number;
  worldState: FireTrainingState;
  createdAt: number;
};

type LingBotRenderJob = {
  jobId: number;
  kind: "initial" | "branch" | "alternative";
  checkpoint: LingBotCheckpoint | null;
  scene: LingBotSceneContract;
};

type LingBotRenderReceipt = {
  jobId: number;
  firstChunkIndex: number;
  startedAt: number;
  firstFrameAt: number;
};
```

`uploadedFileRef` will be replaced by the exact public file-reference type exported by the installed LingBot SDK during implementation. It is intentionally opaque to the training engine.

## 7. Generation Lifecycle

### 7.1 Initial world

1. Request a LingBot-scoped token from `/api/reactor-token`.
2. Connect one `LingbotWorld2Model` instance and wait for SDK status `ready`.
3. Upload the reviewed apartment reference image.
4. Register event waiters before sending each associated command.
5. Set the fixed seed, attention window, image and invariant orientation prompt.
6. Wait for `image_accepted`, `prompt_accepted` and `conditions_ready`.
7. Start generation.
8. Wait for `generation_started`, `main_video` and the first `chunk_complete`.
9. Reveal the learner interface only after the video element has non-zero dimensions and sufficient ready state.

### 7.2 Decision checkpoint

1. Send idle for longitudinal movement, lateral movement and both look axes.
2. Wait for the current `chunk_complete`.
3. Set the attention window to `small`.
4. Pause and wait for `generation_paused`.
5. Capture the visible video frame at 1280×720 as JPEG quality 0.82.
6. Reject an empty, zero-dimension or fully transparent capture.
7. Upload the checkpoint once and retain its file reference.
8. Store the serialized deterministic world state and fixed seed.
9. Display the two decision actions only after the checkpoint is complete.

### 7.3 Selected consequence

1. Record the action as pending without mutating hazard or scoring state.
2. Keep the captured frame visible and display `Rendering your consequence`.
3. Issue `reset` and wait for `generation_reset`.
4. Reapply the checkpoint seed, `small` attention window and neutral camera controls.
5. Reuse the uploaded checkpoint file reference. If Reactor rejects reuse, upload the stored JPEG again in the same job.
6. Set the invariant prompt plus the selected branch prompt.
7. Wait for image and prompt acceptance before calling `start`.
8. Wait for generation start, a live video track and the first completed chunk.
9. Crossfade from the captured frame to the new live stream.
10. Commit the pending action to the deterministic training reducer.

### 7.4 Counterfactual

The alternative repeats the selected-consequence lifecycle with the original checkpoint image reference and identical seed. Only the branch prompt changes. The previous branch stream is never used as the alternative reference.

## 8. Prompt Contracts

All prompts use an invariant-plus-delta structure. The invariant is repeated on every full generation start.

Invariant requirements:

- first-person view from inside the same compact apartment bedroom;
- exact door location, bed, window, wall colors, lighting and camera height preserved from the checkpoint;
- learner remains inside the bedroom;
- no people, captions, signs, safety advice, additional doors, additional rooms or camera cuts;
- photorealistic nighttime lighting and stable geometry;
- no invented learner action.

Unsafe delta requirements:

- previously closed warm door visibly open inward;
- dense smoke and orange hallway light entering through the opening;
- visibility reduced and exposure visibly worsened;
- learner does not pass through the doorway.

Safer delta requirements:

- door visibly remains fully closed;
- smoke remains concentrated beneath the gap rather than filling the room;
- learner signals or communicates from inside the room;
- geometry and camera position remain unchanged.

Small environmental changes may use `setPrompt` at a chunk boundary. Opening the door, keeping it closed for the contrasting future and counterfactual rewind always use the full checkpoint regeneration lifecycle.

## 9. Interaction Design

- WASD and pointer look are enabled during orientation and exploration.
- The learner must acknowledge the alarm, inspect smoke under the door and assess the warm door before the decision checkpoint.
- The UI does not claim that a screen coordinate corresponds to a model object.
- Critical cue stages stabilize the camera and stop free movement before presenting contextual actions.
- Navigation remains locked while a checkpoint or branch job is active.
- Unsafe actions permit the scripted recovery sequence after the unsafe consequence renders.
- Hints restate controlled priorities and never alter the prompt or safety state.

## 10. Learner Interface

The main route presents one apartment-fire scenario. It contains a full-screen live viewport, immediate priority, compact exposure and resource indicators, a central reticle, one contextual action area and a minimal live-model indicator.

Raw prompts, seeds, file references, event logs and transport errors are hidden. `?debug=1` exposes a developer diagnostics drawer with the render job, SDK state, event timestamps, branch latency and error details.

The learner-facing runtime states are:

```ts
type TrainerRuntimeState =
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
```

## 11. Failure Handling

- Startup failure remains behind the loading gate and offers `Retry live world`.
- Checkpoint failure restores the current live stream and offers another capture.
- Branch timeout retains the frozen checkpoint and automatically retries the same render contract once.
- A second branch failure retains the checkpoint and offers manual retry.
- No branch failure advances deterministic safety state.
- A transport failure sends idle navigation before reconnect or cleanup.
- Every async render has a monotonically increasing `jobId`; events from older jobs are ignored.
- Tab blur, overlay opening, pause, node change, route change and component unmount send idle controls.
- No prepared MP4, generated canvas disaster scene or fallback image appears in the judge-facing flow.
- A learner may complete the experience only after both live futures have produced confirmed chunks.

## 12. Latency Strategy

- Maintain one token and one SDK connection throughout the episode.
- Capture and upload the checkpoint before revealing choices.
- Reuse the uploaded checkpoint file reference across both branch resets when supported.
- Register event waiters before commands to prevent missed acknowledgements.
- Replace polling sleeps with event-driven promises.
- Compress checkpoint images before upload.
- Keep the captured frame visible during reset so no blank viewport appears.
- Measure token, connect, image acceptance, prompt acceptance, generation start and first-frame durations independently.
- Target median choice-to-first-frame latency at or below 12 seconds and the 95th percentile at or below 20 seconds.
- Add dual-session branch prewarming only after measurement proves the single-session design misses the target and the demo machine can decode two streams without frame loss.

## 13. Safety and Score Eligibility

The deterministic engine continues to own the fire-training truth. A render receipt confirms only that LingBot produced a branch stream; it does not prove semantic correctness.

A run is score-eligible only when:

- initial generation and both branches use live LingBot output;
- every render job reaches a confirmed first chunk;
- no SDK fallback media is used;
- no visual mismatch is reported;
- the full counterfactual and debrief sequence completes.

The debug-only visual mismatch control invalidates scoring without rewriting action history or safety outcomes.

## 14. Validation

Automated coverage will include:

- SDK event ordering and command preconditions;
- reset, image, prompt and start sequencing;
- first-frame gating;
- checkpoint reuse across both branches;
- identical seed and reference assertions;
- pending-action commit only after render receipt;
- render timeout and retry behavior;
- stale-job event rejection;
- navigation idle on every interruption boundary;
- browser flows using a deterministic fake LingBot stream;
- absence of fallback media and raw prompts in learner UI;
- production build and TypeScript checks.

The opt-in live validation matrix will run the locked image, prompt and seed repeatedly:

| Check | Acceptance target |
|---|---:|
| Initial apartment matches reviewed reference | 10/10 |
| Door position remains stable before decision | 9/10 |
| Unsafe future visibly differs from checkpoint | 9/10 |
| Unsafe future shows open door and increased smoke | 8/10 |
| Safer future keeps door closed | 8/10 |
| No invented people, text, exits or safety advice | 9/10 |
| Both branches use the same checkpoint and seed | 10/10 |
| Median branch latency | ≤12 seconds |
| 95th-percentile branch latency | ≤20 seconds |
| Successful API runs use no prepared media | 10/10 |

API availability failures are reported separately from semantic visual failures.

## 15. Repository Migration

- Replace `HappyOysterFireTrainer` on `app/page.tsx` with `LingBotFireTrainer`.
- Split the current monolithic `lib/reactor/client.ts` into a focused session transport and checkpoint director while preserving its tested event-waiting behavior.
- Refactor `WorldViewport` into a LingBot-only viewport without fallback media branches.
- Reuse the existing fire training reducer and reviewed Red Cross guidance.
- Remove multi-disaster selection and arbitrary scenario descriptions from the main showcase.
- Retain legacy Happy Oyster and multi-disaster code only until the LingBot flow passes acceptance testing, then remove it in a dedicated cleanup commit.
- Keep `/world-lab` as a development-only route until cleanup; it is not linked from the learner interface.

## 16. Definition of Done

- The main route shows no learner UI before a real LingBot frame arrives.
- Every visible apartment, consequence and alternative scene is rendered by LingBot World 2.
- The learner can navigate during orientation and exploration.
- Three cues precede the pivotal decision.
- Both futures regenerate from the same captured checkpoint and seed.
- The selected future produces a visibly new model stream before deterministic state advances.
- The alternative is shown before the source-grounded debrief.
- No prepared disaster media can appear in the main runtime.
- Failed rendering remains retryable without corrupting safety state.
- The automated suite, lint, typecheck, production build and browser tests pass.
- A live validation report records visual accuracy and branch latency against the stated targets.
