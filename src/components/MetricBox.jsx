import React from 'react';
import { Gauge, Navigation, Clock } from 'lucide-react';
import { formatDistance } from '../services/geo.js';

export function MetricBoxes({ speedKmh, distanceMeters, etaMinutes }) {
  const metrics = [
    {
      label: 'Tốc độ',
      value: typeof speedKmh === 'number' ? Math.round(speedKmh) : '0',
      unit: 'km/h',
      icon: Gauge,
      color: 'text-sky-600',
      bgColor: 'bg-sky-50',
    },
    {
      label: 'Còn lại',
      value: typeof distanceMeters === 'number' ? formatDistance(distanceMeters).split(' ')[0] : '—',
      unit: typeof distanceMeters === 'number' ? formatDistance(distanceMeters).split(' ')[1] : '',
      icon: Navigation,
      color: 'text-indigo-600',
      bgColor: 'bg-indigo-50',
    },
    {
      label: 'Dự kiến (ETA)',
      value: etaMinutes ? String(etaMinutes) : '—',
      unit: etaMinutes ? 'phút' : '',
      icon: Clock,
      color: 'text-emerald-600',
      bgColor: 'bg-emerald-50',
    },
  ];

  return (
    <div className="grid grid-cols-3 gap-2.5 my-3">
      {metrics.map((m, idx) => {
        const Icon = m.icon;
        return (
          <div
            key={idx}
            className="bg-white border border-slate-200/80 rounded-2xl p-3 flex flex-col justify-between shadow-sm relative overflow-hidden text-center"
          >
            <div className="flex items-center justify-center space-x-1 mb-1">
              <Icon className={`w-3.5 h-3.5 ${m.color}`} />
              <span className="text-[11px] font-semibold text-slate-500 tracking-tight">{m.label}</span>
            </div>
            <div className="flex items-baseline justify-center space-x-1">
              <span className="text-2xl font-extrabold text-slate-900 tracking-tight">
                {m.value}
              </span>
              {m.unit && (
                <span className="text-[11px] font-bold text-slate-500 uppercase">
                  {m.unit}
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
