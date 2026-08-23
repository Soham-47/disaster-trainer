# Live Connection-Gated Startup Implementation Plan

> **For the implementation agent:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Keep the learner on the entry screen until LingBot publishes a live `main_video` track, then enter the scenario; expose startup failures without silently switching to a prepared continuation.

**Architecture:** `ReactorClient.start()` owns bounded startup stages and a first-frame readiness promise. `ExperiencePlayer` starts the adapter while its state is still `entry`, dispatching `START_SCENARIO` only after the adapter resolves. `EntryScreen` renders the startup error and remains retryable. Existing controlled fallback behavior remains available for post-live branch failures.

**Tech stack:** Next.js/React, TypeScript, Vitest, LingBot World 2 SDK, WebRTC `MediaStream`/`MediaStreamTrack`.

### Task 1: Lock the startup contract with failing tests

**Files:** `tests/reactor-adapter.test.ts`

- Add a deterministic fake LingBot SDK in the test module.
- Assert a token/startup failure rejects, leaves no active fallback, and reports `error`.
- Assert `start()` remains pending after `model.start()` returns and resolves only after `onMainVideo` publishes a frame.
- Preserve the existing test that a post-live branch failure still activates the prepared fallback.
- Run the focused adapter tests and confirm the new readiness assertions fail against the old behavior.

### Task 2: Make Reactor startup live-frame gated

**Files:** `lib/reactor/client.ts`

- Add a startup failure channel and a first-frame deferred promise scoped to one `start()` call.
- Route SDK command/error events to startup rejection while startup is in progress; route them to the existing fallback path after live readiness.
- Wrap connect, image/prompt setup, and first-frame waits in the existing bounded timeout constants.
- Reject startup on token fallback, timeout, SDK error, or missing first frame; clean up the model and set status to `error` without activating fallback.
- Resolve startup only from `onMainVideo(track, stream)` and retain the existing frame callback behavior.
- Run the focused adapter tests until they pass.

### Task 3: Gate the learner-facing state transition

**Files:** `components/ExperiencePlayer.tsx`, `components/EntryScreen.tsx`

- Add local startup-error state to `ExperiencePlayer`.
- Keep `START_SCENARIO` after `await startAdapter(...)`; leave state at `entry` during pending/error.
- Clear the error on a new attempt/restart and preserve the learner's normalized brief for retry.
- Add an accessible exact-error alert to `EntryScreen` while leaving the Start/Retry action enabled outside pending.
- Run typecheck and the player/reducer tests.

### Task 4: Verify the full application

**Files:** no source changes expected

- Stop only the repository's local dev-server process before resource-heavy checks.
- Run `npm test`, `npm run typecheck`, `npm run lint`, and `npm run build`.
- Restart `npm run dev` and use the browser bridge if available to exercise the connection screen, retry path, live first-person stream, and post-live fallback. Record any bridge limitation explicitly.
- Inspect `git diff`, commit the implementation, and push the current feature branch.
