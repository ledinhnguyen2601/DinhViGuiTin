import React, { useState } from 'react';
import { PlayCircle, StopCircle, CheckCircle2, AlertTriangle, Navigation, Gauge, FastForward, ShieldAlert } from 'lucide-react';
import { TRIP_STATES } from '../config/constants.js';

export function Simulator({ tracker, setActiveTab }) {
  const { settings, secrets, tripState, isSimulating, runSimulation, stopTrip } = tracker;
  const [selectedScenario, setSelectedScenario] = useState('normal_approach');
  const [customSpeed, setCustomSpeed] = useState(40);

  // Target destination coordinates from settings
  const targetLat = settings.destinationLat;
  const targetLng = settings.destinationLng;

  // Generates waypoints based on scenario
  const getWaypoints = () => {
    const now = Date.now();
    switch (selectedScenario) {
      case 'normal_approach':
        // Approach from ~2.5km away down to 30m inside radius
        return [
          { lat: targetLat + 0.022, lng: targetLng, accuracy: 12, speed: customSpeed / 3.6, timestamp: now },
          { lat: targetLat + 0.015, lng: targetLng, accuracy: 10, speed: customSpeed / 3.6, timestamp: now + 5000 },
          { lat: targetLat + 0.008, lng: targetLng, accuracy: 8, speed: customSpeed / 3.6, timestamp: now + 10000 },
          { lat: targetLat + 0.003, lng: targetLng, accuracy: 10, speed: (customSpeed * 0.7) / 3.6, timestamp: now + 15000 },
          { lat: targetLat + 0.0008, lng: targetLng, accuracy: 9, speed: 20 / 3.6, timestamp: now + 20000 }, // ~88m (within 100m radius) - Sample 1
          { lat: targetLat + 0.0003, lng: targetLng, accuracy: 7, speed: 5 / 3.6, timestamp: now + 26000 }, // ~33m (within radius, >5s later) - Sample 2 -> ARRIVED!
        ];
      case 'gps_spike':
        // Glitch sample (TC-04): 1 sample momentarily jumps inside, then moves far away
        return [
          { lat: targetLat + 0.030, lng: targetLng, accuracy: 15, speed: 40 / 3.6, timestamp: now },
          { lat: targetLat + 0.0005, lng: targetLng, accuracy: 12, speed: 40 / 3.6, timestamp: now + 3000 }, // Glitch sample
          { lat: targetLat + 0.025, lng: targetLng, accuracy: 14, speed: 40 / 3.6, timestamp: now + 6000 }, // Back out!
        ];
      case 'poor_accuracy':
        // Inside radius but accuracy is 120m (TC-05) -> must be rejected
        return [
          { lat: targetLat + 0.010, lng: targetLng, accuracy: 15, speed: 30 / 3.6, timestamp: now },
          { lat: targetLat + 0.0005, lng: targetLng, accuracy: 120, speed: 10 / 3.6, timestamp: now + 5000 }, // Poor accuracy (120m > 50m)
          { lat: targetLat + 0.0003, lng: targetLng, accuracy: 130, speed: 0, timestamp: now + 11000 },
        ];
      default:
        return [];
    }
  };

  const handleStartSimulation = () => {
    const waypoints = getWaypoints();
    runSimulation(waypoints, 2500); // 2.5s per step
    setActiveTab('home'); // Switch to home to watch live radar & metrics!
  };

  return (
    <div className="space-y-4 pb-24 text-sm animate-fade-in">
      <div>
        <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">Bộ giả lập GPS thực địa</h1>
        <p className="text-xs text-slate-500">Mô phỏng chuyến đi thực tế để kiểm tra tự động phát hiện đến & gửi tin</p>
      </div>

      {/* Scenario Picker */}
      <section className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-sm space-y-3">
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center space-x-1.5 pb-1 border-b border-slate-100">
          <Navigation className="w-4 h-4 text-brand-600" />
          <span>Chọn kịch bản kiểm thử</span>
        </h2>

        <div className="space-y-2">
          {[
            {
              id: 'normal_approach',
              title: 'Kịch bản 1: Tiếp cận điểm đến bình thường (TC-03 & TC-07)',
              desc: 'Xe đi từ 2.5 km -> 800m -> 88m -> 33m. Thỏa 2 mẫu liên tiếp và kích hoạt báo an Telegram/SMS.',
              badge: 'Chuẩn',
              badgeColor: 'bg-emerald-100 text-emerald-700',
            },
            {
              id: 'gps_spike',
              title: 'Kịch bản 2: GPS nhảy đột ngột rồi ra ngoài (TC-04)',
              desc: '1 mẫu GPS lỗi nhảy vào trong bán kính nhưng ngay lập tức vọt ra ngoài. Ứng dụng KHÔNG được báo nhầm.',
              badge: 'Chống nhiễu',
              badgeColor: 'bg-amber-100 text-amber-700',
            },
            {
              id: 'poor_accuracy',
              title: 'Kịch bản 3: Tọa độ trong bán kính nhưng sai số 120m (TC-05)',
              desc: 'Mẫu vào vùng geofence nhưng độ chính xác kém (>50m). Ứng dụng phải lọc bỏ và không báo đến.',
              badge: 'Lọc mẫu xấu',
              badgeColor: 'bg-rose-100 text-rose-700',
            },
          ].map((item) => (
            <label
              key={item.id}
              onClick={() => setSelectedScenario(item.id)}
              className={`block p-3.5 rounded-xl border cursor-pointer transition ${
                selectedScenario === item.id
                  ? 'border-brand-500 bg-brand-50/50 shadow-sm'
                  : 'border-slate-200 hover:bg-slate-50'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="font-bold text-xs text-slate-900">{item.title}</span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${item.badgeColor}`}>
                  {item.badge}
                </span>
              </div>
              <p className="text-[11px] text-slate-600 leading-relaxed">{item.desc}</p>
            </label>
          ))}
        </div>

        {/* Speed slider */}
        <div className="pt-2">
          <div className="flex justify-between items-center mb-1">
            <label className="text-xs font-semibold text-slate-700">Tốc độ xe mô phỏng</label>
            <span className="text-xs font-bold text-brand-600">{customSpeed} km/h</span>
          </div>
          <input
            type="range"
            min={10}
            max={80}
            step={5}
            value={customSpeed}
            onChange={(e) => setCustomSpeed(parseInt(e.target.value))}
            className="w-full accent-brand-600 cursor-pointer"
          />
        </div>
      </section>

      {/* Target Preview */}
      <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 space-y-1 text-xs text-slate-700">
        <div className="font-bold text-slate-900">Mục tiêu đang thiết lập:</div>
        <div>Tên điểm đến: <span className="font-semibold text-brand-700">{settings.destinationName}</span></div>
        <div>Tọa độ đích: <span className="font-mono text-slate-600">{settings.destinationLat.toFixed(6)}, {settings.destinationLng.toFixed(6)}</span></div>
        <div>Bán kính Geofence: <span className="font-bold text-emerald-700">{settings.radiusMeters} mét</span></div>
      </div>

      {/* Actions */}
      <div className="pt-2">
        {isSimulating ? (
          <button
            onClick={stopTrip}
            className="w-full py-4 px-6 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-base shadow-lg shadow-rose-600/30 flex items-center justify-center space-x-2 transition"
          >
            <StopCircle className="w-5 h-5" />
            <span>DỪNG GIẢ LẬP</span>
          </button>
        ) : (
          <button
            onClick={handleStartSimulation}
            className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-700 hover:to-indigo-700 text-white font-bold text-base shadow-lg shadow-brand-500/25 flex items-center justify-center space-x-2 transition cursor-pointer"
          >
            <PlayCircle className="w-5 h-5" />
            <span>CHẠY GIẢ LẬP & XEM TRÊN HOME</span>
          </button>
        )}
      </div>
    </div>
  );
}
