import React, { useState } from 'react';
import { StatusCard } from '../components/StatusCard.jsx';
import { MetricBoxes } from '../components/MetricBox.jsx';
import { BigButton } from '../components/BigButton.jsx';
import { ConfirmModal } from '../components/ConfirmModal.jsx';
import { MapPin, Send, MessageSquare, AlertCircle, Signal, CheckCircle2, ChevronRight, Battery, BatteryCharging, Wifi, WifiOff } from 'lucide-react';
import { TRIP_STATES } from '../config/constants.js';
import { formatTime } from '../services/geo.js';

function DiscordIcon({ className = 'w-4 h-4' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994.021-.041.001-.09-.041-.106a13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.061 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.894.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.028zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
    </svg>
  );
}

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
    telegramStatus,
    startTrip,
    stopTrip,
    resetTrip,
    deviceInfo,
  } = tracker;

  const [showStopModal, setShowStopModal] = useState(false);

  // Check if GPS hasn't updated in > 5 minutes
  const isGpsStale = metrics.lastUpdated && Date.now() - metrics.lastUpdated > 5 * 60 * 1000;
  const hasSmsConfigured = Boolean(secrets.backupPhone1 || secrets.backupPhone2);
  const currentMode = settings.chedoGui || settings.sendMode;
  const isDiscordMode = currentMode === 'discord' || currentMode === 'discord_with_sms_fallback';
  const hasDiscordConfigured = Boolean(secrets.discordWebhookUrl && secrets.discordWebhookUrl.trim());

  const handleStart = () => {
    startTrip();
  };

  const handleConfirmStop = () => {
    setShowStopModal(false);
    stopTrip();
  };

  return (
    <div className="space-y-4 pb-24 animate-fade-in">
      <StatusCard state={tripState} />

      {/* Device Info (Battery & Network) */}
      <div className="flex items-center justify-between px-2 text-xs font-semibold text-slate-500">
         <div className="flex items-center space-x-1.5">
            {deviceInfo.isConnected ? (
               <Wifi className="w-4 h-4 text-emerald-500" />
            ) : (
               <WifiOff className="w-4 h-4 text-rose-500" />
            )}
            <span>
               {deviceInfo.isConnected 
                  ? (deviceInfo.networkType === 'wifi' ? 'Wi-Fi' : deviceInfo.networkType === 'cellular' ? '4G/LTE' : 'Mạng OK')
                  : 'Mất mạng'
               }
            </span>
         </div>
         <div className="flex items-center space-x-1.5">
            {deviceInfo.isCharging ? (
               <BatteryCharging className="w-4 h-4 text-amber-500" />
            ) : (
               <Battery className="w-4 h-4 text-emerald-500" />
            )}
            <span>
               {deviceInfo.battery !== null ? `${deviceInfo.battery}%` : '--'}
            </span>
         </div>
      </div>

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
            <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider flex items-center space-x-1">
              <span>Người đi:</span>
              <span className="text-brand-600 font-bold">{settings.travelerName || 'Chưa đặt'}</span>
            </div>
            <div className="text-base font-bold text-slate-900 leading-snug">
              Đến: {settings.destinationName || 'Chưa đặt'}
            </div>
            <div className="text-xs text-slate-500">
              Bán kính báo tin: <span className="font-semibold text-slate-700">{settings.radiusMeters || 100} m</span>
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

        {isDiscordMode ? (
          <div className="flex flex-col gap-2 text-xs">
            {/* Dòng 1: icon Discord + "Discord Webhook" + trạng thái (Đã đặt / Chưa đặt) */}
            <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <DiscordIcon className="w-4 h-4 text-[#5865F2]" />
                <span className="font-medium text-slate-700">Discord Webhook</span>
              </div>
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  hasDiscordConfigured
                    ? 'bg-emerald-100 text-emerald-700'
                    : 'bg-amber-100 text-amber-700'
                }`}
              >
                {hasDiscordConfigured ? 'Đã đặt' : 'Chưa đặt'}
              </span>
            </div>

            {/* Dòng 2: icon SMS + "SMS SIM" + trạng thái */}
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
                {hasSmsConfigured ? 'Đã đặt' : 'Chưa đặt'}
              </span>
            </div>
          </div>
        ) : (
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
        )}
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
