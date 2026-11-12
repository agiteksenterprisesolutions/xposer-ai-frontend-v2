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
