// src/utils/permissions.js
//
// The one source of truth for what a signed-in user may see.
//
// Roles are organization-defined in v2: an organization can rename, re-permission
// or invent roles, so a role code says nothing reliable about what its holder can
// do. Every access decision in the UI branches on a permission from
// GET /users/me → permissions[] instead. The server resolves those per request
// from the organization's own role document, so they are never in the token and
// never stale on the server side — only our cached copy can be.
//
// Hiding something here is a courtesy, not a control: every endpoint enforces the
// same permission server-side, so a stale tab still gets a 403.
import i18n from '../i18n';

/** The permissions an organization can assign. The catalog endpoint is the full list. */
export const PERM = {
  // Reports
  reportCreate: 'report:create',
  reportReadOwn: 'report:read_own',
  reportReadAll: 'report:read_all',
  reportReadAssigned: 'report:read_assigned',
  // Their own reports plus everyone at or below them in the reporting tree,
  // resolved through the account's linked directory entry. Unlinked, it falls
  // back to their own caseload — never to the whole organization.
  reportReadSubordinates: 'report:read_subordinates',
  reportUpdateAll: 'report:update_all',
  reportManage: 'report:manage',
  // Clearance for a case's confidentiality level, on top of access to it.
  reportReadConfidential: 'report:read_confidential',
  reportReadRestricted: 'report:read_restricted',
  // Answers marked sensitive in clear; every unmasked view is logged.
  reportReadSensitive: 'report:read_sensitive',

  // Messages
  messageCreate: 'message:create',
  messageReadOwn: 'message:read_own',
  messageReadInternal: 'message:read_internal',

  // Users
  userReadMe: 'user:read_me',
  userReadAll: 'user:read_all',
  userCreate: 'user:create',
  userUpdate: 'user:update',
  userDelete: 'user:delete',
  userManageRoles: 'user:manage_roles',
  userResetPassword: 'user:reset_password',

  // Report types
  reportTypeRead: 'report_type:read',
  reportTypeManage: 'report_type:manage',

  // Organization
  organizationRead: 'organization:read',

  // Reporting hierarchy
  hierarchyRead: 'org_hierarchy:read',
  hierarchyManage: 'org_hierarchy:manage',

  // AI agents
  agentRead: 'agent:read',
  agentManage: 'agent:manage',
  agentKbRead: 'agent:kb_read',
  agentSummaryRead: 'agent:summary_read',

  // Voice profile
  voiceProfileRead: 'voice_profile:read',
  voiceProfileManage: 'voice_profile:manage',

  // Legal entities (the companies a tenant is made of)
  entityRead: 'entity:read',
  entityManage: 'entity:manage',
  // Reporter portal addresses, branding and QR posters (XPAI-226/227).
  portalManage: 'portal:manage',
  // The tenant's defaults every legal entity inherits (XPAI-222).
  tenantManage: 'tenant:manage',
  // The entity admin's own entity: its branding, posters and settings
  // (XPAI-232). Only the fixed entity_admin role can hold it.
  entityManageOwn: 'entity:manage_own',
  // Routing rules: where cases go and their flags (XPAI-106). Admin only.
  routingManage: 'routing:manage',

  // Roles
  roleManage: 'role:manage',

  // System
  systemStats: 'system:stats',
};

/**
 * One line per permission, for the roles editor. The catalog endpoint supplies
 * which permissions exist, how they group and what each requires; this only
 * says what ticking one lets a person do. A permission missing here still
 * renders, under its code.
 */
