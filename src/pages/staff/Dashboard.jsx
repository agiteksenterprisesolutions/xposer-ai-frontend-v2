// src/pages/staff/Dashboard.jsx
//
// The staff area has one dashboard route; which view it shows follows from
// what the user can see, not from their role:
//   - organization-wide stats over every report → the overview dashboard
//   - every report, without the stats           → the case dashboard
//   - only reports assigned to them             → the assigned-work dashboard
import AdminDashboard from '../admin/Dashboard';
import ComplianceDashboard from '../compliance/Dashboard';
import ReviewerDashboard from '../reviewer/ReviewerDashboard';
import { useCan } from '../../hooks/useCan';
import { ACCESS, PERM } from '../../utils/permissions';

const StaffDashboard = () => {
  const can = useCan();

  if (can(ACCESS.orgOverview)) return <AdminDashboard />;
  if (can(PERM.reportReadAll)) return <ComplianceDashboard />;
  return <ReviewerDashboard />;
};

export default StaffDashboard;
