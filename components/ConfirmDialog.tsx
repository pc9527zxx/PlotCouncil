import React from 'react';
import { AlertTriangle, Info, X } from 'lucide-react';

export interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'info';
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'danger'
}) => {
  if (!isOpen) return null;

  const variantStyles = {
    danger: {
      icon: <AlertTriangle className="w-6 h-6 text-rose-500" />,
      iconBg: 'bg-rose-100 dark:bg-rose-900/30',
      confirmBtn: 'bg-rose-600 hover:bg-rose-700 focus:ring-rose-500',
    },
    warning: {
      icon: <AlertTriangle className="w-6 h-6 text-amber-500" />,
      iconBg: 'bg-amber-100 dark:bg-amber-900/30',
      confirmBtn: 'bg-amber-600 hover:bg-amber-700 focus:ring-amber-500',
    },
    info: {
      icon: <Info className="w-6 h-6 text-indigo-500" />,
      iconBg: 'bg-indigo-100 dark:bg-indigo-900/30',
      confirmBtn: 'bg-indigo-600 hover:bg-indigo-700 focus:ring-indigo-500',
    },
  };

  const styles = variantStyles[variant];

  const handleConfirm = () => {
    onConfirm();
    onClose();
  };

  return (
    <div 
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div 
        className="bg-white dark:bg-zinc-900 w-full max-w-sm mx-4 rounded-xl shadow-2xl border border-slate-200 dark:border-zinc-800 overflow-hidden transform scale-100 transition-all animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start gap-4 p-5">
          <div className={`p-2.5 rounded-full ${styles.iconBg} shrink-0`}>
            {styles.icon}
          </div>
          <div className="flex-1 min-w-0 pt-0.5">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              {title}
            </h3>
            <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              {message}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Actions */}
        <div className="flex gap-2 p-4 pt-0">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 rounded-lg transition-colors"
          >
            {cancelText}
          </button>
          <button
            onClick={handleConfirm}
            className={`flex-1 px-4 py-2 text-xs font-semibold text-white rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-zinc-900 ${styles.confirmBtn}`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};
