# Player Flow and Scenario Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add the learner-first interactive story flow and the deterministic, source-grounded scenario engine on top of the existing Reactor adapter.

**Architecture:** The player is a typed reducer-driven state machine that renders controlled scenario data and calls a small `WorldModelAdapter` interface. The scenario engine composes only approved parameter combinations, owns safety truth and prompt constraints, and calculates transfer outcomes independently of generated media. The UI can run against a deterministic mock adapter and the real `reactorClient` through dependency injection.

**Tech Stack:** Next.js 14, React 18, TypeScript, Tailwind CSS, Vitest.

**Spec:** `plan2.txt` and the repository `README.md` ownership table.

## Global Constraints

- Keep Reactor SDK details inside `lib/reactor/*`; UI consumes the existing `WorldModelAdapter` contract.
- Keep safety labels, prompts, consequences, citations, and scoring in `lib/scenario/*` and `scenarios/*`.
- MVP choices are constrained; no scored free-text actions.
- Any fallback or contradiction is unscored.
- The experience must expose captions/text equivalents, keyboard focus, and reduced-motion behavior.
- Use the Red Cross fire guidance citation already specified in the project plan.

---

### Phase 1: Member B player flow

- [x] Add failing reducer tests for every legal transition, invalid-action no-ops, and double-submit prevention.
- [x] Implement the reducer and player session model.
- [x] Add adapter-backed `ExperiencePlayer` orchestration with a deterministic mock adapter.
- [x] Add entry, decision, rewind, debrief, transfer, and result components with accessible controls.
- [x] Replace the Member A harness page with the player flow while preserving adapter status and fallback behavior.
- [x] Run tests, typecheck, lint, and build; commit and publish `feat/player-flow`.

### Phase 2: Member C scenario engine

- [x] Add failing tests for parameter validation, prompt composition, pack invariants, scoring, and score eligibility.
- [x] Implement immutable structure-fire and hotel-transfer scenario packs.
- [x] Implement deterministic composition and validation helpers.
- [x] Implement transfer-success and improvement semantics.
- [x] Wire the player to consume the scenario engine without duplicating safety facts in UI code.
- [x] Run the full suite, typecheck, lint, and build; commit and publish `feat/scenario-engine`.
