/**
 * InSearch — Sai University Lost & Found Portal
 * Centralized API Client (js/api.js)
 *
 * Implements:
 * - Centralized API_BASE_URL configuration
 * - Automatic Authorization: Bearer JWT attachment using 'insearch_jwt_token_v1'
 * - Safe 401 handling without infinite redirect loops
 * - Relative image URL normalization
 * - Unified Promise-based HTTP methods and error formatting
 */

(function (window) {
  'use strict';

  // 1. Mandatory storage key for authentication JWT
  const TOKEN_STORAGE_KEY = 'insearch_jwt_token_v1';
  const USER_STORAGE_KEY = 'insearch_current_user_v1';

  // 2. Base URL resolution
  const API_BASE_URL = (
    window.INSEARCH_API_BASE_URL ||
    (typeof window.location !== 'undefined' && window.location && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
      ? 'http://localhost:5000'
      : 'http://localhost:5000')
  ).replace(/\/+$/, '');

  // Category fallback images for broken or missing images
  const CATEGORY_FALLBACKS = {
    Electronics: 'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?auto=format&fit=crop&w=800&q=80',
    'ID Cards & Keys': 'https://images.unsplash.com/photo-1582139329536-e7284fece509?auto=format&fit=crop&w=800&q=80',
    'Wallets & Bags': 'https://images.unsplash.com/photo-1627123424574-724758594e93?auto=format&fit=crop&w=800&q=80',
    'Books & Stationery': 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&w=800&q=80',
    'Clothing & Footwear': 'https://images.unsplash.com/photo-1576995853123-5a10305d93c0?auto=format&fit=crop&w=800&q=80',
    'Personal Accessories': 'https://images.unsplash.com/photo-1524805444758-089113d48a6d?auto=format&fit=crop&w=800&q=80',
    Others: 'https://images.unsplash.com/photo-1584438784894-089d6a62b8fa?auto=format&fit=crop&w=800&q=80'
  };
  const DEFAULT_FALLBACK_IMAGE = 'https://images.unsplash.com/photo-1584438784894-089d6a62b8fa?auto=format&fit=crop&w=800&q=80';

  /**
   * Custom API Error Class
   */
  class ApiError extends Error {
    constructor(message, status = 500, data = null) {
      super(message);
      this.name = 'ApiError';
      this.status = status;
      this.statusCode = status;
      this.data = data;
    }
  }

  class ApiClient {
    constructor() {
      this.baseUrl = API_BASE_URL;
      this.tokenKey = TOKEN_STORAGE_KEY;
      this.userKey = USER_STORAGE_KEY;
    }

    /**
     * Retrieve stored JWT token
     */
    getToken() {
      try {
        return localStorage.getItem(this.tokenKey);
      } catch (e) {
        return null;
      }
    }

    /**
     * Persist JWT token
     */
    setToken(token) {
      try {
        if (token) {
          localStorage.setItem(this.tokenKey, token);
        } else {
          localStorage.removeItem(this.tokenKey);
        }
      } catch (e) {
        console.error('Failed to update JWT in localStorage:', e);
      }
    }

    /**
     * Remove token and session data
     */
    clearSession() {
      try {
        localStorage.removeItem(this.tokenKey);
        localStorage.removeItem(this.userKey);
      } catch (e) {
        // silent
      }
    }

    /**
     * Normalizes image URLs against backend base URL
     */
    resolveImageUrl(imageSrc, category = 'Others') {
      if (!imageSrc || typeof imageSrc !== 'string' || imageSrc.trim() === '') {
        return CATEGORY_FALLBACKS[category] || DEFAULT_FALLBACK_IMAGE;
      }
      const trimmed = imageSrc.trim();
      if (/^https?:\/\//i.test(trimmed) || /^data:image\//i.test(trimmed)) {
        return trimmed;
      }
      const cleanPath = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
      return `${this.baseUrl}${cleanPath}`;
    }

    /**
     * Core fetch wrapper with JSON serialization, headers, and 401 handling
     */
    async request(path, options = {}) {
      const url = path.startsWith('http://') || path.startsWith('https://')
        ? path
        : `${this.baseUrl}${path.startsWith('/') ? '' : '/'}${path}`;

      const headers = { ...(options.headers || {}) };

      // Attach Authorization Bearer token if available
      const token = this.getToken();
      if (token && !headers['Authorization']) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      // Automatically handle JSON body
      if (options.body && typeof options.body === 'object' && !(options.body instanceof FormData)) {
        headers['Content-Type'] = 'application/json';
        options.body = JSON.stringify(options.body);
      }

      const fetchOptions = {
        ...options,
        headers
      };

      let response;
      try {
        response = await fetch(url, fetchOptions);
      } catch (networkError) {
        throw new ApiError(
          'Unable to connect to InSearch server. Please verify backend is running on port 5000.',
          0,
          { networkError: true, originalMessage: networkError.message }
        );
      }

      // Parse JSON response safely
      let data = null;
      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        try {
          data = await response.json();
        } catch (e) {
          data = null;
        }
      } else {
        const text = await response.text();
        data = { raw: text };
      }

      // Safe 401 handling without infinite redirect loops
      if (response.status === 401) {
        const isAuthEndpoint = path.includes('/api/auth/login') ||
          path.includes('/api/auth/register') ||
          path.includes('/api/auth/demo-login');

        if (!isAuthEndpoint) {
          this.clearSession();
          if (window.State && typeof window.State.emit === 'function') {
            window.State.emit('auth:expired', { status: 401 });
          }
        }
      }

      if (!response.ok) {
        const message = (data && data.message) ||
          (data && data.error) ||
          `Request failed with HTTP status ${response.status}`;
        throw new ApiError(message, response.status, data);
      }

      return data;
    }

    // HTTP Verb Helpers
    get(path, params = null) {
      let fullPath = path;
      if (params && typeof params === 'object') {
        const cleanParams = new URLSearchParams();
        Object.entries(params).forEach(([key, val]) => {
          if (val !== undefined && val !== null && val !== '') {
            cleanParams.append(key, val);
          }
        });
        const queryStr = cleanParams.toString();
        if (queryStr) {
          fullPath += (fullPath.includes('?') ? '&' : '?') + queryStr;
        }
      }
      return this.request(fullPath, { method: 'GET' });
    }

    post(path, body) {
      return this.request(path, { method: 'POST', body });
    }

    put(path, body) {
      return this.request(path, { method: 'PUT', body });
    }

    patch(path, body) {
      return this.request(path, { method: 'PATCH', body });
    }

    delete(path) {
      return this.request(path, { method: 'DELETE' });
    }
  }

  // Instantiate and expose globally
  window.api = new ApiClient();
  window.ApiClient = ApiClient;
  window.ApiError = ApiError;

})(window);
