# Counterfactual Disaster Trainer

Interactive Media hackathon project for practicing high-stakes disaster decisions through generated worlds and counterfactual replay.

## Concept

The learner enters a generated disaster situation, chooses from a small number of controlled actions, experiences the selected consequence, rewinds to the decision, experiences the alternative, and then applies the safety principle in a visually different transfer scenario.

**Open-ended situations. Constrained decisions. Controlled safety truth.**

Reactor/LingBot World 2 renders the environment and visual futures. A deterministic scenario engine owns the warning cues, available choices, safety classifications, consequences, scoring, citations, and fallback behavior.

## Hackathon

- Track: **Interactive Media**
- Event: **Inception Series: Hackathon 2.0**
- Status: Greenfield prototype
- Current MVP: five reviewed disaster scenario packs with generated environment variations
- Primary model platform: [Reactor](https://www.reactor.inc/)
- Model: [LingBot World 2](https://www.reactor.inc/models/lingbot-world-2/api)

## MVP experience

1. Describe one of the supported disaster families: structure fire, earthquake, flash flood, wildfire, or cyclone.
2. Orient inside the selected live generated environment.
3. Notice the pack's authored warning cue and choose between two constrained actions.
4. Experience the chosen future.
5. Rewind to the decision.
6. Experience the counterfactual future.
7. Read a sourced debrief.
8. Make a transfer decision in a different environment.

The MVP deliberately keeps choices constrained. Scenario breadth comes from reviewed combinations of disaster pack, environment, time, occupancy, infrastructure condition, and complication. Descriptions outside the five reviewed families are rejected at the entry screen instead of being silently mapped to fire.

## Safety boundary

The world model is a renderer, not the safety authority. Safety rules and scoring are deterministic and human-authored. If generated output contradicts the controlled scenario, times out, or becomes unavailable, the experience switches to an approved fallback continuation and marks the run unscored.

The initial packs are grounded in the following public guidance: [American Red Cross home-fire guidance](https://www.redcross.org/content/dam/redcross/atg/PDF_s/Preparedness___Disaster_Recovery/Disaster_Preparedness/Home_Fire/FireFAQs.pdf), [FEMA earthquake guidance](https://www.ready.gov/sites/default/files/2024-03/ready.gov_earthquake_hazard-info-sheet.pdf), [Ready.gov floods](https://www.ready.gov/floods), [FEMA wildfire guidance](https://www.ready.gov/sites/default/files/2024-08/ready-gov_wildfire_info-sheet.pdf), and [FEMA hurricane guidance](https://www.ready.gov/sites/default/files/2024-03/ready.gov_hurricane_hazard-info-sheet.pdf).

This is an experimental preparedness-practice prototype, not certified training or a physically exact disaster simulator.

## Team ownership

| Member | Person | Primary branch | Ownership |
|---|---|---|---|
| Member A | Krishna | `feat/reactor-adapter` | Reactor authentication, LingBot runtime, event handling, streaming, and fallbacks. |
| Member B | You | `feat/player-flow` | Experience player, state transitions, decision UI, rewind, debrief, transfer, and accessibility. |
| Member C | Soumodeep | `feat/scenario-engine` | Scenario packs, source-grounded safety rules, prompt constraints, scoring, and tests. |

## Team workflow

Use one shared repository with a protected `main` branch and short-lived feature branches:

- `feat/reactor-adapter` — Krishna: Reactor integration, streaming, events, and fallbacks.
- `feat/player-flow` — You: React experience states, choices, rewind, debrief, transfer, and accessibility.
- `feat/scenario-engine` — Soumodeep: Scenario packs, safety rules, prompt constraints, scoring, and tests.

Keep scenario types, the player state machine, and the public world-model adapter interface contract-first. Open a pull request for each focused change, run lint/typecheck/tests/build before merging, and synchronize from `main` at each 60–90 minute build checkpoint.

## Planned architecture

```text
Next.js / React / TypeScript
  ├── Experience player and state machine
  ├── Deterministic scenario and scoring engine
  ├── Reactor/LingBot World 2 adapter
  └── Approved fallback media
```

The Reactor adapter implementation is fully integrated and tested. It uses the official `@reactor-models/lingbot-world-2` SDK, server-side authentication, fail-closed fallback management, and event-driven video rendering.

## Testing & Quality Assurance

- `npm test`: Runs Vitest suite covering adapter status flow, token failures, fallback triggering, event delivery, and asset existence.
- `npm run typecheck`: TypeScript compilation check.
- `npm run lint`: ESLint check using Next.js core web vitals configuration.
- `npm run build`: Production build.


## License

License to be decided by the team before publishing code.
