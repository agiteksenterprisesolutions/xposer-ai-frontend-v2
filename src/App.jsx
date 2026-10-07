import { useEffect } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation, useParams } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
// App.css is imported by index.css so Tailwind can read its tokens in @theme
// import Home from './pages/public/Home'
import Login from './pages/public/Login'
// import Register from './pages/public/Register'
import ForgetPassword from './pages/public/ForgetPassword'
import SubmitAnonymous from './pages/public/SubmitAnonymous'
import TrackReport from './pages/public/TrackReport'
import ReportDetails from './pages/public/ReportDetails'
import EditAnonymousDraft from './pages/public/EditAnonymousDraft'

// Reporter pages
import ReporterDashboard from './pages/reporter/Dashboard'
import SubmitReport from './pages/reporter/SubmitReport'
import MyReports from './pages/reporter/MyReports'
import ReportDetail from './pages/reporter/ReportDetail'
import EditDraftReport from './pages/reporter/EditDraftReport'
import Messages from './pages/reporter/Messages'

// Staff pages — one area, each page gated on the permission it needs
import StaffDashboard from './pages/staff/Dashboard'
import AllReports from './pages/compliance/AllReports'
import MyCases from './pages/compliance/MyCases'
import Team from './pages/compliance/Team'
import Analytics from './pages/compliance/Analytics'
import CaseDetail from './pages/compliance/CaseDetail'
import ComplianceMessages from './pages/compliance/Messages'

import ReportTypes from './pages/admin/ReportTypes'
import Users from './pages/admin/Users'
import Settings from './pages/admin/Settings'
import AuditLogs from './pages/admin/AuditLogs'
import CreateReportType from './pages/admin/CreateReportType'
import EditReportType from './pages/admin/EditReportType'
import ViewReportType from './pages/admin/ViewReportType'
import Workflows from './pages/admin/Workflows'
import WorkflowEditor from './pages/admin/WorkflowEditor'
import Agents from './pages/admin/Agents'
import Summarizer from './pages/admin/Summarizer'
import Hierarchy from './pages/admin/Hierarchy'
import KnowledgeBase from './pages/admin/KnowledgeBase'
import AgentActivity from './pages/admin/AgentActivity'
import QuestionSets from './pages/admin/QuestionSets'
import VoiceProfile from './pages/admin/VoiceProfile'
import ChangePassword from './pages/reporter/ChangePassword'
import SetPassword from './pages/auth/SetPassword'

import ProtectedRoute from './components/auth/ProtectedRoute'
import AnonymousOnlyRoute from './components/auth/AnonymousOnlyRoute'
import MainLayout from './MainLayout'
import PrivacyPolicy from './pages/public/PrivacyPolicy'
import TermsConditions from './pages/public/TermsConditions'
import CookiePolicy from './pages/public/CookiePolicy'
import Compliance from './pages/public/Compliance'
import Security from './pages/public/Security'
import Help from './pages/public/HelpCenter'
import HowToUse from './pages/public/HowToUse'
import PublicLayout from './components/layout/PublicLayout'
import AdminLayout from './components/layout/AdminLayout'
import DashboardLayout from './components/layout/DashboardLayout'
import Roles from './pages/admin/Roles'
import { useAuthStore } from './store/authStore'
import Home from './pages/public/Home'
import Pricing from './pages/public/Pricing'
import Checkout from './pages/public/Checkout'
import Contact from './pages/public/Contact'
import { ToastContainer } from 'react-toastify'
import SEO from './components/seo/SEO'
import { RequireAccess } from './components/auth/ProtectedRoute'
import { ACCESS } from './utils/permissions'
import { hasStaffAccess, STAFF_AREA } from './utils/navigation'

// v1 had one area per fixed role. Bookmarks and emailed links into them land
// on the same page in the staff area, where the page's own permission applies.
const LegacyStaffRedirect = () => {
  const { orgSlug, '*': rest } = useParams();
  const { search, hash } = useLocation();
  return <Navigate to={`/${orgSlug}/${STAFF_AREA}/${rest || 'dashboard'}${search}${hash}`} replace />;
};

// Shorthand for a staff page that needs `access`.
const gate = (access, element) => <RequireAccess access={access}>{element}</RequireAccess>;

