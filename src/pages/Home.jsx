import React, { useState } from 'react';
import { StatusCard } from '../components/StatusCard.jsx';
import { MetricBoxes } from '../components/MetricBox.jsx';
import { BigButton } from '../components/BigButton.jsx';
import { ConfirmModal } from '../components/ConfirmModal.jsx';
import { MapPin, Send, MessageSquare, AlertCircle, Signal, CheckCircle2, ChevronRight, PlayCircle } from 'lucide-react';
import { TRIP_STATES } from '../config/constants.js';
import { formatTime } from '../services/geo.js';

export function Home({
  tracker,
  setActiveTab,
}) {
  const {
    settings,
    secrets,
    tripState,
    metrics,
    gpsError,
    isSimulating,
    telegramStatus,
    startTrip,
    stopTrip,
    resetTrip,
  } = tracker;

  const [showStopModal, setShowStopModal] = useState(false);

  // Check if GPS hasn't updated in > 5 minutes
  const isGpsStale = metrics.lastUpdated && Date.now() - metrics.lastUpdated > 5 * 60 * 1000;
  const hasSmsConfigured = Boolean(secrets.backupPhone1 || secrets.backupPhone2);

  const handleStart = () => {
    startTrip();
  };

  const handleConfirmStop = () => {
    setShowStopModal(false);
    stopTrip();
  };

  return (
    <div className="space-y-4 pb-24 animate-fade-in">
      {/* 1. Status Card */}
      <StatusCard state={tripState} isSimulating={isSimulating} />

      {/* 2. Destination Banner */}
      <div
        onClick={() => setActiveTab('settings')}
        className="bg-white border border-slate-200/90 rounded-2xl p-3.5 flex items-center justify-between shadow-sm cursor-pointer hover:border-brand-300 transition"
      >
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-brand-50 flex items-center justify-center text-brand-600 flex-shrink-0">
            <MapPin className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Điểm đến đã đặt</div>
            <div className="text-base font-bold text-slate-900 leading-snug">
              {settings.destinationName}
            </div>
            <div className="text-xs text-slate-500">
              Bán kính báo tin: <span className="font-semibold text-slate-700">{settings.radiusMeters} m</span>
            </div>
          </div>
        </div>
        <div className="flex items-center text-slate-400">
          <ChevronRight className="w-5 h-5" />
        </div>
      </div>

      {/* 3. Three Metric Boxes */}
      <MetricBoxes
        speedKmh={metrics.speedKmh}
        distanceMeters={metrics.distanceMeters}
        etaMinutes={metrics.etaMinutes}
      />

      {/* 4. GPS Accuracy & Status Line */}
      <div className="bg-white border border-slate-200/90 rounded-2xl px-4 py-3 flex items-center justify-between shadow-sm text-xs">
        <div className="flex items-center space-x-2">
          <Signal className={`w-4 h-4 ${metrics.accuracy && metrics.accuracy <= 50 ? 'text-emerald-500' : 'text-amber-500'}`} />
          <span className="text-slate-600">
            Độ chính xác GPS: <span className="font-bold text-slate-900">{metrics.accuracy ? `±${Math.round(metrics.accuracy)}m` : 'Đang chờ...'}</span>
          </span>
        </div>
        <div className="text-slate-500 text-[11px]">
          {metrics.lastUpdated ? `Cập nhật: ${formatTime(metrics.lastUpdated)}` : 'Chưa có mẫu'}
        </div>
      </div>

      {/* Warning if GPS error or stale */}
      {(gpsError || isGpsStale) && (
        <div className="bg-rose-50 border border-rose-200 rounded-2xl p-3 flex items-start space-x-2.5 text-xs text-rose-800">
          <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
          <div>
            <span className="font-bold">Cảnh báo GPS: </span>
            {gpsError || 'Chưa nhận được vị trí mới trong hơn 5 phút. Hãy kiểm tra lại cài đặt quyền và bật GPS máy.'}
          </div>
        </div>
      )}

      {/* 5. Big Action Button */}
      <div className="pt-2">
        <BigButton
          state={tripState}
          onStart={handleStart}
          onStopRequest={() => setShowStopModal(true)}
          onReset={resetTrip}
        />
      </div>

      {/* 6. Notification Channels Status */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-3.5 shadow-sm space-y-2.5">
        <div className="text-xs font-bold text-slate-800 flex items-center justify-between">
          <span>Kênh báo tin cho người nhà</span>
          <button
            onClick={() => setActiveTab('settings')}
            className="text-brand-600 hover:text-brand-700 text-[11px] font-semibold flex items-center"
          >
            Cấu hình <ChevronRight className="w-3.5 h-3.5 ml-0.5" />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs">
          {/* Telegram Status */}
          <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Send className="w-4 h-4 text-sky-500" />
              <span className="font-medium text-slate-700">Telegram</span>
            </div>
            <span
              className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                telegramStatus === 'connected'
                  ? 'bg-emerald-100 text-emerald-700'
                  : telegramStatus === 'error'
                  ? 'bg-rose-100 text-rose-700'
                  : 'bg-amber-100 text-amber-700'
              }`}
            >
              {telegramStatus === 'connected' ? 'Sẵn sàng' : telegramStatus === 'error' ? 'Lỗi' : 'Chưa đặt'}
            </span>
          </div>

          {/* SMS Status */}
          <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <MessageSquare className="w-4 h-4 text-indigo-500" />
              <span className="font-medium text-slate-700">SMS SIM</span>
            </div>
            <span
              className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                hasSmsConfigured
                  ? 'bg-emerald-100 text-emerald-700'
                  : 'bg-amber-100 text-amber-700'
              }`}
            >
              {hasSmsConfigured ? 'Sẵn sàng' : 'Chưa đặt'}
            </span>
          </div>
        </div>
      </div>

      {/* Simulator Shortcut for easy testing */}
      <div
        onClick={() => setActiveTab('simulator')}
        className="bg-gradient-to-r from-sky-50 to-indigo-50 border border-sky-200/80 rounded-2xl p-3 flex items-center justify-between cursor-pointer hover:shadow-md transition text-xs"
      >
        <div className="flex items-center space-x-2.5">
          <PlayCircle className="w-5 h-5 text-brand-600" />
          <div>
            <div className="font-bold text-slate-800">Thử nghiệm GPS ảo ngay tại chỗ</div>
            <div className="text-[11px] text-slate-600">Chạy mô phỏng xe tới điểm đến để kiểm tra tự động gửi tin</div>
          </div>
        </div>
        <ChevronRight className="w-4 h-4 text-slate-400" />
      </div>

      {/* Stop confirmation modal */}
      <ConfirmModal
        isOpen={showStopModal}
        title="Dừng hành trình?"
        message="Hành trình sẽ dừng theo dõi vị trí ngầm và không tự động gửi tin nhắn báo đến nữa."
        confirmText="Dừng ngay"
        cancelText="Tiếp tục đi"
        isDanger={true}
        onConfirm={handleConfirmStop}
        onCancel={() => setShowStopModal(false)}
      />
    </div>
  );
}
