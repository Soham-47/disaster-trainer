

## Summary

Build an isolated browser-based 3D apartment-fire prototype to compare against Happy Oyster. This is a feasibility spike, not production integration.

The prototype must demonstrate:

- immediate first-person movement;
- mouse-look and WASD controls;
- reliable collisions;
- object-aware interactions;
- deterministic fire consequences;
- exact checkpoint restoration;
- acceptable performance on the target RTX 2050 laptop.

The Happy Oyster redesign remains the primary direction until this spike proves materially better.

## Technical Approach

Create branch:

```text
codex/threejs-fire-spike
```

Branch from:

```text
codex/interactive-simulation-v2
```

Do not modify or reuse the dirty `provider-spike` worktree.

Use this React 18-compatible stack:

```json
{
  "three": "0.185.1",
  "@react-three/fiber": "8.18.0",
  "@react-three/drei": "9.122.0",
  "@react-three/rapier": "1.5.0"
}
```

React Three Fiber v8 is the React 18-compatible renderer. Rapier supplies deterministic colliders, ray casting, sensors, and physics snapshots. [React Three Fiber installation](https://r3f.docs.pmnd.rs/getting-started/installation), [React Three Rapier](https://pmndrs.github.io/react-three-rapier/)

Expose the spike only at:

```text
/renderer-lab
```

Do not connect it to Reactor or replace the existing application during the spike.

## Prototype Design

### Apartment scene

Build a compact code-authored bedroom:

- Room dimensions: 6 m × 5 m × 2.8 m.
- One closed exit door.
- One window.
- Bed.
- Nightstand.
- Phone.
- Flashlight.
- Bright signaling cloth.
- Smoke alarm.
- Hallway volume outside the door.

Use simple meshes and physically based materials. The spike evaluates renderer capability and interaction quality, not final furniture artwork.

Physics:

- Static cuboid colliders for walls, floor, ceiling, bed, nightstand, and window.
- Hinged or kinematic door collider.
- Kinematic capsule player.
- Standing eye height: 1.7 m.
- Crouched eye height: 1.05 m.
- Walking speed: 2.3 m/s.
- Crouched speed: 1.2 m/s.
- Interaction distance: 2 m.
- Fixed physics timestep: `1/60`.
- No jumping or movable furniture.

### Controls

- WASD: movement relative to camera yaw.
- Mouse pointer lock: continuous look.
- Arrow keys: accessible look fallback.
- `E`: interact with the object under the reticle.
- `Ctrl`: crouch.
- `Esc`: release pointer lock.
- Stop movement on key-up, blur, visibility change, modal opening, and unmount.

Camera motion must be applied locally every animation frame. Input must never wait for React state updates or network activity.

### Interaction model

Give every training object a stable ID:

```ts
type FireObjectId =
  | "smoke-alarm"
  | "smoke-under-door"
  | "bedroom-door"
  | "phone"
  | "window"
  | "flashlight"
  | "signal-cloth";
```

Cast a ray from the center reticle every frame. Show an interaction prompt only when the nearest reviewed object is within 2 m and unobstructed.

Supported actions:

```ts
type FireInteraction =
  | "listen-alarm"
  | "inspect-smoke"
  | "feel-door"
  | "open-door"
  | "keep-door-closed"
  | "use-phone"
  | "signal-window"
  | "crouch-low";
```

The deterministic controller—not the renderer—decides which interactions are unlocked.

### Fire presentation

Use native Three.js effects only:

- Exponential fog for smoke density.
- A small number of instanced transparent smoke particles.
- Warm hallway point light.
- Alarm audio with captions.
- Fire crackle audio near the hallway.
- Door material warming after inspection.
- Reduced-visibility post-effect through scene fog, not a full-screen CSS overlay.
- Reduced-motion mode disables camera impulses and particle turbulence.

Do not add a post-processing dependency during the spike.

Consequences:

- `open-door` animates the door, enables the hallway collider opening, increases smoke density, raises light intensity, and reduces visibility.
- `keep-door-closed` leaves the door and collider closed and unlocks the phone and window interactions.
- The safety reducer owns exposure, assessment, and debrief state.

### Exact checkpoint

Define:

```ts
type RendererCheckpoint = {
  playerPosition: [number, number, number];
  playerYaw: number;
  playerPitch: number;
  crouched: boolean;
  doorOpen: boolean;
  smokeDensity: number;
  hallwayLightIntensity: number;
  discoveredCueIds: string[];
  completedActionIds: string[];
  hazardExposure: number;
};
```

At the warm-door decision:

1. Save `RendererCheckpoint`.
2. Render the selected consequence.
3. Restore the checkpoint exactly.
4. Render the alternative.
5. Verify camera, door, hazards, cues, and player state equal the saved snapshot.

Also expose:

```ts
captureRendererFrame(): string;
```

This returns a JPEG data URL from the WebGL canvas so the renderer could later provide Reactor with an exact first frame for a generated cinematic.

## UI

The spike UI should contain only:

- full-screen WebGL canvas;
- center reticle;
- immediate objective in the upper left;
- exposure indicator in the upper right;
- contextual `E` prompt;
- small FPS/frame-time readout visible only with the backtick key;
- buttons to save checkpoint, restore checkpoint, and toggle collider debug mode in the developer drawer.

Do not reproduce the current timeline, action wheel, generation-status card, prompt box, or multi-disaster selector.

## Performance Budget

Optimize for the identified target machine:

- Intel i5-12500H.
- 16 GB RAM.
- RTX 2050 4 GB.

Budgets:

- Median frame rate: at least 55 FPS at 1920×1080.
- 1% low frame rate: at least 40 FPS.
- Input-to-camera response: below 50 ms.
- Initial interactive load after route resources are cached: below 2 seconds.
- Total scene triangles: below 250,000.
- Draw calls: below 150.
- Active smoke particles: below 300.
- One shadow-casting light.
- Shadow map: 1024×1024.
- Device pixel ratio: clamp between 1 and 1.5.
- Texture resolution: maximum 2048×2048.
- No runtime path tracing, screen-space reflections, volumetric ray marching, or dynamic global illumination.

If frame rate remains below budget, reduce DPR to 1 before reducing scene functionality.

## Tests

### Automated

- Player cannot pass through walls, furniture, the closed door, or the window.
- Opening the door changes both its visual transform and collider state.
- Ray interaction selects only the nearest unobstructed reviewed object.
- Objects beyond 2 m cannot be activated.
- Unsafe and safer actions produce deterministic state changes.
- Restoring a checkpoint produces a deeply equal renderer and training state.
- Identical input sequences produce identical final player positions within a small floating-point tolerance.
- Blur, unmount, and pointer-lock loss stop movement.
- Reduced-motion mode disables camera impulses and particle turbulence.
- `captureRendererFrame()` produces a valid JPEG data URL.
- `/renderer-lab` loads without affecting the main application.

### Manual browser checks

- Walk around the entire room without clipping or camera inversion.
- Approach every object from multiple angles.
- Crouch beneath denser smoke.
- Inspect and open the door.
- Restore the checkpoint and take the safer alternative.
- Verify readable prompts never overlap the reticle.
- Test keyboard-only controls.
- Test at 1920×1080 and 1366×768.
- Record FPS while idle, walking, crouching, and during the unsafe consequence.

## Deliverables and Decision Gate

Krishna should deliver:

- The isolated `codex/threejs-fire-spike` branch.
- A 60–90 second screen recording.
- Desktop screenshots of orientation, inspection, unsafe consequence, and restored alternative.
- `docs/renderer-spike-report.md` containing:
  - cached load time;
  - median and 1% low FPS;
  - input latency;
  - bundle-size increase;
  - collision defects found;
  - checkpoint equality result;
  - approximate authoring time;
  - comparison against Happy Oyster;
  - recommendation: adopt, hybridize, or reject.

Adopt the 3D renderer only if:

- every collision and checkpoint test passes;
- median FPS is at least 55;
- controls feel materially more responsive than Happy Oyster;
- the scene is visually credible enough for the hackathon;
- Krishna estimates that production-quality asset work can be completed before submission.

Otherwise, keep Happy Oyster Adventure as the primary renderer and retain this branch only as a documented experiment.
