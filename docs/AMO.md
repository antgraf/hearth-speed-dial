# AMO (Firefox Add-ons) packaging

Hearth ships a Vite-bundled, minified Firefox tree under `dist/firefox/`. AMO reviewers need matching **source** plus rebuild steps so they can diff the built output against the uploaded extension zip.

Listing screenshots, store copy, and the privacy-policy URL remain separate Pre-publish lanes. This doc covers the engineering package only.

## Artifacts

| Zip | Command | Use |
| --- | --- | --- |
| `artifacts/hearth-speed-dial-firefox-vX.Y.Z.zip` | `npm run pack:firefox` (after `npm run build`) | Upload as the extension package on AMO |
| `artifacts/hearth-speed-dial-source-vX.Y.Z.zip` | `npm run pack:source` | Attach as **Source code** for the same version |

Release Action also packs Chrome + Firefox extension zips; run `npm run pack:source` when preparing the AMO upload (or after downloading the tagged release tree).

## Reviewer build (paste into AMO notes)

**Environment:** Node.js **≥ 22** (CI and `package.json` `engines` use 22; AMO’s default reviewer image may be newer — either works). OS-agnostic; no browser binary required for the build.

```bash
npm ci
npm run build
```

That writes:

- `dist/chrome/` — Chrome Web Store / Load unpacked tree
- `dist/firefox/` — Firefox temporary-add-on / AMO package tree

Then:

```bash
npm run pack:firefox
```

Compare `dist/firefox/` (or the Firefox zip contents) to the uploaded extension. Expected Firefox manifest differences vs Chrome source `manifest.json`:

- No `favicon` permission
- Optional host patterns folded into `optional_permissions` (no `optional_host_permissions`)
- `browser_specific_settings.gecko`:
  - `id`: `hearth-speed-dial@antgraf`
  - `strict_min_version`: `121.0` (MV3 service workers)
  - `data_collection_permissions`: `{ "required": ["none"] }` — nothing leaves the browser

PowerShell equivalent from a Windows clone: `.\build.ps1` then `npm run pack:firefox`.

## What Anton still does on AMO

These are website / creative steps, not covered by this package:

1. Create the AMO listing (summary, description, category, screenshots, privacy policy URL) once creative lanes land.
2. Upload the **Firefox** zip for the release version.
3. Attach the matching **source** zip and paste the rebuild commands above into the reviewer notes field.
4. Confirm the data-collection disclosure shows **None** (from the manifest key).
5. If AMO’s validator suggests raising `strict_min_version` toward current ESR (e.g. 140), decide whether to bump in a follow-up PR; v1 keeps `121.0` because Hearth declares `none` and needs 121+ for MV3 service workers only.

## Local checks before upload

```bash
npm ci
npm run typecheck
npm test
npm run build
npm run pack:firefox
npm run pack:source
```

Smoke the temporary add-on from `dist/firefox/manifest.json` per [smoke-checklist.md](./smoke-checklist.md).
