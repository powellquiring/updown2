# cicd and development
This project was originally created with: npm create vue@latest

The .github/workflows/ firebase-hosting-merge.yml and firebase-hosting-pull-request.yml were created with: firebase init hosting.

## Decisions made
- **Node version policy**: entire team uses the **exact same** Node version (currently `26.4.0`). Pinned in both `engines.node` and `volta.node` in `package.json`. No ranges.
- **Rationale for exact pin**: reproducibility across dev, CI, and prod outweighs the convenience of accepting patch/minor drift.
- **`@tsconfig/node24` + `@types/node@24` skew vs Node 26 runtime is accepted**: upstream has not published `@tsconfig/node26` / `@types/node@26` yet. Impact is limited to type-checking of build-tool configs (`vite.config.ts`, `eslint.config.ts`); app code is browser-targeted via `@vue/tsconfig/tsconfig.dom.json` and unaffected. Bump when upstream ships.
- **added `.npmrc` with `engine-strict=true`?**
   Turns the `engines.node` exact pin from a warning into a hard install failure.
- **GitHub Actions workflow fixes** (`firebase-hosting-pull-request.yml`, `firebase-hosting-merge.yml`)
   - added `actions/setup-node@v4` with `node-version-file: 'package.json'` so CI uses the pinned Node version.
   - added `cache: 'npm'` to `setup-node` for faster installs.
   - added `permissions: contents: read` to the merge workflow (PR workflow already has explicit permissions).
   - added `concurrency` blocks: `cancel-in-progress: true` for PR previews, `false` for prod merge deploys.
   - added: pin `runs-on` to `ubuntu-24.04` instead of `ubuntu-latest`
   - added: split `npm ci && npm run build` into two steps for clearer log attribution.