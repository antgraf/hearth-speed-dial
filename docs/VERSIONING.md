# Versioning & release

Hearth Speed Dial uses **semantic versioning** (`MAJOR.MINOR.PATCH`) for the extension. The same string is kept in sync in:

- `package.json` / `package-lock.json` (npm / CI)
- `manifest.json` (Chrome source of truth; Firefox packaging copies this version into `dist/firefox/manifest.json`)

Chrome’s `manifest.json` `version` field is numeric segments only (no `-beta` suffixes). Do not put prerelease labels in the shipped manifest.

## Scheme

| Segment | When |
| --- | --- |
| **Minor** (default) | Feature or ship releases: new UX, settings, non-breaking behavior, additive optional permissions, backward-compatible storage/export changes. |
| **Major** | Breaking for users or the store — see below. |
| **Patch** | Narrow hotfixes only (crash, data-loss bug, store-rejection fix) with no intentional product change. |

While the product is still `0.y.z`, treat major bumps the same way: a major checkbox (or manual `1.0.0`) means “breaking / reinstall-class,” not “first public.” Prefer shipping the first CWS / AMO upload as a deliberate minor or major once pre-publish checklist items are ready — do not auto-jump to `1.0.0` just because the Action ran.

## What MUST trigger a major bump

Think in terms of **installed users**, **store update eligibility**, and **data they already have**. Bump major when any of these land:

1. **Install-time permission changes that require reinstall or a new install grant**  
   Adding or removing always-on permissions in `manifest.json` (`bookmarks`, `storage`, `unlimitedStorage`, `favicon`, `contextMenus`, `activeTab`, or future always-on grants), or changing the generated Firefox always-on set in a way that requires reinstall. Chrome often will not silently expand the install set on update; users may need to remove and load again, and store reviewers treat permission deltas as high-signal. Promoting an optional permission to install-time is major.

2. **Storage schema breaks without a migration**  
   `storage.local` keys or value shapes for layout, theme, dial pictures, open/default folder ids, or toggles that existing profiles cannot read, or that wipe / mis-bind data on upgrade. If you ship a migration that keeps existing profiles working, that can stay minor; an intentional wipe or unreadable format is major.

3. **Export / import format breaks**  
   Raising `BACKUP_VERSION` (see `src/backup.ts`) in a way that **older builds cannot read new files** is fine as minor if new builds still import old files. Dropping support for an old backup version, or changing `BACKUP_FORMAT` so existing export files fail, is major.

4. **Bookmark / root behavior changes**  
   Changing what counts as the dial tree root, where new bookmarks are created by default, how the browser’s bookmark root is shown, or any remapping that would surprise users who already organized folders under Hearth. Bookmarks are the dial store — treat tree semantics as user data.

5. **New-tab / package identity breaks**  
   Changing `chrome_url_overrides.newtab`, renaming the shipped extension id expectations for sideload docs, changing the Firefox `browser_specific_settings.gecko.id`, or other packaging changes that leave an old install pointed at a dead page.

6. **Removing or narrowing optional Picture capabilities users already granted**  
   Dropping thumbnail capture or URL-image assign (or their optional permission surface) so previously enabled Settings toggles permanently fail without a clear migration path.

**Not automatically major:** additive Settings, new optional permissions requested only on toggle, UI polish, find/search, themes, favicons, export/import **additions** that still read older backups, and Firefox packaging / AMO zip additions that do not change the Chrome install permission set.

## Patch guidance

Use patch when you would be embarrassed to call it a feature: fix a regression, unblock CWS/AMO review, correct a permissions string, or repair import of the current backup version. If the fix changes user-visible behavior beyond “it works again,” prefer minor.

## How the GitHub Action numbers releases

Workflow: [`.github/workflows/release.yml`](../.github/workflows/release.yml) (`workflow_dispatch` only for now).

**Inputs**

| Input | Type | Default | Effect |
| --- | --- | --- | --- |
| `major` | boolean (checkbox) | `false` | If true → `MAJOR+1.0.0`. |
| `patch` | boolean (checkbox) | `false` | If true and `major` is false → `PATCH+1`. Ignored when `major` is true. |
| *(neither)* | — | — | Default → `MINOR+1`, patch reset to `0`. |

**Flow**

1. Check out `main`.
2. Run `node scripts/bump-version.mjs` with `--major`, `--minor`, or `--patch` per the inputs above. That updates `package.json`, `package-lock.json`, and `manifest.json` together.
3. `npm ci`, typecheck, lint, test, `npm run build` (Chrome + Firefox under `dist/`).
4. `npm run pack:chrome` → `artifacts/hearth-speed-dial-chrome-vX.Y.Z.zip`.
5. `npm run pack:firefox` → `artifacts/hearth-speed-dial-firefox-vX.Y.Z.zip`.
6. For AMO: `npm run pack:source` → `artifacts/hearth-speed-dial-source-vX.Y.Z.zip` (see [AMO.md](./AMO.md)).
7. Commit the version files to `main` (`Release vX.Y.Z`), create annotated tag `vX.Y.Z`, push commit + tag to `origin`.
8. `gh release create` on **`antgraf/hearth-speed-dial`** with **both** extension zips attached (Chrome + Firefox). Attach the source zip when preparing the AMO upload if it is not already on the Release. The release body is **auto-generated** from merged PRs (and commits) since the previous `v*` tag via `gh release create --generate-notes` (and `--notes-start-tag` when a prior tag exists). Do not maintain a hand-written `CHANGELOG.md` for this. On the first release (no prior `v*` tag), notes are still generated without a start tag.

**Policy: commit + tag (not tag-only).** The shipped version always exists on `main` so local clones, CI, and the next bump share one source of truth. Tags alone would drift from `package.json` / `manifest.json` and make the next auto-increment wrong. Annotated `vX.Y.Z` tags are always created and pushed as part of the Action.

## Release checklist (manual)

Before or right after running the Action for a store upload:

1. Confirm bump level (major checkbox if any item in “MUST trigger a major bump” applies).
2. Run [docs/smoke-checklist.md](./smoke-checklist.md) on **Chrome** against `dist/chrome` (or the Chrome release zip unpacked) and on **Firefox 121+** against `dist/firefox` (temporary add-on).
3. Upload the **Chrome** zip from the GitHub Release to CWS (or sideload for verification).
4. Upload the **Firefox** zip to AMO when the AMO listing package is ready (or sideload / temporary add-on for verification). Attach the matching **source** zip (`npm run pack:source`) and paste rebuild steps from [AMO.md](./AMO.md).
5. Confirm the GitHub Release body (auto-generated from merged PRs since the previous tag); edit on GitHub only if you need a short store-facing blurb prepended. Keep CWS/AMO listing copy elsewhere until those listing packages ship.

Ordinary PR CI ([`.github/workflows/ci.yml`](../.github/workflows/ci.yml)) does **not** bump versions or publish releases; it does build and pack both Chrome and Firefox zips to catch packaging regressions.
