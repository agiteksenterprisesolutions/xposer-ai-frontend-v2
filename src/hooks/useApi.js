// src/hooks/useApi.js
import { useState, useCallback, useEffect, useRef } from 'react';
import { useAuthStore } from '../store/authStore';
import { toast } from 'react-toastify';
import { DEFAULT_PAGE_SIZE, normalizeReportsResponse } from '../utils/reports';

/**
 * Custom hook for API calls with built-in loading, error handling, and caching
 */
export const useApi = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const { token } = useAuthStore();
  const abortControllers = useRef(new Map());

  /**
   * Make API request with automatic error handling
   */
  const apiRequest = useCallback(async (apiCall, options = {}) => {
    const {
      showLoading = true,
      showError = true,
      showSuccess = false,
      successMessage = 'Operation completed successfully',
      requestId = null,
    } = options;

    if (showLoading) {
      setLoading(true);
    }
    setError(null);

    // Create abort controller for this request if requestId provided
    if (requestId) {
      abortControllers.current.set(requestId, new AbortController());
    }

    try {
      const response = await apiCall();

      if (showSuccess) {
        toast.success(successMessage);
      }

      return response;
    } catch (error) {
      console.error('API request failed:', error);

      // Don't show error if request was aborted
      if (error.name === 'AbortError') {
        return null;
      }

      if (showError) {
        const errorMessage = error.response?.data?.detail ||
          error.response?.data?.message ||
          error.message ||
          'An error occurred';

        // Don't show toast for 401 errors (handled by interceptor)
        if (error.response?.status !== 401) {
          toast.error(errorMessage);
        }
      }

      setError(error);
      throw error;
    } finally {
      if (showLoading) {
        setLoading(false);
      }

      // Clean up abort controller
      if (requestId) {
        abortControllers.current.delete(requestId);
      }
    }
  }, []);

  /**
   * Abort a specific API request
   */
  const abortRequest = useCallback((requestId) => {
    const controller = abortControllers.current.get(requestId);
    if (controller) {
      controller.abort();
      abortControllers.current.delete(requestId);
    }
  }, []);

  /**
   * Abort all pending requests
   */
  const abortAllRequests = useCallback(() => {
    abortControllers.current.forEach(controller => {
      controller.abort();
    });
    abortControllers.current.clear();
  }, []);

  /**
   * Clear error state
   */
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    loading,
    error,
    apiRequest,
    abortRequest,
    abortAllRequests,
    clearError,
    hasToken: !!token,
  };
};

/**
 * Hook for paginated API data
 */
