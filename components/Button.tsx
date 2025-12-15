import React from 'react';
import { BaseProps } from '../types';

interface ButtonProps extends BaseProps {
  onClick?: () => void;
  disabled?: boolean;
  variant?: 'primary' | 'secondary' | 'outline';
  type?: 'button' | 'submit' | 'reset';
}

export const Button: React.FC<ButtonProps> = ({ 
  onClick, 
  children, 
  disabled = false, 
  variant = 'primary',
  type = 'button',
  className = ''
}) => {
  const baseStyles = "px-6 py-2.5 rounded-lg font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed";
  
  const variants = {
    primary: "bg-slate-900 text-white hover:bg-slate-800 focus:ring-slate-900 shadow-md hover:shadow-lg",
    secondary: "bg-white text-slate-700 hover:bg-slate-50 border border-slate-200 focus:ring-slate-200",
    outline: "bg-transparent border-2 border-slate-900 text-slate-900 hover:bg-slate-50"
  };

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`${baseStyles} ${variants[variant]} ${className}`}
    >
      {children}
    </button>
  );
};