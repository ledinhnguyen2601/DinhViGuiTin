import React from 'react';
import { TRIP_STATES } from '../config/constants.js';
import { CheckCircle2, AlertTriangle, Compass, StopCircle, Radio, Clock } from 'lucide-react';

export function StatusCard({ state, isSimulating }) {
  const getStatusConfig = () => {
    switch (state) {
      case TRIP_STATES.TRACKING:
        return {
          bg: 'bg-emerald-50 border-emerald-200 text-emerald-900',
          badgeBg: 'bg-emerald-500',
          badgeText: isSimulating ? 'Đang giả lập hành trình' : 'Đang theo dõi trực tiếp',
          title: 'Đang di chuyển trên đường',
          desc: 'GPS ngầm đang hoạt động. Sẽ tự động gửi tin nhắn báo người thân khi vào bán kính.',
          icon: Radio,
          iconColor: 'text-emerald-600',
          hasRadar: true,
        };
      case TRIP_STATES.STARTING:
        return {
          bg: 'bg-amber-50 border-amber-200 text-amber-900',
          badgeBg: 'bg-amber-500',
          badgeText: 'Khởi động',
          title: 'Đang bắt tín hiệu GPS...',
          desc: 'Kiểm tra quyền định vị và chuẩn bị thông báo xuất phát.',
          icon: Compass,
          iconColor: 'text-amber-600',
          hasRadar: true,
        };
      case TRIP_STATES.ARRIVED:
        return {
          bg: 'bg-indigo-50 border-indigo-200 text-indigo-900',
          badgeBg: 'bg-indigo-600',
          badgeText: 'Đã đến đích',
          title: 'Đã vào bán kính điểm đến!',
          desc: 'Đang kích hoạt quy trình gửi tin báo an (Telegram / SMS dự phòng).',
          icon: CheckCircle2,
          iconColor: 'text-indigo-600',
          hasRadar: false,
        };
      case TRIP_STATES.DONE:
        return {
          bg: 'bg-teal-50 border-teal-200 text-teal-900',
          badgeBg: 'bg-teal-600',
          badgeText: 'Hoàn tất',
          title: 'Đã gửi tin thành công cho người nhà',
          desc: 'Dịch vụ định vị ngầm đã tự động dừng để tiết kiệm pin.',
          icon: CheckCircle2,
          iconColor: 'text-teal-600',
          hasRadar: false,
        };
      case TRIP_STATES.STOPPED:
        return {
          bg: 'bg-slate-100 border-slate-300 text-slate-800',
          badgeBg: 'bg-slate-500',
          badgeText: 'Đã dừng',
          title: 'Hành trình đã kết thúc',
          desc: 'Người dùng đã chủ động dừng theo dõi vị trí.',
          icon: StopCircle,
          iconColor: 'text-slate-600',
          hasRadar: false,
        };
      case TRIP_STATES.TIMEOUT:
        return {
          bg: 'bg-orange-50 border-orange-200 text-orange-900',
          badgeBg: 'bg-orange-500',
          badgeText: 'Hết giờ tối đa',
          title: 'Tự động dừng theo dõi',
          desc: 'Chuyến đi vượt quá thời gian tối đa đã cài đặt.',
          icon: Clock,
          iconColor: 'text-orange-600',
          hasRadar: false,
        };
      case TRIP_STATES.IDLE:
      default:
        return {
          bg: 'bg-white border-slate-200 text-slate-800',
          badgeBg: 'bg-brand-500',
          badgeText: 'Chưa bắt đầu',
          title: 'Sẵn sàng khởi hành',
          desc: 'Bấm "Bắt đầu" trước khi di chuyển. Màn hình tắt ứng dụng vẫn chạy ngầm và tự báo tin.',
          icon: Compass,
          iconColor: 'text-brand-600',
          hasRadar: false,
        };
    }
  };

  const cfg = getStatusConfig();
  const Icon = cfg.icon;

  return (
    <div className={`p-4 rounded-2xl border ${cfg.bg} shadow-sm relative overflow-hidden transition-all duration-300`}>
      <div className="flex items-start justify-between">
        <div className="flex-1 pr-3">
          <div className="flex items-center space-x-2 mb-1.5">
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold text-white ${cfg.badgeBg}`}>
              {cfg.badgeText}
            </span>
          </div>
          <h2 className="text-lg font-bold tracking-tight">{cfg.title}</h2>
          <p className="text-xs text-slate-600 mt-1 leading-relaxed">{cfg.desc}</p>
        </div>

        <div className="relative flex items-center justify-center w-12 h-12 flex-shrink-0">
          {cfg.hasRadar && (
            <div className="absolute inset-0 rounded-full bg-emerald-500/20 animate-radar" />
          )}
          <div className="relative w-11 h-11 rounded-full bg-white/80 shadow-sm flex items-center justify-center">
            <Icon className={`w-6 h-6 ${cfg.iconColor}`} />
          </div>
        </div>
      </div>
    </div>
  );
}
