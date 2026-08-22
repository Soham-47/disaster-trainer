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
- Current MVP: one validated structure-fire scenario with generated environment variations
- Primary model platform: [Reactor](https://www.reactor.inc/)
- Model: [LingBot World 2](https://www.reactor.inc/models/lingbot-world-2/api)

## MVP experience

1. Orient inside a live generated bedroom, hotel room, or office.
2. Notice smoke and a warm closed door.
3. Choose between opening the door or keeping it closed and calling/signalling for help.
4. Experience the chosen future.
5. Rewind to the decision.
6. Experience the counterfactual future.
7. Read a sourced debrief.
8. Make a transfer decision in a different environment.

The MVP deliberately keeps choices constrained. Scenario breadth comes from reviewed combinations of disaster pack, environment, time, occupancy, infrastructure condition, and complication.

## Safety boundary

The world model is a renderer, not the safety authority. Safety rules and scoring are deterministic and human-authored. If generated output contradicts the controlled scenario, times out, or becomes unavailable, the experience switches to an approved fallback continuation and marks the run unscored.

The fire scenario is grounded in [American Red Cross home-fire guidance](https://www.redcross.org/content/dam/redcross/atg/PDF_s/Preparedness___Disaster_Recovery/Disaster_Preparedness/Home_Fire/FireFAQs.pdf).

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

No code has been added yet. The complete implementation specification is maintained in the team’s local working copy of `PLAN.md`.

## Repository status

This public repository intentionally contains the README only until implementation begins.

## License

License to be decided by the team before publishing code.
