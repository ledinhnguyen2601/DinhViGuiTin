import { useEffect, useRef } from 'react';
import { TelegramService } from '../services/telegram.js';
import { LocationService } from '../services/location.js';
import { Device } from '@capacitor/device';
import { Network } from '@capacitor/network';
import { formatTime } from '../services/geo.js';

export function useTelegramBot(tracker) {
  const { secrets, settings, metrics, tripState } = tracker;
  const updateIdRef = useRef(null);
  const pollingRef = useRef(false);

  useEffect(() => {
    // Only poll if Telegram is configured and app is tracking (or idle, depends on user preference, 
    // but usually we want to allow query anytime as long as app is open. Let's poll anytime it's configured).
    if (!secrets.telegramBotToken) {
      return;
    }

    let isMounted = true;
    let timeoutId;

    const poll = async () => {
      if (!isMounted) return;
      if (pollingRef.current) return;
      
      pollingRef.current = true;
      try {
        const res = await TelegramService.getUpdates(
          secrets.telegramBotToken, 
          updateIdRef.current, 
          10 // 10 seconds long polling
        );

        if (res.ok && res.updates.length > 0) {
          for (const update of res.updates) {
            updateIdRef.current = update.update_id + 1; // Mark as read

            const message = update.message || update.channel_post;
            if (!message || !message.text) continue;

            const senderChatId = String(message.chat.id);
            const isTargetChat = !secrets.telegramChatId || senderChatId === String(secrets.telegramChatId) || message.chat.type === 'private';
            if (!isTargetChat) {
              continue;
            }

            const text = message.text.trim().toLowerCase();
            
            // Lệnh có thể là "/vitri", "/vitri Hieu", "/where Lan", "vitri", "where"
            const parts = text.split(' ').filter(Boolean);
            const cmd = parts[0];
            const nameParam = parts.slice(1).join(' ').toLowerCase();

            // Nếu đây là lệnh vị trí
            if (
              cmd === '/vitri' || 
              cmd === '/where' || 
              cmd === 'vitri' || 
              cmd === 'where' || 
              cmd.startsWith('/vitri@') || 
              cmd.startsWith('/where@')
            ) {
              // Nếu có truyền tên, kiểm tra xem tên có khớp với thiết bị này không
              if (nameParam) {
                const myName = (settings.travelerName || '').toLowerCase();
                // Nếu tên không khớp (kể cả chứa một phần), thì bỏ qua không trả lời
                if (!myName || !myName.includes(nameParam)) {
                  continue; 
                }
              }

              // Gửi vị trí về chính chat đã hỏi
              await handleLocationQuery(senderChatId);
            }
          }
        }
      } catch (err) {
        console.warn('Telegram bot polling error:', err);
      } finally {
        pollingRef.current = false;
        // Schedule next poll immediately for long-polling behavior
        if (isMounted) {
            timeoutId = setTimeout(poll, 1000); // 1s delay before next request
        }
      }
    };

    poll();

    return () => {
      isMounted = false;
      clearTimeout(timeoutId);
    };
  }, [secrets.telegramBotToken, secrets.telegramChatId, settings.travelerName, settings.destinationName, metrics.lastUpdated]);

  const handleLocationQuery = async (targetChatId) => {
    const replyChatId = targetChatId || secrets.telegramChatId;
    if (!replyChatId) return;

    try {
      // 1. Get fresh location or instant cached fix
      let pos = null;
      const lastKnown = LocationService.getLastKnownPosition();

      // If last known position is fresh (< 2 mins), use it immediately for lightning response
      if (lastKnown && typeof lastKnown.lat === 'number' && typeof lastKnown.lng === 'number' && (Date.now() - (lastKnown.timestamp || 0) < 120000)) {
        pos = lastKnown;
      } else {
        try {
          pos = await LocationService.getCurrentPosition();
        } catch (e) {
          if (lastKnown && typeof lastKnown.lat === 'number' && typeof lastKnown.lng === 'number') {
            pos = lastKnown;
          } else if (metrics && typeof metrics.lat === 'number' && typeof metrics.lng === 'number') {
            pos = { lat: metrics.lat, lng: metrics.lng, accuracy: metrics.accuracy };
          } else {
            throw new Error('Chưa lấy được tín hiệu vệ tinh GPS. Vui lòng bật định vị máy.');
          }
        }
      }

      // Get Battery & Network Info
      let batteryInfo = "Không rõ";
      let networkInfo = "Không rõ";
      try {
        const [info, netStatus] = await Promise.all([
          Device.getBatteryInfo().catch(() => null),
          Network.getStatus().catch(() => null)
        ]);

        if (info && info.batteryLevel !== undefined) {
           const percent = Math.round(info.batteryLevel * 100);
           const isCharging = info.isCharging ? ' (Đang sạc)' : '';
           batteryInfo = `${percent}%${isCharging}`;
        }
        
        if (netStatus) {
           if (netStatus.connected) {
             networkInfo = netStatus.connectionType === 'wifi' ? 'Wi-Fi' : 
                           netStatus.connectionType === 'cellular' ? 'Mạng di động (4G/LTE)' : 'Đã kết nối';
           } else {
             networkInfo = 'Mất mạng';
           }
        }
      } catch(e) {
        console.warn("Could not get device info", e);
      }

      // Format message
      const traveler = settings.travelerName || 'Người đi';
      const mapLink = `https://www.google.com/maps?q=${pos.lat},${pos.lng}`;
      
      const speed = Math.round(metrics.speedKmh || 0);
      const timeStr = new Date().toLocaleTimeString('vi-VN');

      let reply = `📍 <b>Vị trí của ${traveler}</b>\n`;
      reply += `Vào lúc: ${timeStr}\n`;
      if (settings.destinationName) {
        reply += `Điểm đến dự kiến: <b>${settings.destinationName}</b>\n`;
      }
      reply += `Tốc độ: ${speed} km/h\n`;
      reply += `Độ chính xác: ±${Math.round(pos.accuracy || 0)}m\n`;
      reply += `Pin: ${batteryInfo} | Mạng: ${networkInfo}\n\n`;
      reply += `<a href="${mapLink}">🗺️ Xem trên Google Maps</a>`;

      await TelegramService.sendMessage(secrets.telegramBotToken, replyChatId, reply);
    } catch (err) {
      await TelegramService.sendMessage(secrets.telegramBotToken, replyChatId, `⚠️ Không thể lấy vị trí hiện tại: ${err.message}`);
    }
  };
}
