import { Outlet, Link } from 'react-router-dom';

export default function PlatformLayout() {
  return (
    <div className="min-h-screen bg-white flex flex-col">
      <header className="border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <span className="w-9 h-9 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-bold">C</span>
            <span className="font-bold text-gray-900">College Admissions Platform</span>
          </Link>
          <nav className="flex items-center gap-6 text-sm">
            <Link to="/colleges" className="text-gray-700 hover:text-gray-900">Colleges</Link>
            <Link to="/register-college" className="text-gray-700 hover:text-gray-900">Register College</Link>
            <Link to="/login" className="px-4 py-2 rounded-lg bg-indigo-600 text-white font-medium">Portal Login</Link>
          </nav>
        </div>
      </header>
      <main className="flex-1"><Outlet /></main>
      <footer className="border-t border-gray-200 mt-16">
        <div className="max-w-6xl mx-auto px-4 py-8 text-sm text-gray-500">
          © {new Date().getFullYear()} College Admissions Platform
        </div>
      </footer>
    </div>
  );
}