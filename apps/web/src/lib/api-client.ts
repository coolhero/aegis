// T005: Axios API client with JWT interceptor + auto-refresh
import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';

const API_BASE_URL = typeof window !== 'undefined'
  ? (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000')
  : 'http://localhost:3000';

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Token getter/setter — set by AuthProvider
let getAccessToken: () => string | null = () => null;
let refreshAccessToken: () => Promise<string | null> = async () => null;
let onRefreshFailure: () => void = () => {};

export function configureApiClient(config: {
  getToken: () => string | null;
  refreshToken: () => Promise<string | null>;
  onRefreshFail: () => void;
}) {
  getAccessToken = config.getToken;
  refreshAccessToken = config.refreshToken;
  onRefreshFailure = config.onRefreshFail;
}

// Response unwrap interceptor: NestJS wraps responses in { data, statusCode, timestamp }
apiClient.interceptors.response.use(
  (response) => {
    if (response.data && typeof response.data === 'object' && 'statusCode' in response.data && 'data' in response.data) {
      response.data = response.data.data;
    }
    return response;
  },
);

// Request interceptor: attach JWT
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = getAccessToken();
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error),
);

// Response interceptor: auto-refresh on 401
let isRefreshing = false;
let refreshQueue: Array<{
  resolve: (token: string) => void;
  reject: (error: Error) => void;
}> = [];

function processQueue(token: string | null, error?: Error) {
  refreshQueue.forEach(({ resolve, reject }) => {
    if (error || !token) {
      reject(error || new Error('Refresh failed'));
    } else {
      resolve(token);
    }
  });
  refreshQueue = [];
}

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        // Queue this request — wait for refresh to complete
        return new Promise<string>((resolve, reject) => {
          refreshQueue.push({ resolve, reject });
        }).then((token) => {
          if (originalRequest.headers) {
            originalRequest.headers.Authorization = `Bearer ${token}`;
          }
          return apiClient(originalRequest);
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const newToken = await refreshAccessToken();
        if (newToken) {
          processQueue(newToken);
          if (originalRequest.headers) {
            originalRequest.headers.Authorization = `Bearer ${newToken}`;
          }
          return apiClient(originalRequest);
        } else {
          processQueue(null, new Error('Refresh failed'));
          onRefreshFailure();
          return Promise.reject(error);
        }
      } catch (refreshError) {
        processQueue(null, refreshError as Error);
        onRefreshFailure();
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  },
);
