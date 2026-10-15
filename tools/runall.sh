#!/bin/sh
# Every rig run behind the DESIGN.md tables, saved to docs/data/. Takes about an hour on 4 cores.
set -e
node tools/rig.js levels --bot human --from 1 --to 100 --games 30 --seed 11 --json docs/data/rig-human.json > docs/data/rig-human.txt
node tools/rig.js levels --bot random --from 1 --to 100 --games 20 --seed 11 --json docs/data/rig-random.json > docs/data/rig-random.txt
node tools/rig.js campaign --bot human --players 40 --to 100 --seed 11 --json docs/data/campaign-human.json > docs/data/campaign-human.txt
node tools/rig.js levels --bot smart --from 1 --to 100 --games 10 --seed 11 --json docs/data/rig-smart.json > docs/data/rig-smart.txt
