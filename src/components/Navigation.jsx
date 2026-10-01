import React from 'react';
import { Home, Settings, ShieldCheck, FileText, PlayCircle } from 'lucide-react';
import { TRIP_STATES } from '../config/constants.js';

export function Navigation({ activeTab, setActiveTab, tripState }) {
  const isTracking = tripState === TRIP_STATES.TRACKING;

  const tabs = [
    { id: 'home', label: 'Hành trình', icon: Home },
    { id: 'simulator', label: 'Giả lập GPS', icon: PlayCircle },
    { id: 'logs', label: 'Nhật ký', icon: FileText },
    { id: 'permissions', label: 'Cấp quyền', icon: ShieldCheck },
    { id: 'settings', label: 'Cài đặt', icon: Settings },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 pb-[env(safe-area-inset-bottom,0px)]">
      <div className="max-w-md mx-auto grid grid-cols-5 h-16">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className="relative flex flex-col items-center justify-center space-y-1 transition text-slate-500 hover:text-slate-900"
            >
              <div className="relative">
                <Icon
                  className={`w-5 h-5 transition-transform ${
                    isActive ? 'text-brand-600 scale-110' : 'text-slate-400'
                  }`}
                />
                {tab.id === 'home' && isTracking && (
                  <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                  </span>
                )}
              </div>
              <span
                className={`text-[11px] font-medium leading-none ${
                  isActive ? 'text-brand-600 font-semibold' : 'text-slate-500'
                }`}
              >
                {tab.label}
              </span>
              {isActive && (
                <div className="absolute bottom-1 w-6 h-0.5 rounded-full bg-brand-600" />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
