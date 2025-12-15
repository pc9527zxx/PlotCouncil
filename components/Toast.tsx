import React, { useEffect } from 'react';
import { X, CheckCircle, AlertCircle, Info } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info';

export interface ToastItem {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastProps {
  id: string;
  message: string;
  type: ToastType;
  onClose: (id: string) => void;
}

export const Toast: React.FC<ToastProps> = ({ id, message, type, onClose }) => {
  useEffect(() => {
    const timer = setTimeout(() => onClose(id), 4000);
    return () => clearTimeout(timer);
  }, [id, onClose]);

  const icons = {
    success: <CheckCircle className="w-4 h-4 text-emerald-400" />,
    error: <AlertCircle className="w-4 h-4 text-rose-400" />,
    info: <Info className="w-4 h-4 text-blue-400" />
  };

  return (
    <div className="flex items-center gap-3 bg-zinc-900/95 backdrop-blur-md text-slate-100 px-4 py-3 rounded-lg shadow-2xl border border-white/10 text-sm font-medium animate-in slide-in-from-bottom-2 fade-in min-w-[320px] max-w-[420px]">
      {icons[type]}
      <span className="flex-1 leading-snug">{message}</span>
      <button onClick={() => onClose(id)} className="text-slate-500 hover:text-slate-300 transition-colors">
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};