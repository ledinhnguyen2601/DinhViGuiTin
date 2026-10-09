import { useEffect, useRef } from 'react';
import { TelegramService } from '../services/telegram.js';
import { LocationService } from '../services/location.js';
import { Device } from '@capacitor/device';
import { Network } from '@capacitor/network';
import { App } from '@capacitor/app';

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export function useTelegramBot(tracker) {
  const trackerRef = useRef(tracker);
  trackerRef.current = tracker;

  const updateIdRef = useRef(null);
  const pollingRef = useRef(false);
  const abortControllerRef = useRef(null);

  const botToken = tracker?.secrets?.telegramBotToken;
  const configuredChatId = tracker?.secrets?.telegramChatId;

  useEffect(() => {
    if (!botToken) {
      return;
    }

    let isMounted = true;
    let timeoutId = null;

    const poll = async () => {
      if (!isMounted) return;
      if (pollingRef.current) return;

      pollingRef.current = true;
      const currentToken = trackerRef.current?.secrets?.telegramBotToken;
      if (!currentToken) {
        pollingRef.current = false;
        return;
      }

      // Controller to abort hanging fetch immediately when needed
      const controller = new AbortController();
      abortControllerRef.current = controller;

      // Watchdog timeout: if polling takes longer than 12s, abort & restart cleanly
      const watchdogId = setTimeout(() => {
        if (pollingRef.current && isMounted) {
          try {
            controller.abort();
          } catch {}
          pollingRef.current = false;
        }
      }, 12000);

      try {
        const res = await TelegramService.getUpdates(
          currentToken,
          updateIdRef.current,
          5, // 5s short long-polling for fast responsiveness
          controller.signal
        );

        clearTimeout(watchdogId);

        if (res.ok && res.updates.length > 0) {
          for (const update of res.updates) {
            updateIdRef.current = update.update_id + 1; // Mark update as acknowledged

            const message = update.message || update.channel_post;
            if (!message || !message.text) continue;

            const senderChatId = String(message.chat.id);
            const currentSecrets = trackerRef.current?.secrets || {};
            const isTargetChat =
              !currentSecrets.telegramChatId ||
              senderChatId === String(currentSecrets.telegramChatId) ||
              message.chat.type === 'private';

            if (!isTargetChat) {
              continue;
            }

            const text = message.text.trim().toLowerCase();
            const parts = text.split(' ').filter(Boolean);
            const cmd = parts[0];
            const nameParam = parts.slice(1).join(' ').toLowerCase();

            // Nhận các lệnh truy vấn vị trí
            if (
              cmd === '/vitri' ||
              cmd === '/where' ||
              cmd === 'vitri' ||
              cmd === 'where' ||
              cmd.startsWith('/vitri@') ||
              cmd.startsWith('/where@')
            ) {
              const currentSettings = trackerRef.current?.settings || {};
              if (nameParam) {
                const myName = (currentSettings.travelerName || '').toLowerCase();
                if (!myName || !myName.includes(nameParam)) {
                  continue;
                }
              }

              // Gửi vị trí ngay về chat hỏi
              await handleLocationQuery(senderChatId);
            }
          }
        }
      } catch (err) {
        clearTimeout(watchdogId);
        // Abort errors are expected when app switches or re-polls
        if (err.name !== 'AbortError') {
          console.warn('Telegram bot polling error:', err);
        }
      } finally {
        pollingRef.current = false;
        abortControllerRef.current = null;
        if (isMounted) {
          timeoutId = setTimeout(poll, 600); // 600ms debounce before next poll cycle
        }
      }
    };

    poll();

    // Tự động kích hoạt lại kết nối polling ngay khi vào lại app (App resume hoặc tab focus)
    const handleResume = () => {
      if (abortControllerRef.current) {
        try {
          abortControllerRef.current.abort();
        } catch {}
      }
      pollingRef.current = false;
      clearTimeout(timeoutId);
      poll();

      // Đồng thời cập nhật ngay GPS nếu có
      if (typeof trackerRef.current?.refreshCurrentPosition === 'function') {
        trackerRef.current.refreshCurrentPosition();
      }
    };

    let appListenerHandle = null;
    App.addListener('appStateChange', (state) => {
      if (state.isActive && isMounted) {
        handleResume();
      }
    }).then((h) => {
      appListenerHandle = h;
    }).catch(() => {});

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible' && isMounted) {
        handleResume();
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      isMounted = false;
      clearTimeout(timeoutId);
      if (abortControllerRef.current) {
        try {
          abortControllerRef.current.abort();
        } catch {}
      }
      if (appListenerHandle?.remove) {
        appListenerHandle.remove();
      }
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [botToken, configuredChatId]);

  const handleLocationQuery = async (targetChatId) => {
    const currentSecrets = trackerRef.current?.secrets || {};
    const currentSettings = trackerRef.current?.settings || {};
    const currentMetrics = trackerRef.current?.metrics || {};

    const replyChatId = targetChatId || currentSecrets.telegramChatId;
    if (!replyChatId || !currentSecrets.telegramBotToken) return;

    try {
      // 1. Lấy vị trí GPS mới nhất
      let pos = null;
      const lastKnown = LocationService.getLastKnownPosition();

      // Nếu vị trí trong cache còn rất mới (< 45 giây), dùng ngay lập tức để phản hồi nhanh
      if (
        lastKnown &&
        typeof lastKnown.lat === 'number' &&
        typeof lastKnown.lng === 'number' &&
        Date.now() - (lastKnown.timestamp || 0) < 45000
      ) {
        pos = lastKnown;
      } else {
        // Nếu không có hoặc đã cũ, lấy vị trí mới với timeout 4s
        try {
          pos = await Promise.race([
            LocationService.getCurrentPosition(),
            new Promise((_, reject) => setTimeout(() => reject(new Error('GPS timeout')), 4000)),
          ]);
        } catch {
          if (lastKnown && typeof lastKnown.lat === 'number' && typeof lastKnown.lng === 'number') {
            pos = lastKnown;
          } else if (currentMetrics && typeof currentMetrics.lat === 'number' && typeof currentMetrics.lng === 'number') {
            pos = { lat: currentMetrics.lat, lng: currentMetrics.lng, accuracy: currentMetrics.accuracy };
          } else {
            throw new Error('Chưa lấy được tín hiệu vệ tinh GPS. Vui lòng bật định vị máy.');
          }
        }
      }

      // 2. Thu thập thông tin Pin và Mạng
      let batteryInfo = 'Không rõ';
      let networkInfo = 'Không rõ';
      try {
        const [info, netStatus] = await Promise.all([
          Device.getBatteryInfo().catch(() => null),
          Network.getStatus().catch(() => null),
        ]);

        if (info && info.batteryLevel !== undefined) {
          const percent = Math.round(info.batteryLevel * 100);
          const isCharging = info.isCharging ? ' (Đang sạc)' : '';
          batteryInfo = `${percent}%${isCharging}`;
        }

        if (netStatus) {
          if (netStatus.connected) {
            networkInfo =
              netStatus.connectionType === 'wifi'
                ? 'Wi-Fi'
                : netStatus.connectionType === 'cellular'
                ? 'Mạng di động (4G/LTE)'
                : 'Đã kết nối';
          } else {
            networkInfo = 'Mất mạng';
          }
        }
      } catch (e) {
        console.warn('Could not get device info', e);
      }

      // 3. Soạn tin nhắn định dạng HTML
      const traveler = escapeHtml(currentSettings.travelerName || 'Người đi');
      const destName = escapeHtml(currentSettings.destinationName || '');
      const mapLink = `https://www.google.com/maps?q=${pos.lat},${pos.lng}`;
      const speed = Math.round(currentMetrics.speedKmh || 0);
      const timeStr = new Date().toLocaleTimeString('vi-VN');

      let reply = `📍 <b>Vị trí của ${traveler}</b>\n`;
      reply += `Vào lúc: ${timeStr}\n`;
      if (destName) {
        reply += `Điểm đến dự kiến: <b>${destName}</b>\n`;
      }
      reply += `Tốc độ: ${speed} km/h\n`;
      reply += `Độ chính xác: ±${Math.round(pos.accuracy || 0)}m\n`;
      reply += `Pin: ${batteryInfo} | Mạng: ${networkInfo}\n\n`;
      reply += `<a href="${mapLink}">🗺️ Xem trên Google Maps</a>`;

      await TelegramService.sendMessage(currentSecrets.telegramBotToken, replyChatId, reply);
    } catch (err) {
      await TelegramService.sendMessage(
        currentSecrets.telegramBotToken,
        replyChatId,
        `⚠️ Không thể lấy vị trí hiện tại: ${err.message}`
      );
    }
  };
}
