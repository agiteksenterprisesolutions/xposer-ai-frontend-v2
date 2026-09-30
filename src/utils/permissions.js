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

/** All 29 permissions an organization can assign. */
export const PERM = {
  // Reports
  reportCreate: 'report:create',
  reportReadOwn: 'report:read_own',
  reportReadAll: 'report:read_all',
  reportReadAssigned: 'report:read_assigned',
  reportUpdateAll: 'report:update_all',
  reportDeleteAll: 'report:delete_all',
  reportManage: 'report:manage',

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
export const PERMISSION_INFO = {
  'report:create': 'Submit reports',
  'report:read_own': 'Read reports they filed themselves',
  'report:read_all': 'Read every report in the organization',
  'report:read_assigned': 'Read reports assigned to them',
  'report:update_all': "Edit any report's details",
  'report:delete_all': 'Delete reports',
  'report:manage': 'Change status and priority, and assign reports',
  'message:create': 'Send messages on reports',
  'message:read_own': 'Read messages on their own reports',
  'message:read_internal': 'Read and write internal notes',
  'user:read_me': 'Read their own profile',
  'user:read_all': 'See everyone in the organization',
  'user:create': 'Add users',
  'user:update': "Edit users and their sign-in method",
  'user:delete': 'Deactivate users',
  'user:manage_roles': 'Change which role a user has',
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
  'role:manage': 'Create and edit roles — including their own',
  'system:stats': 'View organization statistics and analytics',
};

/**
 * Access rules for the areas of the app. A rule is `{ all: [...] }`,
 * `{ any: [...] }`, or both — every permission in `all` and at least one in
 * `any`. Routes and the sidebar share these so a nav item can never point at a
 * page its holder would be turned away from.
 */
export const ACCESS = {
  // Reports someone works on rather than filed themselves.
  caseReports: { any: [PERM.reportReadAll, PERM.reportReadAssigned] },
  orgOverview: { all: [PERM.systemStats, PERM.reportReadAll] },
  messagesInternal: { all: [PERM.messageReadInternal] },
  analytics: { all: [PERM.systemStats] },
  auditLogs: { all: [PERM.systemStats] },
  users: { all: [PERM.userReadAll] },
  team: { all: [PERM.userReadAll] },
  reportTypes: { all: [PERM.reportTypeRead] },
  reportTypesManage: { all: [PERM.reportTypeManage] },
  // The backend serves question sets to "Manager, Admin" — the pair that holds
  // report_type:manage by default.
  questionSets: { all: [PERM.reportTypeManage] },
  roles: { all: [PERM.roleManage] },
  settings: { all: [PERM.organizationRead] },
  agents: { all: [PERM.agentRead] },
  agentsManage: { all: [PERM.agentRead, PERM.agentManage] },
  hierarchy: { all: [PERM.hierarchyRead] },
  voiceProfile: { all: [PERM.voiceProfileRead] },

  // The self-service reporter portal: only reporter accounts read their own
  // reports; no staff role carries this permission.
  reporterPortal: { all: [PERM.reportReadOwn] },
};

/** The permissions array for a user, tolerating a user object that predates v2. */
export const getPermissions = (user) =>
  Array.isArray(user?.permissions) ? user.permissions : [];

/** True when `permissions` satisfies `rule`. A missing rule means no requirement. */
export const satisfies = (permissions, rule) => {
  if (!rule) return true;
  const held = permissions instanceof Set ? permissions : new Set(permissions ?? []);
  const all = rule.all ?? [];
  const any = rule.any ?? [];
  return all.every((p) => held.has(p)) && (any.length === 0 || any.some((p) => held.has(p)));
};

/** `satisfies`, reading the permissions off a user. */
export const userCan = (user, rule) => satisfies(getPermissions(user), rule);
