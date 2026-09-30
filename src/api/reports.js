import api from './axios';

export const reportsAPI = {
  // ============ Unified Multi-Step Flow (Works for both Anonymous & Authenticated) ============

  initReport: async (passwordData = null, customPassword = null) => {
    try {
      const requestData = customPassword ? { password: customPassword } : passwordData;
      const response = await api.post('/reports/init', requestData || {});
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  selectReportType: async (reportNumber, reportTypeId, password = null, organizationSlug = null) => {
    try {
      const params = new URLSearchParams();
      params.append('report_type_id', reportTypeId);
      if (password) params.append('password', password);
      if (organizationSlug) params.append('organization_slug', organizationSlug);
      const response = await api.post(`/reports/${reportNumber}/select-type?${params.toString()}`);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  saveStep: async (reportNumber, stepIndex, formData, password = null, organizationSlug = null) => {
    try {
      const requestData = { form_data: formData };
      if (password) requestData.password = password;
      if (organizationSlug) requestData.organization_slug = organizationSlug;
      const response = await api.post(`/reports/${reportNumber}/step/${stepIndex}`, requestData);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  submitReport: async (reportNumber, payloadOrTitle = null, description = null, password = null, organizationSlug = null) => {
    try {
      const requestData = {};
      let requestPassword = password;

      if (
        payloadOrTitle &&
        typeof payloadOrTitle === 'object' &&
        !Array.isArray(payloadOrTitle)
      ) {
        Object.assign(requestData, payloadOrTitle);
        if (description && typeof description === 'string') {
          requestPassword = description;
        }
      } else {
        if (payloadOrTitle !== undefined) requestData.title = payloadOrTitle;
        if (description !== undefined) requestData.description = description;
      }

      if (requestPassword) requestData.password = requestPassword;
      if (organizationSlug) requestData.organization_slug = organizationSlug;
      const response = await api.post(`/reports/${reportNumber}/submit`, requestData);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  getProgress: async (reportNumber, password = null, organizationSlug = null) => {
    try {
      const params = new URLSearchParams();
      if (password) params.append('password', password);
      if (organizationSlug) params.append('organization_slug', organizationSlug);
      const response = await api.get(`/reports/${reportNumber}/progress?${params.toString()}`);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // ============ File Attachments ============

  /**
   * Upload one or more files to a report.
   * @param {string} reportNumber
   * @param {File[]} files - Array of File objects
   * @param {string|null} password - For anonymous users
   * @param {function} onUploadProgress - Optional progress callback (percentComplete) => void
   * @param {string|null} organizationSlug - Organization slug for anonymous multi-tenant flows
   */
  uploadAttachments: async (reportNumber, files, password = null, onUploadProgress = null, organizationSlug = null) => {
    try {
      const formData = new FormData();
      files.forEach((file) => formData.append('files', file));

      const params = new URLSearchParams();
      if (password) params.append('password', password);
      if (organizationSlug) params.append('organization_slug', organizationSlug);
      const query = params.toString() ? `?${params.toString()}` : '';

      const response = await api.post(
        `/reports/${reportNumber}/attachments${query}`,
        formData,
        {
          headers: { 'Content-Type': 'multipart/form-data' },
          onUploadProgress: onUploadProgress
            ? (e) => {
              const percent = e.total ? Math.round((e.loaded * 100) / e.total) : 0;
              onUploadProgress(percent);
            }
            : undefined,
        }
      );
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  /**
   * List all attachments for a report.
   */
  getAttachments: async (reportNumber, password = null, organizationSlug = null) => {
    try {
      const params = new URLSearchParams();
      if (password) params.append('password', password);
      if (organizationSlug) params.append('organization_slug', organizationSlug);
      const query = params.toString() ? `?${params.toString()}` : '';
      const response = await api.get(`/reports/${reportNumber}/attachments${query}`);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  /**
   * Get a presigned download URL for a specific attachment.
   * @param {string} reportNumber
   * @param {string} objectKey - The S3 key from the attachment metadata
   * @param {string|null} password
   */
  getAttachmentDownloadUrl: async (reportNumber, objectKey, password = null, organizationSlug = null) => {
    try {
      const params = new URLSearchParams();
      if (password) params.append('password', password);
      if (organizationSlug) params.append('organization_slug', organizationSlug);
      const query = params.toString() ? `?${params.toString()}` : '';
      // Encode the key to safely include slashes in the URL path
      const encodedKey = encodeURIComponent(objectKey);
      const response = await api.get(
        `/reports/${reportNumber}/attachments/${encodedKey}${query}`
      );
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  /**
   * Delete an attachment from a report.
   * @param {string} reportNumber
   * @param {string} objectKey - The S3 key from the attachment metadata
   * @param {string|null} password
   */
  deleteAttachment: async (reportNumber, objectKey, password = null, organizationSlug = null) => {
    try {
      const params = new URLSearchParams();
      if (password) params.append('password', password);
      if (organizationSlug) params.append('organization_slug', organizationSlug);
      const query = params.toString() ? `?${params.toString()}` : '';
      const encodedKey = encodeURIComponent(objectKey);
      const response = await api.delete(
        `/reports/${reportNumber}/attachments/${encodedKey}${query}`
      );
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // ============ Simplified Helper Methods ============

  startAuthenticatedReport: async (organizationSlug = null) => {
    try {
      const requestData = {};
      if (organizationSlug) requestData.organization_slug = organizationSlug;
      const response = await api.post('/reports/init', requestData);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  startAnonymousReport: async (customPassword = null, organizationSlug = null) => {
    try {
      const requestData = {};
      if (customPassword) requestData.password = customPassword;
      if (organizationSlug) requestData.organization_slug = organizationSlug;
      const response = await api.post('/reports/init', requestData);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // ============ Public Endpoints ============

  createReport: async (data) => {
    try {
      const response = await api.post('/reports/', data);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  trackReport: async (data) => {
    try {
      const response = await api.post('/reports/track', data);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // ============ Authenticated User Endpoints ============

  getAllReports: async (params = {}) => {
    try {
      const response = await api.get('/reports/', { params });
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  getMyReports: async () => {
    try {
      const response = await api.get('/reports/my-reports');
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  getReport: async (id) => {
    try {
      const response = await api.get(`/reports/${id}`);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  updateReport: async (id, data) => {
    try {
      const response = await api.put(`/reports/${id}`, data);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  deleteReport: async (id) => {
    try {
      const response = await api.delete(`/reports/${id}`);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // ============ Dashboard & Analytics ============

  getDashboardStats: async () => {
    try {
      const response = await api.get('/reports/stats/dashboard');
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  getDetailedStats: async (params = {}) => {
    try {
      const response = await api.get('/reports/stats/detailed', { params });
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  getStats: async () => {
    try {
      const response = await api.get('/stats');
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  exportReports: async (params = {}) => {
    try {
      const response = await api.get('/reports/export', { params, responseType: 'blob' });
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  bulkUpdateReports: async (data) => {
    try {
      const response = await api.post('/reports/bulk-update', data);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  getReportType: async (reportTypeId) => {
    try {
      const response = await api.get(`/report-types/${reportTypeId}`);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  /**
   * The backend requires `password` here — this endpoint authenticates by the
   * report's own credentials and has no account path. Signed-in reporters are
   * served from `/reports/my-reports` instead (see TrackReport). The guard
   * below only keeps an empty string off the wire, which would be a wrong
   * password rather than an absent one.
   */
  validateCredentials: async (reportNumber, password = null) => {
    try {
      const body = { report_number: reportNumber };
      if (password) body.password = password;
      const response = await api.post('/reports/track', body);
      return { valid: true, report: response.data };
    } catch (error) {
      return { valid: false, error: error.response?.data?.detail || 'Invalid credentials' };
    }
  },

  resumeReport: async (reportNumber, password) => {
    try {
      const trackResponse = await api.post('/reports/track', { report_number: reportNumber, password });
      const progressResponse = await api.get(
        `/reports/${reportNumber}/progress?password=${encodeURIComponent(password)}`
      );
      return { report: trackResponse.data, progress: progressResponse.data };
    } catch (error) {
      throw error;
    }
  },
};
