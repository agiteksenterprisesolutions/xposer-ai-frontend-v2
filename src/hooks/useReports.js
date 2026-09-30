// src/hooks/useReports.js
import { useState, useEffect, useCallback } from 'react';
import { useReportStore } from '../store/reportStore';
import { reportsAPI } from '../api/reports';
import { toast } from 'react-toastify';

/**
 * Custom hook for report management
 */
export const useReports = () => {
  const reports = useReportStore(state => state.reports);
  const currentReport = useReportStore(state => state.currentReport);
  const isLoadingStore = useReportStore(state => state.isLoading);
  const error = useReportStore(state => state.error);
  const pagination = useReportStore(state => state.pagination);
  const filters = useReportStore(state => state.filters);
  const stats = useReportStore(state => state.stats);
  const clearCurrentReport = useReportStore(state => state.clearCurrentReport);
  const clearError = useReportStore(state => state.clearError);
  const setFiltersStore = useReportStore(state => state.setFilters);
  const clearFiltersStore = useReportStore(state => state.clearFilters);

  const [localLoading, setLocalLoading] = useState(false);

  /**
   * Fetch reports with optional filters
   */
  const fetchReports = useCallback(async (params = {}) => {
    try {
      return await useReportStore.getState().fetchReports(params);
    } catch (error) {
      console.error('Failed to fetch reports:', error);
      throw error;
    }
  }, []);

  /**
   * Fetch my reports (for reporters)
   */
  const fetchMyReports = useCallback(async () => {
    try {
      return await useReportStore.getState().fetchMyReports();
    } catch (error) {
      console.error('Failed to fetch my reports:', error);
      throw error;
    }
  }, []);

  /**
   * Fetch single report by ID
   */
  const fetchReport = useCallback(async (id) => {
    try {
      return await useReportStore.getState().fetchReport(id);
    } catch (error) {
      console.error('Failed to fetch report:', error);
      throw error;
    }
  }, []);

  /**
   * Create new report
   */
  const createReport = useCallback(async (data) => {
    try {
      return await useReportStore.getState().createReport(data);
    } catch (error) {
      console.error('Failed to create report:', error);
      throw error;
    }
  }, []);

  /**
   * Update existing report
   */
  const updateReport = useCallback(async (id, data) => {
    try {
      return await useReportStore.getState().updateReport(id, data);
    } catch (error) {
      console.error('Failed to update report:', error);
      throw error;
    }
  }, []);

  /**
   * Delete report
   */
  const deleteReport = useCallback(async (id) => {
    try {
      return await useReportStore.getState().deleteReport(id);
    } catch (error) {
      console.error('Failed to delete report:', error);
      throw error;
    }
  }, []);

  /**
   * Track anonymous report
   */
  const trackReport = useCallback(async (reportNumber, password) => {
    try {
      return await useReportStore.getState().trackReport(reportNumber, password);
    } catch (error) {
      console.error('Failed to track report:', error);
      throw error;
    }
  }, []);

  /**
   * Fetch dashboard statistics
   */
  const fetchDashboardStats = useCallback(async () => {
    try {
      return await useReportStore.getState().fetchDashboardStats();
    } catch (error) {
      console.error('Failed to fetch dashboard stats:', error);
      throw error;
    }
  }, []);

  /**
   * Set filters for report listing
   */
  const setFilters = useCallback((filters) => {
    setFiltersStore(filters);
  }, [setFiltersStore]);

  /**
   * Clear all filters
   */
  const clearFilters = useCallback(() => {
    clearFiltersStore();
  }, [clearFiltersStore]);

  /**
   * Export reports to CSV
   */
  const exportReports = useCallback(async (params = {}) => {
    setLocalLoading(true);
    try {
      const blob = await reportsAPI.exportReports(params);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `reports_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success('Reports exported successfully!');
    } catch (error) {
      console.error('Failed to export reports:', error);
      toast.error('Failed to export reports');
      throw error;
    } finally {
      setLocalLoading(false);
    }
  }, []);

  /**
   * Bulk update reports
   */
  const bulkUpdateReports = useCallback(async (reportIds, data) => {
    setLocalLoading(true);
    try {
      const response = await reportsAPI.bulkUpdateReports({
        report_ids: reportIds,
        ...data
      });
      toast.success('Reports updated successfully!');

      // Refresh reports
      await fetchReports();
      return response;
    } catch (error) {
      console.error('Failed to bulk update reports:', error);
      toast.error('Failed to update reports');
      throw error;
    } finally {
      setLocalLoading(false);
    }
  }, [fetchReports]);

  /**
   * Get report by report number (for tracking)
   */
  const getReportByNumber = useCallback(async (reportNumber) => {
    setLocalLoading(true);
    try {
      const allReports = await useReportStore.getState().fetchReports({ limit: 1000 });
      const report = allReports.items?.find(r => r.report_number === reportNumber) ||
        allReports.find?.(r => r.report_number === reportNumber);
      if (!report) {
        throw new Error('Report not found');
      }
      return report;
    } catch (error) {
      console.error('Failed to find report:', error);
      throw error;
    } finally {
      setLocalLoading(false);
    }
  }, []);

  /**
   * Get reports statistics by status
   */
  const getStatusStats = useCallback(() => {
    if (!reports || reports.length === 0) {
      return {};
    }

    const stats = {
      pending: 0,
      in_progress: 0,
      under_review: 0,
      resolved: 0,
      closed: 0,
      rejected: 0,
      total: reports.length
    };

    reports.forEach(report => {
      if (stats[report.status] !== undefined) {
        stats[report.status]++;
      }
    });

    return stats;
  }, [reports]);

  /**
   * Get reports statistics by priority
   */
  const getPriorityStats = useCallback(() => {
    if (!reports || reports.length === 0) {
      return {};
    }

    const stats = {
      low: 0,
      medium: 0,
      high: 0,
      critical: 0,
      total: reports.length
    };

    reports.forEach(report => {
      if (stats[report.priority] !== undefined) {
        stats[report.priority]++;
      }
    });

    return stats;
  }, [reports]);

  return {
    // State
    reports,
    currentReport,
    isLoading: isLoadingStore || localLoading,
    error,
    pagination,
    filters,
    stats,

    // Actions
    fetchReports,
    fetchMyReports,
    fetchReport,
    createReport,
    updateReport,
    deleteReport,
    trackReport,
    fetchDashboardStats,
    setFilters,
    clearFilters,
    exportReports,
    bulkUpdateReports,
    getReportByNumber,

    // Statistics
    getStatusStats,
    getPriorityStats,

    // Clear state
    clearCurrentReport,
    clearError,
  };
};

/**
 * Hook for report messages/communication
 */
export const useReportMessages = (reportId) => {
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchMessages = useCallback(async (includeInternal = false) => {
    if (!reportId) return;

    setIsLoading(true);
    setError(null);
    try {
      const response = await messagesAPI.getReportMessages(reportId, includeInternal);
      setMessages(response);
      return response;
    } catch (error) {
      console.error('Failed to fetch messages:', error);
      setError(error.response?.data?.detail || 'Failed to fetch messages');
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [reportId]);

  const addMessage = useCallback(async (content, isInternal = false) => {
    if (!reportId) return;

    setIsLoading(true);
    setError(null);
    try {
      const messageData = {
        report_id: reportId,
        content,
        is_internal: isInternal
      };

      const response = await useReportStore.getState().sendMessage(messageData);
      setMessages(prev => [...prev, response]);
      return response;
    } catch (error) {
      console.error('Failed to send message:', error);
      setError(error.response?.data?.detail || 'Failed to send message');
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [reportId]);

  const addReporterMessage = useCallback(async (content) => {
    if (!reportId) return;

    setIsLoading(true);
    setError(null);
    try {
      const messageData = {
        report_id: reportId,
        content
      };

      const response = await useReportStore.getState().sendReporterMessage(messageData);
      setMessages(prev => [...prev, response]);
      return response;
    } catch (error) {
      console.error('Failed to send message:', error);
      setError(error.response?.data?.detail || 'Failed to send message');
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [reportId]);

  useEffect(() => {
    if (reportId) {
      fetchMessages();
    }
  }, [reportId, fetchMessages]);

  return {
    messages,
    isLoading,
    error,
    fetchMessages,
    addMessage,
    addReporterMessage,
    clearError: () => setError(null),
  };
};

/**
 * Hook for report form handling
 */
export const useReportForm = (initialData = {}) => {
  const [formData, setFormData] = useState(initialData);
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChange = useCallback((field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));

    // Clear error for this field
    if (errors[field]) {
      setErrors(prev => ({
        ...prev,
        [field]: undefined
      }));
    }
  }, [errors]);

  const handleFormDataChange = useCallback((newFormData) => {
    setFormData(newFormData);
  }, []);

  const validateForm = useCallback(() => {
    const newErrors = {};

    // Required fields validation
    if (!formData.title?.trim()) {
      newErrors.title = 'Title is required';
    }

    if (!formData.description?.trim()) {
      newErrors.description = 'Description is required';
    }

    if (!formData.report_type_id) {
      newErrors.report_type_id = 'Report type is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [formData]);

  const resetForm = useCallback(() => {
    setFormData(initialData);
    setErrors({});
  }, [initialData]);

  const submitForm = useCallback(async (onSubmit) => {
    if (!validateForm()) {
      return false;
    }

    setIsSubmitting(true);
    try {
      await onSubmit(formData);
      return true;
    } catch (error) {
      console.error('Form submission error:', error);

      // Handle API validation errors
      if (error.response?.data?.detail) {
        if (typeof error.response.data.detail === 'string') {
          setErrors({ _general: error.response.data.detail });
        } else if (Array.isArray(error.response.data.detail)) {
          // Handle field-specific errors
          const fieldErrors = {};
          error.response.data.detail.forEach(err => {
            if (err.loc && err.loc.length > 1) {
              const field = err.loc[1];
              fieldErrors[field] = err.msg;
            }
          });
          setErrors(fieldErrors);
        }
      }
      return false;
    } finally {
      setIsSubmitting(false);
    }
  }, [formData, validateForm]);

  return {
    formData,
    errors,
    isSubmitting,
    handleChange,
    handleFormDataChange,
    validateForm,
    resetForm,
    submitForm,
    setFormData,
    setErrors,
  };
};