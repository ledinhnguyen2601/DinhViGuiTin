import React, { useState, useEffect, useRef } from 'react';
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
  Loader2,
  Link as LinkIcon
} from 'lucide-react';
import { CapacitorHttp } from '@capacitor/core';
import { LocationService } from '../services/location.js';
import { StorageService } from '../services/storage.js';
import { TelegramService } from '../services/telegram.js';
import { ConfirmModal } from '../components/ConfirmModal.jsx';
import { MapPicker } from '../components/MapPicker.jsx';
import { DEFAULT_RADIUS } from '../config/constants.js';
import { testDiscordWebhook, validateDiscordWebhookUrl } from '../services/discord.js';

function DiscordIcon({ className = 'w-4 h-4' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994.021-.041.001-.09-.041-.106a13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.061 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.894.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.028zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
    </svg>
  );
}

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

  // Keep refs in sync for auto-saving on unmount
  const formSettingsRef = useRef(formSettings);
  const formSecretsRef = useRef(formSecrets);
  useEffect(() => {
    formSettingsRef.current = formSettings;
  }, [formSettings]);
  useEffect(() => {
    formSecretsRef.current = formSecrets;
  }, [formSecrets]);

  // Sync form state when tracker settings/secrets finish loading from storage
  useEffect(() => {
    setFormSettings((prev) => ({ ...settings, ...prev }));
  }, [settings]);

  useEffect(() => {
    setFormSecrets((prev) => ({ ...secrets, ...prev }));
  }, [secrets]);

  // Auto-save on unmount (e.g. when user switches tab to Home)
  useEffect(() => {
    return () => {
      if (formSettingsRef.current) {
        updateSettings(formSettingsRef.current);
      }
      if (formSecretsRef.current) {
        updateSecrets(formSecretsRef.current);
      }
    };
  }, [updateSettings, updateSecrets]);
  const [showToken, setShowToken] = useState(false);
  const [showDiscordUrl, setShowDiscordUrl] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [toast, setToast] = useState(null); // { type, msg }
  const [isTestingTg, setIsTestingTg] = useState(false);
  const [isSendingTgTest, setIsSendingTgTest] = useState(false);
  const [isTestingDiscord, setIsTestingDiscord] = useState(false);
  const [discordTestResult, setDiscordTestResult] = useState(null);
  const [isSendingSmsTest, setIsSendingSmsTest] = useState(false);
  const [isFetchingChatId, setIsFetchingChatId] = useState(false);
  const [showClearModal, setShowClearModal] = useState(false);
  const [showMapPicker, setShowMapPicker] = useState(false);
  
  const [pastedLink, setPastedLink] = useState('');
  const [isParsingLink, setIsParsingLink] = useState(false);

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

  const handleParseMapLink = async () => {
    if (!pastedLink) return;
    setIsParsingLink(true);
    try {
      let urlToParse = pastedLink;
      
      // If it's a short link, try to unshorten it using CapacitorHttp
      if (urlToParse.includes('maps.app.goo.gl') || urlToParse.includes('goo.gl/maps')) {
         try {
            const response = await CapacitorHttp.get({
               url: urlToParse,
               // we just want to follow redirects and get the final URL
            });
            if (response.url) {
               urlToParse = response.url;
            }
         } catch(e) {
            console.warn("Could not unshorten link via CapacitorHttp", e);
            // Fallback for web testing (might fail due to CORS)
            try {
               const res = await fetch(urlToParse, { method: 'HEAD' });
               urlToParse = res.url;
            } catch(e2) {}
         }
      }

      // Try to extract @lat,lng
      const regex = /@(-?\d+\.\d+),(-?\d+\.\d+)/;
      const match = urlToParse.match(regex);
      if (match && match.length >= 3) {
        const lat = parseFloat(match[1]);
        const lng = parseFloat(match[2]);
        setFormSettings((prev) => ({
          ...prev,
          destinationLat: Number(lat.toFixed(6)),
          destinationLng: Number(lng.toFixed(6)),
        }));
        showNotification('success', `Đã trích xuất tọa độ thành công!`);
        setPastedLink('');
      } else {
         // Try extracting from query params api=1&query=lat,lng
         const queryRegex = /query=(-?\d+\.\d+),(-?\d+\.\d+)/;
         const qMatch = urlToParse.match(queryRegex);
         if (qMatch && qMatch.length >= 3) {
            const lat = parseFloat(qMatch[1]);
            const lng = parseFloat(qMatch[2]);
            setFormSettings((prev) => ({
              ...prev,
              destinationLat: Number(lat.toFixed(6)),
              destinationLng: Number(lng.toFixed(6)),
            }));
            showNotification('success', `Đã trích xuất tọa độ thành công!`);
            setPastedLink('');
         } else {
            showNotification('error', 'Không tìm thấy tọa độ trong link này. Vui lòng mở link, copy URL dài trên thanh địa chỉ.');
         }
      }
    } catch(e) {
       showNotification('error', 'Lỗi khi xử lý link: ' + e.message);
    } finally {
      setIsParsingLink(false);
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

  const handleTestDiscord = async () => {
    setIsTestingDiscord(true);
    setDiscordTestResult(null);
    await updateSecrets(formSecrets);
    const res = await testDiscordWebhook(formSecrets.discordWebhookUrl);
    setIsTestingDiscord(false);
    if (res.ok) {
      setDiscordTestResult({ ok: true, text: '✅ Kết nối thành công' });
      showNotification('success', '✅ Kết nối thành công');
    } else {
      setDiscordTestResult({ ok: false, text: `❌ Lỗi: ${res.error || 'Không thể kết nối'}` });
      showNotification('error', `❌ Lỗi: ${res.error || 'Không thể kết nối'}`);
    }
  };

  const isDiscordMode = formSettings.sendMode === 'discord' || formSettings.chedoGui === 'discord';
  const rawDiscordUrl = (formSecrets.discordWebhookUrl || '').trim();
  const isDiscordUrlValid = validateDiscordWebhookUrl(rawDiscordUrl);
  const isDiscordUrlInvalid = rawDiscordUrl.length > 0 && !isDiscordUrlValid;

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
      {showMapPicker && (
        <MapPicker
          initialLat={formSettings.destinationLat}
          initialLng={formSettings.destinationLng}
          onSelect={(lat, lng) => {
            setFormSettings({ ...formSettings, destinationLat: Number(lat.toFixed(6)), destinationLng: Number(lng.toFixed(6)) });
            setShowMapPicker(false);
            showNotification('success', `Đã chọn vị trí: ${lat.toFixed(5)}, ${lng.toFixed(5)}`);
          }}
          onClose={() => setShowMapPicker(false)}
        />
      )}
      
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
            Tên người đi (xuất hiện trong tin nhắn & nhận diện lệnh bot)
          </label>
          <input
            type="text"
            maxLength={30}
            value={formSettings.travelerName ?? ''}
            onChange={(e) => setFormSettings({ ...formSettings, travelerName: e.target.value })}
            onBlur={() => updateSettings(formSettings)}
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
            value={formSettings.destinationName ?? ''}
            onChange={(e) => setFormSettings({ ...formSettings, destinationName: e.target.value })}
            onBlur={() => updateSettings(formSettings)}
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

        {/* Dán link Google Maps */}
        <div className="pt-1">
          <label className="block text-[11px] font-semibold text-slate-700 mb-1">
            Dán link Google Maps (để lấy tọa độ tự động)
          </label>
          <div className="flex space-x-2">
            <input
              type="url"
              value={pastedLink}
              onChange={(e) => setPastedLink(e.target.value)}
              placeholder="VD: https://maps.app.goo.gl/..."
              className="flex-1 px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500 text-xs text-slate-900"
            />
            <button
              onClick={handleParseMapLink}
              disabled={!pastedLink || isParsingLink}
              className="px-3 py-2 rounded-xl bg-brand-50 hover:bg-brand-100 text-brand-700 text-xs font-bold disabled:opacity-50 transition flex items-center"
            >
              {isParsingLink ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Lấy tọa độ'}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 pt-2">
          <button
            onClick={() => setShowMapPicker(true)}
            className="w-full py-2.5 px-3 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-semibold flex items-center justify-center space-x-1.5 transition cursor-pointer"
          >
            <MapPin className="w-4 h-4" />
            <span>Mở Bản đồ</span>
          </button>

          <button
            onClick={handleUseCurrentLocation}
            disabled={isLocating}
            className="w-full py-2.5 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold flex items-center justify-center space-x-1.5 transition cursor-pointer"
          >
            {isLocating ? (
              <Loader2 className="w-4 h-4 animate-spin text-brand-600" />
            ) : (
              <Crosshair className="w-4 h-4 text-brand-600" />
            )}
            <span>Đang đứng đây</span>
          </button>
        </div>

        {/* Geofence radius slider (FR-02: Bán kính geofence mặc định 100m) */}
        <div>
          <div className="flex justify-between items-center mb-1">
            <label className="text-xs font-semibold text-slate-700">Bán kính Geofence (FR-02)</label>
            <span className="text-xs font-bold text-brand-600">
              {formSettings.radiusMeters || DEFAULT_RADIUS} mét
            </span>
          </div>
          <input
            type="range"
            min={50}
            max={500}
            step={10}
            value={formSettings.radiusMeters || DEFAULT_RADIUS}
            onChange={(e) =>
              setFormSettings({ ...formSettings, radiusMeters: parseInt(e.target.value) || DEFAULT_RADIUS })
            }
            className="w-full accent-brand-600 cursor-pointer"
          />
          <div className="flex justify-between text-[10px] text-slate-400 mt-0.5">
            <span>50m (Tối thiểu)</span>
            <span>100m (Mặc định)</span>
            <span>500m (Tối đa)</span>
          </div>
        </div>

        {/* Nút lưu nhanh riêng cho phần Điểm đến & Người đi */}
        <div className="pt-1">
          <button
            type="button"
            onClick={async () => {
              await updateSettings(formSettings);
              showNotification('success', 'Đã lưu tên người đi và điểm đến!');
            }}
            className="w-full py-2.5 px-3 rounded-xl bg-brand-50 hover:bg-brand-100 active:scale-98 text-brand-700 text-xs font-bold flex items-center justify-center space-x-1.5 transition cursor-pointer border border-brand-200"
          >
            <CheckCircle2 className="w-4 h-4 text-brand-600" />
            <span>Lưu Tên & Điểm Đến Này</span>
          </button>
        </div>
      </section>

      {/* 3. Primary Channel: Telegram or Discord Webhook */}
      {isDiscordMode ? (
        <section className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-sm space-y-3.5">
          <div className="flex items-center justify-between pb-1 border-b border-slate-100">
            <div className="flex items-center space-x-2">
              <DiscordIcon className="w-4 h-4 text-[#5865F2]" />
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700">Kênh chính: Discord Webhook</h2>
            </div>
            <span className="text-[10px] font-semibold text-[#5865F2] bg-indigo-50 px-2 py-0.5 rounded-full">
              Thử nghiệm
            </span>
          </div>

          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="text-xs font-semibold text-slate-700">Discord Webhook URL</label>
              <button
                type="button"
                onClick={() => setShowDiscordUrl(!showDiscordUrl)}
                className="text-slate-400 hover:text-slate-600 text-xs flex items-center space-x-1 cursor-pointer"
              >
                {showDiscordUrl ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                <span className="text-[11px]">{showDiscordUrl ? 'Ẩn' : 'Hiện'}</span>
              </button>
            </div>
            <div className="flex space-x-2">
              <input
                type={showDiscordUrl ? 'text' : 'password'}
                value={formSecrets.discordWebhookUrl || ''}
                onChange={(e) => {
                  setFormSecrets({ ...formSecrets, discordWebhookUrl: e.target.value });
                  setDiscordTestResult(null);
                }}
                placeholder="https://discord.com/api/webhooks/..."
                className={`flex-1 px-3 py-2 rounded-xl border font-mono text-xs text-slate-900 focus:outline-none focus:ring-2 ${
                  isDiscordUrlInvalid
                    ? 'border-rose-300 focus:ring-rose-500 bg-rose-50/30'
                    : 'border-slate-200 focus:ring-brand-500'
                }`}
              />
              <button
                type="button"
                onClick={handleTestDiscord}
                disabled={!isDiscordUrlValid || isTestingDiscord}
                className="px-3.5 py-2 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-[#5865F2] text-xs font-semibold flex items-center space-x-1.5 transition disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer whitespace-nowrap"
              >
                {isTestingDiscord ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Send className="w-3.5 h-3.5" />
                )}
                <span>Kiểm tra Discord</span>
              </button>
            </div>
            {isDiscordUrlInvalid && (
              <p className="text-[11px] text-rose-600 font-medium mt-1">
                URL phải bắt đầu bằng https://discord.com/api/webhooks/
              </p>
            )}
            {discordTestResult && (
              <div
                className={`mt-2.5 p-2 rounded-xl text-xs font-semibold flex items-center space-x-1.5 border ${
                  discordTestResult.ok
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : 'bg-rose-50 text-rose-700 border-rose-200'
                }`}
              >
                <span>{discordTestResult.text}</span>
              </div>
            )}
          </div>
        </section>
      ) : (
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
      )}

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
              {
                id: 'discord',
                title: 'Discord Webhook',
                desc: 'Dùng để thử nghiệm',
              },
            ].map((mode) => (
              <label
                key={mode.id}
                onClick={() => setFormSettings({ ...formSettings, sendMode: mode.id, chedoGui: mode.id })}
                className={`flex items-start space-x-3 p-3 rounded-xl border cursor-pointer transition ${
                  (formSettings.sendMode === mode.id || formSettings.chedoGui === mode.id)
                    ? 'border-brand-500 bg-brand-50/50'
                    : 'border-slate-200 hover:bg-slate-50'
                }`}
              >
                <input
                  type="radio"
                  name="sendMode"
                  checked={formSettings.sendMode === mode.id || formSettings.chedoGui === mode.id}
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
