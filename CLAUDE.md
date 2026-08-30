# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `npm run start` — Vite dev server on port 8000 serving `demo/index.html`, with `vite build --watch` running in parallel so `dist/` stays current.
- `npm run build` — Production build via Vite (library mode, ES output, `echarts` externalized).
- `npm run watch` — `vite build --watch` only, no dev server.
- `npm run types` — Regenerate `src/definition-schema.d.ts` from `src/definition-schema.json` using `json-schema-to-typescript`. Run this whenever the JSON schema changes.
- `npm run analyze` — Run `@custom-elements-manifest/analyzer` (lit flavor).
- `npm run release` — `npm version patch`: preflight guards (on `main`, clean tree, not behind `origin/main`, generated files current, build passes), then commit, bare-semver tag, `git push --follow-tags`, then waits on the CI run and fails if the npm publish fails. `npm run release:minor` / `release:major` for other bumps.
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

- `inputData: StateHistoryConfiguration` — typed via `src/definition-schema.d.ts`, generated from `src/definition-schema.json`. The JSON schema is the authoritative contract used by the IronFlock dashboard editor to render the widget's configuration UI; descriptions in it are intentionally written for AI agents and end users (see commit `f2e58ea`). Edit the JSON, then run `npm run types`.
- `theme: { theme_name, theme_object }` — light/dark theme objects (see `demo/themes/`).

`src/default-data.json` provides the demo payload.

### Rendering

Uses ECharts via tree-shaken `echarts/core` plus `CustomChart`, `CanvasRenderer`, and the Title/Tooltip/Grid/DataZoom/Legend/Toolbox components. State bars are drawn with a custom `renderItem`. `echarts` is a `peerDependency` and externalized in the Rollup output (`external: [/^echarts/]`) — the host page provides it.

Two things to keep in mind when touching `applyData()`:

- **Every component used in the option template must be in `echarts.use([...])`.** Importing it is not enough. An unregistered component makes ECharts log `Component X is used but not imported` and silently drop it — which is how the zoom toolbox's `restore` button went missing despite being fully configured.
- **Write single-instance components through `setComponent()`, never as `option.<key>.<prop> = …`.** Only the first draw uses the plain-object template; every later draw re-reads the option via `getOption()`, which normalises `title`, `tooltip`, `xAxis`, `legend` and `toolbox` to one-element **arrays**. A direct assignment then sets a property on the Array and is silently ignored, so config changes appear to do nothing until the chart is recreated. (`widget-linechart` avoids this differently — it keeps a config fingerprint and does a `notMerge` rebuild from the template whenever any of those values change.)

### Build pipeline

Vite library mode (`build.lib`, ES format, fileName `widget-statehistory`) emits `dist/widget-statehistory.js` plus type declarations. The output banner adds the Record Evolution copyright. `process.env.NODE_ENV` is hard-coded to `production` in `vite.config.ts`.

### Release flow (from README)

1. Tag push triggers the workflow which runs `npm ci`, builds, and publishes via npm trusted publishing (OIDC — no `NPM_TOKEN`).
2. After publish, register the new version with the platform via SQL:
   ```sql
   select swarm.f_update_widget_master('{"package_name": "widget-statehistory", "version": "X.Y.Z"}'::jsonb);
   ```
3. Run `npm run build` locally so the version-stamped tag matches before restarting the local node web server container.
4. If the widget appears in `dashboard-template.yml`, bump its version there too.

## `aiSelection` in `src/definition-schema.json`

The schema root carries an `aiSelection` block next to `title` and `description`. It is **not** JSON Schema and describes no config field — it exists so the IronFlock AI's Widget Builder can pick the right widget for a given shape of data, using knowledge only the widget author has:

```jsonc
"aiSelection": {
  "dataShape": "…what columns this widget consumes and what each one means…",
  "useWhen":   ["…a situation, naming the properties that express it…"],
  "notFor":    ["…a situation this widget is wrong for, naming the widget to use instead…"]
}
```

It is inert everywhere else, and must stay that way: `json2ts` ignores it (the generated `.d.ts` is byte-identical with and without it), the dashboard config editor renders only `schema.properties`, and the AI service's `validate_widget` validates *configs* against the schema, skipping unknown Draft-7 keywords.

When maintaining it:

- `notFor` is the high-value half and the part plain descriptions always omit. Every entry must name the widget that *should* be used, or it rejects without routing.
- Write for an LLM with no other documentation: describe the visible result and the user's intent, not the implementation.
- Prefer entries that discriminate against a *neighbouring* widget. Generic rejections are cheap; the ones that pay are those an author could plausibly get wrong.
- The `notFor` lists are a set across all `widget-*` repos and are meant to be reciprocal — if this widget routes to another for some case, that widget should usually route back for the converse. Changing one side is a cue to check the other.
- Update it whenever a property changes what this widget can *do*, not just how it looks.
