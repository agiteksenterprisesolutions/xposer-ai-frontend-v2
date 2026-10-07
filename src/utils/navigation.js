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
import { SET_PASSWORD_PATH, mustChangePassword } from './passwordPolicy';

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
 * The staff sidebar, in display order and grouped under `section` headings.
 * `access` is the same rule the matching route enforces. `name` also feeds the
 * sidebar's data-tour ids, which the dashboard tours target — rename with care.
 * The first page a user can open is their home page, so keep Dashboard first.
 */
export const STAFF_NAV = [
  // Day-to-day case work
  { section: 'Overview', name: 'Dashboard', icon: Home, path: 'dashboard', access: ACCESS.caseReports },
  { section: 'Overview', name: 'All Reports', icon: FileText, path: 'reports', access: ACCESS.caseReports },
  // What reporters fill in, by form or by voice
  { section: 'Reporting', name: 'Report Types', icon: Settings, path: 'report-types', access: ACCESS.reportTypes },
  { section: 'Reporting', name: 'Voice Questions', icon: ListChecks, path: 'question-sets', access: ACCESS.questionSets },
  { section: 'Reporting', name: 'Voice Profile', icon: AudioLines, path: 'voice-profile', access: ACCESS.voiceProfile },
  // How reports are handled once they arrive
  { section: 'AI & Automation', name: 'AI Agents', icon: Bot, path: 'agents', access: ACCESS.agents },
  { section: 'AI & Automation', name: 'Workflows', icon: GitBranch, path: 'workflows', access: ACCESS.agents },
  { section: 'AI & Automation', name: 'Summarizer', icon: ScrollText, path: 'summarizer', access: ACCESS.agents },
  { section: 'AI & Automation', name: 'Knowledge Base', icon: BookOpen, path: 'agent-kb', access: ACCESS.agents },
  { section: 'AI & Automation', name: 'AI Activity', icon: Activity, path: 'agent-runs', access: ACCESS.agents },
  // Who works here and what they may do
  { section: 'Organization', name: 'User Management', icon: Users, path: 'users', access: ACCESS.users },
  { section: 'Organization', name: 'Roles & Permissions', icon: ShieldCheck, path: 'roles', access: ACCESS.roles },
  { section: 'Organization', name: 'Reporting Hierarchy', icon: Network, path: 'hierarchy', access: ACCESS.hierarchy },
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

  // Nothing else loads until the default password is replaced.
  if (mustChangePassword(user)) return SET_PASSWORD_PATH;

  const [firstStaffPage] = staffNavFor(user);
  if (firstStaffPage) return staffPath(orgSlug, firstStaffPage.path);

  if (userCan(user, ACCESS.reporterPortal)) return reporterPath(orgSlug);

  return null;
};
