import React, { useState } from 'react';
import { X, Mail, Lock, User, Eye, EyeOff } from 'lucide-react';
import { apiClient } from '../services/api';
import { useAppStore } from '../store/appStore';
import { useAuth } from '../hooks/useAuth';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

type AuthMode = 'login' | 'register';

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  
  const { setError: setGlobalError } = useAppStore();
  const { login, register } = useAuth();

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      let user;
      if (mode === 'login') {
        user = await login(email, password);
      } else {
        user = await register(email, password, name || undefined);
      }

      // Close modal and call success callback
      onClose();
      if (onSuccess) {
        onSuccess();
      }
      
      // Reset form
      setEmail('');
      setPassword('');
      setName('');
      setError('');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '인증 중 오류가 발생했습니다.';
      setError(errorMessage);
      setGlobalError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const switchMode = () => {
    setMode(mode === 'login' ? 'register' : 'login');
    setError('');
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full mx-4 p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-gray-900">
            {mode === 'login' ? '로그인' : '회원가입'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
            {error}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'register' && (
            <div className="relative">
              <User size={18} className="absolute left-3 top-3 text-gray-400" />
              <input
                type="text"
                placeholder="이름 (선택사항)"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400"
                disabled={isLoading}
              />
            </div>
          )}

          <div className="relative">
            <Mail size={18} className="absolute left-3 top-3 text-gray-400" />
            <input
              type="email"
              placeholder="이메일"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400"
              required
              disabled={isLoading}
            />
          </div>

          <div className="relative">
            <Lock size={18} className="absolute left-3 top-3 text-gray-400" />
            <input
              type={showPassword ? "text" : "password"}
              placeholder="비밀번호"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full pl-10 pr-10 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400"
              required
              minLength={8}
              disabled={isLoading}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-3 text-gray-400 hover:text-gray-600"
              disabled={isLoading}
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>

          {mode === 'register' && (
            <p className="text-xs text-gray-500">
              비밀번호는 최소 8자 이상이어야 합니다.
            </p>
          )}

          <button
            type="submit"
            disabled={isLoading || !email || !password}
            className="w-full py-3 px-4 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isLoading ? (
              <div className="flex items-center justify-center gap-2">
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                처리 중...
              </div>
            ) : (
              mode === 'login' ? '로그인' : '회원가입'
            )}
          </button>
        </form>

        {/* Switch Mode */}
        <div className="mt-6 text-center">
          <p className="text-sm text-gray-600">
            {mode === 'login' ? '계정이 없으신가요?' : '이미 계정이 있으신가요?'}
          </p>
          <button
            onClick={switchMode}
            disabled={isLoading}
            className="mt-1 text-indigo-600 hover:text-indigo-700 font-medium text-sm disabled:opacity-50"
          >
            {mode === 'login' ? '회원가입하기' : '로그인하기'}
          </button>
        </div>

        {/* Guest Mode Notice */}
        {mode === 'login' && (
          <div className="mt-4 p-3 bg-gray-50 rounded-xl">
            <p className="text-xs text-gray-600 text-center">
              로그인하지 않고도 서비스를 체험해볼 수 있습니다.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};