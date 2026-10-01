import React from 'react';
import { AlertCircle } from 'lucide-react';

export function ConfirmModal({ isOpen, title, message, confirmText = 'Xác nhận', cancelText = 'Hủy', onConfirm, onCancel, isDanger = false }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-sm bg-white rounded-3xl p-5 shadow-2xl border border-slate-100">
        <div className="flex items-center space-x-3 mb-3">
          <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${isDanger ? 'bg-rose-100 text-rose-600' : 'bg-brand-100 text-brand-600'}`}>
            <AlertCircle className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-bold text-slate-900">{title}</h3>
        </div>
        <p className="text-sm text-slate-600 mb-5 leading-relaxed">{message}</p>
        <div className="flex space-x-2.5">
          <button
            onClick={onCancel}
            className="flex-1 py-3 px-4 rounded-xl border border-slate-200 text-slate-700 font-semibold text-sm hover:bg-slate-50 active:scale-95 transition"
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            className={`flex-1 py-3 px-4 rounded-xl text-white font-bold text-sm shadow-md active:scale-95 transition ${
              isDanger ? 'bg-rose-600 hover:bg-rose-700 shadow-rose-600/20' : 'bg-brand-600 hover:bg-brand-700 shadow-brand-600/20'
            }`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
