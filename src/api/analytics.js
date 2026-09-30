// src/api/analytics.js
import api from './axios';

export const analyticsAPI = {
  // Get comprehensive analytics
  getAnalytics: async (params = {}) => {
    try {
      const response = await api.get('/analytics/', { params });
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Get reports by time period
  getReportsOverTime: async (period = 'month') => {
    try {
      const response = await api.get('/analytics/reports-over-time', {
        params: { period }
      });
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Get reports by type
  getReportsByType: async () => {
    try {
      const response = await api.get('/analytics/reports-by-type');
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Get reports by status
  getReportsByStatus: async () => {
    try {
      const response = await api.get('/analytics/reports-by-status');
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Get reports by priority
  getReportsByPriority: async () => {
    try {
      const response = await api.get('/analytics/reports-by-priority');
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Get reports by assignee
  getReportsByAssignee: async () => {
    try {
      const response = await api.get('/analytics/reports-by-assignee');
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Get resolution time statistics
  getResolutionTimeStats: async () => {
    try {
      const response = await api.get('/analytics/resolution-time');
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Get activity timeline
  getActivityTimeline: async (params = {}) => {
    try {
      const response = await api.get('/analytics/activity-timeline', { params });
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Get system usage statistics
  getSystemUsage: async (params = {}) => {
    try {
      const response = await api.get('/analytics/system-usage', { params });
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Export analytics data
  exportAnalytics: async (params = {}) => {
    try {
      const response = await api.get('/analytics/export', {
        params,
        responseType: 'blob'
      });
      return response.data;
    } catch (error) {
      throw error;
    }
  }
};