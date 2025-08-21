import React, { useState, useEffect } from 'react';
import { User, Mail, Calendar, Settings, Shield, Bell, Eye, Download, Trash2, Edit3, Save, X, Check, AlertCircle, Loader2 } from 'lucide-react';
import { apiClient } from '../services/api';
import { useAuth } from '../hooks/useAuth';

interface UserProfile {
  id: number;
  email: string;
  name: string;
  credits: number;
  isSubscribed: boolean;
  subscriptionExpiresAt?: string;
  processingCount: number;
  memberSince: string;
}

interface SettingsState {
  emailNotifications: boolean;
  marketingEmails: boolean;
  dataProcessing: boolean;
  autoSave: boolean;
}

interface ProfileTabProps {
  onLogout?: () => void;
}

export const ProfileTab: React.FC<ProfileTabProps> = ({ onLogout }) => {
  const { user, isAuthenticated, logout: originalLogout, refetch } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editedName, setEditedName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [settings, setSettings] = useState<SettingsState>({
    emailNotifications: true,
    marketingEmails: false,
    dataProcessing: true,
    autoSave: true,
  });

  useEffect(() => {
    if (isAuthenticated) {
      fetchProfile();
    } else {
      setLoading(false);
    }
  }, [isAuthenticated]);

  const fetchProfile = async () => {
    try {
      setLoading(true);
      const profileData = await apiClient.getUserProfile();
      setProfile(profileData);
      setEditedName(profileData.name || '');
    } catch (error) {
      console.error('Failed to fetch profile:', error);
      setError('프로필 정보를 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveProfile = async () => {
    if (!editedName.trim()) {
      setError('이름을 입력해주세요.');
      return;
    }

    try {
      setSaving(true);
      setError(null);

      await apiClient.updateUserProfile(editedName.trim());
      
      setSuccess('프로필이 업데이트되었습니다.');
      setEditing(false);
      await fetchProfile();
      refetch();
    } catch (error) {
      console.error('Profile update failed:', error);
      setError('프로필 업데이트에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const handleCancelEdit = () => {
    setEditedName(profile?.name || '');
    setEditing(false);
    setError(null);
  };

  const handleSettingChange = (setting: keyof SettingsState) => {
    setSettings(prev => ({
      ...prev,
      [setting]: !prev[setting]
    }));
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  if (!isAuthenticated) {
    return (
      <div className="text-center py-16">
        <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-4">
          <User className="w-8 h-8 text-gray-400" />
        </div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">로그인이 필요합니다</h3>
        <p className="text-gray-600">프로필을 확인하려면 로그인해주세요.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="flex items-center gap-2 text-gray-600">
          <Loader2 className="w-5 h-5 animate-spin" />
          로딩 중...
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* 헤더 */}
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">내 프로필</h1>
        <p className="text-gray-600">계정 정보를 관리하고 설정을 변경하세요</p>
      </div>

      {/* 알림 메시지 */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl text-red-700 flex items-center justify-between p-4">
          <div className="flex items-center gap-2">
            <AlertCircle size={18} />
            <span>{error}</span>
          </div>
          <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600">
            <X size={18} />
          </button>
        </div>
      )}

      {success && (
        <div className="bg-green-50 border border-green-200 rounded-xl text-green-700 flex items-center justify-between p-4">
          <div className="flex items-center gap-2">
            <Check size={18} />
            <span>{success}</span>
          </div>
          <button onClick={() => setSuccess(null)} className="text-green-400 hover:text-green-600">
            <X size={18} />
          </button>
        </div>
      )}

      {/* 프로필 정보 */}
      <div className="bg-white rounded-2xl border border-gray-100 p-8">
        <div className="flex items-center gap-6 mb-8">
          <div className="w-20 h-20 rounded-2xl bg-indigo-100 flex items-center justify-center">
            <User className="w-10 h-10 text-indigo-600" />
          </div>
          
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              {editing ? (
                <input
                  type="text"
                  value={editedName}
                  onChange={(e) => setEditedName(e.target.value)}
                  className="text-2xl font-bold text-gray-900 bg-transparent border-b-2 border-indigo-300 focus:outline-none focus:border-indigo-500"
                  placeholder="이름을 입력하세요"
                />
              ) : (
                <h2 className="text-2xl font-bold text-gray-900">
                  {profile?.name || '이름 없음'}
                </h2>
              )}
              
              {editing ? (
                <div className="flex gap-2">
                  <button
                    onClick={handleSaveProfile}
                    disabled={saving}
                    className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors disabled:opacity-50"
                  >
                    {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                  </button>
                  <button
                    onClick={handleCancelEdit}
                    className="p-2 text-gray-500 hover:bg-gray-50 rounded-lg transition-colors"
                  >
                    <X size={18} />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setEditing(true)}
                  className="p-2 text-gray-500 hover:bg-gray-50 rounded-lg transition-colors"
                >
                  <Edit3 size={18} />
                </button>
              )}
            </div>
            
            <div className="flex items-center gap-2 text-gray-600 mb-1">
              <Mail size={16} />
              <span>{profile?.email}</span>
            </div>
            
            <div className="flex items-center gap-2 text-gray-600">
              <Calendar size={16} />
              <span>{profile?.memberSince ? `${formatDate(profile.memberSince)} 가입` : '가입일 불명'}</span>
            </div>
          </div>
        </div>

        {/* 통계 */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-gray-50 rounded-xl p-4 text-center">
            <div className="text-2xl font-bold text-indigo-600 mb-1">
              {profile?.isSubscribed ? '∞' : (profile?.credits || 0)}
            </div>
            <div className="text-sm text-gray-600">
              {profile?.isSubscribed ? '변환 가능 횟수' : '보유 크레딧'}
            </div>
          </div>
          
          <div className="bg-gray-50 rounded-xl p-4 text-center">
            <div className="text-2xl font-bold text-green-600 mb-1">{profile?.processingCount || 0}</div>
            <div className="text-sm text-gray-600">총 변환 수</div>
          </div>
          
          <div className="bg-gray-50 rounded-xl p-4 text-center">
            <div className="text-2xl font-bold text-purple-600 mb-1">
              {profile?.isSubscribed ? '프리미엄' : '무료'}
            </div>
            <div className="text-sm text-gray-600">
              {profile?.isSubscribed ? '무제한 변환' : '월 5회 무료'}
            </div>
          </div>
          
          <div className="bg-gray-50 rounded-xl p-4 text-center">
            <div className="text-2xl font-bold text-blue-600 mb-1">
              {profile?.isSubscribed ? 'VIP' : 'A+'}
            </div>
            <div className="text-sm text-gray-600">
              {profile?.isSubscribed ? '프리미엄 등급' : '일반 등급'}
            </div>
          </div>
        </div>
      </div>

      {/* 설정 */}
      <div className="bg-white rounded-2xl border border-gray-100 p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 rounded-xl bg-gray-50">
            <Settings size={18} />
          </div>
          <h3 className="text-xl font-semibold text-gray-900">설정</h3>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 border border-gray-100 rounded-xl">
            <div className="flex items-center gap-3">
              <Bell size={18} className="text-gray-500" />
              <div>
                <div className="font-medium text-gray-900">이메일 알림</div>
                <div className="text-sm text-gray-600">중요한 업데이트와 알림을 받습니다</div>
              </div>
            </div>
            <button
              onClick={() => handleSettingChange('emailNotifications')}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                settings.emailNotifications ? 'bg-indigo-600' : 'bg-gray-200'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  settings.emailNotifications ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          <div className="flex items-center justify-between p-4 border border-gray-100 rounded-xl">
            <div className="flex items-center gap-3">
              <Mail size={18} className="text-gray-500" />
              <div>
                <div className="font-medium text-gray-900">마케팅 이메일</div>
                <div className="text-sm text-gray-600">프로모션과 새로운 기능 소식을 받습니다</div>
              </div>
            </div>
            <button
              onClick={() => handleSettingChange('marketingEmails')}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                settings.marketingEmails ? 'bg-indigo-600' : 'bg-gray-200'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  settings.marketingEmails ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          <div className="flex items-center justify-between p-4 border border-gray-100 rounded-xl">
            <div className="flex items-center gap-3">
              <Shield size={18} className="text-gray-500" />
              <div>
                <div className="font-medium text-gray-900">데이터 처리 동의</div>
                <div className="text-sm text-gray-600">AI 개선을 위한 데이터 사용에 동의합니다</div>
              </div>
            </div>
            <button
              onClick={() => handleSettingChange('dataProcessing')}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                settings.dataProcessing ? 'bg-indigo-600' : 'bg-gray-200'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  settings.dataProcessing ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          <div className="flex items-center justify-between p-4 border border-gray-100 rounded-xl">
            <div className="flex items-center gap-3">
              <Save size={18} className="text-gray-500" />
              <div>
                <div className="font-medium text-gray-900">자동 저장</div>
                <div className="text-sm text-gray-600">편집 중인 내용을 자동으로 저장합니다</div>
              </div>
            </div>
            <button
              onClick={() => handleSettingChange('autoSave')}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                settings.autoSave ? 'bg-indigo-600' : 'bg-gray-200'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  settings.autoSave ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
        </div>
      </div>

      {/* 데이터 관리 */}
      <div className="bg-white rounded-2xl border border-gray-100 p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 rounded-xl bg-gray-50">
            <Download size={18} />
          </div>
          <h3 className="text-xl font-semibold text-gray-900">데이터 관리</h3>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 border border-gray-100 rounded-xl">
            <div>
              <div className="font-medium text-gray-900 mb-1">내 데이터 다운로드</div>
              <div className="text-sm text-gray-600">모든 개인 데이터를 JSON 형식으로 다운로드합니다</div>
            </div>
            <button className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl transition-colors flex items-center gap-2">
              <Download size={16} />
              다운로드
            </button>
          </div>

          <div className="flex items-center justify-between p-4 border border-red-200 rounded-xl bg-red-50/30">
            <div>
              <div className="font-medium text-red-900 mb-1">계정 삭제</div>
              <div className="text-sm text-red-600">모든 데이터가 영구적으로 삭제됩니다</div>
            </div>
            <button className="px-4 py-2 bg-red-100 hover:bg-red-200 text-red-700 rounded-xl transition-colors flex items-center gap-2">
              <Trash2 size={16} />
              삭제
            </button>
          </div>
        </div>
      </div>

      {/* 로그아웃 */}
      <div className="bg-white rounded-2xl border border-gray-100 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-1">세션 관리</h3>
            <p className="text-sm text-gray-600">현재 세션에서 로그아웃하거나 모든 기기에서 로그아웃할 수 있습니다</p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => {
                originalLogout();
                onLogout?.();
              }}
              className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl transition-colors"
            >
              로그아웃
            </button>
            <button className="px-4 py-2 bg-red-100 hover:bg-red-200 text-red-700 rounded-xl transition-colors">
              모든 기기에서 로그아웃
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};