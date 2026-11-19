# Xposer frontend (v2): tenant app

The main Xposer web app: reporters file reports, and staff and admins of one
organization (tenant) handle them. React 18, Vite, Tailwind v4, Zustand,
react-router v6.

## Related project: the super-admin panel

`../xposer-superadmin` (`/home/wa/xposer-superadmin`) is a **separate app and
repo** for platform administration: creating tenants, their users,
jurisdiction packs and sector packs (epic XPAI-65). It's deployed separately.

How the two relate:

| | This app (tenant) | `../xposer-superadmin` |
|---|---|---|
| Users | Reporters, an organization's staff and admins | Super admins only (`role: super_admin`) |
| Backend | `VITE_API_URL` = `https://api.xposer.ai/v2` (the "W" service) | `VITE_SA_API_URL` = `https://api.xposer.ai/sa` (the "S" service) |
| API spec | `https://api.xposer.ai/v2/openapi.json` | `https://api.xposer.ai/sa/openapi.json` |
| Session key | `xposerai-auth` | `xposer-sa-auth` |
| Dev port | 5173 | 5174 |

- **Shared data, separate code.** Both backends read the same database. An
  organization created in the panel is the tenant this app serves, and a
  sector pack installed there becomes this app's report types.
- **Shared look, copied not linked.** The panel has copies of this app's design
  tokens (`src/App.css`, `src/index.css`), `src/store/themeStore.js`,
  `src/components/brand/XposerLogo.jsx` and the UI components in
  `src/components/ui/` (Button, Card, Badge, Input, Skeleton, Table, Pagination,
  Alert, ThemeToggle, Modal). When you change one of those here in a way the
  panel should also get, copy it across and say so. Both apps use the theme key
  `xposer-theme`.
- **Never import across the two repos.** Neither app may import code from the
  other or call the other's backend.
- **Which app for a frontend guide?** The backend team's guides
  (`FRONTEND_GUIDE.md`, epic XPAI-65) mark endpoints **W** (`/v2`, this app) or
  **S** (`/sa`, the panel). Work on **S** goes in the panel; work on **W** goes
  here.

To get the panel's context, read `../xposer-superadmin/CLAUDE.md` and its
`README.md`, then `src/api/sa.js` (every endpoint it calls).

## Working in this repo

- Check request and response shapes against the live `openapi.json`, not the
  guides. Some schemas are missing from the spec, so fall back to a live GET.
- **Permissions:** the UI branches on `permissions[]` from `GET /users/me`
  (`src/utils/permissions.js`, `PERM` and `ACCESS`, `useCan`). Never branch on
  role names, because organizations rename and add roles.
- **API layer:** `src/api/*.js`. The axios client is `src/api/axios.js`.
  `skipErrorToast` / `quiet` stops the global toast where a screen shows the
  error itself. Error text comes from `src/utils/errors.js` (`describeError`,
  `errorSummary`).
- **Builds and checks:** `npx vite build` works. ESLint isn't usable in this
  repo. For UI checks, a headless Chrome via `playwright-core` (with
  `/usr/bin/google-chrome`) in the session scratchpad works well.
- **Test accounts:** the user supplies them per session. Pass them only as
  environment variables to a test command. Never write them into files,
  memory or code.
- **Live backends:** `api.xposer.ai` is shared with real demo tenants. Reading
  is fine. Ask before creating, changing or deleting data there.
- **Git:** the remote is `XPOSER-AI-FRONTEND-V2`. Commit only when asked.

## Accessibility (WCAG 2.2 AA)

The app passes WCAG 2.2 AA on the automated checks (axe-core) and a keyboard
pass. Keep it there:

- **Colours:** use the theme tokens (`text-ink-*`, `text-link`, `bg-subtle`, …),
  never fixed Tailwind greys or blues; those fail contrast in dark mode.
  `text-ink-subtle` is the lightest colour allowed for text.
- **Dialogs:** use `components/ui/Modal` (or `layout/Modal`). A hand-built
  overlay must call `useDialogFocus(ref, isOpen)` (`src/hooks/useDialogFocus.js`)
  and carry `role="dialog" aria-modal="true"` and a label.
