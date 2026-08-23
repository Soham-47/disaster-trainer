# Live Connection-Gated Startup Design

## Problem

The experience can currently leave the entry screen as soon as the SDK accepts the
`start` command. LingBot may still be negotiating or may have failed before publishing
the `main_video` track. That makes a prepared continuation look like a successful live
world and hides the real connection failure.

## Goals

- Keep learners on the entry/connection screen until a live LingBot `main_video` track
  has been received.
- Make the adapter's `start()` contract mean “live startup is ready”, not merely
  “command was queued”.
- Surface the exact startup error and keep a retry path available.
- Preserve fail-closed prepared fallbacks for failures after a live session is already
  established (branch prompts, pause/resume, or later stream failures).
- Keep safety rules and scoring controlled by the scenario engine; model output remains
  visual context only.

## Non-goals

- No automatic retry loop, token refresh policy, or new disaster logic.
- No open-ended learner actions.
- No claim that a successful WebRTC connection validates safety content.

## State and data flow

```text
EntryScreen (brief + Start)
        |
        | start()
        v
token -> SDK connect -> image/prompt setup -> model.start()
        |
        | wait for onMainVideo(track, stream)
        v
live-ready -> dispatch START_SCENARIO -> orient/consequence UI

any startup failure/timeout
        |
        v
EntryScreen + exact error + Retry (no fallback continuation)

post-live branch failure
        |
        v
controlled prepared fallback (existing fail-closed behavior)
```

The first live frame callback records the stream and resolves startup. The experience
player dispatches `START_SCENARIO` only after `adapter.start()` resolves, so the
`WorldViewport` is not mounted as a learner-facing scenario before live readiness.

## Contract changes

### `ReactorClient.start`

- Wait for the first `main_video` callback after `model.start()`.
- Apply bounded deadlines to SDK connect, image setup, prompt setup, and first frame.
- Treat token, connection, setup, command, and first-frame failures as startup errors:
  set adapter status to `error`, retain the diagnostic reason, clean up the model, and
  reject the promise.
- Do not call `useFallback()` during initial startup.
- Continue using `useFallback()` for failures after startup has become live.

### `ExperiencePlayer`

- Keep the current state at `entry` while startup is pending.
- Dispatch `START_SCENARIO` only after `startAdapter()` resolves.
- Keep startup errors local to the entry screen so a retry does not require entering
  the scenario and then rewinding it.

### `EntryScreen`

- Render an accessible alert with the exact connection error and a short retry hint.
- Keep the brief and Start/Retry controls available; disable them only while pending.

## Error semantics

The user-facing message must identify the failed stage (for example, token exchange,
SDK connection, or first model frame). The internal fallback reason remains available
for diagnostics. A startup error must not set an active fallback asset or report live
scenario progress.

## Verification

- Unit test that startup rejects on token failure without activating fallback.
- Unit test that `start()` does not resolve until the fake SDK publishes `main_video`.
- Unit test existing post-live fail-closed fallback behavior.
- Run typecheck, lint, production build, and the complete Vitest suite with the local
  dev server stopped to avoid competing Next processes.
- Browser acceptance requires the Chrome control connection: start a short scenario,
  verify the entry screen remains visible while connecting, and verify the live
  first-person video appears before the orient state. If the browser bridge is
  unavailable, report that limitation instead of treating a fallback run as proof of
  live streaming.
