# cicd and development
This project was originally created with: npm create vue@latest

The .github/workflows/ firebase-hosting-merge.yml and firebase-hosting-pull-request.yml were created with: firebase init hosting.

## Versioning policy
The enforced versioning policy ("always run the latest LTS / stable version of every dependency") lives in `.clinerules` at the repo root. That file is the source of truth for *how* to choose versions. This document records *which* versions were chosen and *why*.

## Decisions made
- **Node version policy**: entire team uses the **exact same** Node version (currently `24.18.0`, latest LTS "Krypton"). Pinned in both `engines.node` and `volta.node` in `package.json`. No ranges.
- **Rationale for exact pin**: reproducibility across dev, CI, and prod outweighs the convenience of accepting patch/minor drift.
- **Why Node 24 LTS (not Node 26 current)**: initial attempt at Node 26.4.0 failed in CI at deploy time — `FirebaseExtended/action-hosting-deploy@v0` runs `npx firebase-tools@latest`, whose transitive dep `superstatic` declares `engines.node: "20 || 22 || 24"` and is rejected by `engine-strict=true` on Node 26. Non-LTS Node majors are not in most packages' engine allowlists; pinning to the active LTS line avoids this class of failure. Side benefit: `@tsconfig/node24` and `@types/node@^24` now align naturally with the runtime.
- **Why 24.18.0 specifically**: latest Node 24 LTS patch release as of writing. An intermediate attempt at 24.10.0 was rejected by `engine-strict=true` because `json-parse-even-better-errors@6.0.0` requires `^24.15.0`. Bump to the latest 24.x patch when newer ones ship to stay above the floor that newly-released packages set.
- **`@types/node` intentionally pinned to `^24`, not the npm `latest` (`^26`)**: `@types/node`'s major version must track the project's pinned Node runtime line (currently Node 24 LTS), not the npm `latest` tag. Bumping to `@types/node@26` would expose Node 26 APIs that aren't in the runtime. This is a deliberate exception to the "always latest" policy in `.clinerules` Clause 2, justified by Clause 4 (compatibility). Bump in lockstep with the Node version pin only.
- **added `.npmrc` with `engine-strict=true`?**
   Turns the `engines.node` exact pin from a warning into a hard install failure.
- **GitHub Actions workflow fixes** (`firebase-hosting-pull-request.yml`, `firebase-hosting-merge.yml`)
   - bumped `actions/checkout` and `actions/setup-node` from `@v4` to `@v5` (v4 still declares Node 20 runtime, which GitHub deprecated on runners 2025-09-19; v5 declares Node 24).
   - added `actions/setup-node@v5` with `node-version-file: 'package.json'` so CI uses the pinned Node version.
   - added `cache: 'npm'` to `setup-node` for faster installs.
   - added `permissions: contents: read` to the merge workflow (PR workflow already has explicit permissions).
   - added `concurrency` blocks: `cancel-in-progress: true` for PR previews, `false` for prod merge deploys.
   - added: pin `runs-on` to `ubuntu-24.04` instead of `ubuntu-latest`
   - added: split `npm ci && npm run build` into two steps for clearer log attribution.