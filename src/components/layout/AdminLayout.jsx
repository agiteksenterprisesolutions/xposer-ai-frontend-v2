import { Outlet } from "react-router-dom";
import Navbar from "./Navbar";
import Sidebar from "./Sidebar";

const AdminLayout = () => (
  <div className="min-h-screen flex flex-col bg-canvas text-ink">
    <Navbar />
    <div className="flex flex-1 min-w-0">
      <Sidebar />
      {/* min-w-0 lets wide children (tables, charts) scroll inside the main
          column instead of forcing the whole page sideways */}
      <main className="flex-1 min-w-0 px-4 py-5 sm:px-6 sm:py-6 lg:px-8">
        <div className="mx-auto w-full max-w-7xl">
          <Outlet />
        </div>
      </main>
    </div>
  </div>
)

export default AdminLayout;
