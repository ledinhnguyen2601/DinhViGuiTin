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
    if (!secrets.telegramBotToken || !secrets.telegramChatId) {
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

            // Only respond to specific chats to avoid spam
            if (String(message.chat.id) !== String(secrets.telegramChatId)) {
                continue;
            }

            const text = message.text.trim().toLowerCase();
            
            // Lệnh có thể là "/vitri", "/vitri Hieu", "/where Lan"
            // Tách lệnh và tham số (tên)
            const parts = text.split(' ').filter(Boolean);
            const cmd = parts[0];
            const nameParam = parts.slice(1).join(' ').toLowerCase();

            // Nếu đây là lệnh vị trí
            if (cmd === '/vitri' || cmd === '/where' || cmd.startsWith('/vitri@') || cmd.startsWith('/where@')) {
              
              // Nếu có truyền tên, kiểm tra xem tên có khớp với thiết bị này không
              if (nameParam) {
                const myName = (settings.travelerName || '').toLowerCase();
                // Nếu tên không khớp (kể cả chứa một phần), thì bỏ qua không trả lời
                if (!myName || !myName.includes(nameParam)) {
                  continue; 
                }
              }

              // Nếu không truyền tên hoặc tên khớp -> gửi vị trí
              await handleLocationQuery();
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

  const handleLocationQuery = async () => {
    try {
      // Get fresh location if possible, otherwise use last known
      let pos;
      try {
         pos = await LocationService.getCurrentPosition();
      } catch(e) {
         // Fallback to metrics if GPS fails right now
         if (metrics.lastUpdated) {
             pos = { lat: metrics.lat, lng: metrics.lng, accuracy: metrics.accuracy };
         } else {
             throw new Error('Không thể lấy vị trí hiện tại.');
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
      
      let durationInfo = "";
      // If tracking, how long have they been tracking? If idle, how long have they been here?
      // For simplicity, we just send current time and speed
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

      await TelegramService.sendMessage(secrets.telegramBotToken, secrets.telegramChatId, reply);
    } catch (err) {
      await TelegramService.sendMessage(secrets.telegramBotToken, secrets.telegramChatId, `⚠️ Không thể lấy vị trí hiện tại: ${err.message}`);
    }
  };
}
