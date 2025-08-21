import { 
  ApiResponse, 
  AuthResponse, 
  User, 
  UserProfile,
  UploadResponse, 
  UrlDownloadResponse, 
  ProcessingStartResponse, 
  ProcessingResult, 
  HistoryResponse,
  SubscriptionInfo,
  CreditPackage,
  SubscriptionPlan,
  PaymentIntentResponse,
  SubscriptionResponse,
  PaymentPackagesResponse,
  PaymentPlansResponse
} from '../types/api';

const API_BASE_URL = import.meta.env.VITE_API_URL ? `${import.meta.env.VITE_API_URL}/api` : 'http://localhost:3005/api';

export class ApiClient {
  private baseUrl: string;
  private accessToken: string | null = null;
  private refreshToken: string | null = null;
  private isRefreshing: boolean = false;
  private refreshPromise: Promise<string> | null = null;

  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl;
    this.accessToken = localStorage.getItem('access_token');
    this.refreshToken = localStorage.getItem('refresh_token');
  }

  setTokens(accessToken: string | null, refreshToken: string | null) {
    this.accessToken = accessToken;
    this.refreshToken = refreshToken;
    
    if (accessToken && refreshToken) {
      localStorage.setItem('access_token', accessToken);
      localStorage.setItem('refresh_token', refreshToken);
    } else {
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
    }
  }

  getAccessToken(): string | null {
    return this.accessToken || localStorage.getItem('access_token');
  }

  getRefreshToken(): string | null {
    return this.refreshToken || localStorage.getItem('refresh_token');
  }

  // Legacy method for backward compatibility
  setToken(token: string | null) {
    if (token) {
      this.setTokens(token, token); // Fallback for old usage
    } else {
      this.setTokens(null, null);
    }
  }

  // Legacy method for backward compatibility  
  getToken(): string | null {
    return this.getAccessToken();
  }

  private async refreshAccessToken(): Promise<string> {
    if (this.isRefreshing && this.refreshPromise) {
      return this.refreshPromise;
    }

    const refreshToken = this.getRefreshToken();
    if (!refreshToken) {
      throw new Error('No refresh token available');
    }

    this.isRefreshing = true;
    this.refreshPromise = (async () => {
      try {
        const response = await fetch(`${this.baseUrl}/auth/refresh`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ refreshToken }),
        });

        if (!response.ok) {
          throw new Error('Token refresh failed');
        }

        const data = await response.json();
        this.setTokens(data.accessToken, data.refreshToken);
        return data.accessToken;
      } catch (error) {
        // If refresh fails, clear all tokens and redirect to login
        this.setTokens(null, null);
        window.location.href = '/auth/login';
        throw error;
      } finally {
        this.isRefreshing = false;
        this.refreshPromise = null;
      }
    })();

    return this.refreshPromise;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
    retryOnAuth = true
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const token = this.getAccessToken();

    const config: RequestInit = {
      headers: {
        'Content-Type': 'application/json',
        ...(token && { Authorization: `Bearer ${token}` }),
        ...options.headers,
      },
      ...options,
    };

    try {
      const response = await fetch(url, config);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        
        // Check if it's a token expired error and we can retry
        if (response.status === 401 && errorData.error?.code === 'TOKEN_EXPIRED' && retryOnAuth) {
          try {
            const newToken = await this.refreshAccessToken();
            // Retry the request with new token
            const newConfig = {
              ...config,
              headers: {
                ...config.headers,
                Authorization: `Bearer ${newToken}`,
              },
            };
            return this.request<T>(endpoint, { ...options, headers: newConfig.headers }, false);
          } catch (refreshError) {
            throw new Error('Authentication failed. Please login again.');
          }
        }
        
        throw new Error(errorData.error?.message || `HTTP ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Network request failed');
    }
  }

  // Auth endpoints
  async register(email: string, password: string, name?: string): Promise<AuthResponse> {
    const response = await this.request<AuthResponse>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, name }),
    }, false); // Don't retry auth endpoints
    
    // Store tokens after successful registration
    this.setTokens(response.accessToken, response.refreshToken);
    return response;
  }

  async login(email: string, password: string): Promise<AuthResponse> {
    const response = await this.request<AuthResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }, false); // Don't retry auth endpoints
    
    // Store tokens after successful login
    this.setTokens(response.accessToken, response.refreshToken);
    return response;
  }

  async logout(): Promise<void> {
    try {
      await this.request('/auth/logout', {
        method: 'POST',
      });
    } catch (error) {
      // Even if logout fails on server, clear local tokens
      console.warn('Logout request failed:', error);
    } finally {
      this.setTokens(null, null);
    }
  }

  // Upload endpoints
  async uploadVideo(file: File, onProgress?: (progress: number) => void): Promise<UploadResponse> {
    const token = this.getAccessToken();
    const formData = new FormData();
    formData.append('video', file);

    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();

      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable && onProgress) {
          const progress = Math.round((e.loaded / e.total) * 100);
          onProgress(progress);
        }
      });

      xhr.addEventListener('load', async () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            resolve(JSON.parse(xhr.responseText));
          } catch (error) {
            reject(new Error('Invalid response format'));
          }
        } else if (xhr.status === 401) {
          // Handle token expiration for uploads
          try {
            const errorData = JSON.parse(xhr.responseText);
            if (errorData.error?.code === 'TOKEN_EXPIRED') {
              try {
                const newToken = await this.refreshAccessToken();
                // Retry upload with new token
                const retryXhr = new XMLHttpRequest();
                
                retryXhr.upload.addEventListener('progress', (e) => {
                  if (e.lengthComputable && onProgress) {
                    const progress = Math.round((e.loaded / e.total) * 100);
                    onProgress(progress);
                  }
                });
                
                retryXhr.addEventListener('load', () => {
                  if (retryXhr.status >= 200 && retryXhr.status < 300) {
                    try {
                      resolve(JSON.parse(retryXhr.responseText));
                    } catch (error) {
                      reject(new Error('Invalid response format'));
                    }
                  } else {
                    reject(new Error(`HTTP ${retryXhr.status}`));
                  }
                });
                
                retryXhr.addEventListener('error', () => reject(new Error('Upload failed')));
                retryXhr.open('POST', `${this.baseUrl}/upload/video`);
                retryXhr.setRequestHeader('Authorization', `Bearer ${newToken}`);
                retryXhr.send(formData);
                
              } catch (refreshError) {
                reject(new Error('Authentication failed. Please login again.'));
              }
            } else {
              reject(new Error(errorData.error?.message || `HTTP ${xhr.status}`));
            }
          } catch {
            reject(new Error(`HTTP ${xhr.status}`));
          }
        } else {
          try {
            const errorData = JSON.parse(xhr.responseText);
            reject(new Error(errorData.error?.message || `HTTP ${xhr.status}`));
          } catch {
            reject(new Error(`HTTP ${xhr.status}`));
          }
        }
      });

      xhr.addEventListener('error', () => {
        reject(new Error('Upload failed'));
      });

      xhr.addEventListener('abort', () => {
        reject(new Error('Upload aborted'));
      });

      xhr.open('POST', `${this.baseUrl}/upload/video`);
      
      if (token) {
        xhr.setRequestHeader('Authorization', `Bearer ${token}`);
      }

      xhr.send(formData);
    });
  }

  async getVideo(videoId: number) {
    return this.request(`/upload/video/${videoId}`);
  }

  async deleteVideo(videoId: number) {
    return this.request(`/upload/video/${videoId}`, {
      method: 'DELETE',
    });
  }

  async getUserVideos(page = 1, limit = 10) {
    return this.request(`/upload/videos?page=${page}&limit=${limit}`);
  }

  // Video processing endpoints
  async processVideo(videoId: number): Promise<ProcessingStartResponse> {
    return this.request<ProcessingStartResponse>(`/video/process/${videoId}`, {
      method: 'POST',
    });
  }

  async getProcessingStatus(processingId: number): Promise<ProcessingResult> {
    return this.request<ProcessingResult>(`/video/process/${processingId}`);
  }

  async downloadFromUrl(url: string): Promise<UrlDownloadResponse> {
    return this.request<UrlDownloadResponse>('/video/download-url', {
      method: 'POST',
      body: JSON.stringify({ url }),
    });
  }

  // User endpoints
  async getUserProfile(): Promise<UserProfile> {
    return this.request<UserProfile>('/user/profile');
  }

  async updateUserProfile(name: string): Promise<UserProfile> {
    return this.request<UserProfile>('/user/profile', {
      method: 'PUT',
      body: JSON.stringify({ name }),
    });
  }

  async getUserHistory(page = 1, limit = 10): Promise<HistoryResponse> {
    return this.request<HistoryResponse>(`/user/history?page=${page}&limit=${limit}`);
  }

  async deleteProcessingResult(processingId: number) {
    return this.request(`/user/processing-result/${processingId}`, {
      method: 'DELETE',
    });
  }

  async purchaseCredits(amount: number, paymentMethod: string) {
    return this.request('/user/purchase-credits', {
      method: 'POST',
      body: JSON.stringify({ amount, paymentMethod }),
    });
  }

  async getSubscription(): Promise<SubscriptionInfo> {
    return this.request<SubscriptionInfo>('/user/subscription');
  }

  async subscribe(plan: string, paymentMethod: string) {
    return this.request('/user/subscribe', {
      method: 'POST',
      body: JSON.stringify({ plan, paymentMethod }),
    });
  }

  // Payment endpoints
  async getCreditPackages(): Promise<PaymentPackagesResponse> {
    return this.request<PaymentPackagesResponse>('/payment/packages');
  }

  async getSubscriptionPlans(): Promise<PaymentPlansResponse> {
    return this.request<PaymentPlansResponse>('/payment/plans');
  }

  async createPaymentIntent(packageId: string): Promise<PaymentIntentResponse> {
    return this.request<PaymentIntentResponse>('/payment/create-payment-intent', {
      method: 'POST',
      body: JSON.stringify({ packageId }),
    });
  }

  async createSubscription(planId: string): Promise<SubscriptionResponse> {
    return this.request<SubscriptionResponse>('/payment/create-subscription', {
      method: 'POST',
      body: JSON.stringify({ planId }),
    });
  }

  async cancelSubscription(): Promise<{ message: string }> {
    return this.request<{ message: string }>('/payment/cancel-subscription', {
      method: 'POST',
    });
  }

  async createMockSubscription(): Promise<{ message: string; subscriptionId: number }> {
    return this.request<{ message: string; subscriptionId: number }>('/payment/create-mock-subscription', {
      method: 'POST',
    });
  }
}

export const apiClient = new ApiClient();