function App() {
  // Permissions are resolved per request on the server; the copy persisted
  // with the session may predate a role edit, so refetch it on every start.
  useEffect(() => {
    useAuthStore.getState().refreshUser();
  }, []);

  return (
    <Router>
      {/* Site-wide defaults; any <SEO /> mounted inside a page overrides these. */}
      <SEO />
      <Routes>
        {/* Outside every layout: an account on its default password can call
            nothing else, so nothing else may render around it. */}
        <Route path="/set-password" element={<SetPassword />} />

        <Route path="/" element={<PublicLayout />}>
          <Route index element={<Home />} />
          <Route path="login" element={<Login />} />
          <Route path="pricing" element={<Pricing />} />
          {/* <Route path="register" element={<Register />} /> */}
          <Route path="forget-password" element={<ForgetPassword />} />
          <Route path="privacy" element={<PrivacyPolicy />} />
          <Route path="terms" element={<TermsConditions />} />
          <Route path='cookie-policy' element={<CookiePolicy />} />
          <Route path='compliance' element={<Compliance />} />
          <Route path='security' element={<Security />} />
          <Route path='help' element={<Help />} />
          <Route path='how-to-use' element={<HowToUse />} />
          <Route path="track-report" element={<TrackReport />} />
          <Route path="pricing" element={<Pricing />} />
          <Route path="checkout" element={<Checkout />} />
          <Route path="contact" element={<Contact />} />
        </Route>

        <Route path="/:orgSlug" element={<PublicLayout />}>
          <Route index element={<Home />} />
          <Route path="login" element={<Login />} />
          <Route path="pricing" element={<Pricing />} />
          {/* <Route path="register" element={<Register />} /> */}
          <Route path="forget-password" element={<ForgetPassword />} />
          <Route path="privacy" element={<PrivacyPolicy />} />
          <Route path="terms" element={<TermsConditions />} />
          <Route path='cookie-policy' element={<CookiePolicy />} />
          <Route path='compliance' element={<Compliance />} />
          <Route path='security' element={<Security />} />
          <Route path='help' element={<Help />} />
          <Route path='how-to-use' element={<HowToUse />} />
          <Route path='pricing' element={<Pricing />} />
          <Route path='checkout' element={<Checkout />} />
          <Route path="contact" element={<Contact />} />
        </Route>

        {/* Public Layout */}
        <Route path='/:orgSlug' element={<PublicLayout requireOrg />}>
          <Route
            path="submit-anonymous"
            element={
              <AnonymousOnlyRoute>
                <SubmitAnonymous />
              </AnonymousOnlyRoute>
            }
          />
          <Route path="track-report" element={<TrackReport />} />
          <Route path="report-details/:id" element={<ReportDetails />} />
          <Route
            path="edit-draft/:reportNumber"
            element={
              <AnonymousOnlyRoute>
                <EditAnonymousDraft />
              </AnonymousOnlyRoute>
            }
          />
          <Route path="checkout" element={<Checkout />} />
          <Route path="contact" element={<Contact />} />
        </Route>

        {/* Reporter portal — accounts that read their own reports */}
        <Route
          path='/:orgSlug/reporter'
          element={
            <ProtectedRoute access={ACCESS.reporterPortal} redirectIfDenied>
              <DashboardLayout />
            </ProtectedRoute>
          }
        >
          <Route path="dashboard" element={<ReporterDashboard />} />
          <Route path="submit" element={<SubmitReport />} />
          <Route path="reports" element={<MyReports />} />
          <Route path="reports/:id" element={<ReportDetail />} />
          <Route path="reports/:id/edit" element={<EditDraftReport />} />
          <Route path="messages" element={<Messages />} />
          <Route path="change-password" element={<ChangePassword />} />
          <Route path='track-report' element={<TrackReport />} />
        </Route>

        {/* Staff — one area for every organization-defined role. The area
            admits anyone who can open some page in it; each page then checks
            the permission it needs. The sidebar reads the same rules
            (utils/navigation.js), so it never links to a page that refuses. */}
        <Route
          path={`/:orgSlug/${STAFF_AREA}`}
          element={
            <ProtectedRoute access={hasStaffAccess} redirectIfDenied>
              <AdminLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={gate(ACCESS.caseReports, <StaffDashboard />)} />
          <Route path="reports" element={gate(ACCESS.caseReports, <AllReports />)} />
          <Route path="cases/:id" element={gate(ACCESS.caseReports, <CaseDetail />)} />
          <Route path="my-cases" element={gate(ACCESS.caseReports, <MyCases />)} />
          <Route path="messages" element={gate(ACCESS.messagesInternal, <ComplianceMessages />)} />
          <Route path="team" element={gate(ACCESS.team, <Team />)} />
          <Route path="analytics" element={gate(ACCESS.analytics, <Analytics />)} />
          <Route path="users" element={gate(ACCESS.users, <Users />)} />
          <Route path="report-types" element={gate(ACCESS.reportTypes, <ReportTypes />)} />
          <Route path="report-types/:id/view" element={gate(ACCESS.reportTypes, <ViewReportType />)} />
          <Route path="report-types/:id" element={gate(ACCESS.reportTypesManage, <EditReportType />)} />
          <Route path="create-report-type" element={gate(ACCESS.reportTypesManage, <CreateReportType />)} />
          <Route path="roles" element={gate(ACCESS.roles, <Roles />)} />
          <Route path="settings" element={gate(ACCESS.settings, <Settings />)} />
          <Route path="audit" element={gate(ACCESS.auditLogs, <AuditLogs />)} />
          <Route path="agents" element={gate(ACCESS.agents, <Agents />)} />
          <Route path="summarizer" element={gate(ACCESS.agents, <Summarizer />)} />
          <Route path="hierarchy" element={gate(ACCESS.hierarchy, <Hierarchy />)} />
          <Route path="workflows" element={gate(ACCESS.agents, <Workflows />)} />
          <Route path="workflows/new" element={gate(ACCESS.agentsManage, <WorkflowEditor />)} />
          <Route path="workflows/:id" element={gate(ACCESS.agents, <WorkflowEditor />)} />
          {/* v1's fixed orchestration modes, replaced by workflows. The page
              is kept in the codebase but no longer reachable. */}
          <Route path="agent-config" element={<Navigate to="../workflows" replace />} />
          <Route path="agent-kb" element={gate(ACCESS.agents, <KnowledgeBase />)} />
          <Route path="agent-runs" element={gate(ACCESS.agents, <AgentActivity />)} />
          <Route path="question-sets" element={gate(ACCESS.questionSets, <QuestionSets />)} />
          <Route path="voice-profile" element={gate(ACCESS.voiceProfile, <VoiceProfile />)} />
        </Route>

        {/* v1 role areas, kept only as redirects into the staff area */}
        <Route path="/:orgSlug/admin/*" element={<LegacyStaffRedirect />} />
        <Route path="/:orgSlug/compliance/*" element={<LegacyStaffRedirect />} />
        <Route path="/:orgSlug/reviewer/*" element={<LegacyStaffRedirect />} />
      </Routes>

      <ToastContainer
        position="top-right"


      />
    </Router>
  )
}

export default App
