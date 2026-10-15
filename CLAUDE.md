# Working on this repo

## Ship every finished task to the live site (owner's standing rule)

The owner texts the live link to friends after every update, so every completed task ends with the change live at **https://joudrie.github.io/teris/**. No exceptions, and no asking first.

1. Run the checks: `npm test`, plus `node tools/browser/hook.mjs` and `node tools/browser/check.mjs` when the game or UI changed.
2. Run `npm run stamp` last, right before committing. It gives every module and the stylesheet a content-hashed URL and bumps `version.json`, so players get the new build at once instead of a cached copy for up to 10 minutes. `node tools/stamp.mjs --check` fails if you forgot.
3. Commit, then push the same commit to **both** `main` and `claude/new-session-qpcuho`. GitHub Pages builds the site from `claude/new-session-qpcuho`. Merge (never force-push) if a branch has moved on.
4. Wait for the site to serve the new build (about 1–2 minutes), and load it once in a browser to confirm it runs.
5. End every message to the owner with the clickable live link: https://joudrie.github.io/teris/

Never send the owner a branch link, a PR link or an artifact link in place of the live site.
