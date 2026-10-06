# Microsoft Edge Add-ons — submission form checklist

Every field → final answer for the first public listing. Paste blocks live in
[listing-copy.md](listing-copy.md).

**Package:** same Chromium zip as CWS — `artifacts/hearth-speed-dial-chrome-v0.3.0.zip`  
**Privacy URL:** https://github.com/antgraf/hearth-speed-dial/blob/main/docs/PRIVACY.md

---

## Availability

| Field | Answer |
| --- | --- |
| Visibility | **Public** |
| Markets | All markets (default) |

---

## Properties

| Field | Answer |
| --- | --- |
| Category | **Productivity** |
| Website | `https://github.com/antgraf/hearth-speed-dial` |
| Support contact detail | `https://github.com/antgraf/hearth-speed-dial/issues` |
| Mature content | Unchecked |

---

## Privacy

| Field | Answer |
| --- | --- |
| Single purpose | Paste from listing-copy.md |
| Permission justification (each) | Paste from listing-copy.md — includes `favicon` |
| Are you using remote code? | **No** (+ short paste if asked) |
| Data types collected | **All unchecked** (same as CWS) |
| Certifications | **Check all three** (same Limited Use set as CWS) |
| Privacy policy URL | `https://github.com/antgraf/hearth-speed-dial/blob/main/docs/PRIVACY.md` |

Data-type checkboxes (leave unchecked): PII, health, financial, auth, personal communications, location, web history, user activity, website content.  
Fallback if a reviewer cites CWS-style FAQ Q3: same Website content fallback as Chrome (`listing-copy.md` / Chrome form).

---

## Store listing — `en-US`

| Field | Answer |
| --- | --- |
| Extension name | From package (read-only): `Hearth Speed Dial` |
| Short description | From package (read-only): manifest `ext_description` |
| Description | Paste from listing-copy.md (3,223 chars) |
| Extension logo | `images/hearth-edge-logo-300x300.png` (300×300) |
| Small promotional tile | `images/hearth-promo-small-440x280.png` (recommended) |
| Large promotional tile | `images/hearth-promo-marquee-1400x560.png` (include) |
| Screenshots (≤6) | `images/` 01–06 @ 1280×800 |
| YouTube video URL | **Leave empty** (skipped for v1) |
| Search terms | 7 terms from listing-copy.md |

---

## Submit

| Field | Answer |
| --- | --- |
| Notes for certification | Paste from listing-copy.md |

---

## Images upload checklist

- [ ] `hearth-edge-logo-300x300.png`
- [ ] Screenshots 01–06 @ 1280×800
- [ ] `hearth-promo-small-440x280.png`
- [ ] `hearth-promo-marquee-1400x560.png`

---

## Owner leftovers (at submit)

- Partner Center Edge developer registration (MSA)  
- Publisher display name on the account  
- Full Edge smoke before upload (`.\launch-edge.ps1`)  
