import React, { useState, useEffect } from 'react';
import { CreditCard, Crown, Check, Zap, Star, Loader2, AlertCircle, X } from 'lucide-react';
import { apiClient } from '../services/api';
import { useAuth } from '../hooks/useAuth';

interface SubscriptionInfo {
  isSubscribed: boolean;
  expiresAt?: string;
  plan: string;
}

interface CreditPackage {
  id: string;
  credits: number;
  price: number;
  bonus?: number;
  popular?: boolean;
}

const creditPackages: CreditPackage[] = [
  { id: 'basic', credits: 10, price: 5000 },
  { id: 'standard', credits: 30, price: 12000, bonus: 5, popular: true },
  { id: 'premium', credits: 100, price: 35000, bonus: 25 },
];

const subscriptionPlans = [
  {
    id: 'free',
    name: '무료 플랜',
    price: 0,
    credits: 5,
    features: ['월 5회 변환', '기본 편집 기능', '표준 해상도'],
    current: true,
  },
  {
    id: 'premium',
    name: '프리미엄',
    price: 19900,
    credits: 'unlimited',
    features: ['무제한 변환', '고급 AI 기능', '4K 해상도', '우선 처리', '프리미엄 지원'],
    popular: true,
  },
];

export const BillingTab: React.FC = () => {
  const { user, isAuthenticated, refreshCredits } = useAuth();
  const [subscriptionInfo, setSubscriptionInfo] = useState<SubscriptionInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState<string | null>(null);
  const [subscribing, setSubscribing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [selectedPayment, setSelectedPayment] = useState('card');

  useEffect(() => {
    if (isAuthenticated) {
      fetchSubscriptionInfo();
    } else {
      setLoading(false);
    }
  }, [isAuthenticated]);

  const fetchSubscriptionInfo = async () => {
    try {
      setLoading(true);
      const info = await apiClient.getSubscription();
      setSubscriptionInfo(info);
    } catch (error) {
      console.error('Failed to fetch subscription info:', error);
      setError('구독 정보를 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const purchaseCredits = async (packageId: string) => {
    const pkg = creditPackages.find(p => p.id === packageId);
    if (!pkg) return;

    try {
      setPurchasing(packageId);
      setError(null);

      await apiClient.purchaseCredits(pkg.credits + (pkg.bonus || 0), selectedPayment);
      
      setSuccess(`${pkg.credits + (pkg.bonus || 0)}크레딧이 충전되었습니다!`);
      refreshCredits();
    } catch (error) {
      console.error('Credit purchase failed:', error);
      setError('크레딧 충전에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setPurchasing(null);
    }
  };

  const subscribeToPremium = async () => {
    try {
      setSubscribing(true);
      setError(null);

      await apiClient.subscribe('premium', selectedPayment);
      
      setSuccess('프리미엄 구독이 활성화되었습니다!');
      fetchSubscriptionInfo();
      refreshCredits();
    } catch (error) {
      console.error('Subscription failed:', error);
      setError('구독 처리에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setSubscribing(false);
    }
  };

  const cancelSubscription = async () => {
    if (!confirm('정말로 프리미엄 구독을 취소하시겠습니까? 다음 결제일에 구독이 종료됩니다.')) {
      return;
    }

    try {
      setSubscribing(true);
      setError(null);

      await apiClient.cancelSubscription();
      
      setSuccess('구독이 취소되었습니다. 현재 기간 동안은 프리미엄 기능을 계속 이용할 수 있습니다.');
      fetchSubscriptionInfo();
      refreshCredits();
    } catch (error) {
      console.error('Subscription cancellation failed:', error);
      setError('구독 취소에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setSubscribing(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ko-KR');
  };

  if (!isAuthenticated) {
    return (
      <div className="text-center py-16">
        <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-4">
          <CreditCard className="w-8 h-8 text-gray-400" />
        </div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">로그인이 필요합니다</h3>
        <p className="text-gray-600">결제 및 구독 정보를 확인하려면 로그인해주세요.</p>
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
        <h1 className="text-3xl font-bold text-gray-900 mb-2">결제 & 구독</h1>
        <p className="text-gray-600">크레딧을 충전하거나 프리미엄 플랜으로 업그레이드하세요</p>
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

      {/* 현재 상태 */}
      <div className="bg-white rounded-2xl border border-gray-100 p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600">
            <CreditCard size={18} />
          </div>
          <h2 className="text-xl font-semibold text-gray-900">현재 상태</h2>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <div className="bg-gray-50 rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold text-gray-900">
                {subscriptionInfo?.isSubscribed ? '변환 횟수' : '보유 크레딧'}
              </h3>
              <Zap className="w-5 h-5 text-yellow-500" />
            </div>
            <div className="text-3xl font-bold text-gray-900">
              {subscriptionInfo?.isSubscribed ? '무제한' : (user?.credits || 0)}
            </div>
            <p className="text-sm text-gray-600">
              {subscriptionInfo?.isSubscribed ? '변환 가능 횟수' : '사용 가능한 변환 횟수'}
            </p>
          </div>

          <div className="bg-gray-50 rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold text-gray-900">구독 상태</h3>
              <Crown className={`w-5 h-5 ${subscriptionInfo?.isSubscribed ? 'text-yellow-500' : 'text-gray-400'}`} />
            </div>
            <div className="text-lg font-bold text-gray-900">
              {subscriptionInfo?.isSubscribed ? '프리미엄' : '무료 플랜'}
            </div>
            {subscriptionInfo?.isSubscribed && subscriptionInfo.expiresAt && (
              <p className="text-sm text-gray-600">
                {formatDate(subscriptionInfo.expiresAt)}까지
              </p>
            )}
            {subscriptionInfo?.isSubscribed && (
              <button
                onClick={cancelSubscription}
                disabled={subscribing}
                className="mt-3 px-3 py-1 text-xs font-medium text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
              >
                {subscribing ? '처리 중...' : '구독 취소'}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 결제 방법 선택 */}
      <div className="bg-white rounded-2xl border border-gray-100 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">결제 방법</h3>
        <div className="grid grid-cols-3 gap-3">
          <button
            onClick={() => setSelectedPayment('card')}
            className={`p-3 rounded-xl border text-sm font-medium transition-colors ${
              selectedPayment === 'card'
                ? 'border-indigo-300 bg-indigo-50 text-indigo-700'
                : 'border-gray-200 text-gray-700 hover:bg-gray-50'
            }`}
          >
            💳 신용카드
          </button>
          <button
            onClick={() => setSelectedPayment('kakaopay')}
            className={`p-3 rounded-xl border text-sm font-medium transition-colors ${
              selectedPayment === 'kakaopay'
                ? 'border-indigo-300 bg-indigo-50 text-indigo-700'
                : 'border-gray-200 text-gray-700 hover:bg-gray-50'
            }`}
          >
            🔶 카카오페이
          </button>
          <button
            onClick={() => setSelectedPayment('naverpay')}
            className={`p-3 rounded-xl border text-sm font-medium transition-colors ${
              selectedPayment === 'naverpay'
                ? 'border-indigo-300 bg-indigo-50 text-indigo-700'
                : 'border-gray-200 text-gray-700 hover:bg-gray-50'
            }`}
          >
            🔷 네이버페이
          </button>
        </div>
      </div>

      {/* 크레딧 충전 - 프리미엄 구독자가 아닐 때만 표시 */}
      {!subscriptionInfo?.isSubscribed && (
        <div className="bg-white rounded-2xl border border-gray-100 p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 rounded-xl bg-yellow-50 text-yellow-600">
              <Zap size={18} />
            </div>
            <h2 className="text-xl font-semibold text-gray-900">크레딧 충전</h2>
          </div>

          <div className="grid md:grid-cols-3 gap-4">
            {creditPackages.map((pkg) => (
              <div
                key={pkg.id}
                className={`relative border rounded-2xl p-6 transition-all hover:border-indigo-300 ${
                  pkg.popular ? 'border-indigo-300 bg-indigo-50/30' : 'border-gray-200'
                }`}
              >
                {pkg.popular && (
                  <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                    <span className="bg-indigo-600 text-white px-3 py-1 rounded-full text-xs font-medium">
                      인기
                    </span>
                  </div>
                )}

                <div className="text-center">
                  <div className="text-2xl font-bold text-gray-900 mb-1">
                    {pkg.credits}{pkg.bonus ? `+${pkg.bonus}` : ''}
                  </div>
                  <div className="text-sm text-gray-600 mb-4">크레딧</div>
                  
                  <div className="text-3xl font-bold text-gray-900 mb-1">
                    ₩{pkg.price.toLocaleString()}
                  </div>
                  
                  {pkg.bonus && (
                    <div className="text-sm text-green-600 font-medium mb-4">
                      보너스 {pkg.bonus}크레딧!
                    </div>
                  )}

                  <button
                    onClick={() => purchaseCredits(pkg.id)}
                    disabled={purchasing === pkg.id}
                    className="w-full px-4 py-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {purchasing === pkg.id ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <>
                        <CreditCard size={16} />
                        충전하기
                      </>
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 구독 플랜 */}
      <div className="bg-white rounded-2xl border border-gray-100 p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 rounded-xl bg-yellow-50 text-yellow-600">
            <Crown size={18} />
          </div>
          <h2 className="text-xl font-semibold text-gray-900">구독 플랜</h2>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {subscriptionPlans.map((plan) => (
            <div
              key={plan.id}
              className={`relative border-2 rounded-2xl p-6 ${
                plan.popular
                  ? 'border-indigo-300 bg-indigo-50/30'
                  : subscriptionInfo?.plan === plan.id
                  ? 'border-green-300 bg-green-50/30'
                  : 'border-gray-200'
              }`}
            >
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                  <span className="bg-indigo-600 text-white px-3 py-1 rounded-full text-xs font-medium flex items-center gap-1">
                    <Star size={12} />
                    추천
                  </span>
                </div>
              )}

              {subscriptionInfo?.plan === plan.id && (
                <div className="absolute -top-3 right-4">
                  <span className="bg-green-600 text-white px-3 py-1 rounded-full text-xs font-medium flex items-center gap-1">
                    <Check size={12} />
                    현재 플랜
                  </span>
                </div>
              )}

              <div className="text-center mb-6">
                <h3 className="text-xl font-bold text-gray-900 mb-2">{plan.name}</h3>
                <div className="text-3xl font-bold text-gray-900 mb-1">
                  {plan.price === 0 ? '무료' : `₩${plan.price.toLocaleString()}`}
                </div>
                {plan.price > 0 && (
                  <div className="text-sm text-gray-600">/월</div>
                )}
              </div>

              <ul className="space-y-3 mb-6">
                {plan.features.map((feature, index) => (
                  <li key={index} className="flex items-center gap-2 text-sm text-gray-700">
                    <Check size={16} className="text-green-500 flex-shrink-0" />
                    {feature}
                  </li>
                ))}
              </ul>

              {plan.id === 'premium' && !subscriptionInfo?.isSubscribed && (
                <button
                  onClick={subscribeToPremium}
                  disabled={subscribing}
                  className="w-full px-4 py-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {subscribing ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <>
                      <Crown size={16} />
                      프리미엄 시작하기
                    </>
                  )}
                </button>
              )}

              {subscriptionInfo?.plan === plan.id && (
                <div className="text-center text-sm text-green-600 font-medium">
                  현재 사용 중인 플랜입니다
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* 결제 내역 */}
      <div className="bg-white rounded-2xl border border-gray-100 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">최근 결제 내역</h3>
        <div className="text-center py-8 text-gray-500">
          <p className="text-sm">결제 내역이 없습니다.</p>
          <p className="text-xs text-gray-400 mt-1">크레딧 충전 또는 구독 시 내역이 표시됩니다.</p>
        </div>
      </div>
    </div>
  );
};