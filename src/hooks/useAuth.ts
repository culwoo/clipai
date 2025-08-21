import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '../services/api';

export interface User {
  id: number;
  email: string;
  name?: string;
  credits: number;
  isSubscribed: boolean;
  processingCount?: number;
  memberSince?: string;
}

export interface AuthState {
  user: User | null;
  accessToken: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}

export function useAuth() {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    accessToken: null,
    isLoading: true,
    isAuthenticated: false,
  });

  // Initialize auth state on mount
  useEffect(() => {
    const accessToken = apiClient.getAccessToken();
    if (accessToken) {
      // Try to fetch user profile
      fetchUserProfile();
    } else {
      setAuthState(prev => ({ ...prev, isLoading: false }));
    }
  }, []);

  const fetchUserProfile = useCallback(async () => {
    try {
      setAuthState(prev => ({ ...prev, isLoading: true }));
      const response = await apiClient.getUserProfile();
      
      const user: User = {
        id: response.id,
        email: response.email,
        name: response.name,
        credits: response.credits,
        isSubscribed: response.isSubscribed,
        processingCount: response.processingCount,
        memberSince: response.memberSince,
      };

      setAuthState({
        user,
        accessToken: apiClient.getAccessToken(),
        isLoading: false,
        isAuthenticated: true,
      });
    } catch (error) {
      console.error('Failed to fetch user profile:', error);
      // Clear invalid tokens from both API client and localStorage
      apiClient.setTokens(null, null);
      
      setAuthState({
        user: null,
        accessToken: null,
        isLoading: false,
        isAuthenticated: false,
      });
    }
  }, []);

  const login = useCallback(async (email: string, password: string): Promise<User> => {
    setAuthState(prev => ({ ...prev, isLoading: true }));
    
    try {
      const response = await apiClient.login(email, password);
      // API client automatically stores tokens now
      
      const user: User = {
        id: response.user.id,
        email: response.user.email,
        name: response.user.name,
        credits: response.user.credits,
        isSubscribed: response.user.isSubscribed,
      };

      // Immediately update state with force re-render
      setAuthState({
        user,
        accessToken: response.accessToken,
        isLoading: false,
        isAuthenticated: true,
      });

      return user;
    } catch (error) {
      setAuthState(prev => ({ ...prev, isLoading: false, isAuthenticated: false }));
      throw error;
    }
  }, []);

  const register = useCallback(async (email: string, password: string, name?: string): Promise<User> => {
    setAuthState(prev => ({ ...prev, isLoading: true }));
    
    try {
      const response = await apiClient.register(email, password, name);
      // API client automatically stores tokens now
      
      const user: User = {
        id: response.user.id,
        email: response.user.email,
        name: response.user.name,
        credits: response.user.credits,
        isSubscribed: response.user.isSubscribed,
      };

      // Immediately update state
      setAuthState({
        user,
        accessToken: response.accessToken,
        isLoading: false,
        isAuthenticated: true,
      });

      return user;
    } catch (error) {
      setAuthState(prev => ({ ...prev, isLoading: false, isAuthenticated: false }));
      throw error;
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await apiClient.logout(); // This will clear tokens and call server logout
    } catch (error) {
      console.warn('Logout failed:', error);
    }
    
    setAuthState({
      user: null,
      accessToken: null,
      isLoading: false,
      isAuthenticated: false,
    });
  }, []);

  const updateProfile = useCallback(async (name: string) => {
    if (!authState.user) {
      throw new Error('Not authenticated');
    }

    try {
      await apiClient.updateUserProfile(name);
      setAuthState(prev => ({
        ...prev,
        user: prev.user ? { ...prev.user, name } : null,
      }));
    } catch (error) {
      throw error;
    }
  }, [authState.user]);

  const refreshCredits = useCallback(async () => {
    if (!authState.isAuthenticated) return;
    
    try {
      const response = await apiClient.getUserProfile();
      setAuthState(prev => ({
        ...prev,
        user: prev.user ? { ...prev.user, credits: response.credits } : null,
      }));
    } catch (error) {
      console.error('Failed to refresh credits:', error);
    }
  }, [authState.isAuthenticated]);

  const purchaseCredits = useCallback(async (amount: number, paymentMethod: string) => {
    if (!authState.user) {
      throw new Error('Not authenticated');
    }

    try {
      const response = await apiClient.purchaseCredits(amount, paymentMethod);
      setAuthState(prev => ({
        ...prev,
        user: prev.user ? { ...prev.user, credits: response.totalCredits } : null,
      }));
      return response;
    } catch (error) {
      throw error;
    }
  }, [authState.user]);

  const subscribe = useCallback(async (plan: string, paymentMethod: string) => {
    if (!authState.user) {
      throw new Error('Not authenticated');
    }

    try {
      const response = await apiClient.subscribe(plan, paymentMethod);
      setAuthState(prev => ({
        ...prev,
        user: prev.user ? { ...prev.user, isSubscribed: true } : null,
      }));
      return response;
    } catch (error) {
      throw error;
    }
  }, [authState.user]);

  return {
    ...authState,
    login,
    register,
    logout,
    updateProfile,
    refreshCredits,
    purchaseCredits,
    subscribe,
    refetch: fetchUserProfile,
  };
}