import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Sidebar from '../components/Sidebar';
import Topbar from '../components/Topbar';

export default function DashboardLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const { menu, plan, user } = useAuth();

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
          <PlanBanner plan={plan} staff={user?.user_type !== 'student'} />
          <Outlet />
        </main>
      </div>
    </div>
  );
}

const fmt = (d) => new Date(`${d}T00:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
const daysTo = (d) => { const t = new Date(); t.setHours(0, 0, 0, 0); return Math.round((new Date(`${d}T00:00:00`) - t) / 86400000); };

// Subscription notice above every page: read-only after the grace period, and a
// heads-up for staff during grace or the last week of a trial.
function PlanBanner({ plan, staff }) {
  if (!plan) return null;
  let tone = null, text = null;
  if (plan.read_only) {
    tone = 'bg-red-50 border-red-200 text-red-800';
    text = staff
      ? `Your subscription ended on ${fmt(plan.expires_at)}. The portal is read-only until it is renewed. Contact the platform administrator.`
      : 'The portal is read-only at the moment. You can view your records but not make changes.';
  } else if (staff && plan.status === 'grace') {
    tone = 'bg-amber-50 border-amber-200 text-amber-800';
    text = `Your subscription ended on ${fmt(plan.expires_at)}. Renew by ${fmt(plan.grace_ends_at)} or the portal becomes read-only.`;
  } else if (staff && plan.status === 'trial' && plan.expires_at && daysTo(plan.expires_at) <= 7) {
    const n = daysTo(plan.expires_at);
    tone = 'bg-indigo-50 border-indigo-200 text-indigo-800';
    text = `Your free trial ends ${n <= 0 ? 'today' : `in ${n} day${n === 1 ? '' : 's'}`} (${fmt(plan.expires_at)}). Contact the platform administrator to subscribe.`;
  }
  if (!text) return null;
  return <div role="status" className={`mb-4 rounded-xl border px-4 py-3 text-sm ${tone}`}>{text}</div>;
}
