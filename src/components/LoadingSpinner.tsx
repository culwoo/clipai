import React from 'react';
import { Loader2 } from 'lucide-react';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  message?: string;
  fullScreen?: boolean;
}

const sizeClasses = {
  sm: 'w-4 h-4',
  md: 'w-6 h-6',
  lg: 'w-8 h-8',
};

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ 
  size = 'md', 
  message, 
  fullScreen = false 
}) => {
  const spinner = (
    <div className="flex items-center justify-center gap-2">
      <Loader2 className={`animate-spin text-indigo-600 ${sizeClasses[size]}`} />
      {message && (
        <span className="text-sm font-medium text-gray-700">{message}</span>
      )}
    </div>
  );

  if (fullScreen) {
    return (
      <div className="fixed inset-0 bg-white/80 backdrop-blur-sm flex items-center justify-center z-50">
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6">
          {spinner}
        </div>
      </div>
    );
  }

  return spinner;
};