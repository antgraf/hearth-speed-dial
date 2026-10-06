# Store submit kits — Hearth Speed Dial

Self-contained folders for upload day on each browser store. Copy and images live
**in this tree** (duplicated per browser so you do not need shared paths).

| Folder | Store | Package |
| --- | --- | --- |
| [chrome/](chrome/) | Chrome Web Store | `artifacts/hearth-speed-dial-chrome-vX.Y.Z.zip` |
| [firefox/](firefox/) | Firefox Add-ons (AMO) | Firefox + source zips — see [docs/AMO.md](../docs/AMO.md) |
| [edge/](edge/) | Microsoft Edge Add-ons | Same Chromium zip as Chrome |

Each browser folder has:

1. **`listing-copy.md`** — paste-ready listing text only
2. **`submission-form.md`** — every dashboard field → final answer
3. **`images/`** — PNG assets that store needs

## Shared locked facts

| Item | Value |
| --- | --- |
| Privacy policy URL | https://github.com/antgraf/hearth-speed-dial/blob/main/docs/PRIVACY.md |
| Homepage | https://github.com/antgraf/hearth-speed-dial |
| Support | https://github.com/antgraf/hearth-speed-dial/issues |
| CWS category | **Functionality & UI** |
| Edge category | **Productivity** |
| AMO categories | **Bookmarks** + **Tabs** |
| Visibility | Public immediately (all regions / markets; AMO listed) |
| YouTube | Skip for v1 |
| Optional `tabs` API permission | Dropped (not in package) |
| Edge favicons | OK — keep site-icon bullets |

Repo privacy body: [docs/PRIVACY.md](../docs/PRIVACY.md).

## Assets are duplicated on purpose

Promo tiles and screenshots that several stores share are **copied** into each
`images/` folder (not symlinked), so each kit is upload-ready on its own.

| Asset | chrome/ | firefox/ | edge/ |
| --- | --- | --- | --- |
| Screenshots 01–05 @ 1280×800 | yes | yes | yes |
| Screenshot 06 (Add to Hearth) | — | — | yes (6th slot) |
| Small promo 440×280 | yes | — | yes |
| Marquee / large 1400×560 | yes | — | yes |
| CWS icon 128×128 | yes | — | — |
| AMO icons 32 + 64 | — | yes | — |
| Edge logo 300×300 | — | — | yes |

Total PNG payload under `promo/` is about 2 MB (fine for git).

## Owner leftovers (not in these kits)

Publisher display names, optional support email, and CWS account trader
declaration — fill from each store account at submit.
