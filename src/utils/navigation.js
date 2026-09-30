// src/utils/navigation.js
//
// Where a signed-in user can go, derived from permissions.
//
// Staff no longer have per-role areas (/admin, /compliance, /reviewer): an
// organization's roles are its own, so there is one staff area at
// /:orgSlug/staff and each page in it is shown to whoever holds the permission
// that page needs. The reporter portal stays at /:orgSlug/reporter.
import {
  Home,
  FileText,
  Users,
  Settings,
  ShieldCheck,
  Bot,
  BookOpen,
  Activity,
  ListChecks,
  AudioLines,
  ScrollText,
  GitBranch,
  Network,
} from 'lucide-react';
import { ACCESS, userCan } from './permissions';

export const STAFF_AREA = 'staff';
export const REPORTER_AREA = 'reporter';

const orgBase = (orgSlug) => (orgSlug ? `/${orgSlug}` : '');

/** `/acme/staff/reports`, from `staffPath('acme', 'reports')`. */
export const staffPath = (orgSlug, subPath = 'dashboard') =>
  `${orgBase(orgSlug)}/${STAFF_AREA}/${subPath}`.replace(/\/+$/, '');

/** `/acme/reporter/reports`, from `reporterPath('acme', 'reports')`. */
export const reporterPath = (orgSlug, subPath = 'dashboard') =>
  `${orgBase(orgSlug)}/${REPORTER_AREA}/${subPath}`.replace(/\/+$/, '');

/** Where a report someone is working on opens. */
export const casePath = (orgSlug, reportId) => staffPath(orgSlug, `cases/${reportId}`);

/**
 * The staff sidebar, in display order. `access` is the same rule the matching
 * route enforces. `name` also feeds the sidebar's data-tour ids, which the
 * dashboard tours target — rename with care.
 */
export const STAFF_NAV = [
  { name: 'Dashboard', icon: Home, path: 'dashboard', access: ACCESS.caseReports },
  { name: 'All Reports', icon: FileText, path: 'reports', access: ACCESS.caseReports },
  { name: 'Report Types', icon: Settings, path: 'report-types', access: ACCESS.reportTypes },
  { name: 'User Management', icon: Users, path: 'users', access: ACCESS.users },
  { name: 'Roles & Permissions', icon: ShieldCheck, path: 'roles', access: ACCESS.roles },
  { name: 'Reporting Hierarchy', icon: Network, path: 'hierarchy', access: ACCESS.hierarchy },
  { name: 'AI Agents', icon: Bot, path: 'agents', access: ACCESS.agents },
  { name: 'Summarizer', icon: ScrollText, path: 'summarizer', access: ACCESS.agents },
  { name: 'Workflows', icon: GitBranch, path: 'workflows', access: ACCESS.agents },
  { name: 'Knowledge Base', icon: BookOpen, path: 'agent-kb', access: ACCESS.agents },
  { name: 'Voice Questions', icon: ListChecks, path: 'question-sets', access: ACCESS.questionSets },
  { name: 'Voice Profile', icon: AudioLines, path: 'voice-profile', access: ACCESS.voiceProfile },
  { name: 'AI Activity', icon: Activity, path: 'agent-runs', access: ACCESS.agents },
];

/** The staff nav items this user may open. */
export const staffNavFor = (user) => STAFF_NAV.filter((item) => userCan(user, item.access));

/** True when the user can open at least one page in the staff area. */
export const hasStaffAccess = (user) => staffNavFor(user).length > 0;

/**
 * The page a signed-in user lands on: the first staff page they can open, else
 * the reporter portal, else nothing. `null` means the account holds no
 * permission that opens any page — the caller shows a "no access" state rather
 * than redirecting, which would loop.
 */
export const getHomePath = (user) => {
  if (!user) return null;
  const orgSlug = user.organization_slug;

  if (user.is_anonymous) return `${orgBase(orgSlug)}/track-report`;

  const [firstStaffPage] = staffNavFor(user);
  if (firstStaffPage) return staffPath(orgSlug, firstStaffPage.path);

  if (userCan(user, ACCESS.reporterPortal)) return reporterPath(orgSlug);

  return null;
};
