import { useState, useCallback } from 'react';
import { ToastProps } from '../components/Toast';

export interface ToastOptions {
  type?: 'success' | 'error' | 'warning' | 'info';
  title?: string;
  duration?: number;
}

export interface AddToastFunction {
  (message: string, options?: ToastOptions): void;
  success: (message: string, title?: string) => void;
  error: (message: string, title?: string) => void;
  warning: (message: string, title?: string) => void;
  info: (message: string, title?: string) => void;
}

export const useToast = () => {
  const [toasts, setToasts] = useState<Omit<ToastProps, 'onClose'>[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  }, []);

  const addToast = useCallback((message: string, options: ToastOptions = {}) => {
    const id = Date.now().toString() + Math.random().toString(36).substr(2, 9);
    
    const toast: Omit<ToastProps, 'onClose'> = {
      id,
      message,
      type: options.type || 'info',
      title: options.title,
      duration: options.duration || 5000,
    };

    setToasts(prev => [...prev, toast]);
  }, []) as AddToastFunction;

  // Add convenience methods
  addToast.success = useCallback((message: string, title?: string) => {
    addToast(message, { type: 'success', title });
  }, [addToast]);

  addToast.error = useCallback((message: string, title?: string) => {
    addToast(message, { type: 'error', title });
  }, [addToast]);

  addToast.warning = useCallback((message: string, title?: string) => {
    addToast(message, { type: 'warning', title });
  }, [addToast]);

  addToast.info = useCallback((message: string, title?: string) => {
    addToast(message, { type: 'info', title });
  }, [addToast]);

  return {
    toasts,
    addToast,
    removeToast,
  };
};