- **Links that look like buttons:** `<Button to="/path">`, never a `<Button>`
  inside a `<Link>`.
- **Clickable rows:** pass `onClick` to `Table.Row`; it is keyboard-operable.
  Don't put `onClick` on a plain `div`/`tr` yourself.
- **Fields:** every input, select and textarea needs a label (the shared
  `Input`/`Select`/`Textarea` do this, and link their error text). Option
  groups (radios, checkboxes) need `role="group"`/`"radiogroup"` with
  `aria-labelledby`. Icon-only buttons need `aria-label`; click targets are at
  least 24×24 px.
- **Personal data fields** (the user's own name, email, phone, password) get
  `autoComplete`. Fields about someone else don't.
- **Arabic text** gets `lang="ar" dir="rtl"`.
- **Page structure:** layouts render a skip link and `#main-content`;
  `RouteAnnouncer` adds a hidden `<h1>` when a page has none and moves focus to
  it on navigation.

## Languages (English and Arabic)

The whole tenant app (reporter, staff and admin screens) is translated with
react-i18next. The backend still sends some text in English only (error
messages, coverage and routing reasons, role descriptions); that needs
backend support (requests already send `Accept-Language`).

- **Text:** `src/locales/<lang>/<namespace>.json`. Files are picked up
  automatically (`src/i18n/index.js`). Namespaces: `common` (shared: nav,
  staff menu, buttons, statuses, errors, password rules), reporter side
  `public`, `submit`, `form`, `track`, `chat`, `reporter`; staff side
  `dashboards`, `cases`, `reportTypes`, `builder`, `people`, `hierarchy`,
  `agents`, `admin` (workflows, settings, audit log, jurisdiction, entities). Add a namespace by adding the same file under `en/` and `ar/`.
- **In code:** `const { t } = useTranslation('submit')`, then `t('picker.title')`.
  Outside components use `i18n.t(...)` at call time, never at module load (it
  wouldn't follow a language change). Interpolate with `{{name}}`; don't glue
  translated fragments together. Counts use i18next plurals (Arabic has
  `_zero _one _two _few _many _other`). Inline links/bold use `<Trans>`.
- **Don't translate content:** report types, questions, pack text and anything
  people wrote comes from the API as written. Give such text `dir="auto"` when
  it can be in either language.
- **Check:** `node scripts/check-i18n.mjs` (English and Arabic have the same
  keys, every key the code uses exists, no `<Trans>` tag named after an HTML
  void element: `<link>`/`<br>` lose their content, use `<lnk>`).
- **Shared label lists** (statuses, tiers, permissions, agent kinds) read their
  text through getters or functions (`noTypeLabel()`, `codeHint()`), so
  importers get the current language. Don't turn them back into constants.
- **Values saved to the API never change with the language.** Tour targets
  (`data-tour`) also stay English-derived.
- **Right-to-left:** `<html dir>` follows the language. Use logical Tailwind
  classes only: `ms-/me-`, `ps-/pe-`, `start-/end-`, `text-start/end`,
  `border-s/e`, `rounded-s/e`. Never `ml-`, `pr-`, `left-`, `text-left` etc.
  (exception: `left-1/2 -translate-x-1/2` centring, which is symmetric).
  Arrow and chevron icons flip automatically (`App.css`).
- **Formatting:** dates and money go through `src/utils/locale.js`
  (`intlLocale()`, `dateFnsLocale()`) or the shared `formatDate` helpers.
  Arabic uses Western digits (`ar-u-nu-latn`).
- **Language choice:** stored as `xposer-lang` in localStorage; `index.html`
  sets `lang`/`dir` before first paint. Requests send `Accept-Language`.
- **The super-admin panel** stays English-only. The shared UI components here
  now call `useTranslation`. When copying one across, strip that back out.
- **Arabic copy is machine-drafted** until a human reviewer signs it off. Legal
  and anonymity wording especially needs review.
