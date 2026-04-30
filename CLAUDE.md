# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `npm run start` — Vite dev server on port 8000 serving `demo/index.html`, with `vite build --watch` running in parallel so `dist/` stays current.
- `npm run build` — Production build via Vite (library mode, ES output, `echarts` externalized).
- `npm run watch` — `vite build --watch` only, no dev server.
- `npm run types` — Regenerate `src/definition-schema.d.ts` from `src/definition-schema.json` using `json-schema-to-typescript`. Run this whenever the JSON schema changes.
- `npm run analyze` — Run `@custom-elements-manifest/analyzer` (lit flavor).
- `npm run release` — Builds, regenerates types, runs `npm version patch` (no `v` prefix on tag), pushes commit and tag. The tag push triggers `.github/workflows/build-publish.yml` which publishes to npm and creates a GitHub release.
- `npm run link` / `npm run unlink` — Symlink this package into a sibling `../RESWARM/frontend` for local integration testing.

No test runner, linter, or formatter scripts are wired up. `.prettierrc` exists but is not invoked via npm.

Node `>=24.9.0`, npm `>=10.0.2` (enforced via `engines`). The CI workflow uses Node 24.

## Architecture

This repo is one entry in a family of IronFlock dashboard widgets (`../widget-*` siblings). Each widget is a standalone Lit web component published to npm and consumed by the IronFlock platform's dashboard frontend.

### Entry point and versioned tag

- Single source: `src/widget-statehistory.ts` exporting `WidgetStateHistory extends LitElement`.
- The custom element tag is registered as `widget-statehistory-versionplaceholder`. At build time, `@rollup/plugin-replace` (configured in `vite.config.ts`) substitutes `versionplaceholder` with the current `package.json` version, producing tags like `widget-statehistory-1.0.13`.
- Consumers must keep the version-suffixed tag in sync with the installed package version. `demo/index.html` resolves this dynamically via `unsafeStatic` from `package.json`.

### Inputs and platform contract

The widget receives two reactive Lit `@property` objects from the host dashboard:

- `inputData: InputData` — typed via `src/definition-schema.d.ts`, generated from `src/definition-schema.json`. The JSON schema is the authoritative contract used by the IronFlock dashboard editor to render the widget's configuration UI; descriptions in it are intentionally written for AI agents and end users (see commit `f2e58ea`). Edit the JSON, then run `npm run types`.
- `theme: { theme_name, theme_object }` — light/dark theme objects (see `demo/themes/`).

`src/default-data.json` provides the demo payload.

### Rendering

Uses ECharts via tree-shaken `echarts/core` plus `CustomChart`, `CanvasRenderer`, and the Title/Tooltip/Grid/DataZoom/Legend components. State bars are drawn with a custom `renderItem`. `echarts` is a `peerDependency` and externalized in the Rollup output (`external: [/^echarts/]`) — the host page provides it.

### Build pipeline

Vite library mode (`build.lib`, ES format, fileName `widget-statehistory`) emits `dist/widget-statehistory.js` plus type declarations. The output banner adds the Record Evolution copyright. `process.env.NODE_ENV` is hard-coded to `production` in `vite.config.ts`.

### Release flow (from README)

1. Tag push triggers the workflow which runs `npm install --omit-dev --frozen-lockfile`, builds, and publishes.
2. After publish, register the new version with the platform via SQL:
   ```sql
   select swarm.f_update_widget_master('{"package_name": "widget-statehistory", "version": "X.Y.Z"}'::jsonb);
   ```
3. Run `npm run build` locally so the version-stamped tag matches before restarting the local node web server container.
4. If the widget appears in `dashboard-template.yml`, bump its version there too.