export const usePaginatedData = (fetchFunction, initialParams = {}) => {
  const [data, setData] = useState([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(DEFAULT_PAGE_SIZE);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [hasMore, setHasMore] = useState(true);
  // Held in a ref so an inline `initialParams` object doesn't change the
  // identity of fetchData on every render.
  const baseParams = useRef(initialParams);
  baseParams.current = initialParams;

  const fetchData = useCallback(async (params = {}) => {
    setLoading(true);
    setError(null);

    try {
      const requestedPage = params.page || page;
      const requestedLimit = params.limit || limit;
      const response = await fetchFunction({
        ...baseParams.current,
        page: requestedPage,
        // The API names this page_size; limit is kept for endpoints still on it.
        page_size: requestedLimit,
        limit: requestedLimit,
        ...params,
      });

      const result = normalizeReportsResponse(response);
      setData(result.items);
      setTotal(result.total);
      setTotalPages(result.totalPages);
      setHasMore(result.hasNext);

      return response;
    } catch (error) {
      console.error('Failed to fetch paginated data:', error);
      setError(error.response?.data?.detail || 'Failed to fetch data');
      throw error;
    } finally {
      setLoading(false);
    }
  }, [fetchFunction, page, limit]);

  const loadMore = useCallback(async () => {
    if (!hasMore || loading) return;

    const nextPage = page + 1;
    setPage(nextPage);

    try {
      const response = await fetchFunction({
        ...baseParams.current,
        page: nextPage,
        page_size: limit,
        limit,
      });

      const result = normalizeReportsResponse(response);
      setData(prev => [...prev, ...result.items]);
      setTotal(result.total);
      setTotalPages(result.totalPages);
      setHasMore(result.hasNext);

      return response;
    } catch (error) {
      console.error('Failed to load more data:', error);
      setError(error.response?.data?.detail || 'Failed to load more data');
      throw error;
    }
  }, [fetchFunction, page, limit, hasMore, loading]);

  const refresh = useCallback(async () => {
    return fetchData({ page: 1 });
  }, [fetchData]);

  const changeLimit = useCallback(async (newLimit) => {
    setLimit(newLimit);
    setPage(1);
    return fetchData({ page: 1, limit: newLimit });
  }, [fetchData]);

  return {
    data,
    total,
    totalPages,
    page,
    limit,
    loading,
    error,
    hasMore,
    fetchData,
    loadMore,
    refresh,
    changeLimit,
    setPage,
    setLimit,
    clearError: () => setError(null),
  };
};

/**
 * Hook for cached API data with automatic refetching
 */
export const useCachedApi = (fetchFunction, key, options = {}) => {
  const {
    autoFetch = true,
    refreshInterval = null,
    cacheTime = 5 * 60 * 1000, // 5 minutes
    initialData = null,
  } = options;

  const [data, setData] = useState(initialData);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lastFetched, setLastFetched] = useState(null);
  const cache = useRef(new Map());

  const fetchData = useCallback(async (force = false) => {
    // Check cache if not forced
    if (!force && cache.current.has(key)) {
      const cached = cache.current.get(key);
      const now = Date.now();

      // Use cache if still valid
      if (cached.timestamp + cacheTime > now) {
        setData(cached.data);
        setLastFetched(cached.timestamp);
        return cached.data;
      }
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetchFunction();
      const timestamp = Date.now();

      // Update cache
      cache.current.set(key, { data: response, timestamp });

      setData(response);
      setLastFetched(timestamp);
      return response;
    } catch (error) {
      console.error('Failed to fetch cached data:', error);
      setError(error.response?.data?.detail || 'Failed to fetch data');

      // Return cached data even if stale on error
      if (cache.current.has(key)) {
        const cached = cache.current.get(key);
        setData(cached.data);
        return cached.data;
      }

      throw error;
    } finally {
      setLoading(false);
    }
  }, [fetchFunction, key, cacheTime]);

  const invalidateCache = useCallback(() => {
    cache.current.delete(key);
  }, [key]);

  const updateCache = useCallback((newData) => {
    const timestamp = Date.now();
    cache.current.set(key, { data: newData, timestamp });
    setData(newData);
    setLastFetched(timestamp);
  }, [key]);

  // Auto fetch on mount
  useEffect(() => {
    if (autoFetch) {
      fetchData();
    }
  }, [autoFetch, fetchData]);

  // Set up refresh interval
  useEffect(() => {
    if (!refreshInterval || !autoFetch) return;

    const interval = setInterval(() => {
      fetchData();
    }, refreshInterval);

    return () => clearInterval(interval);
  }, [refreshInterval, autoFetch, fetchData]);

  // Clear cache on unmount for specific keys
  useEffect(() => {
    return () => {
      if (options.clearOnUnmount) {
        cache.current.delete(key);
      }
    };
  }, [key, options.clearOnUnmount]);

  return {
    data,
    loading,
    error,
    lastFetched,
    fetchData: (force = false) => fetchData(force),
    invalidateCache,
    updateCache,
    clearError: () => setError(null),
    isCached: cache.current.has(key),
    cacheTime,
  };
};

/**
 * Hook for form submission with API
 */
export const useFormSubmit = (submitFunction, options = {}) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  const {
    onSuccess = null,
    onError = null,
    successMessage = 'Operation completed successfully',
    errorMessage = 'Operation failed',
    showToast = true,
  } = options;

  const submit = useCallback(async (data) => {
    setIsSubmitting(true);
    setSubmitError(null);
    setSubmitSuccess(false);

    try {
      const result = await submitFunction(data);
      setSubmitSuccess(true);

      if (showToast) {
        toast.success(successMessage);
      }

      if (onSuccess) {
        onSuccess(result);
      }

      return result;
    } catch (error) {
      console.error('Form submission failed:', error);

      const errorMsg = error.response?.data?.detail ||
        error.response?.data?.message ||
        error.message ||
        errorMessage;

      setSubmitError(errorMsg);

      if (showToast) {
        toast.error(errorMsg);
      }

      if (onError) {
        onError(error, errorMsg);
      }

      throw error;
    } finally {
      setIsSubmitting(false);
    }
  }, [submitFunction, onSuccess, onError, successMessage, errorMessage, showToast]);

  const reset = useCallback(() => {
    setIsSubmitting(false);
    setSubmitError(null);
    setSubmitSuccess(false);
  }, []);

  return {
    isSubmitting,
    submitError,
    submitSuccess,
    submit,
    reset,
  };
};

/**
 * Hook for real-time updates (WebSocket/SSE simulation)
 */
export const useRealtimeUpdates = (fetchFunction, interval = 30000) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const intervalRef = useRef(null);

  const fetchUpdate = useCallback(async () => {
    try {
      const result = await fetchFunction();
      setData(result);
      setError(null);
      return result;
    } catch (error) {
      console.error('Failed to fetch realtime update:', error);
      setError(error.response?.data?.detail || 'Failed to fetch update');
    } finally {
      setLoading(false);
    }
  }, [fetchFunction]);

  useEffect(() => {
    // Initial fetch
    fetchUpdate();

    // Set up interval for updates
    intervalRef.current = setInterval(fetchUpdate, interval);

    // Clean up
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [fetchUpdate, interval]);

  const updateData = useCallback((updater) => {
    setData(prev => {
      if (typeof updater === 'function') {
        return updater(prev);
      }
      return updater;
    });
  }, []);

  const stopUpdates = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const startUpdates = useCallback(() => {
    if (!intervalRef.current) {
      intervalRef.current = setInterval(fetchUpdate, interval);
    }
  }, [fetchUpdate, interval]);

  return {
    data,
    loading,
    error,
    updateData,
    stopUpdates,
    startUpdates,
    refresh: fetchUpdate,
    clearError: () => setError(null),
  };
};