import React, { useState } from 'react';
import {
  ShieldCheck,
  MapPin,
  Bell,
  MessageSquare,
  BatteryCharging,
  Smartphone,
  CheckCircle2,
  ExternalLink,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { LocationService } from '../services/location.js';

export function Permissions() {
  const [permStatus, setPermStatus] = useState(null);
  const [activeOem, setActiveOem] = useState('xiaomi');

  const handleRequestLocation = async () => {
    const res = await LocationService.requestPermissions();
    setPermStatus(res);
  };

  const oems = [
    {
      id: 'xiaomi',
      name: 'Xiaomi / Redmi / POCO',
      steps: [
        'Vào Cài đặt > Ứng dụng > Quản lý ứng dụng > Chọn Geofencing Tracker.',
        'Bật mục "Tự khởi chạy" (Autostart).',
        'Vào mục "Tiết kiệm pin" > Chọn "Không hạn chế".',
        'Mở màn hình đa nhiệm (Recent Apps) > Nhấn giữ ứng dụng và bấm biểu tượng "Khóa" để không bị tắt khi dọn RAM.',
      ],
    },
    {
      id: 'samsung',
      name: 'Samsung OneUI',
      steps: [
        'Vào Cài đặt > Pin và chăm sóc thiết bị > Pin.',
        'Chọn "Giới hạn sử dụng dưới nền" > "Ứng dụng không bao giờ ngủ".',
        'Bấm dấu (+) và thêm Geofencing Tracker vào danh sách.',
        'Đảm bảo ứng dụng KHÔNG nằm trong mục "Ứng dụng ngủ sâu".',
      ],
    },
    {
      id: 'oppo',
      name: 'Oppo / Realme / Vivo',
      steps: [
        'Vào Cài đặt > Pin > Quản lý pin tùy chỉnh cho ứng dụng.',
        'Bật "Cho phép hoạt động dưới nền" và "Cho phép tự khởi động".',
        'Tại mục Tối ưu hóa pin, chuyển sang chế độ "Không tối ưu hóa".',
      ],
    },
    {
      id: 'pixel',
      name: 'Google Pixel / Android gốc',
      steps: [
        'Vào Cài đặt > Ứng dụng > Geofencing Tracker > Pin.',
        'Chuyển từ "Được tối ưu hóa" sang "Không hạn chế" (Unrestricted).',
      ],
    },
  ];

  return (
    <div className="space-y-4 pb-24 text-sm animate-fade-in">
      <div>
        <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">Hướng dẫn cấp quyền</h1>
        <p className="text-xs text-slate-500">Đảm bảo ứng dụng chạy ngầm liên tục khi tắt màn hình</p>
      </div>

      {/* 1. Core Permissions Card */}
      <section className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-sm space-y-3">
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center space-x-1.5 pb-1 border-b border-slate-100">
          <ShieldCheck className="w-4 h-4 text-brand-600" />
          <span>Các quyền cần thiết</span>
        </h2>

        {/* Permission 1: Location */}
        <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2.5">
              <div className="w-8 h-8 rounded-lg bg-brand-100 text-brand-600 flex items-center justify-center">
                <MapPin className="w-4 h-4" />
              </div>
              <div>
                <div className="font-bold text-xs text-slate-900">Vị trí: "Luôn cho phép"</div>
                <div className="text-[11px] text-slate-500">Theo dõi GPS ngay cả khi tắt màn hình</div>
              </div>
            </div>
            <button
              onClick={handleRequestLocation}
              className="px-3 py-1.5 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold shadow-sm transition"
            >
              Cấp quyền
            </button>
          </div>
          <div className="text-[11px] text-slate-600 bg-white p-2 rounded-lg border border-slate-200/60 leading-relaxed">
            <span className="font-bold text-brand-700">Quy trình Android 11+: </span>
            Bước 1 chọn "Khi dùng ứng dụng". Sau đó vào Cài đặt ứng dụng của máy, chọn Quyền vị trí và đổi thành <span className="font-bold text-slate-900">"Luôn cho phép" (Allow all the time)</span>.
          </div>
        </div>

        {/* Permission 2: Foreground Service Notification */}
        <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-sky-100 text-sky-600 flex items-center justify-center">
              <Bell className="w-4 h-4" />
            </div>
            <div>
              <div className="font-bold text-xs text-slate-900">Thông báo thanh trạng thái</div>
              <div className="text-[11px] text-slate-500">Hiển thị thông báo cố định dịch vụ nền</div>
            </div>
          </div>
          <span className="text-[10px] font-bold text-slate-500 bg-slate-200 px-2 py-0.5 rounded-full">
            Tự động
          </span>
        </div>

        {/* Permission 3: SMS Dispatch */}
        <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-600 flex items-center justify-center">
              <MessageSquare className="w-4 h-4" />
            </div>
            <div>
              <div className="font-bold text-xs text-slate-900">Quyền gửi SMS (SEND_SMS)</div>
              <div className="text-[11px] text-slate-500">Chỉ dùng khi Telegram gặp lỗi mạng</div>
            </div>
          </div>
          <span className="text-[10px] font-bold text-slate-500 bg-slate-200 px-2 py-0.5 rounded-full">
            Theo SIM
          </span>
        </div>
      </section>

      {/* 2. OEM Battery Optimization Guide */}
      <section className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-sm space-y-3">
        <div className="flex items-center justify-between pb-1 border-b border-slate-100">
          <div className="flex items-center space-x-1.5">
            <BatteryCharging className="w-4 h-4 text-emerald-600" />
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700">Tắt tiết kiệm pin theo hãng máy</h2>
          </div>
          <a
            href="https://dontkillmyapp.com"
            target="_blank"
            rel="noreferrer"
            className="text-[11px] text-brand-600 hover:underline flex items-center space-x-0.5"
          >
            <span>dontkillmyapp</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>

        <p className="text-xs text-slate-600 leading-relaxed">
          Nhiều hãng máy (Xiaomi, Samsung, Oppo...) có cơ chế "diệt" tác vụ nền rất mạnh. Để không bị mất GPS dọc đường, hãy làm theo hướng dẫn:
        </p>

        <div className="space-y-2">
          {oems.map((oem) => {
            const isOpen = activeOem === oem.id;
            return (
              <div
                key={oem.id}
                className="border border-slate-200 rounded-xl overflow-hidden transition"
              >
                <button
                  onClick={() => setActiveOem(isOpen ? '' : oem.id)}
                  className="w-full p-3 bg-slate-50 flex items-center justify-between font-bold text-xs text-slate-800 text-left hover:bg-slate-100 transition"
                >
                  <div className="flex items-center space-x-2">
                    <Smartphone className="w-3.5 h-3.5 text-slate-500" />
                    <span>{oem.name}</span>
                  </div>
                  {isOpen ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                </button>
                {isOpen && (
                  <div className="p-3 bg-white space-y-2 text-xs text-slate-700">
                    <ol className="list-decimal list-inside space-y-1.5">
                      {oem.steps.map((st, i) => (
                        <li key={i} className="leading-relaxed">
                          {st}
                        </li>
                      ))}
                    </ol>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
