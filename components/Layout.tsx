import React from 'react';
import { BaseProps } from '../types';
import { Header } from './Header';

export const Layout: React.FC<BaseProps> = ({ children, className = '' }) => {
  return (
    <div className={`min-h-screen flex flex-col ${className}`}>
      <Header />
      <main className="flex-grow container mx-auto px-4 py-8">
        {children}
      </main>
      <footer className="py-6 text-center text-slate-400 text-sm border-t border-slate-100 bg-white/50 backdrop-blur-sm">
        <p>&copy; {new Date().getFullYear()} Zen Canvas. All rights reserved.</p>
      </footer>
    </div>
  );
};