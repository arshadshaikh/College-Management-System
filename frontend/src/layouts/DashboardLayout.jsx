import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Sidebar from '../components/Sidebar';
import Topbar from '../components/Topbar';

export default function DashboardLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const { menu } = useAuth();

  return (
    <div className="h-screen bg-gray-50 flex overflow-hidden">
      <Sidebar
        menu={menu}
        open={sidebarOpen}
        collapsed={collapsed}
        onClose={() => setSidebarOpen(false)}
        onCollapse={() => setCollapsed(!collapsed)}
      />

      <div className="flex-1 flex flex-col min-w-0 h-screen">
        <Topbar onMenuToggle={() => setSidebarOpen(true)} collapsed={collapsed} onCollapse={() => setCollapsed(!collapsed)} />
        <main className="flex-1 p-4 lg:p-6 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
