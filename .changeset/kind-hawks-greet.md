---
type: Changed
pr: 3884
---
**Default `git.branching_strategy` is now `"phase"`** (was `"none"`). New projects initialized with `gsd new-project` get `git.branching_strategy: "phase"` baked into `.planning/config.json`, so `execute-phase` always creates a `gsd/phase-{phase}-{slug}` branch before running. Existing projects are unaffected — their committed `.planning/config.json` value wins. The validate `createConfig`/`resetConfig` repair fallback also writes `"phase"` for consistency. Rationale: aligns the shipped default with the "every change reaches main via a PR" workflow — `"none"` commits straight to the current branch (often `main`) with no PR; `"phase"` produces a per-phase branch ready for PR + review. (#3884)
