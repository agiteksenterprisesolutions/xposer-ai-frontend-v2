import { Outlet } from "react-router-dom"
import Navbar from "./Navbar"
import RouteAnnouncer from "./RouteAnnouncer"
import Sidebar from "./Sidebar"
import AIChatWidget from "./AIChatWidget"

const DashboardLayout = () => (
  <div className="min-h-screen flex flex-col bg-canvas text-ink">
    <a href="#main-content" className="skip-link">Skip to main content</a>
    <Navbar />
    <div className="flex flex-1 min-w-0">
      <Sidebar />
      {/* min-w-0 lets wide children (tables, charts) scroll inside the main
          column instead of forcing the whole page sideways */}
      <main id="main-content" tabIndex={-1} className="flex-1 min-w-0 outline-none px-4 py-5 sm:px-6 sm:py-6 lg:px-8">
        <RouteAnnouncer />
        <div className="mx-auto w-full max-w-7xl">
          <Outlet />
        </div>
      </main>
    </div>
    <AIChatWidget />
  </div>
)

export default DashboardLayout
