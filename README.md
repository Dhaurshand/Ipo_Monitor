# IPO Monitor

Multi-account IPO tracker (IPOs, accounts, applications, portfolio) with **live IPO
details fetched automatically** instead of typed in by hand.

## Run

```bash
npm start
```

Then open <http://localhost:5173>. No dependencies — Node 18+ only.

Opening `public/index.html` directly (`file://`) still works, but live fetching and
cloud storage are disabled there: browsers can't call NSE cross-origin, which is
exactly why the tiny server exists.

## Layout

```
Ipo_Monitor/
├─ package.json          npm start → server/index.js
├─ firestore.rules       security rules for the cloud copy
├─ public/               everything the browser loads
│  ├─ index.html         markup only
│  ├─ styles.css
│  ├─ firebase-config.js your Firebase project (edit this)
│  └─ js/
│     ├─ store.js        db object, localStorage, seed data
│     ├─ helpers.js      formatting, metrics, $()
│     ├─ ui.js           tab nav + modal open/close
│     ├─ dashboard.js    KPIs, GMP movers, ticker
│     ├─ ipos.js         IPO cards, add/edit/delete
│     ├─ accounts.js     account cards
│     ├─ applications.js application form + table
│     ├─ portfolio.js    per-account totals
│     ├─ live-sync.js    talks to /api/ipos, merges results
│     ├─ cloud.js        Firebase auth + Firestore sync (ES module)
│     └─ app.js          renderAll() + startup
└─ server/
   ├─ index.js           HTTP server, static files, /api/ipos, cache
   ├─ lib/fetch.js       fetch wrapper + concurrency cap
   ├─ lib/normalize.js   text/number/date parsing
   └─ providers/
      ├─ nse.js          NSE India
      └─ gmp.js          grey market premium
```

The browser scripts are plain (non-module) and share globals deliberately — the
markup uses inline `onclick` handlers, so load order in `index.html` matters:
helpers first, `app.js` last.

## How live fetching works

`server/index.js` exposes `GET /api/ipos`:

| Source | Provides |
| --- | --- |
| NSE India — `/api/ipo-current-issue` + `/api/all-upcoming-issues` | company name, symbol, price band, open/close dates, status, live subscription (× times) |
| NSE India — `/api/ipo-detail?symbol=…` (one call per IPO) | lot size, face value, registrar, and band/dates for SME issues the list feed leaves blank |
| GMP tracker (InvestorGain, Chittorgarh fallback) | grey market premium and estimated listing price |

- NSE needs a cookie handshake, so the server loads the HTML page first and reuses the cookies.
- Detail calls run 5 at a time; a symbol that fails just loses its lot size.
- Both sources are fetched in parallel; if one fails the other still renders, and the failure is reported in the sync bar.
- Results are merged by a normalised company name (`Nova Industries Ltd.` → `novaindustries`), cached for 5 minutes, and the last good payload is served if every source goes down.
- Status is derived from the dates when the source doesn't state it.

`GET /api/ipos?refresh=1` bypasses the cache (that's what the **⟳ Fetch live IPOs** button sends).

## Storage — Firebase (Firestore)

Data lives in **one Firestore document per user**, `ipoMonitor/{uid}`, holding
`ipos`, `accounts` and `applications`. localStorage is kept as a mirror, so the app
works before Firebase connects, while offline, and if you never configure Firebase
at all.

### Setup

1. [Firebase console](https://console.firebase.google.com) → create a project.
2. Project settings → Your apps → Web (`</>`) → register → copy the `firebaseConfig`.
3. Paste it into [public/firebase-config.js](public/firebase-config.js) (replace `window.FIREBASE_CONFIG = null;`).
4. Build → **Firestore Database** → create database.
5. Build → **Authentication** → Sign-in method → enable **Anonymous** (required) and
   **Email/Password** (only if you want multi-device access).
6. Publish the rules from [firestore.rules](firestore.rules):

```bash
firebase deploy --only firestore:rules
```

or paste them into console → Firestore → Rules → Publish.

Reload the page; the second status bar shows `Cloud: anonymous (ab12c3…) · synced`.

### How it behaves

- **Anonymous by default** — no login prompt; the account is tied to this browser.
- **Sign in** (button in the cloud bar) links an email to that anonymous account, so
  the data you already have carries over and other devices see the same document.
  Signing in with an email that already has data adopts that cloud copy instead.
- **Realtime** — `onSnapshot` pushes changes from any other device/tab into the page.
- **Writes are debounced** 500 ms, so a burst of edits is a single document write.
- **Offline** — Firestore's persistent cache queues writes and flushes on reconnect.
- **Conflicts** — last write wins; the doc is small and per-user, so this is fine.
- Config values in `public/firebase-config.js` are identifiers, not secrets. Access is
  enforced by `firestore.rules`, which limits every user to their own document.

## Merge rules in the browser

Fetched IPOs land in the same database as manual ones (Firestore when configured,
localStorage otherwise):

- **New IPO** → added with `source: "live"` and a `live` badge.
- **Existing live IPO** → market fields (band, lot, dates, status, GMP) refreshed; your `currentPrice` is never touched.
- **Manually added IPO** matched by name → only empty fields are filled, plus GMP. Your edits win.

Auto-refresh runs every 5 minutes and can be switched off with the `auto` checkbox in the sync bar.

## Caveats

- The upstream endpoints are public but undocumented. If one changes shape or starts
  blocking, the sync bar names the source that failed and manual entry keeps working.
- The GMP trackers sit behind bot protection that some networks/ISPs reject outright
  (this happened on the machine where the feature was built — NSE returned all 11 live
  IPOs, the GMP host refused the connection). When GMP is unavailable, cards show
  `GMP — not available` and you can still type a value in yourself.
- GMP is unofficial and indicative only; it does not predict the listing price.
