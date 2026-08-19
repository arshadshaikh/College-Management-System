import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import PrivilegeRoute from './components/PrivilegeRoute';
import DashboardLayout from './layouts/DashboardLayout';
import { IS_MAIN_DOMAIN } from './config/tenant';
import PlatformLayout from './pages/platform/PlatformLayout';
import PlatformHome from './pages/platform/PlatformHome';
import PlatformColleges from './pages/platform/PlatformColleges';
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
import ProgramDetail from './pages/college-admin/ProgramDetail';
import ProgramFees from './pages/college-admin/ProgramFees';
import ApplicationList from './pages/college-admin/ApplicationList';
import ApplicationDetail from './pages/college-admin/ApplicationDetail';
import CollegeList from './pages/super-admin/CollegeList';
import CollegeDetail from './pages/super-admin/CollegeDetail';
import ChallanList from './pages/college-admin/ChallanList';
import ChallanDetail from './pages/college-admin/ChallanDetail';
import Settings from './pages/college-admin/Settings';
import CmsPageList from './pages/college-admin/CmsPageList';
import CmsPageForm from './pages/college-admin/CmsPageForm';
import CmsAnnouncementList from './pages/college-admin/CmsAnnouncementList';
import CmsAnnouncementForm from './pages/college-admin/CmsAnnouncementForm';
import CmsMenuList from './pages/college-admin/CmsMenuList';
import CmsMenuForm from './pages/college-admin/CmsMenuForm';
import CmsBannerList from './pages/college-admin/CmsBannerList';
import CmsBannerForm from './pages/college-admin/CmsBannerForm';
import MediaLibrary from './pages/college-admin/MediaLibrary';
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
import { PublicSiteProvider } from './context/PublicSiteContext';
import PublicLayout from './pages/public/PublicLayout';
import PublicHome from './pages/public/PublicHome';
import PublicPage from './pages/public/PublicPage';

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
      <Route path="/login" element={user ? <Navigate to="/portal" replace /> : <Login />} />
      <Route path="/forgot-password" element={user ? <Navigate to="/portal" replace /> : <ForgotPassword />} />
      <Route path="/reset-password" element={user ? <Navigate to="/portal" replace /> : <ResetPassword />} />
      <Route path="/register-college" element={<CollegeRegister />} />

      <Route path="/portal" element={<ProtectedRoute><DashboardLayout /></ProtectedRoute>}>
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
        <Route path="programs/create" element={<PrivilegeRoute slug="programs.store"><ProgramForm /></PrivilegeRoute>} />
        <Route path="programs/:id" element={<PrivilegeRoute slug="programs.show"><ProgramDetail /></PrivilegeRoute>} />
        <Route path="programs/:id/edit" element={<PrivilegeRoute slug="programs.update"><ProgramForm /></PrivilegeRoute>} />

        <Route path="programs/:id/fees" element={<PrivilegeRoute slug="programs.fee-structures"><ProgramFees /></PrivilegeRoute>} />

        {/* Applications */}
        <Route path="applications" element={<PrivilegeRoute slug="applications.index"><ApplicationList /></PrivilegeRoute>} />
        <Route path="applications/:id" element={<PrivilegeRoute slug="applications.show"><ApplicationDetail /></PrivilegeRoute>} />

        {/* Challans */}
        <Route path="challans" element={<PrivilegeRoute slug="challans.index"><ChallanList /></PrivilegeRoute>} />
        <Route path="challans/:id" element={<PrivilegeRoute slug="challans.show"><ChallanDetail /></PrivilegeRoute>} />

        {/* College Settings */}
        <Route path="cms/settings" element={<PrivilegeRoute slug="settings.index"><Settings /></PrivilegeRoute>} />

        {/* CMS Pages */}
        <Route path="cms/pages" element={<PrivilegeRoute slug="cms.pages.index"><CmsPageList /></PrivilegeRoute>} />
        <Route path="cms/pages/create" element={<PrivilegeRoute slug="cms.pages.store"><CmsPageForm /></PrivilegeRoute>} />
        <Route path="cms/pages/:id/edit" element={<PrivilegeRoute slug="cms.pages.update"><CmsPageForm /></PrivilegeRoute>} />

        {/* CMS Announcements */}
        <Route path="cms/announcements" element={<PrivilegeRoute slug="cms.announcements.index"><CmsAnnouncementList /></PrivilegeRoute>} />
        <Route path="cms/announcements/create" element={<PrivilegeRoute slug="cms.announcements.store"><CmsAnnouncementForm /></PrivilegeRoute>} />
        <Route path="cms/announcements/:id/edit" element={<PrivilegeRoute slug="cms.announcements.update"><CmsAnnouncementForm /></PrivilegeRoute>} />

        {/* CMS Menus */}
        <Route path="cms/menus" element={<PrivilegeRoute slug="cms.menus.index"><CmsMenuList /></PrivilegeRoute>} />
        <Route path="cms/menus/create" element={<PrivilegeRoute slug="cms.menus.store"><CmsMenuForm /></PrivilegeRoute>} />
        <Route path="cms/menus/:id/edit" element={<PrivilegeRoute slug="cms.menus.update"><CmsMenuForm /></PrivilegeRoute>} />

        {/* CMS Banners */}
        <Route path="cms/banners" element={<PrivilegeRoute slug="cms.banners.index"><CmsBannerList /></PrivilegeRoute>} />
        <Route path="cms/banners/create" element={<PrivilegeRoute slug="cms.banners.store"><CmsBannerForm /></PrivilegeRoute>} />
        <Route path="cms/banners/:id/edit" element={<PrivilegeRoute slug="cms.banners.update"><CmsBannerForm /></PrivilegeRoute>} />

        {/* Media Library */}
        <Route path="cms/media" element={<PrivilegeRoute slug="cms.media.index"><MediaLibrary /></PrivilegeRoute>} />

        {/* Student Routes */}
        <Route path="my-applications" element={<PrivilegeRoute slug="applications.my"><MyApplications /></PrivilegeRoute>} />
        <Route path="my-challans" element={<PrivilegeRoute slug="challans.my"><MyChallans /></PrivilegeRoute>} />
        <Route path="my-challans/:id" element={<PrivilegeRoute slug="challans.my"><MyChallanDetail /></PrivilegeRoute>} />
        <Route path="apply" element={<PrivilegeRoute slug="applications.store"><ApplyForm /></PrivilegeRoute>} />
        
      </Route>

      {/* Root: platform site on main domain, college site on subdomain */}
      {IS_MAIN_DOMAIN ? (
        <Route path="/" element={<PlatformLayout />}>
          <Route index element={<PlatformHome />} />
          <Route path="colleges" element={<PlatformColleges />} />
          <Route path=":slug" element={<PublicPage />} />
        </Route>
        ) : (
        <Route path="/" element={<PublicSiteProvider><PublicLayout /></PublicSiteProvider>}>
          <Route index element={<PublicHome />} />
          <Route path=":slug" element={<PublicPage />} />
        </Route>
        )
      }

      <Route path="*" element={<Navigate to="/" replace />} />

    </Routes>
  );
}