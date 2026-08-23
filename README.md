# Counterfactual Apartment-Fire Trainer

A first-person interactive-media prototype for practicing one apartment-fire decision deeply: inspect the cues, decide whether to open a warm smoke-lined door, experience the consequence, then restart the same permanent world and experience the alternative.

Happy Oyster Adventure renders the navigable live world. A deterministic TypeScript reducer owns the cues, available decisions, exposure, recovery, assessment, and debrief. Model output is never used as safety truth.

## Setup

```powershell
npm install
Copy-Item .env.example .env.local
npm run dev
```

Configure both server-only values in `.env.local`:

```text
REACTOR_API_KEY=...
HAPPY_OYSTER_FIRE_WORLD_ID=...
```

Never expose the Reactor key through a `NEXT_PUBLIC_` variable. The browser receives only a short-lived Adventure-scoped token from `/api/happy-oyster-session`.

### Create the permanent training world

1. Start the development server.
2. Open `http://localhost:3000/world-lab`.
3. Select **Build and validate world**.
4. Confirm a real live video appears and inspect the provider verbs (the reviewed world currently advertises `open_close_door` and `crouch`).
5. Copy the permanent encrypted world ID into `HAPPY_OYSTER_FIRE_WORLD_ID` in `.env.local`.
6. Restart `npm run dev`, then open `/`.

The world lab is unavailable in production. Normal learner sessions only attach the prebuilt reviewed world; they never create a new world.

## Learner flow

1. A verified live Happy Oyster stream must start; there is no fake “live” fallback.
2. Use WASD and pointer-look to explore the stable first-person bedroom.
3. Use `E`, number keys, or the contextual controls to inspect the alarm, smoke, and warm door.
4. Open the door or keep it closed, then perform the reviewed response actions.
5. Restart travel on the same permanent world and take only the opposite door decision.
6. Review the deterministic action timeline, exposure, readiness assessment, and Red Cross guidance.

## Safety and realism boundary

Happy Oyster provides navigable video rather than a collision-accurate 3D scene. The visual experience can be approximate; it does not define whether an action is safe. The controller maps reviewed actions to the verbs actually advertised by the permanent world and produces identical safety state for identical action sequences. A failed or unavailable stream blocks the scenario and offers retry instead of silently switching to prepared media. A learner or reviewer can flag a contradictory visual consequence, which keeps the controlled lesson visible but makes the run ineligible for scoring.

This is an experimental preparedness-practice prototype, not certified training or a physically exact fire simulator. Newly introduced guidance still requires review by a qualified fire-safety professional.

## Verification

```powershell
npm test
npm run typecheck
npm run build
npx playwright test
```

The main implementation is intentionally focused on one deep scenario for the Interactive Media track: visual realism, continuous movement, low-friction interaction, spatial immersion, and a visible counterfactual learning loop.
