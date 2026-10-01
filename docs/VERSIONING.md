# Versioning & release

Hearth Speed Dial uses **semantic versioning** (`MAJOR.MINOR.PATCH`) for the Chrome extension. The same string is kept in sync in:

- `package.json` / `package-lock.json` (npm / CI)
- `manifest.json` (what Chrome and the Chrome Web Store see)

Chrome’s `manifest.json` `version` field is numeric segments only (no `-beta` suffixes). Do not put prerelease labels in the shipped manifest.

## Scheme

| Segment | When |
| --- | --- |
| **Minor** (default) | Feature or ship releases: new UX, settings, non-breaking behavior, additive optional permissions, backward-compatible storage/export changes. |
| **Major** | Breaking for users or the store — see below. |
| **Patch** | Narrow hotfixes only (crash, data-loss bug, store-rejection fix) with no intentional product change. |

While the product is still `0.y.z`, treat major bumps the same way: a major checkbox (or manual `1.0.0`) means “breaking / reinstall-class,” not “first public.” Prefer shipping the first CWS upload as a deliberate minor or major once pre-publish checklist items are ready — do not auto-jump to `1.0.0` just because the Action ran.

## What MUST trigger a major bump

Think in terms of **installed users**, **Chrome Web Store update eligibility**, and **data they already have**. Bump major when any of these land:

1. **Install-time permission changes that require reinstall or a new install grant**  
   Adding or removing always-on permissions in `manifest.json` (`bookmarks`, `storage`, `unlimitedStorage`, `favicon`, `contextMenus`, `activeTab`, or future always-on grants). Chrome often will not silently expand the install set on update; users may need to remove and load again, and CWS reviewers treat permission deltas as high-signal. Promoting an optional permission to install-time is major.

2. **Storage schema breaks without a migration**  
   `chrome.storage.local` keys or value shapes for layout, theme, dial pictures, open/default folder ids, or toggles that existing profiles cannot read, or that wipe / mis-bind data on upgrade. If you ship a migration that keeps existing profiles working, that can stay minor; an intentional wipe or unreadable format is major.

3. **Export / import format breaks**  
   Raising `BACKUP_VERSION` (see `src/backup.ts`) in a way that **older builds cannot read new files** is fine as minor if new builds still import old files. Dropping support for an old backup version, or changing `BACKUP_FORMAT` so existing export files fail, is major.

4. **Bookmark / root behavior changes**  
   Changing what counts as the dial tree root, where new bookmarks are created by default, how Chrome’s bookmark root is shown, or any remapping that would surprise users who already organized folders under Hearth. Bookmarks are the dial store — treat tree semantics as user data.

5. **New-tab / package identity breaks**  
   Changing `chrome_url_overrides.newtab`, renaming the shipped extension id expectations for sideload docs, or other packaging changes that leave an old install pointed at a dead page.

6. **Removing or narrowing optional Picture capabilities users already granted**  
   Dropping thumbnail capture or URL-image assign (or their optional permission surface) so previously enabled Settings toggles permanently fail without a clear migration path.

**Not automatically major:** additive Settings, new optional permissions requested only on toggle, UI polish, find/search, themes, favicons, export/import **additions** that still read older backups, and Firefox packaging once that lands (separate artifact; still bump Chrome semver only when the Chrome package changes).

## Patch guidance

Use patch when you would be embarrassed to call it a feature: fix a regression, unblock CWS review, correct a permissions string, or repair import of the current backup version. If the fix changes user-visible behavior beyond “it works again,” prefer minor.

## How the GitHub Action numbers releases

Workflow: [`.github/workflows/release.yml`](../.github/workflows/release.yml) (`workflow_dispatch` only for now).

**Inputs**

| Input | Type | Default | Effect |
| --- | --- | --- | --- |
| `major` | boolean (checkbox) | `false` | If true → `MAJOR+1.0.0`. |
| `patch` | boolean (checkbox) | `false` | If true and `major` is false → `PATCH+1`. Ignored when `major` is true. |
| *(neither)* | — | — | Default → `MINOR+1`, patch reset to `0`. |

**Flow (Chrome only today)**

1. Check out `main`.
2. Run `node scripts/bump-version.mjs` with `--major`, `--minor`, or `--patch` per the inputs above. That updates `package.json`, `package-lock.json`, and `manifest.json` together.
3. `npm ci`, typecheck, lint, test, `npm run build`.
4. `npm run pack:chrome` → zip of `dist/` contents (manifest at zip root) under `artifacts/hearth-speed-dial-chrome-vX.Y.Z.zip` for CWS / sideload.
5. Commit the version files to `main` (`Release vX.Y.Z`), create annotated tag `vX.Y.Z`, push commit + tag to `origin`.
6. `gh release create` on **`antgraf/hearth-speed-dial`** with the Chrome zip attached.

**Policy: commit + tag (not tag-only).** The shipped version always exists on `main` so local clones, CI, and the next bump share one source of truth. Tags alone would drift from `package.json` / `manifest.json` and make the next auto-increment wrong.

**Firefox later:** keep `pack:chrome` and the `-chrome-` artifact name. Add `pack:firefox` (and a second release asset) when Firefox support is in the SPEC — do not invent a Firefox zip before then.

## Release checklist (manual)

Before or right after running the Action for a store upload:

1. Confirm bump level (major checkbox if any item in “MUST trigger a major bump” applies).
2. Run [docs/smoke-checklist.md](./smoke-checklist.md) on Chrome against the built `dist` (or the release zip unpacked).
3. Upload the **Chrome** zip from the GitHub Release to CWS (or sideload for verification).
4. Note release notes on the GitHub Release; keep store listing copy elsewhere until the listing package ships.

Ordinary PR CI ([`.github/workflows/ci.yml`](../.github/workflows/ci.yml)) does **not** bump versions or publish releases.
