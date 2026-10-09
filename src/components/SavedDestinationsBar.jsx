import React from 'react';
import { MapPin, Plus, Check, Home, Building2, Car, Navigation2 } from 'lucide-react';
import { haversine, formatDistance } from '../services/geo.js';

function getIconForDestination(name) {
  const lower = (name || '').toLowerCase();
  if (lower.includes('nhà') || lower.includes('home')) {
    return <Home className="w-3.5 h-3.5 flex-shrink-0" />;
  }
  if (lower.includes('cơ quan') || lower.includes('công ty') || lower.includes('văn phòng') || lower.includes('làm')) {
    return <Building2 className="w-3.5 h-3.5 flex-shrink-0" />;
  }
  if (lower.includes('gửi xe') || lower.includes('bãi xe') || lower.includes('gara') || lower.includes('xe')) {
    return <Car className="w-3.5 h-3.5 flex-shrink-0" />;
  }
  return <MapPin className="w-3.5 h-3.5 flex-shrink-0" />;
}

export function SavedDestinationsBar({
  destinations = [],
  currentLat,
  currentLng,
  currentName,
  userLocation, // { lat, lng }
  onSelectDestination,
  onOpenAddMap,
}) {
  return (
    <div className="w-full">
      <div className="flex items-center justify-between px-1 mb-1.5 text-xs">
        <span className="font-bold text-slate-700 uppercase tracking-wider text-[11px] flex items-center space-x-1.5">
          <Navigation2 className="w-3.5 h-3.5 text-brand-600 rotate-45" />
          <span>Điểm đến yêu thích</span>
        </span>
        <button
          onClick={onOpenAddMap}
          className="text-brand-600 hover:text-brand-700 font-semibold text-[11px] flex items-center space-x-1 active:scale-95 transition"
        >
          <Plus className="w-3 h-3" />
          <span>Thêm ghim mới</span>
        </button>
      </div>

      <div className="flex items-center space-x-2 overflow-x-auto py-1 px-0.5 no-scrollbar scroll-smooth">
        {destinations.map((dest) => {
          const isSelected =
            (Math.abs(dest.lat - currentLat) < 0.0001 && Math.abs(dest.lng - currentLng) < 0.0001) ||
            dest.name === currentName;

          let distStr = '';
          if (userLocation && typeof userLocation.lat === 'number' && typeof userLocation.lng === 'number') {
            const distMeters = haversine(userLocation.lat, userLocation.lng, dest.lat, dest.lng);
            distStr = formatDistance(distMeters);
          }

          return (
            <button
              key={dest.id || `${dest.lat}_${dest.lng}`}
              onClick={() => onSelectDestination(dest)}
              className={`flex-shrink-0 flex items-center space-x-2 px-3.5 py-2 rounded-2xl text-xs font-semibold transition-all shadow-sm active:scale-95 cursor-pointer border ${
                isSelected
                  ? 'bg-brand-50 border-brand-500 text-brand-700 shadow-brand-500/10 ring-1 ring-brand-500'
                  : 'bg-white border-slate-200/90 text-slate-700 hover:bg-slate-50 hover:border-slate-300'
              }`}
            >
              <div
                className={`w-6 h-6 rounded-lg flex items-center justify-center ${
                  isSelected ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-500'
                }`}
              >
                {isSelected ? <Check className="w-3.5 h-3.5 stroke-[3]" /> : getIconForDestination(dest.name)}
              </div>
              <div className="text-left">
                <div className="font-bold whitespace-nowrap text-xs leading-tight">
                  {dest.name}
                </div>
                {distStr && (
                  <div className={`text-[10px] leading-tight ${isSelected ? 'text-brand-600 font-medium' : 'text-slate-400'}`}>
                    Cách {distStr}
                  </div>
                )}
              </div>
            </button>
          );
        })}

        {/* Nút thêm điểm nhanh ở cuối danh sách cuộn ngang */}
        <button
          onClick={onOpenAddMap}
          className="flex-shrink-0 flex items-center space-x-1.5 px-3 py-2 rounded-2xl text-xs font-semibold border border-dashed border-slate-300 bg-white/70 text-slate-500 hover:text-brand-600 hover:border-brand-300 hover:bg-white active:scale-95 transition cursor-pointer"
        >
          <div className="w-6 h-6 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500">
            <Plus className="w-3.5 h-3.5" />
          </div>
          <span className="whitespace-nowrap text-xs">Ghim điểm</span>
        </button>
      </div>
    </div>
  );
}
