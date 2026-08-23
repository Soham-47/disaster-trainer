# Counterfactual Apartment-Fire Trainer

An Interactive Media prototype for practicing one apartment-fire decision through a real LingBot World 2 first-person stream. The deterministic fire engine owns cues, available actions, exposure, recovery, scoring, and the source-grounded debrief; LingBot renders the learner-visible world.

## Setup

```powershell
npm install
Copy-Item .env.example .env.local
npm run dev
```

Set the server-only key in `.env.local`:

```text
REACTOR_API_KEY=...
```

Never expose this value through a `NEXT_PUBLIC_*` variable. The app blocks learner controls until the live stream and first generation chunk are confirmed. Startup and branch failures stay visible and retryable; no prepared disaster media is substituted.

## Learner flow

1. Connect to the live apartment world and explore with WASD and arrow-look controls.
2. Listen to the alarm, inspect smoke under the door, and feel the warm door.
3. The checkpoint is captured only after a confirmed chunk boundary and pause.
4. Choose **Open door** or **Keep door closed**. The action remains pending until the matching LingBot first-chunk receipt arrives.
5. Respond to the consequence, rewind the exact captured checkpoint, and experience the opposite future.
6. Review the warning cue, recommended action, consequence, and Red Cross guidance.

## Safety and realism boundary

LingBot supplies navigable video rather than collision-accurate 3D state. It does not define whether an action is safe. A failed or unavailable stream blocks the scenario and offers retry instead of silently switching to prepared media.

This is an experimental preparedness-practice prototype, not certified training or a physically exact fire simulator. Newly introduced guidance still requires review by a qualified fire-safety professional.

## Verification

```powershell
npm test
npm run lint
npm run build
npm run typecheck
npx playwright test
```

Use `http://localhost:3000/?mockWorld=1` for a deterministic local browser flow. The mock is enabled only outside production and only with that query flag. Use `?debug=1` for technical diagnostics. This is experimental preparedness practice, not certified training or a physically exact 3D simulator.
