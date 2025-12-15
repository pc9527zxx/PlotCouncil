import React from 'react';

export const Header: React.FC = () => {
  return (
    <header className="sticky top-0 z-50 w-full backdrop-blur-md bg-white/70 border-b border-slate-100">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <div className="w-6 h-6 rounded-md bg-gradient-to-r from-primary to-secondary"></div>
          <span className="font-bold text-lg text-slate-800 tracking-tight">Zen Canvas</span>
        </div>
        <nav>
           {/* Placeholder for nav links */}
           <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">v1.0.0</span>
        </nav>
      </div>
    </header>
  );
};