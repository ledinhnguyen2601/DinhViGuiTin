import React, { useState } from 'react';
import {
  MapPin,
  Send,
  MessageSquare,
  Crosshair,
  Key,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  HelpCircle,
  Eye,
  EyeOff,
  Radio,
  Clock,
  Sparkles,
  Loader2
} from 'lucide-react';
import { LocationService } from '../services/location.js';
import { StorageService } from '../services/storage.js';
import { TelegramService } from '../services/telegram.js';
import { ConfirmModal } from '../components/ConfirmModal.jsx';

export function Settings({ tracker }) {
  const {
    settings,
    secrets,
    updateSettings,
    updateSecrets,
    testTelegramConnection,
    sendTestTelegram,
    sendTestSms,
  } = tracker;

  const [formSettings, setFormSettings] = useState({ ...settings });
  const [formSecrets, setFormSecrets] = useState({ ...secrets });
  const [showToken, setShowToken] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [toast, setToast] = useState(null); // { type, msg }
  const [isTestingTg, setIsTestingTg] = useState(false);
  const [isSendingTgTest, setIsSendingTgTest] = useState(false);
  const [isSendingSmsTest, setIsSendingSmsTest] = useState(false);
  const [isFetchingChatId, setIsFetchingChatId] = useState(false);
  const [showClearModal, setShowClearModal] = useState(false);

  const showNotification = (type, msg) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 4000);
  };

  const handleSaveAll = async () => {
    await updateSettings(formSettings);
    await updateSecrets(formSecrets);
    showNotification('success', 'Đã lưu toàn bộ cấu hình thành công!');
  };

  const handleUseCurrentLocation = async () => {
    setIsLocating(true);
    try {
      const pos = await LocationService.getCurrentPosition();
      setFormSettings((prev) => ({
        ...prev,
        destinationLat: Number(pos.lat.toFixed(6)),
        destinationLng: Number(pos.lng.toFixed(6)),
      }));
      showNotification('success', `Đã lấy tọa độ hiện tại (±${Math.round(pos.accuracy || 0)}m)!`);
    } catch (e) {
      showNotification('error', `Lỗi lấy vị trí: ${e.message}`);
    } finally {
      setIsLocating(false);
    }
  };

  const handleTestTg = async () => {
    setIsTestingTg(true);
    await updateSecrets(formSecrets);
    const res = await testTelegramConnection();
    setIsTestingTg(false);
    if (res.ok) {
      showNotification('success', `Kết nối Telegram OK! Bot: @${res.botInfo.username}`);
    } else {
      showNotification('error', res.message || res.error);
    }
  };

  const handleSendTgTest = async () => {
    setIsSendingTgTest(true);
    await updateSecrets(formSecrets);
    const res = await sendTestTelegram();
    setIsSendingTgTest(false);
    if (res.ok) {
      showNotification('success', 'Đã gửi tin nhắn thử nghiệm vào nhóm Telegram!');
    } else {
      showNotification('error', res.message || res.error);
    }
  };

  const handleSendSmsTest = async () => {
    setIsSendingSmsTest(true);
    await updateSecrets(formSecrets);
    const res = await sendTestSms();
    setIsSendingSmsTest(false);
    if (res.ok) {
      showNotification('success', `Đã gửi SMS thử nghiệm tới ${res.successCount} số!`);
    } else {
      showNotification('error', res.errors?.[0] || res.message || 'Lỗi gửi SMS');
    }
  };

  const handleFetchChatId = async () => {
    setIsFetchingChatId(true);
    await updateSecrets(formSecrets);
    const res = await TelegramService.getLatestChatId(formSecrets.telegramBotToken);
    setIsFetchingChatId(false);
    if (res.ok) {
      setFormSecrets((prev) => ({ ...prev, telegramChatId: res.chatId }));
      showNotification('success', `Tìm thấy Chat ID: ${res.chatId} (${res.chatTitle})`);
    } else {
      showNotification('error', res.error);
    }
  };

  const handleClearAllData = async () => {
    setShowClearModal(false);
    await StorageService.clearAll();
    window.location.reload();
  };

  return (
    <div className="space-y-5 pb-24 text-sm animate-fade-in">
      {/* Toast alert */}
      {toast && (
        <div
          className={`fixed top-16 left-4 right-4 z-50 p-3.5 rounded-2xl shadow-xl border flex items-center space-x-2.5 transition animate-slide-down ${
            toast.type === 'success'
              ? 'bg-emerald-600 text-white border-emerald-500'
              : 'bg-rose-600 text-white border-rose-500'
          }`}
        >
          {toast.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
          ) : (
            <AlertTriangle className="w-5 h-5 flex-shrink-0" />
          )}
          <span className="text-xs font-semibold leading-snug">{toast.msg}</span>
        </div>
      )}

      {/* 1. Header with quick Save button */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">Cài đặt hệ thống</h1>
          <p className="text-xs text-slate-500">Cấu hình điểm đến và các kênh thông báo</p>
        </div>
        <button
          onClick={handleSaveAll}
          className="px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 active:scale-95 text-white font-bold text-xs shadow-md shadow-brand-500/20 transition cursor-pointer"
        >
          Lưu tất cả
        </button>
      </div>

      {/* 2. Destination & Traveler */}
      <section className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-sm space-y-3.5">
        <div className="flex items-center space-x-2 pb-1 border-b border-slate-100">
          <MapPin className="w-4 h-4 text-brand-600" />
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700">Điểm đến & Người đi</h2>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Tên người đi (xuất hiện trong tin nhắn)
          </label>
          <input
            type="text"
            maxLength={30}
            value={formSettings.travelerName}
            onChange={(e) => setFormSettings({ ...formSettings, travelerName: e.target.value })}
            placeholder="VD: Đình Nguyên"
            className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500 font-medium text-slate-900"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Tên điểm đến
          </label>
          <input
            type="text"
            maxLength={50}
            value={formSettings.destinationName}
            onChange={(e) => setFormSettings({ ...formSettings, destinationName: e.target.value })}
            placeholder="VD: Nhà, Quê ngoại, Ký túc xá"
            className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500 font-medium text-slate-900"
          />
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Vĩ độ (Lat)</label>
            <input
              type="number"
              step="any"
              value={formSettings.destinationLat}
              onChange={(e) =>
                setFormSettings({ ...formSettings, destinationLat: parseFloat(e.target.value) || 0 })
              }
              className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500 font-mono text-xs text-slate-900"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Kinh độ (Lng)</label>
            <input
              type="number"
              step="any"
              value={formSettings.destinationLng}
              onChange={(e) =>
                setFormSettings({ ...formSettings, destinationLng: parseFloat(e.target.value) || 0 })
              }
              className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500 font-mono text-xs text-slate-900"
            />
          </div>
        </div>

        <button
          onClick={handleUseCurrentLocation}
          disabled={isLocating}
          className="w-full py-2.5 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold flex items-center justify-center space-x-2 transition cursor-pointer"
        >
          {isLocating ? (
            <Loader2 className="w-4 h-4 animate-spin text-brand-600" />
          ) : (
            <Crosshair className="w-4 h-4 text-brand-600" />
          )}
          <span>{isLocating ? 'Đang đọc tọa độ GPS...' : 'Lấy vị trí hiện tại làm điểm đến'}</span>
        </button>

        {/* Geofence radius slider */}
        <div>
          <div className="flex justify-between items-center mb-1">
            <label className="text-xs font-semibold text-slate-700">Bán kính Geofence</label>
            <span className="text-xs font-bold text-brand-600">{formSettings.radiusMeters} mét</span>
          </div>
          <input
            type="range"
            min={50}
            max={500}
            step={10}
            value={formSettings.radiusMeters}
            onChange={(e) =>
              setFormSettings({ ...formSettings, radiusMeters: parseInt(e.target.value) })
            }
            className="w-full accent-brand-600 cursor-pointer"
          />
          <div className="flex justify-between text-[10px] text-slate-400 mt-0.5">
            <span>50m (Chính xác)</span>
            <span>100m (Khuyên dùng)</span>
            <span>500m (Rộng)</span>
          </div>
        </div>
      </section>

      {/* 3. Telegram Bot Configuration */}
      <section className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-sm space-y-3.5">
        <div className="flex items-center justify-between pb-1 border-b border-slate-100">
          <div className="flex items-center space-x-2">
            <Send className="w-4 h-4 text-sky-500" />
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700">Kênh chính: Telegram Bot</h2>
          </div>
          <span className="text-[10px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
            Miễn phí
          </span>
        </div>

        <div>
          <div className="flex justify-between items-center mb-1">
            <label className="text-xs font-semibold text-slate-700">Bot Token (từ @BotFather)</label>
            <button
              onClick={() => setShowToken(!showToken)}
              className="text-slate-400 hover:text-slate-600 text-xs flex items-center space-x-1"
            >
              {showToken ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              <span className="text-[11px]">{showToken ? 'Ẩn' : 'Hiện'}</span>
            </button>
          </div>
          <input
            type={showToken ? 'text' : 'password'}
            value={formSecrets.telegramBotToken}
            onChange={(e) => setFormSecrets({ ...formSecrets, telegramBotToken: e.target.value })}
            placeholder="123456789:AAFlkjw9384jsdfk..."
            className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500 font-mono text-xs text-slate-900"
          />
        </div>

        <div>
          <div className="flex justify-between items-center mb-1">
            <label className="text-xs font-semibold text-slate-700">Chat ID (Nhóm hoặc người nhận)</label>
            <button
              onClick={handleFetchChatId}
              disabled={isFetchingChatId}
              className="text-brand-600 hover:text-brand-700 text-[11px] font-semibold flex items-center space-x-1"
            >
              {isFetchingChatId && <Loader2 className="w-3 h-3 animate-spin mr-1" />}
              <span>Tự lấy Chat ID</span>
            </button>
          </div>
          <input
            type="text"
            value={formSecrets.telegramChatId}
            onChange={(e) => setFormSecrets({ ...formSecrets, telegramChatId: e.target.value })}
            placeholder="-100123456789"
            className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500 font-mono text-xs text-slate-900"
          />
        </div>

        <div className="grid grid-cols-2 gap-2 pt-1">
          <button
            onClick={handleTestTg}
            disabled={isTestingTg}
            className="py-2.5 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold flex items-center justify-center space-x-1.5 transition cursor-pointer"
          >
            {isTestingTg ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Key className="w-3.5 h-3.5" />}
            <span>Kiểm tra Token</span>
          </button>
          <button
            onClick={handleSendTgTest}
            disabled={isSendingTgTest}
            className="py-2.5 px-3 rounded-xl bg-sky-50 hover:bg-sky-100 text-sky-700 text-xs font-semibold flex items-center justify-center space-x-1.5 transition cursor-pointer"
          >
            {isSendingTgTest ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
            <span>Gửi tin thử</span>
          </button>
        </div>
      </section>

      {/* 4. SMS Backup Configuration */}
      <section className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-sm space-y-3.5">
        <div className="flex items-center justify-between pb-1 border-b border-slate-100">
          <div className="flex items-center space-x-2">
            <MessageSquare className="w-4 h-4 text-indigo-500" />
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700">Kênh dự phòng: SMS từ SIM</h2>
          </div>
          <span className="text-[10px] font-semibold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">
            Khi mất mạng
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Số người thân 1</label>
            <input
              type="tel"
              value={formSecrets.backupPhone1}
              onChange={(e) => setFormSecrets({ ...formSecrets, backupPhone1: e.target.value })}
              placeholder="0912345678"
              className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500 font-mono text-xs text-slate-900"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Số người thân 2 (Tùy chọn)</label>
            <input
              type="tel"
              value={formSecrets.backupPhone2}
              onChange={(e) => setFormSecrets({ ...formSecrets, backupPhone2: e.target.value })}
              placeholder="0987654321"
              className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500 font-mono text-xs text-slate-900"
            />
          </div>
        </div>

        <button
          onClick={handleSendSmsTest}
          disabled={isSendingSmsTest}
          className="w-full py-2.5 px-3 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-semibold flex items-center justify-center space-x-1.5 transition cursor-pointer"
        >
          {isSendingSmsTest ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <MessageSquare className="w-3.5 h-3.5" />}
          <span>Gửi tin SMS thử nghiệm</span>
        </button>
      </section>

      {/* 5. Dispatch Mode & Advanced Options */}
      <section className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-sm space-y-3.5">
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700 pb-1 border-b border-slate-100">
          Chế độ gửi & Tùy chọn nâng cao
        </h2>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1.5">Chế độ gửi tin báo</label>
          <div className="space-y-1.5">
            {[
              {
                id: 'telegram_with_sms_fallback',
                title: 'Telegram + SMS dự phòng (Khuyên dùng)',
                desc: 'Ưu tiên Telegram. Nếu quá 60s lỗi mạng sẽ tự động chuyển SMS từ SIM.',
              },
              {
                id: 'telegram_only',
                title: 'Chỉ Telegram',
                desc: 'Chỉ gửi qua Telegram bot, không gửi tin nhắn SMS tốn cước.',
              },
              {
                id: 'sms_only',
                title: 'Chỉ SMS từ SIM',
                desc: 'Gửi thẳng SMS trực tiếp từ máy mà không cần mạng Internet.',
              },
            ].map((mode) => (
              <label
                key={mode.id}
                onClick={() => setFormSettings({ ...formSettings, sendMode: mode.id })}
                className={`flex items-start space-x-3 p-3 rounded-xl border cursor-pointer transition ${
                  formSettings.sendMode === mode.id
                    ? 'border-brand-500 bg-brand-50/50'
                    : 'border-slate-200 hover:bg-slate-50'
                }`}
              >
                <input
                  type="radio"
                  name="sendMode"
                  checked={formSettings.sendMode === mode.id}
                  onChange={() => {}}
                  className="mt-0.5 accent-brand-600"
                />
                <div>
                  <div className="font-semibold text-xs text-slate-900">{mode.title}</div>
                  <div className="text-[11px] text-slate-500">{mode.desc}</div>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Toggles */}
        <div className="space-y-2 pt-2 border-t border-slate-100">
          <label className="flex items-center justify-between py-1 cursor-pointer">
            <div>
              <div className="font-semibold text-xs text-slate-800">Gửi tin "Bắt đầu hành trình"</div>
              <div className="text-[11px] text-slate-500">Báo người nhà ngay khi bạn bấm Bắt đầu</div>
            </div>
            <input
              type="checkbox"
              checked={formSettings.sendStartMessage}
              onChange={(e) => setFormSettings({ ...formSettings, sendStartMessage: e.target.checked })}
              className="w-5 h-5 accent-brand-600 rounded cursor-pointer"
            />
          </label>

          <label className="flex items-center justify-between py-1 cursor-pointer">
            <div>
              <div className="font-semibold text-xs text-slate-800">Luôn gửi cả SMS</div>
              <div className="text-[11px] text-slate-500">Gửi đồng thời cả Telegram và SMS khi đến đích</div>
            </div>
            <input
              type="checkbox"
              checked={formSettings.alwaysSendSms}
              onChange={(e) => setFormSettings({ ...formSettings, alwaysSendSms: e.target.checked })}
              className="w-5 h-5 accent-brand-600 rounded cursor-pointer"
            />
          </label>

          <div className="flex items-center justify-between py-1">
            <div>
              <div className="font-semibold text-xs text-slate-800">Thời gian tối đa hành trình</div>
              <div className="text-[11px] text-slate-500">Tự động tắt GPS sau số giờ đã chọn</div>
            </div>
            <select
              value={formSettings.maxTripHours}
              onChange={(e) => setFormSettings({ ...formSettings, maxTripHours: parseInt(e.target.value) })}
              className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs font-bold text-slate-900 focus:outline-none"
            >
              {[1, 2, 4, 8, 12, 18, 24].map((h) => (
                <option key={h} value={h}>
                  {h} giờ
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      {/* 6. Save & Danger zone */}
      <div className="space-y-2.5 pt-2">
        <button
          onClick={handleSaveAll}
          className="w-full py-3.5 px-4 rounded-2xl bg-brand-600 hover:bg-brand-700 active:scale-98 text-white font-bold text-sm shadow-lg shadow-brand-500/20 transition cursor-pointer"
        >
          LƯU TẤT CẢ CẤU HÌNH
        </button>

        <button
          onClick={() => setShowClearModal(true)}
          className="w-full py-3 px-4 rounded-2xl bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-semibold flex items-center justify-center space-x-1.5 transition cursor-pointer"
        >
          <Trash2 className="w-4 h-4" />
          <span>Xóa toàn bộ dữ liệu & đặt lại gốc</span>
        </button>
      </div>

      {/* Clear confirmation */}
      <ConfirmModal
        isOpen={showClearModal}
        title="Xóa toàn bộ dữ liệu?"
        message="Hành động này sẽ xóa vĩnh viễn cấu hình điểm đến, bot token, số điện thoại và nhật ký hành trình."
        confirmText="Xác nhận xóa"
        cancelText="Giữ lại"
        isDanger={true}
        onConfirm={handleClearAllData}
        onCancel={() => setShowClearModal(false)}
      />
    </div>
  );
}
