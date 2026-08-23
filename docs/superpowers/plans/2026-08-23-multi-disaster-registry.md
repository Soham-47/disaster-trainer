# Multi-Disaster Scenario Registry Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Route learner disaster descriptions to one of five reviewed scenario packs so LingBot renders the selected disaster while deterministic choices, consequences, debriefs, scoring, and fallbacks remain pack-owned.

**Architecture:** A pure keyword classifier maps a normalized learner description to a registered disaster family or an unsupported result. Each registered pack is a complete `ScenarioPack` with its own visual assets and controlled safety contract; `composeScenario` continues to validate and generate deterministic scenarios. The page selects the first pack before starting the existing player flow, and unsupported descriptions remain on the entry screen with an actionable message.

**Tech Stack:** Next.js 14, React 18, TypeScript, Vitest, existing LingBot World 2 adapter, existing scenario engine.

**Spec:** Approved in chat on 2026-08-23: support at least five reviewed disaster families; do not let arbitrary learner text override safety rules; unsupported families must not silently become fire.

## Global Constraints

- Supported initial families: structure fire, earthquake, flash flood, wildfire, and cyclone.
- Each pack owns its reference image, base prompt, controlled choices, consequences, debrief, transfer scenario id, and fallback assets.
- The world model renders visuals only; deterministic authored pack data owns safety and scoring.
- Unsupported descriptions do not start a mismatched scenario and are not scored.
- No new runtime dependency.
- Preserve the existing constrained two-choice player flow.

### Task 1: Scenario family routing contract

**Files:**
- Create: `lib/scenario/registry.ts`
- Test: `tests/scenario-registry.test.ts`

**Interfaces:**
- `detectDisasterType(description: string): DisasterType | null`
- `getScenarioPack(disasterType: DisasterType): ScenarioPack | undefined`
- `composeScenarioFromDescription(description: string): GeneratedScenario | null`

- [x] Write tests proving earthquake, flood, wildfire, cyclone, and fire descriptions route to the expected family, unknown text returns `null`, and every registered pack composes as approved.
- [x] Run `npm test -- tests/scenario-registry.test.ts`; confirm it fails because the registry exports are missing.
- [x] Implement normalized keyword matching and a five-pack registry without changing `composeScenario`.
- [x] Run the focused registry tests and the existing scenario engine tests; confirm they pass.
- [x] Commit `feat: add reviewed multi-disaster scenario registry`.

### Task 2: Five authored scenario packs

**Files:**
- Create: `scenarios/earthquake-v1.ts`
- Create: `scenarios/flash-flood-v1.ts`
- Create: `scenarios/wildfire-v1.ts`
- Create: `scenarios/cyclone-v1.ts`
- Modify: `scenarios/structure-fire-v1.ts` to export the pack through the registry
- Test: `tests/scenario-packs.test.ts`

**Interfaces:**
- Each file exports one `ScenarioPack` with exactly one decision template, two controlled choices, two consequence states, sourced debrief, and validated fallback paths.

- [x] Write tests asserting all five packs are approved, have two choices, cover both selected consequence ids, include a source URL, and contain distinct prompts/assets.
- [x] Run the focused pack tests and confirm they fail for missing packs.
- [x] Add the four new packs with conservative, reviewed cues and explicit “visuals only/no advice” prompt constraints.
- [x] Run pack validation and full scenario-engine tests; confirm all pass.
- [x] Commit `feat: add five disaster scenario packs`.

### Task 3: Player entry routing

**Files:**
- Modify: `components/ExperiencePlayer.tsx`
- Modify: `components/EntryScreen.tsx`
- Modify: `app/page.tsx`
- Test: `tests/player-routing.test.ts`

**Interfaces:**
- `ExperiencePlayer` receives a `scenarioResolver` or uses the registry helper to select a `GeneratedScenario` before `adapter.start`.

- [x] Write tests for selecting an earthquake scenario from the entry brief and returning a user-visible unsupported result for an unknown disaster.
- [x] Run the focused routing tests and confirm they fail before the player accepts a resolver.
- [x] Change the entry copy to describe “choose a disaster situation” and explain that only reviewed families can start; remove the misleading “visual situation” wording.
- [x] Resolve the initial and transfer scenarios from the selected pack instead of always importing fire scenarios.
- [x] Keep the existing controlled decisions, rewind, debrief, transfer, and scoring flow unchanged.
- [x] Run player/state/prompt/scenario tests and confirm they pass.
- [x] Commit `feat: route player flow to selected disaster pack`.

### Task 4: Verification and documentation

**Files:**
- Modify: `README.md`
- Test: existing full suite

- [x] Document the five supported families, unsupported-input behavior, and pack-review boundary.
- [x] Run `npm test -- --run`, `npm run typecheck`, `npm run build`, and `npm run lint`.
- [x] Start the app and smoke-test fire and earthquake briefs in the browser; confirm the selected pack name/prompt changes and no unsupported brief starts fire.
- [x] Commit `docs: document multi-disaster scenario routing`.
