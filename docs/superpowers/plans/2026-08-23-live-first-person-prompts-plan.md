# Live First-Person Prompts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add arbitrary visual scenario briefs, make live LingBot video the primary first-person viewport, and reduce local rendering work without weakening controlled safety decisions.

**Architecture:** Normalize the learner brief in a small scenario prompt utility and append it to controlled prompts with an explicit visual-only boundary. Update the entry/player flow to carry that brief through orient, consequence, alternative, and transfer states. Normalize SDK frames into a MediaStream and make the viewport pause its canvas loop whenever video or the page lifecycle makes it unnecessary.

**Tech Stack:** Next.js 14, React 18, TypeScript, LingBot World 2 SDK, Vitest, browser smoke testing.

**Spec:** `docs/superpowers/specs/2026-08-23-live-first-person-prompts-design.md`

## Global Constraints

- Controlled scenario packs remain the only source of safety rules, choices, consequences, debriefs, and scores.
- Learner text is visual context only and is capped at 280 characters.
- Live failures fail closed to prepared fallback media and remain unscored.
- No new runtime dependency.
- Canvas work is skipped while a live or fallback video is visible.

---

### Task 1: Prompt context utility

**Files:**
- Create: `lib/scenario/prompt.ts`
- Test: `tests/prompt.test.ts`

- [ ] Write a failing test for whitespace/control-character normalization and the 280-character limit.
- [ ] Write a failing test proving the generated model prompt retains the controlled prompt and fences learner text as visual-only context.
- [ ] Run `npm test -- tests/prompt.test.ts` and confirm the new tests fail because the utility is missing.
- [ ] Implement `normalizeScenarioBrief` and `buildWorldModelPrompt` with literal limits and no parser that can alter safety rules.
- [ ] Run the focused tests, then the full Vitest suite.

### Task 2: Entry and player brief flow

**Files:**
- Modify: `components/EntryScreen.tsx`
- Modify: `components/ExperiencePlayer.tsx`

- [ ] Extend the entry callback to receive the trimmed brief and add an accessible textarea with a 280-character limit and visual-context explanation.
- [ ] Carry the brief through `startAdapter`, consequence prompts, alternative prompts, and transfer startup using `buildWorldModelPrompt`.
- [ ] Keep `DecisionOverlay`, transfer choices, scoring, and safety copy unchanged.
- [ ] Run typecheck and the existing state/scoring tests.

### Task 3: Live stream normalization and lifecycle cleanup

**Files:**
- Modify: `components/ExperiencePlayer.tsx`
- Modify: `lib/reactor/client.ts`
- Test: `tests/reactor-adapter.test.ts`

- [ ] Add a regression test for a main-video callback that provides a track and ensure the player-facing callback can receive a MediaStream.
- [ ] Normalize SDK frame payloads to a MediaStream, retaining native streams and wrapping a lone track in a new MediaStream when supported.
- [ ] Stop tracks from replaced streams and clear the stream on fallback/reset.
- [ ] Run the focused adapter tests and full tests.

### Task 4: First-person viewport and low-power renderer

**Files:**
- Modify: `components/WorldViewport.tsx`

- [ ] Add live-video readiness state and make the full-bleed video visible once media can play.
- [ ] Gate the canvas animation behind absence of live/fallback video, document visibility, and reduced-motion state.
- [ ] Keep the 1280x720 canvas cap, clean animation frames/listeners, and preserve the fallback overlay and rewind frame capture.
- [ ] Run lint, typecheck, production build, and browser smoke tests.

### Task 5: Verification and handoff

- [ ] Run `npm test`, `npm run typecheck`, `npm run lint`, and `npm run build` sequentially with no concurrent dev server.
- [ ] Start `npm run dev`, open the browser, verify the brief field, live/fallback status, first-person video path, constrained decision buttons, rewind, debrief, and transfer result.
- [ ] Confirm `git diff`, commit the implementation, and push the feature branch.
