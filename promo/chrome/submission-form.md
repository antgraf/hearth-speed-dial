# Chrome Web Store — submission form checklist

Every field → final answer for the first public listing. Confirm labels in the
live dashboard if wording drifts. Paste blocks live in [listing-copy.md](listing-copy.md).

**Package:** `artifacts/hearth-speed-dial-chrome-v0.3.0.zip` (tag after smoke)  
**Privacy URL:** https://github.com/antgraf/hearth-speed-dial/blob/main/docs/PRIVACY.md

---

## Store listing tab

| Field | Answer |
| --- | --- |
| Product name | From package: `Hearth Speed Dial` |
| Short description | From package: `New-tab speed dial of your bookmark tree — nested folders, local pictures, browser sync. No account.` |
| Detailed description | Paste from listing-copy.md (3,221 chars) |
| Category | **Functionality & UI** (Make Chrome Yours) |
| Language | English |
| Store icon 128×128 | `images/hearth-cws-icon-128x128.png` |
| Screenshots (≤5) | `images/hearth-screenshot-01` … `05` @ 1280×800 |
| Small promo tile 440×280 | `images/hearth-promo-small-440x280.png` (**required**) |
| Marquee promo 1400×560 | `images/hearth-promo-marquee-1400x560.png` (include) |
| Global promo video / YouTube | **Leave empty** (skipped for v1) |
| Official URL | Leave unset (needs Search Console–verified site) |
| Homepage URL | `https://github.com/antgraf/hearth-speed-dial` |
| Support URL | `https://github.com/antgraf/hearth-speed-dial/issues` |
| Mature content | Unchecked |

---

## Privacy practices tab

| Field | Answer |
| --- | --- |
| Single purpose | Paste from listing-copy.md |
| Justification — `bookmarks` | Paste from listing-copy.md |
| Justification — `storage` | Paste from listing-copy.md |
| Justification — `unlimitedStorage` | Paste from listing-copy.md |
| Justification — `favicon` | Paste from listing-copy.md |
| Justification — `contextMenus` | Paste from listing-copy.md |
| Justification — `activeTab` | Paste from listing-copy.md |
| Justification — optional hosts | Paste combined host block from listing-copy.md |
| Remote code | **No, I am not using remote code.** (+ short paste if a box appears) |
| Data types collected | **All unchecked** (see table below) |
| Limited Use certifications | **Check all three** |
| Privacy policy URL | `https://github.com/antgraf/hearth-speed-dial/blob/main/docs/PRIVACY.md` |

### Data types — leave unchecked

| Data type | Answer |
| --- | --- |
| Personally identifiable information | ☐ |
| Health information | ☐ |
| Financial and payment information | ☐ |
| Authentication information | ☐ |
| Personal communications | ☐ |
| Location | ☐ |
| Web history | ☐ |
| User activity | ☐ |
| Website content | ☐ |

### Certifications — check all

- ☑ I do not sell or transfer user data to third parties, outside of the approved use cases  
- ☑ I do not use or transfer user data for purposes that are unrelated to my item's single purpose  
- ☑ I do not use or transfer user data to determine creditworthiness or for lending purposes  

**Fallback only if a reviewer cites User Data FAQ Q3:** tick **Website content** (and **Web history** only if asked). Then add this sentence to the policy Summary:

```text
For store disclosure purposes: Hearth handles website content (screenshots and images you ask for) and the title and address of pages you add, on your device only. None of it is transmitted.
```

---

## Distribution tab

| Field | Answer |
| --- | --- |
| Payments | Free |
| Visibility | **Public** |
| Regions | All regions |
| Publish automatically after review | Leave **on** (public immediately) |

---

## Test instructions tab (optional)

Paste from listing-copy.md, or leave empty (CWS says this is mainly for logins).

---

## Images upload checklist

- [ ] `hearth-cws-icon-128x128.png` (128×128)
- [ ] Screenshots 01–05 @ 1280×800
- [ ] `hearth-promo-small-440x280.png`
- [ ] `hearth-promo-marquee-1400x560.png`

---

## Owner leftovers (at submit)

- Publisher / account display name  
- CWS contact email verified  
- Trader / non-trader declaration in Account settings  
