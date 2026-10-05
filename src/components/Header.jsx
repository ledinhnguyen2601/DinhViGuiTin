import React from 'react';
import { Navigation2, ShieldCheck, Settings, FileText } from 'lucide-react';
import { TRIP_STATES } from '../config/constants.js';

export function Header({ activeTab, setActiveTab, tripState }) {
  const isTracking = tripState === TRIP_STATES.TRACKING;

  return (
    <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-slate-200 px-4 py-3">
      <div className="max-w-md mx-auto flex items-center justify-between">
        <div 
          onClick={() => setActiveTab('home')}
          className="flex items-center space-x-2.5 cursor-pointer"
        >
          <div className="relative w-9 h-9 rounded-xl bg-gradient-to-tr from-brand-600 to-sky-400 flex items-center justify-center text-white shadow-md shadow-brand-500/20">
            <Navigation2 className="w-5 h-5 -rotate-45" />
            {isTracking && (
              <span className="absolute -top-1 -right-1 flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500 border-2 border-white"></span>
              </span>
            )}
          </div>
          <div>
            <div className="text-base font-bold text-slate-900 leading-tight">Geofencing Tracker</div>
            <div className="text-[11px] font-medium text-slate-500">Tự động báo tin khi đến</div>
          </div>
        </div>

        <div className="flex items-center space-x-1">
          <button
            onClick={() => setActiveTab('logs')}
            title="Nhật ký"
            className={`p-2 rounded-xl transition ${
              activeTab === 'logs'
                ? 'bg-brand-50 text-brand-600 font-semibold'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <FileText className="w-5 h-5" />
          </button>
          <button
            onClick={() => setActiveTab('settings')}
            title="Cài đặt"
            className={`p-2 rounded-xl transition ${
              activeTab === 'settings'
                ? 'bg-brand-50 text-brand-600 font-semibold'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Settings className="w-5 h-5" />
          </button>
        </div>
      </div>
    </header>
  );
}
