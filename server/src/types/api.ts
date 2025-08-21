// Common API response types

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

export interface PaginationParams {
  page: number;
  limit: number;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// User types
export interface User {
  id: number;
  email: string;
  name: string;
  credits: number;
  isSubscribed: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface UserProfile extends User {
  subscription?: {
    id: string;
    status: string;
    currentPeriodEnd: string;
    plan: string;
  };
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  name: string;
}

// Video types
export interface Video {
  id: number;
  userId?: number;
  originalName: string;
  filePath: string;
  fileSize: number;
  mimeType: string;
  duration: number;
  width: number;
  height: number;
  status: 'uploading' | 'uploaded' | 'processing' | 'completed' | 'failed';
  createdAt: string;
  updatedAt: string;
}

export interface UploadResponse {
  video: Video;
  message: string;
}

export interface UrlDownloadResponse {
  downloadId: number;
  videoInfo: {
    id: number;
    title: string;
    description: string;
    duration: number;
    thumbnail: string;
  };
  message: string;
}

// Processing types
export interface HighlightClip {
  id: number;
  title: string;
  duration: number;
  startTime: number;
  endTime: number;
  confidence: number;
  thumbnail?: string;
  downloadUrl?: string;
}

export interface Thumbnail {
  id: number;
  timestamp: number;
  width: number;
  height: number;
  downloadUrl: string;
}

export interface Caption {
  id: number;
  platform: 'youtube' | 'tiktok' | 'instagram' | 'twitter';
  content: string;
  hashtags: string[];
}

export interface ProcessingResult {
  id: number;
  videoId: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  errorMessage?: string;
  video: {
    originalName: string;
    size: number;
    type: string;
  };
  highlights: HighlightClip[];
  thumbnails: Thumbnail[];
  captions: Caption[];
  createdAt: string;
  updatedAt: string;
}

export interface ProcessingStartResponse {
  message: string;
  processingId: number;
}

// History types
export interface HistoryItem {
  id: number;
  video: {
    id: number;
    originalName: string;
    duration: number;
    fileSize: number;
  };
  stats: {
    highlights: number;
    thumbnails: number;
    captions: number;
  };
  createdAt: string;
}

export interface HistoryResponse {
  history: HistoryItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// Subscription types
export interface SubscriptionInfo {
  id: string;
  status: 'active' | 'cancelled' | 'past_due' | 'unpaid';
  currentPeriodEnd: string;
  plan: {
    id: string;
    name: string;
    price: number;
    interval: 'month' | 'year';
    features: string[];
  };
}

export interface PricingPlan {
  id: string;
  name: string;
  price: number;
  interval: 'month' | 'year';
  features: string[];
  popular?: boolean;
}

// Error types
export interface ApiError {
  message: string;
  code?: string;
  details?: any;
}

export interface ValidationError {
  field: string;
  message: string;
  value?: any;
}

// Request types with validation
export interface CreateProcessingRequest {
  videoId: number;
}

export interface UrlDownloadRequest {
  url: string;
}

export interface UpdateProfileRequest {
  name?: string;
  email?: string;
}

export interface CreateSubscriptionRequest {
  planId: string;
  paymentMethodId?: string;
}

// System types
export interface HealthCheck {
  status: 'healthy' | 'unhealthy';
  timestamp: string;
  database: boolean;
  storage: boolean;
  version: string;
}

export interface SystemDiagnostics {
  uptime: number;
  memory: {
    used: number;
    total: number;
    percentage: number;
  };
  cpu: {
    usage: number;
  };
  disk: {
    used: number;
    total: number;
    percentage: number;
  };
  database: {
    connected: boolean;
    tables: number;
  };
  processes: {
    active: number;
    queued: number;
  };
}