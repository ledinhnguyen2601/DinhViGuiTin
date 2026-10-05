import React, { useState, useEffect } from 'react';
import { StorageService } from '../services/storage.js';
import { FileText, Trash2, RefreshCw, Filter, Search, CheckCircle2, AlertTriangle, Info, AlertCircle } from 'lucide-react';
import { formatTime } from '../services/geo.js';

export function Logs() {
  const [logs, setLogs] = useState([]);
  const [filter, setFilter] = useState('all'); // 'all' | 'error' | 'warn' | 'success' | 'info'
  const [search, setSearch] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchLogs = async () => {
    setIsRefreshing(true);
    const data = await StorageService.getLogs();
    setLogs(data);
    setIsRefreshing(false);
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const handleClear = async () => {
    await StorageService.clearLogs();
    setLogs([]);
  };

  const filteredLogs = logs.filter((item) => {
    if (filter !== 'all' && item.level !== filter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return (
        item.message?.toLowerCase().includes(q) ||
        item.details?.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const getBadgeStyle = (level) => {
    switch (level) {
      case 'error':
        return 'bg-rose-100 text-rose-700 border-rose-200';
      case 'warn':
        return 'bg-amber-100 text-amber-700 border-amber-200';
      case 'success':
        return 'bg-emerald-100 text-emerald-700 border-emerald-200';
      case 'info':
      default:
        return 'bg-sky-100 text-sky-700 border-sky-200';
    }
  };

  const getIcon = (level) => {
    switch (level) {
      case 'error':
        return <AlertCircle className="w-3.5 h-3.5 text-rose-600 flex-shrink-0" />;
      case 'warn':
        return <AlertTriangle className="w-3.5 h-3.5 text-amber-600 flex-shrink-0" />;
      case 'success':
        return <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />;
      case 'info':
      default:
        return <Info className="w-3.5 h-3.5 text-sky-600 flex-shrink-0" />;
    }
  };

  return (
    <div className="space-y-4 pb-24 text-sm animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">Nhật ký hoạt động</h1>
          <p className="text-xs text-slate-500">Ghi nhận các sự kiện định vị và gửi tin gần nhất (Tối đa 200)</p>
        </div>
        <div className="flex items-center space-x-1.5">
          <button
            onClick={fetchLogs}
            disabled={isRefreshing}
            className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50 active:scale-95 text-slate-600 transition"
            title="Làm mới"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-brand-600' : ''}`} />
          </button>
          <button
            onClick={handleClear}
            className="p-2 rounded-xl border border-rose-200 bg-rose-50 text-rose-600 hover:bg-rose-100 active:scale-95 transition"
            title="Xóa sạch nhật ký"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-3 shadow-sm space-y-2.5">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            inputMode="text"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm kiếm nội dung sự kiện..."
            className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-brand-500 font-medium select-text"
          />
        </div>

        <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 text-xs">
          {[
            { id: 'all', label: 'Tất cả' },
            { id: 'success', label: 'Thành công' },
            { id: 'warn', label: 'Cảnh báo' },
            { id: 'error', label: 'Lỗi' },
            { id: 'info', label: 'Thông tin' },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setFilter(item.id)}
              className={`px-3 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition cursor-pointer ${
                filter === item.id
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* Log items list */}
      <div className="space-y-2">
        {filteredLogs.length === 0 ? (
          <div className="bg-white border border-slate-200/80 rounded-2xl p-8 text-center text-slate-400">
            <FileText className="w-10 h-10 mx-auto mb-2 text-slate-300" />
            <div className="text-xs font-medium">Chưa có nhật ký ghi nhận nào</div>
          </div>
        ) : (
          filteredLogs.map((entry) => (
            <div
              key={entry.id}
              className="bg-white border border-slate-200/80 rounded-2xl p-3 shadow-sm hover:border-slate-300 transition space-y-1"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-1.5">
                  {getIcon(entry.level)}
                  <span
                    className={`text-[10px] font-bold px-2 py-0.2 rounded-full border uppercase ${getBadgeStyle(
                      entry.level
                    )}`}
                  >
                    {entry.level}
                  </span>
                </div>
                <span className="text-[11px] font-mono text-slate-400">
                  {new Date(entry.timestamp).toLocaleTimeString('vi-VN')}
                </span>
              </div>
              <p className="text-xs text-slate-800 font-medium leading-relaxed pl-5">
                {entry.message}
              </p>
              {entry.details && (
                <pre className="text-[10px] bg-slate-50 text-slate-600 p-2 rounded-lg border border-slate-100 font-mono overflow-x-auto ml-5">
                  {entry.details}
                </pre>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