const PERMISSION_INFO_EN = {
  'report:create': 'Submit reports',
  'report:read_own': 'Read reports they filed themselves',
  'report:read_all': 'Read every report in the organization',
  'report:read_assigned': 'Read reports assigned to them',
  'report:read_subordinates': "Read their team's reports — everyone below them in the hierarchy",
  'report:update_all': "Edit any report's details",
  'report:manage': 'Change status and priority, and assign reports',
  'report:read_confidential': 'See confidential cases',
  'report:read_restricted': 'See restricted cases',
  'report:read_sensitive': 'View sensitive answers',
  'message:create': 'Send messages on reports',
  'message:read_own': 'Read messages on their own reports',
  'message:read_internal': 'Read and write internal notes',
  'user:read_me': 'Read their own profile',
  'user:read_all': 'See every account in the organization',
  'user:create': 'Add users',
  'user:update': "Edit users and their sign-in method",
  'user:delete': 'Deactivate users',
  'user:manage_roles': 'Change which role a user has',
  'user:reset_password': "Reset other people's passwords",
  'report_type:read': 'View report types',
  'report_type:manage': 'Create and edit report types and voice questions',
  'organization:read': 'View organization settings',
  'org_hierarchy:read': 'View the reporting hierarchy',
  'org_hierarchy:manage': 'Edit hierarchy levels, the directory and the HR sync',
  'agent:read': 'View AI agents, workflows, runs and the knowledge base',
  'agent:manage': 'Configure AI agents, workflows and the knowledge base',
  'agent:kb_read': 'Consult policy documents (used by AI agents)',
  'agent:summary_read': "Read the AI summary on a report",
  'voice_profile:read': 'View the voice profile',
  'voice_profile:manage': 'Edit the voice profile',
  'entity:read': 'View the legal entities',
  'entity:manage': 'Add and edit legal entities',
  'role:manage': 'Create and edit roles — including their own',
  'system:stats': 'View organization statistics and analytics',
};

/** A line under a permission whose label alone doesn't say what it changes. */
const PERMISSION_HINTS_EN = {
  'report:read_confidential': 'Cases marked Confidential are hidden without this.',
  'report:read_restricted': 'Cases marked Restricted are hidden without this.',
  'report:read_sensitive':
    'Without this, answers marked PII, special category, financial or government ID show as ••••. Every unmasked view is logged.',
};

// The permission code as a translation key: `report:read_own` →
// `perm.report.read_own` in the `people` namespace (':' is i18next's
// namespace separator, so it can't stay in the key).
const permKey = (permission, kind) => `${kind}.${permission.replace(':', '.')}`;

// Same shape as before (code → text), but each value is a getter, so it
// reads in the current interface language whenever it's looked up.
const translatedTable = (english, kind) => {
  const table = {};
  for (const [code, text] of Object.entries(english)) {
    Object.defineProperty(table, code, {
      enumerable: true,
      get: () => i18n.t(permKey(code, kind), { ns: 'people', defaultValue: text }),
    });
  }
  return Object.freeze(table);
};

/** Permission code → what ticking it lets a person do, in the interface language. */
export const PERMISSION_INFO = translatedTable(PERMISSION_INFO_EN, 'perm');

/** Permission code → an explanatory line, in the interface language. */
export const PERMISSION_HINTS = translatedTable(PERMISSION_HINTS_EN, 'permHint');

/**
 * Ticks or unticks one permission. Ticking *See restricted cases* ticks *See
 * confidential cases* too — the server refuses one without the other.
 */
export const togglePermissionIn = (current, permission) => {
  const next = new Set(current);
  if (next.has(permission)) next.delete(permission);
  else {
    next.add(permission);
    if (permission === 'report:read_restricted') next.add('report:read_confidential');
  }
  return next;
};

/**
 * The words people see for a permission — "Submit reports", never
 * "report:create". Codes stay internal; one the table doesn't know yet is
 * turned into plain words rather than shown raw.
 */
export const permissionLabel = (permission) => {
  if (!permission) return '';
  if (PERMISSION_INFO[permission]) return PERMISSION_INFO[permission];
  const text = permission.replace(/[:_]/g, ' ').trim();
  return text.charAt(0).toUpperCase() + text.slice(1);
};

/** Several permissions in a sentence: “Read every report” or “Read reports assigned to them”. */
export const permissionLabels = (permissions = [], joiner) => {
  const sep = joiner ?? i18n.t('permJoin.or', { ns: 'people' });
  return permissions
    .map((permission) => i18n.t('permJoin.quoted', { ns: 'people', label: permissionLabel(permission) }))
    .join(sep);
};

/**
 * Access rules for the areas of the app. A rule is `{ all: [...] }`,
 * `{ any: [...] }`, or both — every permission in `all` and at least one in
 * `any`. Routes and the sidebar share these so a nav item can never point at a
 * page its holder would be turned away from.
 */
// Everything the reporter identity holds. A staff session holds something
// beyond these — note admin holds every permission, report:create included,
// so "has a reporter permission" would not tell staff apart.
const REPORTER_IDENTITY = new Set([
  PERM.reportCreate,
  PERM.reportReadOwn,
  PERM.reportTypeRead,
  PERM.messageCreate,
  PERM.messageReadOwn,
  PERM.userReadMe,
]);

