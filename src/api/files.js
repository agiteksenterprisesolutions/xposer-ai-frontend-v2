// src/api/files.js
import api from './axios';
import { toast } from 'react-toastify';

export const filesAPI = {
  /**
   * Upload file attachment to a report
   * POST /reports/{report_number}/attachments
   */
  uploadReportAttachment: async (reportNumber, formData, password = null) => {
    try {
      const params = password ? { password } : {};
      const response = await api.post(
        `/reports/${reportNumber}/attachments`,
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data'
          },
          params
        }
      );
      return response.data;
    } catch (error) {
      console.error('Upload error:', error);
      throw error;
    }
  },

  /**
   * Get all attachments for a report
   * GET /reports/{report_number}/attachments
   */
  getReportAttachments: async (reportNumber, password = null) => {
    try {
      const params = password ? { password } : {};
      const response = await api.get(
        `/reports/${reportNumber}/attachments`,
        { params }
      );
      return response.data;
    } catch (error) {
      console.error('Get attachments error:', error);
      throw error;
    }
  },

  /**
   * Get download URL for a specific attachment
   * GET /reports/{report_number}/attachments/{key}
   */
  getDownloadUrl: async (reportNumber, attachmentKey, password = null) => {
    try {
      const params = password ? { password } : {};
      const encodedKey = encodeURIComponent(attachmentKey);
      const response = await api.get(
        `/reports/${reportNumber}/attachments/${encodedKey}`,
        { params }
      );
      return response.data;
    } catch (error) {
      console.error('Get download URL error:', error);
      throw error;
    }
  },

  /**
   * Delete an attachment
   * DELETE /reports/{report_number}/attachments/{key}
   */
  deleteReportAttachment: async (reportNumber, attachmentKey, password = null) => {
    try {
      const params = password ? { password } : {};
      const encodedKey = encodeURIComponent(attachmentKey);
      const response = await api.delete(
        `/reports/${reportNumber}/attachments/${encodedKey}`,
        { params }
      );
      toast.success('File deleted successfully!');
      return response.data;
    } catch (error) {
      console.error('Delete error:', error);
      throw error;
    }
  },

  // Legacy methods (keep for backwards compatibility if needed)
  uploadFile: async (formData) => {
    try {
      const response = await api.post('/files/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  getFile: async (fileId) => {
    try {
      const response = await api.get(`/files/${fileId}`);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  downloadFile: async (fileId) => {
    try {
      const response = await api.get(`/files/${fileId}/download`, {
        responseType: 'blob'
      });
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  deleteFile: async (fileId) => {
    try {
      const response = await api.delete(`/files/${fileId}`);
      toast.success('File deleted successfully!');
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  getReportFiles: async (reportId) => {
    try {
      const response = await api.get(`/files/report/${reportId}`);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  uploadReportFile: async (reportId, formData) => {
    try {
      const response = await api.post(`/files/report/${reportId}/upload`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      return response.data;
    } catch (error) {
      throw error;
    }
  }
};