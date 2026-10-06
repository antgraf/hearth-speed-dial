# Firefox Add-ons (AMO) — submission form checklist

Every field → final answer for the first public listing. Paste blocks live in
[listing-copy.md](listing-copy.md). Engineering package steps:
[docs/AMO.md](../../docs/AMO.md).

**Packages:**  
- Extension: `artifacts/hearth-speed-dial-firefox-v0.3.0.zip`  
- Source: `artifacts/hearth-speed-dial-source-v0.3.0.zip`  

**Privacy URL:** https://github.com/antgraf/hearth-speed-dial/blob/main/docs/PRIVACY.md

---

## Upload version

| Field | Answer |
| --- | --- |
| Extension package | Firefox zip above |
| Compatible platforms | Firefox **desktop** only (Linux / macOS / Windows) — **not** Firefox for Android |
| Source code included? | **Yes** + source zip |
| Notes for Reviewers | Paste from listing-copy.md |

---

## Describe add-on / listing

| Field | Answer |
| --- | --- |
| Name | `Hearth Speed Dial` |
| Add-on URL (slug) | `hearth-speed-dial` |
| Summary | Paste from listing-copy.md (212 / 250) |
| Description | Paste Markdown from listing-copy.md |
| This add-on is experimental | Unchecked |
| Requires payment / non-free services | Unchecked |
| Firefox categories (≤2) | **Bookmarks**, **Tabs** |
| Firefox for Android categories | Skip (desktop only) |
| Support email | Leave empty for v1 (optional owner add) |
| Support website | `https://github.com/antgraf/hearth-speed-dial/issues` |
| Homepage | `https://github.com/antgraf/hearth-speed-dial` |
| License | **MIT** |
| This add-on has a privacy policy | **Check** + paste AMO Markdown variant from listing-copy.md; also set URL to `docs/PRIVACY.md` on `main` |
| Tags | **Leave empty** (fixed AMO list has no speed-dial / new-tab / bookmarks tag) |
| Listing icons | `images/hearth-amo-icon-32x32.png`, `images/hearth-amo-icon-64x64.png` |
| Screenshots + captions | `images/` 01–05 @ 1280×800 + captions in listing-copy.md |
| Version release notes | Paste v0.3.0 block from listing-copy.md |
| Default locale | English (US) |

---

## Data collection

| Item | Answer |
| --- | --- |
| Manifest `data_collection_permissions` | `{ "required": ["none"] }` (shipped) |
| Dashboard display | Confirm it shows **None** after upload |

---

## Images upload checklist

- [ ] `hearth-amo-icon-32x32.png`
- [ ] `hearth-amo-icon-64x64.png`
- [ ] Screenshots 01–05 @ 1280×800 with captions
- [ ] No promo 440×280 / marquee required for AMO

---

## Owner leftovers (at submit)

- Mozilla/AMO developer account  
- Publisher display name on the account  
- Optional support email (AMO suggests one; Issues is the locked support path)  
- Confirm data-collection UI reads **None**  
- Attach source zip + paste rebuild notes  
