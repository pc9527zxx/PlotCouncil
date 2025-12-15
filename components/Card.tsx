import React from 'react';
import { BaseProps } from '../types';

interface CardProps extends BaseProps {
  title?: string;
}

export const Card: React.FC<CardProps> = ({ title, children, className = '' }) => {
  return (
    <div className={`bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden ${className}`}>
      {title && (
        <div className="px-6 py-4 border-b border-slate-50 bg-slate-50/50">
          <h3 className="font-semibold text-slate-800">{title}</h3>
        </div>
      )}
      <div className="p-6">
        {children}
      </div>
    </div>
  );
};