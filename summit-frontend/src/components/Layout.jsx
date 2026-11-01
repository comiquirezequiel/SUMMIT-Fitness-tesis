import { useState } from 'react';
import { Outlet } from 'react-router';
import Navbar from './Navbar';
import Sidebar from './Sidebar';

const Layout = () => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar onMenuClick={() => setIsSidebarOpen(true)} />

      {/* Mobile Overlay */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-slate-900/50 z-20 md:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      <Sidebar isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen} />

      {/* La barra de arriba mide 3rem (h-12): el contenido arranca justo debajo, con poco margen */}
      <main className="md:ml-64 px-3 pb-4 pt-15 md:px-5 md:pb-5 md:pt-16 min-h-screen overflow-x-hidden">
        <div className="w-full">
          <Outlet />
        </div>
      </main>
    </div>
  );
};

export default Layout;