export const ACCESS = {
  // Reports someone works on rather than filed themselves.
  caseReports: { any: [PERM.reportReadAll, PERM.reportReadSubordinates, PERM.reportReadAssigned] },
  orgOverview: { all: [PERM.systemStats, PERM.reportReadAll] },
  messagesInternal: { all: [PERM.messageReadInternal] },
  analytics: { all: [PERM.systemStats] },
  auditLogs: { all: [PERM.systemStats] },
  // Any staff account. The list is filtered server-side to the caller plus the
  // roles in their role's `viewable_roles` (admins see everyone); creating,
  // editing and resetting are admin-only and gated on the screen itself.
  // An entity admin (entity:manage_own) runs one entity's cases and portal
  // look, not the organization's people (ENTITY_ADMIN.md §2).
  users: { staff: true, none: [PERM.entityManageOwn] },
  team: { staff: true },
  // Reporters hold report_type:read too (to pick a type when filing), so
  // reading alone doesn't open the staff page: it also takes managing types
  // or working on other people's reports.
  reportTypes: {
    all: [PERM.reportTypeRead],
    any: [PERM.reportTypeManage, PERM.reportReadAll, PERM.reportReadSubordinates, PERM.reportReadAssigned],
  },
  reportTypesManage: { all: [PERM.reportTypeManage] },
  // The backend serves question sets to "Manager, Admin" — the pair that holds
  // report_type:manage by default.
  questionSets: { all: [PERM.reportTypeManage] },
  // Roles & Permissions — every role with its permissions, the catalog, the
  // access matrix — is admin only. Other staff get a trimmed role list
  // (names for labels and filters) from GET /org-roles/, nothing more.
  roles: { all: [PERM.roleManage] },
  // Role names for labels, pickers and filters: any staff account.
  roleNames: { staff: true },
  // Your account: everyone can change their password; only an admin can
  // change their own name or email.
  account: { staff: true },
  settings: { all: [PERM.organizationRead] },
  agents: { all: [PERM.agentRead] },
  agentsManage: { all: [PERM.agentRead, PERM.agentManage] },
  // Non-admins with org_hierarchy:read get the org chart (levels and people),
  // read-only, and nothing else; the rest of the section is admin only.
  // The organization's region and jurisdiction pack: any staff member reads packs.
  jurisdiction: { staff: true },
  // Legal entities: entity:manage requires entity:read.
  entities: { all: [PERM.entityRead] },
  entitiesManage: { all: [PERM.entityRead, PERM.entityManage] },
  // Portal addresses are tenant-admin only; branding and posters are also
  // open to an entity admin for their own entity (ENTITY_ADMIN.md §3).
  tenantSettings: { all: [PERM.tenantManage] },
  routingRules: { all: [PERM.routingManage] },
  portalAddresses: { all: [PERM.portalManage] },
  portalBranding: { any: [PERM.portalManage, PERM.entityManageOwn] },
  posters: { any: [PERM.portalManage, PERM.entityManageOwn] },
  // The entity admin role carries org_hierarchy:read for the backend's own
  // use, but the org chart isn't theirs to see (ENTITY_ADMIN.md §2).
  hierarchy: { all: [PERM.hierarchyRead], none: [PERM.entityManageOwn] },
  hierarchyAdmin: { all: [PERM.hierarchyManage] },
  voiceProfile: { all: [PERM.voiceProfileRead] },

  // The self-service reporter portal: only reporter accounts read their own
  // reports; no staff role carries this permission.
  reporterPortal: { all: [PERM.reportReadOwn] },
};

/** The permissions array for a user, tolerating a user object that predates v2. */
export const getPermissions = (user) =>
  Array.isArray(user?.permissions) ? user.permissions : [];

/**
 * True when `permissions` satisfies `rule`. A missing rule means no
 * requirement. `staff: true` asks for a staff session: some permission the
 * reporter identity doesn't have.
 */
export const satisfies = (permissions, rule) => {
  if (!rule) return true;
  const held = permissions instanceof Set ? permissions : new Set(permissions ?? []);
  const all = rule.all ?? [];
  const any = rule.any ?? [];
  const none = rule.none ?? [];
  if (none.some((p) => held.has(p))) return false;
  if (rule.staff && ![...held].some((p) => !REPORTER_IDENTITY.has(p))) return false;
  return all.every((p) => held.has(p)) && (any.length === 0 || any.some((p) => held.has(p)));
};

/** `satisfies`, reading the permissions off a user. */
export const userCan = (user, rule) => satisfies(getPermissions(user), rule);
