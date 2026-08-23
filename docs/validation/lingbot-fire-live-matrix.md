# LingBot apartment-fire live validation matrix

Mark a row semantically valid only after a human reviewer confirms the live frame, not merely after the SDK reports success. Run at least ten repetitions per branch with the same reference and seed contract.

| Run | API success | initial continuity | door state | smoke state | invented content | branch latency ms | reviewer | notes |
|---|---|---|---|---|---|---:|---|---|
| 1 |  |  |  |  |  |  |  |  |
| 2 |  |  |  |  |  |  |  |  |
| 3 |  |  |  |  |  |  |  |  |
| 4 |  |  |  |  |  |  |  |  |
| 5 |  |  |  |  |  |  |  |  |
| 6 |  |  |  |  |  |  |  |  |
| 7 |  |  |  |  |  |  |  |  |
| 8 |  |  |  |  |  |  |  |  |
| 9 |  |  |  |  |  |  |  |  |
| 10 |  |  |  |  |  |  |  |  |

Acceptance targets: the bedroom geometry and camera remain continuous; the unsafe branch visibly opens the warm door and increases smoke exposure; the safer branch keeps the door closed with smoke at the gap; no people, captions, extra exits, or model-generated advice appear; the learner action stays pending until the matching first chunk; and both branches begin from the same captured checkpoint image and seed.
