# Thumbnail fixtures (local promo mocks only)

Two fake, self-contained websites for capturing dial thumbnails for store promo
screenshots. All content is original fiction — no real trademarks, no real site
content, no network dependencies. Works fully offline.

| Page | Brand | URL |
|------|-------|-----|
| Hobby | Moss & Sprocket — backyard plant & tinker club | http://127.0.0.1:4173/ |
| Business | Northline Advisory — ops & analytics consulting | http://127.0.0.1:4174/ |

## Run on Windows (PowerShell)

From the repo root:

```powershell
.\promo\thumbnail-fixtures\serve.ps1
```

The script hosts both pages using only built-in PowerShell / .NET
(`HttpListener`) — nothing to install. It prints the two URLs and keeps
running until you press **Ctrl+C**.

If you only need one page, open just its URL; both are served by the same script.

## Capture flow

1. Run `serve.ps1`.
2. Bookmark `http://127.0.0.1:4173/` and `http://127.0.0.1:4174/`.
3. Capture thumbnails for the dials (desktop viewport ~1280×800 works best).
4. Ctrl+C in the PowerShell window to stop the servers.

These pages exist solely for local thumbnail capture and promo mocks. Do not
publish or link them as real sites.
