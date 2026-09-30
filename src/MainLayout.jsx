import AIChatWidget from './components/layout/AIChatWidget'
import { Outlet } from 'react-router-dom'
import Navbar from './components/layout/Navbar'
import Sidebar from './components/layout/Sidebar'

const MainLayout = () => {
  return (
    <div>
      <Navbar />
      <div className='flex'>
      <aside ><Sidebar /></aside>
      <main className='px-5 py-2'>
        <Outlet />
      </main>
      </div>
        <AIChatWidget />
    </div>
  )
}

export default MainLayout