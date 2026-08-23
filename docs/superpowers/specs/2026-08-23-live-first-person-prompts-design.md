# Live First-Person Prompts Design

## Goal

Make the Counterfactual Disaster Trainer feel like a real-time first-person world-model experience on a typical laptop while allowing learners to describe arbitrary visual scenarios without allowing natural language to define safety rules or decisions.

## Design

- The Reactor WebRTC `MediaStream` is the primary viewport whenever a live main-video stream arrives.
- The prepared video and canvas renderer remain a fail-closed fallback. The canvas animation is paused whenever a video is visible, when the tab is hidden, or when reduced motion is requested.
- The entry screen accepts an optional learner-authored scenario brief up to 280 characters. The brief is passed to the world model as visual context and explicitly fenced as non-authoritative.
- The controlled scenario pack continues to own cues, choices, consequences, debrief copy, and scoring. The brief cannot alter those rules.
- Consequence and transfer prompts include the same brief so the world remains visually coherent across the counterfactual loop.
- Live stream normalization accepts either a MediaStream or a MediaStreamTrack from the SDK callback and cleans up replaced streams.

## Performance and failure behavior

- Canvas work runs only when no video stream/fallback video is visible.
- Canvas resolution is capped at 1280x720 and animation is suspended while the document is hidden.
- The player prevents duplicate starts through its existing pending guard and resets media streams on restart/unmount.
- If Reactor token exchange, SDK connection, or first-frame delivery fails, the existing prepared continuation is shown and the run remains unscored.

## Testing

- Unit tests cover brief normalization, prompt fencing, and stream-track normalization behavior.
- Existing scenario, scoring, adapter, typecheck, lint, build, and browser smoke tests remain required.
