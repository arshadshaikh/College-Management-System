import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import PrivilegeRoute from './components/PrivilegeRoute';
import DashboardLayout from './layouts/DashboardLayout';
import Login from './pages/auth/Login';
import Dashboard from './pages/shared/Dashboard';
import UserList from './pages/UserList';
import UserCreate from './pages/UserCreate';
import UserEdit from './pages/UserEdit';
import RoleList from './pages/RoleList';
import RoleCreate from './pages/RoleCreate';
import RoleEdit from './pages/RoleEdit';
import PrivilegeList from './pages/PrivilegeList';
import PrivilegeCreate from './pages/PrivilegeCreate';
import PrivilegeEdit from './pages/PrivilegeEdit';
import ChangePassword from './pages/shared/ChangePassword';
import ChangeRole from './pages/shared/ChangeRole';
import ForgotPassword from './pages/auth/ForgotPassword';
import ResetPassword from './pages/auth/ResetPassword';
import ProgramList from './pages/college-admin/ProgramList';
import ProgramForm from './pages/college-admin/ProgramForm';
import ApplicationList from './pages/college-admin/ApplicationList';
import ApplicationDetail from './pages/college-admin/ApplicationDetail';
import CollegeList from './pages/super-admin/CollegeList';
import CollegeDetail from './pages/super-admin/CollegeDetail';
import ChallanList from './pages/college-admin/ChallanList';
import ChallanDetail from './pages/college-admin/ChallanDetail';
import MyApplications from './pages/student/MyApplications';
import MyChallans from './pages/student/MyChallans';
import ApplyForm from './pages/student/ApplyForm';
import MyChallanDetail from './pages/student/MyChallanDetail';
import CollegeRegister from './pages/auth/CollegeRegister';
import DocumentTypeList from './pages/super-admin/DocumentTypeList';
import DocumentTypeForm from './pages/super-admin/DocumentTypeForm';
import CollegeAdminList from './pages/super-admin/CollegeAdminList';
import CollegeAdminForm from './pages/super-admin/CollegeAdminForm';
import AuditLogList from './pages/super-admin/AuditLogList';

export default function App() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin h-10 w-10 border-4 border-indigo-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />
      <Route path="/forgot-password" element={user ? <Navigate to="/" replace /> : <ForgotPassword />} />
      <Route path="/reset-password" element={user ? <Navigate to="/" replace /> : <ResetPassword />} />

      <Route path="/register-college" element={<CollegeRegister />} />

      <Route path="/" element={<ProtectedRoute><DashboardLayout /></ProtectedRoute>}>
        <Route index element={<Dashboard />} />
        <Route path="change-password" element={<ChangePassword />} />
        <Route path="change-role" element={<ChangeRole />} />

        {/* User Management */}
        <Route path="users" element={<PrivilegeRoute slug="user-list"><UserList /></PrivilegeRoute>} />
        <Route path="users/create" element={<PrivilegeRoute slug="create-user"><UserCreate /></PrivilegeRoute>} />
        <Route path="users/:id/edit" element={<PrivilegeRoute slug="update-user"><UserEdit /></PrivilegeRoute>} />

        {/* Role Management */}
        <Route path="roles" element={<PrivilegeRoute slug="role-list"><RoleList /></PrivilegeRoute>} />
        <Route path="roles/create" element={<PrivilegeRoute slug="create-role"><RoleCreate /></PrivilegeRoute>} />
        <Route path="roles/:id/edit" element={<PrivilegeRoute slug="update-role"><RoleEdit /></PrivilegeRoute>} />

        {/* Privilege Management */}
        <Route path="privileges" element={<PrivilegeRoute slug="privilege-list"><PrivilegeList /></PrivilegeRoute>} />
        <Route path="privileges/create" element={<PrivilegeRoute slug="create-privilege"><PrivilegeCreate /></PrivilegeRoute>} />
        <Route path="privileges/:id/edit" element={<PrivilegeRoute slug="update-privilege"><PrivilegeEdit /></PrivilegeRoute>} />

        {/* Colleges (super admin) */}
        <Route path="colleges" element={<PrivilegeRoute slug="colleges.index"><CollegeList /></PrivilegeRoute>} />
        <Route path="colleges/:id" element={<PrivilegeRoute slug="colleges.show"><CollegeDetail /></PrivilegeRoute>} />

        {/* College Admins */}
        <Route path="college-admins" element={<PrivilegeRoute slug="college-admins.index"><CollegeAdminList /></PrivilegeRoute>} />
        <Route path="college-admins/create" element={<PrivilegeRoute slug="college-admins.store"><CollegeAdminForm /></PrivilegeRoute>} />
        <Route path="college-admins/:id/edit" element={<PrivilegeRoute slug="college-admins.update"><CollegeAdminForm /></PrivilegeRoute>} />

        {/* Document Types */}
        <Route path="document-types" element={<PrivilegeRoute slug="doc-types.index"><DocumentTypeList /></PrivilegeRoute>} />
        <Route path="document-types/create" element={<PrivilegeRoute slug="doc-types.store"><DocumentTypeForm /></PrivilegeRoute>} />
        <Route path="document-types/:id/edit" element={<PrivilegeRoute slug="doc-types.update"><DocumentTypeForm /></PrivilegeRoute>} />

        {/* Audit Logs */}
        <Route path="audit-logs" element={<PrivilegeRoute slug="audit-logs.index"><AuditLogList /></PrivilegeRoute>} />
        

        {/* Programs */}
        <Route path="programs" element={<PrivilegeRoute slug="programs.index"><ProgramList /></PrivilegeRoute>} />
        <Route path="programs/create"   element={<PrivilegeRoute slug="programs.store"><ProgramForm /></PrivilegeRoute>} />
        <Route path="programs/:id/edit" element={<PrivilegeRoute slug="programs.update"><ProgramForm /></PrivilegeRoute>} />

        {/* Applications */}
        <Route path="applications" element={<PrivilegeRoute slug="applications.index"><ApplicationList /></PrivilegeRoute>} />
        <Route path="applications/:id" element={<PrivilegeRoute slug="applications.show"><ApplicationDetail /></PrivilegeRoute>} />

        {/* Challans */}
        <Route path="challans" element={<PrivilegeRoute slug="challans.index"><ChallanList /></PrivilegeRoute>} />
        <Route path="challans/:id" element={<PrivilegeRoute slug="challans.show"><ChallanDetail /></PrivilegeRoute>} />

        {/* Student Routes */}
        <Route path="my-applications" element={<PrivilegeRoute slug="applications.my"><MyApplications /></PrivilegeRoute>} />
        <Route path="my-challans" element={<PrivilegeRoute slug="challans.my"><MyChallans /></PrivilegeRoute>} />
        <Route path="my-challans/:id" element={<PrivilegeRoute slug="challans.my"><MyChallanDetail /></PrivilegeRoute>} />
        <Route path="apply" element={<PrivilegeRoute slug="applications.store"><ApplyForm /></PrivilegeRoute>} />
  

        
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}