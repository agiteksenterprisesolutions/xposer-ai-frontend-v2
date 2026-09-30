// src/store/reportStore.js
import { create } from 'zustand';
import { reportsAPI, messagesAPI } from '../api';
import { toast } from 'react-toastify';
import { useAuthStore } from './authStore';
import { DEFAULT_PAGE_SIZE, normalizeReportsResponse } from '../utils/reports';

export const useReportStore = create((set, get) => ({
  // Reports state
  reports: [],
  currentReport: null,
  isLoading: false,
  error: null,
  pagination: {
    page: 1,
    limit: DEFAULT_PAGE_SIZE,
    total: 0,
    totalPages: 0
  },
  filters: {
    status: '',
    priority: '',
    assigned_to: '',
    search: '',
    date_from: '',
    date_to: ''
  },

  // Messages state
  messages: [],
  unreadCount: 0,

  // Dashboard stats
  stats: null,

  // Set filters
  setFilters: (newFilters) => set((state) => ({
    filters: { ...state.filters, ...newFilters }
  })),

  // Clear filters
  clearFilters: () => set({
    filters: {
      status: '',
      priority: '',
      assigned_to: '',
      search: '',
      date_from: '',
      date_to: ''
    }
  }),

  // Fetch all reports
  fetchReports: async (params = {}) => {
    set({ isLoading: true, error: null });
    try {
      const { pagination, filters } = get();
      const queryParams = {
        page: params.page || pagination.page,
        page_size: params.page_size || params.limit || pagination.limit,
        ...filters,
        ...params
      };

      const response = await reportsAPI.getAllReports(queryParams);
      const result = normalizeReportsResponse(response);
      set({
        reports: result.items,
        pagination: {
          page: result.page,
          limit: result.pageSize,
          total: result.total,
          totalPages: result.totalPages
        },
        isLoading: false,
        error: null
      });

      return response;
    } catch (error) {
      set({
        isLoading: false,
        error: error.response?.data?.detail || 'Failed to fetch reports'
      });
      throw error;
    }
  },

  // Fetch my reports (for reporters)
  fetchMyReports: async () => {
    const { user } = useAuthStore.getState();
    if (user?.is_anonymous) {
      console.warn('Skipping fetchMyReports for anonymous tracer session');
      return [];
    }

    set({ isLoading: true, error: null });
    try {
      const response = await reportsAPI.getMyReports();
      set({
        reports: response,
        isLoading: false,
        error: null
      });

      return response;
    } catch (error) {
      set({
        isLoading: false,
        error: error.response?.data?.detail || 'Failed to fetch reports'
      });
      throw error;
    }
  },

  // Fetch single report
  fetchReport: async (id) => {
    set({ isLoading: true, error: null });
    try {
      const response = await reportsAPI.getReport(id);
      set({
        currentReport: response,
        isLoading: false,
        error: null
      });

      return response;
    } catch (error) {
      set({
        isLoading: false,
        error: error.response?.data?.detail || 'Failed to fetch report'
      });
      throw error;
    }
  },

  // Create report
  createReport: async (data) => {
    set({ isLoading: true, error: null });
    try {
      const response = await reportsAPI.createReport(data);
      set((state) => ({
        reports: [response, ...state.reports],
        isLoading: false,
        error: null
      }));

      toast.success('Report submitted successfully!');
      return response;
    } catch (error) {
      set({
        isLoading: false,
        error: error.response?.data?.detail || 'Failed to create report'
      });
      throw error;
    }
  },

  // Update report
  updateReport: async (id, data) => {
    set({ isLoading: true, error: null });
    try {
      const response = await reportsAPI.updateReport(id, data);
      set((state) => ({
        reports: state.reports.map(report =>
          report.id === id ? { ...report, ...response } : report
        ),
        currentReport: state.currentReport?.id === id
          ? { ...state.currentReport, ...response }
          : state.currentReport,
        isLoading: false,
        error: null
      }));

      toast.success('Report updated successfully!');
      return response;
    } catch (error) {
      set({
        isLoading: false,
        error: error.response?.data?.detail || 'Failed to update report'
      });
      throw error;
    }
  },

  // Delete report
  deleteReport: async (id) => {
    set({ isLoading: true, error: null });
    try {
      await reportsAPI.deleteReport(id);
      set((state) => ({
        reports: state.reports.filter(report => report.id !== id),
        currentReport: state.currentReport?.id === id ? null : state.currentReport,
        isLoading: false,
        error: null
      }));

      toast.success('Report deleted successfully!');
      return true;
    } catch (error) {
      set({
        isLoading: false,
        error: error.response?.data?.detail || 'Failed to delete report'
      });
      throw error;
    }
  },

  // Track report (anonymous)
  trackReport: async (reportNumber, password) => {
    set({ isLoading: true, error: null });
    try {
      const response = await reportsAPI.trackReport({ report_number: reportNumber, password });
      set({
        currentReport: response,
        isLoading: false,
        error: null
      });

      return response;
    } catch (error) {
      set({
        isLoading: false,
        error: error.response?.data?.detail || 'Failed to track report'
      });
      throw error;
    }
  },

  // Fetch dashboard stats
  fetchDashboardStats: async () => {
    const { user } = useAuthStore.getState();
    if (user?.is_anonymous) return null;

    set({ isLoading: true, error: null });
    try {
      const response = await reportsAPI.getDashboardStats();
      set({
        stats: response,
        isLoading: false,
        error: null
      });

      return response;
    } catch (error) {
      set({
        isLoading: false,
        error: error.response?.data?.detail || 'Failed to fetch statistics'
      });
      throw error;
    }
  },

  // Messages
  fetchMessages: async (reportId, includeInternal = false) => {
    set({ isLoading: true, error: null });
    try {
      const response = await messagesAPI.getReportMessages(reportId, includeInternal);
      set({
        messages: response,
        isLoading: false,
        error: null
      });

      return response;
    } catch (error) {
      set({
        isLoading: false,
        error: error.response?.data?.detail || 'Failed to fetch messages'
      });
      throw error;
    }
  },

  // Send message
  sendMessage: async (data) => {
    set({ isLoading: true, error: null });
    try {
      const response = await messagesAPI.sendMessage(data);
      set((state) => ({
        messages: [...state.messages, response],
        isLoading: false,
        error: null
      }));

      return response;
    } catch (error) {
      set({
        isLoading: false,
        error: error.response?.data?.detail || 'Failed to send message'
      });
      throw error;
    }
  },

  // Send reporter message
  sendReporterMessage: async (data) => {
    set({ isLoading: true, error: null });
    try {
      const response = await messagesAPI.sendReporterMessage(data);
      set((state) => ({
        messages: [...state.messages, response],
        isLoading: false,
        error: null
      }));

      return response;
    } catch (error) {
      set({
        isLoading: false,
        error: error.response?.data?.detail || 'Failed to send message'
      });
      throw error;
    }
  },

  // Fetch unread count
  fetchUnreadCount: async () => {
    try {
      const response = await messagesAPI.getUnreadCount();
      set({ unreadCount: response.count || 0 });
      return response;
    } catch (error) {
      console.error('Failed to fetch unread count:', error);
      return { count: 0 };
    }
  },

  // Mark message as read
  markAsRead: async (messageId) => {
    try {
      await messagesAPI.markAsRead(messageId);
      set((state) => ({
        messages: state.messages.map(msg =>
          msg.id === messageId ? { ...msg, read: true } : msg
        ),
        unreadCount: Math.max(0, state.unreadCount - 1)
      }));
    } catch (error) {
      console.error('Failed to mark message as read:', error);
    }
  },

  // Clear current report
  clearCurrentReport: () => set({ currentReport: null }),

  // Clear error
  clearError: () => set({ error: null })
}));