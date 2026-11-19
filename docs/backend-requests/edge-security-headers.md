# Public intake pages: no third-party requests (XPAI-228)

Written for Sajjad (edge headers) and Amman (voice check), after the frontend
part of XPAI-228. It covers the headers we ask the edge to send, what the
frontend changed, the exceptions that need a decision, and what the intake
pages keep in the browser.

## 1. What the frontend now guarantees

Checked on a production build (`vite build` + `vite preview`) against tenant
`v2-test`, with the check below:

| Page | Hosts contacted |
|---|---|
| `/{slug}` (portal home) | our origin, `api.xposer.ai` |
| `/{slug}/{entity}` (entity portal) | our origin, `api.xposer.ai` |
| `/{slug}/submit-anonymous` ("Before you report", then the report) | our origin, `api.xposer.ai` |
| `/{slug}/track-report` | our origin, `api.xposer.ai` |
| `/{slug}/report-named` | our origin, `api.xposer.ai` |

Changes made for this:

- **Firebase SDK out of the intake bundle.** It is only loaded when someone
  signs in with a password, Google or Microsoft (the login screens), and on
  sign-out of such a session. Intake pages never download or start it.
- **No inline scripts.** The two first-paint scripts (language and theme)
  moved from `index.html` to `/boot.js`, so the policy below needs no
  `'unsafe-inline'` for scripts.
- **No Google Fonts.** The pricing and checkout pages loaded fonts from
  `fonts.googleapis.com`. They are bundled now. Every font is served from
  our origin.
- Every link that opens a new tab carries `rel="noopener noreferrer"`. There
  are no `<iframe>`s.

## 2. Headers for the edge (Sajjad)

Send these on every HTML response of the tenant app (the SPA serves the same
`index.html` for every route):

```
Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https://api.xposer.ai; font-src 'self' data:; connect-src 'self' https://api.xposer.ai; media-src 'self' blob:; worker-src 'self' blob:; frame-src 'none'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'
Referrer-Policy: no-referrer
Permissions-Policy: browsing-topics=(), interest-cohort=(), camera=(), geolocation=(), microphone=(self)
X-Content-Type-Options: nosniff
```

Notes on the differences from the header in the story:

- `style-src` keeps `'unsafe-inline'`. React's `style` attributes and the
  pricing pages' `<style>` blocks need it. Inline styles can't run code.
- `img-src` and `connect-src` include the tenant's API origin
  (`https://api.xposer.ai` today; use the in-region API host per deployment).
  Logos and attachments are read from it.
- `media-src` / `worker-src blob:` cover the voice recorder and the poster
  PDF generation, which work on in-memory data only.
- `interest-cohort` is obsolete; `browsing-topics=()` is its replacement.
  Both are listed. `microphone=(self)` keeps the voice channel working on our
  own origin.

The frontend check (§4) can enforce this exact policy on a build before it
is deployed: `npm run check:third-party -- --csp`. It passes on all intake
pages.

## 3. Exceptions that need a decision

These go outside our origin and API. They are **not** on the intake pages
above, or only when the reporter chooses them:

| What | Host | When | Owner |
|---|---|---|---|
| Voice channel | LiveKit Cloud, `wss://*.livekit.cloud` (from `VITE_LIVEKIT_URL`) | Only when the reporter starts a voice report | **Amman**: confirm the host and its region (story step 8). If allowed, add it to `connect-src` and `media-src`. If out of region, a decision for Shahab. |
| Downloading an attachment | Presigned storage URLs (S3) returned by `GET /reports/{n}/attachments/{key}` | When someone opens an uploaded file (track page, staff case page) | Backend: serve downloads through the API, or confirm the bucket is in region and add its host to `connect-src`/`img-src`. Uploads already go through our API. |
| Staff sign-in | `identitytoolkit.googleapis.com`, `securetoken.googleapis.com`, the Firebase auth domain | Only on `/login` and the other sign-in screens, never on intake pages | If the edge can tell routes apart, allow these on the sign-in routes only. Otherwise they must be in the policy for the whole app, and the intake pages are protected by the frontend instead. |
| Checkout | the payment provider's hosts | Only on `/{slug}/checkout` | Same as above. |

## 4. The automated check

`scripts/check-third-party.mjs`, run with `npm run check:third-party`:

1. **Static:** the built `index.html` and stylesheets reference no external
   URL.
2. **Runtime:** a headless Chrome at phone width opens each intake page,
   ticks "Before you report" and continues, and fails on any host other than
   our origin and the API. With `--csp` it also serves the pages with the
   policy above and fails on any violation.
3. **Storage:** it fails on any cookie, or any `localStorage` /
   `sessionStorage` key outside the list in §5.

Writes to the API are blocked by default, so the check never files a real
report. `--allow-writes` lets it go further, against a staging tenant only.

To run it in CI (there is no CI configuration in this repo yet):

```
npm ci
npm run build
npx vite preview --port 4173 &
CHECK_SLUG=<staging tenant slug> CHROME_PATH=<chromium path> npm run check:third-party -- --csp
```

It exits with 1 on any problem, so it blocks the merge.

## 5. What intake pages keep in the browser

No cookies. Nothing that identifies the reporter:

| Key | Where | What |
|---|---|---|
| `xposer-lang` | localStorage | Interface language, `en` or `ar` |
| `xposer-lang-chosen` | localStorage | Whether the language was picked by hand |
| `xposer-theme` | localStorage | `light` or `dark` |
| `xposer_*_tour_seen` | localStorage | Which guided tours were dismissed |
| `xposer-portal` | sessionStorage (this tab) | The portal address used (`/acme/insurance`), so the report keeps its entity |
| `xposer-sso-pending` | sessionStorage (this tab) | Only during company sign-in: where to return |

The "Before you report" acknowledgement (`content_hash`) is kept in page
memory only. A reporter who signs in to track a report gets a session
(`xposerai-auth`) for that report, as before; it is removed on sign-out.
