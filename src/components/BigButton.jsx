import React from 'react';
import { Play, Square, RotateCcw } from 'lucide-react';
import { TRIP_STATES } from '../config/constants.js';

export function BigButton({ state, onStart, onStopRequest, onReset }) {
  if (state === TRIP_STATES.TRACKING || state === TRIP_STATES.STARTING) {
    return (
      <button
        onClick={onStopRequest}
        className="w-full py-4 px-6 rounded-2xl bg-rose-600 hover:bg-rose-700 active:scale-[0.98] text-white font-bold text-lg shadow-lg shadow-rose-600/30 flex items-center justify-center space-x-3 transition-all cursor-pointer"
      >
        <Square className="w-5 h-5 fill-current" />
        <span>DỪNG HÀNH TRÌNH</span>
      </button>
    );
  }

  if (state === TRIP_STATES.ARRIVED || state === TRIP_STATES.DONE || state === TRIP_STATES.STOPPED || state === TRIP_STATES.TIMEOUT) {
    return (
      <div className="flex space-x-3">
        <button
          onClick={onReset}
          className="flex-1 py-4 px-4 rounded-2xl bg-slate-100 hover:bg-slate-200 active:scale-[0.98] text-slate-700 font-semibold text-base flex items-center justify-center space-x-2 transition cursor-pointer"
        >
          <RotateCcw className="w-4 h-4" />
          <span>Chuyến mới</span>
        </button>
        <button
          onClick={onStart}
          className="flex-[2] py-4 px-6 rounded-2xl bg-brand-600 hover:bg-brand-700 active:scale-[0.98] text-white font-bold text-lg shadow-lg shadow-brand-600/30 flex items-center justify-center space-x-3 transition cursor-pointer"
        >
          <Play className="w-5 h-5 fill-current" />
          <span>BẮT ĐẦU LẠI</span>
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={onStart}
      className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-brand-600 to-sky-500 hover:from-brand-700 hover:to-sky-600 active:scale-[0.98] text-white font-bold text-lg shadow-xl shadow-brand-500/25 flex items-center justify-center space-x-3 transition-all cursor-pointer"
    >
      <Play className="w-6 h-6 fill-current" />
      <span>BẮT ĐẦU HÀNH TRÌNH</span>
    </button>
  );
}
