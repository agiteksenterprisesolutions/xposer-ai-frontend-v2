// src/api/messages.js
import api from './axios';
import { toast } from 'react-toastify';

export const messagesAPI = {
  // Send message (compliance team)
  sendMessage: async (data) => {
    try {
      const response = await api.post('/messages/', data);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Send message from reporter
  sendReporterMessage: async (data) => {
    try {
      // Backend uses unified POST /messages/ for both staff and reporters
      const response = await api.post('/messages/', {
        report_number: data.report_number,
        content: data.content,
        is_internal: false,
        // Signed-in reporters send no password at all; an empty string is not
        // the same thing as "authenticate me by my session".
        password: data.password || null,
      });
      toast.success('Message sent successfully!');
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Get report messages (unified endpoint)
  getReportMessages: async (reportNumber, includeInternal = false, password = null) => {
    try {
      const params = {};
      if (includeInternal) params.include_internal = includeInternal;
      if (password) params.password = password;

      const response = await api.get(`/messages/report/${reportNumber}`, { params });
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Get reporter messages (alias for getReportMessages for clarity)
  getReporterMessages: async (reportNumber, password = null) => {
    return messagesAPI.getReportMessages(reportNumber, false, password);
  },

  // Get my messages (for compliance team dashboard)
  getMyMessages: async (params = {}) => {
    try {
      const response = await api.get('/messages/my-messages', { params });
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Get unread message count
  getUnreadCount: async () => {
    try {
      const response = await api.get('/messages/unread-count');
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Mark message as read
  markAsRead: async (messageId) => {
    try {
      const response = await api.post(`/messages/${messageId}/read`);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Mark all messages as read
  markAllAsRead: async () => {
    try {
      const response = await api.post('/messages/mark-all-read');
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Delete message
  deleteMessage: async (messageId) => {
    try {
      const response = await api.delete(`/messages/${messageId}`);
      toast.success('Message deleted successfully!');
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Add attachment to message (if implemented)
  addAttachment: async (messageId, formData) => {
    try {
      const response = await api.post(`/messages/${messageId}/attachments`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Get message attachments (if implemented)
  getAttachments: async (messageId) => {
    try {
      const response = await api.get(`/messages/${messageId}/attachments`);
      return response.data;
    } catch (error) {
      throw error;
    }
  }
};