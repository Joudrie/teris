# Playtest script: five new players, levels 1–10

The bots in `tools/bots.js` set every budget and win rate in DESIGN.md. This session checks those numbers against real people, so the human-ish bot can be retuned to match.

## Setup (per player)

1. Serve the game (`npm start`) and open `http://<your-ip>:8000/?playtest` on the player's own phone. Use a private window so the save starts fresh.
2. Say only: "It's a puzzle game, play it as you like for about 15 minutes." Don't explain the controls. The callouts and the home screen should be enough, and that's what we're testing.
3. Watch without helping. If they ask a question, note it and answer only if they're stuck for over 30 seconds.

## Note down

| Moment | What to write down |
|---|---|
| First 10 s | Did they touch the screen before the first water landed? Did they read the callout? |
| First slam | When did they first flick down, and was it on purpose? |
| Level 5 (glass tower) | Did they slam the glass after the callout? How many tries? |
| Level 8 (two-material pieces) | Did they rotate pieces on purpose? |
| Any loss | Did they take the revive? What did they say on "So close"? |
| Hesitations | Any pause over 5 s with no input, and where |
| Quit point | The level and minute they stopped, and why (if they say) |

## After each player

1. Open the home screen (the ⌂ button). The **Playtest results** panel shows their numbers in the same terms as the DESIGN.md tables.
2. Tap **Copy all attempts** and paste the JSON into `docs/data/playtest-<name>.json`.
3. Tap **Clear** before the next player, or use a new private window.

## Compare with the bots

| Measure | Newbie bot | Human-ish bot | Players |
|---|---|---|---|
| First drain (level 1) | 7.2 s | 1.7 s | |
| Level 1 clear time | ~79 s | ~27 s | |
| First-try win, levels 1–20 | | see DESIGN.md | |
| Close losses (80%+) | | see DESIGN.md | |
| Longest no-drain gap (median) | 10–20 s | ~5 s | |

If players land between the newbie and human-ish bots, the curve holds. If they are well below the newbie bot on levels 4–10, loosen those budgets: lower the targets in `HAND_TARGET` in `src/levels.js`, then run `node tools/calibrate.js`. If they are well above, raise them.
