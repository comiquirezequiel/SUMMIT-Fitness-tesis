import React from 'react';
import { ChevronLeft, Globe, Moon, Bell, LogOut, Menu } from 'lucide-react';

const Navbar = ({ onMenuClick }) => {
  return (
    <header className="h-14 bg-white border-b border-slate-200 fixed top-0 left-0 right-0 z-30 flex items-center justify-between px-4">
      <div className="flex items-center">
        <button 
          onClick={onMenuClick}
          className="md:hidden text-slate-500 hover:text-slate-700 p-2 -ml-2 mr-2 rounded-lg hover:bg-slate-100 transition-colors"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="w-auto md:w-60 flex items-center justify-between md:pr-4">
          <span className="text-lg md:text-xl font-extrabold text-blue-600 tracking-tight">Summit</span>
          <button className="hidden md:flex text-slate-400 hover:text-slate-600 p-1 rounded-md hover:bg-slate-100 transition-colors">
            <ChevronLeft className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="flex items-center gap-2 md:gap-4 text-slate-600">
        <button className="hidden sm:flex items-center gap-1.5 text-xs font-semibold px-2 py-1 rounded hover:bg-slate-100 transition-colors text-slate-700">
          <Globe className="w-4 h-4 text-slate-500" />
          <span>ES</span>
        </button>
        
        <button className="hidden sm:flex p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-700 transition-colors">
          <Moon className="w-4 h-4" />
        </button>

        <div className="relative">
          <button className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-700 transition-colors">
            <Bell className="w-4 h-4" />
          </button>
          <span className="absolute -top-0.5 -right-0.5 bg-rose-500 text-white text-[9px] font-bold px-1.5 py-0.2 rounded-full border-2 border-white">
            0
          </span>
        </div>

        <button 
          onClick={() => {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            window.location.href = '/login';
          }}
          className="hidden sm:flex p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-700 transition-colors"
        >
          <LogOut className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-2 pl-2 border-l border-slate-200">
          <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 font-bold text-xs flex items-center justify-center border border-blue-200">
            {localStorage.getItem('user') ? JSON.parse(localStorage.getItem('user')).nombreCompleto.substring(0, 2).toUpperCase() : 'ST'}
          </div>
          <span className="hidden md:inline text-sm font-semibold text-slate-700">
            {localStorage.getItem('user') ? JSON.parse(localStorage.getItem('user')).nombreCompleto : 'Staff Test'}
          </span>
        </div>
      </div>
    </header>
  );
};

export default Navbar;
