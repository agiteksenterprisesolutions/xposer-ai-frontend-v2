import api from './axios';

// Staff-only fields on a report: notes, who holds it, escalation and owner
// routing, and the records hold.
const STAFF_ONLY_REPORT_FIELDS = [
  'routing_note',
  'routed_to_role',
  'owner_role',
  'alternate_owner_role',
  'eligibility_warnings',
  'legal_hold',
  'internal_notes',
  'assigned_to',
  'assigned_to_name',
  'assigned_by',
  'excluded_user_ids',
  'implicated_member_id',
  'escalated_to_member_id',
  'escalated_reason',
  'coi_bypass_applied',
];

/** A report as a reporter may see it. */
export const toReporterView = (report) => {
  if (!report || typeof report !== 'object') return report;
  const view = { ...report };
  STAFF_ONLY_REPORT_FIELDS.forEach((field) => delete view[field]);
  return view;
};

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

  // Refused with 403 anonymous_not_allowed when an anonymous reporter picks a
  // type that needs sign-in; `quiet` lets the screen show that sentence.
  selectReportType: async (reportNumber, reportTypeId, password = null, organizationSlug = null, { quiet = false } = {}) => {
    try {
      const params = new URLSearchParams();
      params.append('report_type_id', reportTypeId);
      if (password) params.append('password', password);
      if (organizationSlug) params.append('organization_slug', organizationSlug);
      const response = await api.post(`/reports/${reportNumber}/select-type?${params.toString()}`, undefined, {
        skipErrorToast: quiet,
      });
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
      // The form shows a refusal itself, and takes the reporter to the
      // question it names (400 anonymous_election_not_allowed + field).
      const response = await api.post(`/reports/${reportNumber}/submit`, requestData, { skipErrorToast: true });
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

  // The backend still returns the whole serialized report here, including
  // the internal case notes and the investigator's identity. An anonymous
  // reporter must never receive those, so they are dropped before the
  // response reaches any screen.
  trackReport: async (data) => {
    try {
      const response = await api.post('/reports/track', data);
      return toReporterView(response.data);
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

  // `quiet` for screens that show the reason themselves — a case the user may
  // not open is a plain 404, rendered as "Case not found".
  getReport: async (id, { quiet = false } = {}) => {
    const response = await api.get(`/reports/${id}`, { skipErrorToast: quiet });
    return response.data;
  },

  // Refusals (400 not cleared / excluded / the reporter, 403, 409 disposed)
  // come back worded for the screen; pass `quiet` and show them there.
  updateReport: async (id, data, { quiet = false } = {}) => {
    const response = await api.put(`/reports/${id}`, data, { skipErrorToast: quiet });
    return response.data;
  },

  /**
   * Records that the reporter was acknowledged (by letter or phone — the first
   * message to them counts on its own). Returns the full case plus
   * `acknowledgement_recorded`, false when it already had been.
   */
  acknowledgeReport: async (id) => {
    const response = await api.post(`/reports/${id}/acknowledge`, {}, { skipErrorToast: true });
    return response.data;
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
      return { valid: true, report: toReporterView(response.data) };
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
      return { report: toReporterView(trackResponse.data), progress: progressResponse.data };
    } catch (error) {
      throw error;
    }
  },
};
