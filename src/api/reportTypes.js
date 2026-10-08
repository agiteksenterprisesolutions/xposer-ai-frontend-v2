// src/api/reportTypes.js
import api from './axios';
import { toast } from 'react-toastify';
import { DEFAULT_PAGE_SIZE, normalizeListResponse } from '../utils/pagination';
import { blobDownload } from '../utils/download';

// Page size used when pulling the full list for pickers; large enough that one
// request almost always covers an organization, with paging as the fallback.
const FULL_LIST_PAGE_SIZE = 10;

// The import endpoint answers with { detail: { message, imported, problems: [...] } }
// on success and on validation failure alike, so both paths get flattened here into
// one predictable shape the page can render.
const normalizeImportResult = (data) => {
  const detail = data?.detail ?? data ?? {};
  if (typeof detail === 'string') {
    return { message: detail, imported: 0, problems: [], warnings: [], created: [] };
  }
  return {
    message: detail.message || '',
    imported: detail.imported ?? detail.created_count ?? 0,
    problems: Array.isArray(detail.problems) ? detail.problems : [],
    // e.g. header.unknown_column for the Arabic columns an older workbook
    // still carries. The import succeeded; these are only advisories.
    warnings: Array.isArray(detail.warnings) ? detail.warnings : [],
    created: Array.isArray(detail.created) ? detail.created : [],
  };
};

export const reportTypesAPI = {
  // Get one page of report types. Returns the raw envelope
  // ({ items, page, page_size, total, total_pages, has_next, has_previous }).
  listReportTypes: async ({
    page = 1,
    pageSize = DEFAULT_PAGE_SIZE,
    activeOnly = false,
    includeSections = true,
    organizationSlug = null,
    organizationId = null,
    search = null,
  } = {}) => {
    try {
      const params = {
        page,
        page_size: pageSize,
        active_only: activeOnly,
        include_sections: includeSections,
      };
      if (organizationSlug) params.organization_slug = organizationSlug;
      if (organizationId) params.organization_id = organizationId;
      if (search) params.search = search;
      const response = await api.get('/report-types/', { params });
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Get every report type as a flat array — for dropdowns and id → name lookups
  // that need the whole set rather than a page of it.
  getReportTypes: async (activeOnly = false, includeSections = true, organizationSlug = null) => {
    const all = [];
    let page = 1;
    // Guard against a backend that always reports has_next.
    while (page <= 25) {
      const data = await reportTypesAPI.listReportTypes({
        page,
        pageSize: FULL_LIST_PAGE_SIZE,
        activeOnly,
        includeSections,
        organizationSlug,
      });
      const { items, hasNext } = normalizeListResponse(data);
      all.push(...items);
      if (!hasNext || items.length === 0) break;
      page += 1;
    }
    return all;
  },

  // Create report type
  // Quiet on failure: the editor shows a refused save under the field it is
  // about (an owner role, the compliance code, the retention period).
  createReportType: async (data) => {
    const response = await api.post('/report-types/', data, { skipErrorToast: true });
    return response.data;
  },

  // Get report type by ID
  getReportType: async (id, includeSections = true, { quiet = false } = {}) => {
    try {
      const response = await api.get(`/report-types/${id}`, {
        params: { include_sections: includeSections },
        skipErrorToast: quiet,
      });
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Update report type
  updateReportType: async (id, data) => {
    const response = await api.patch(`/report-types/${id}`, data, { skipErrorToast: true });
    toast.success('Report type updated successfully!');
    return response.data;
  },

  // Delete report type (soft delete)
  deleteReportType: async (id) => {
    try {
      const response = await api.delete(`/report-types/${id}`);
      toast.success('Report type deleted successfully!');
      return response.data;
    } catch (error) {
      const errorMsg = error.response?.data?.detail || 'Failed to delete report type';
      toast.error(errorMsg);
      throw error;
    }
  },

  // Activate report type
  activateReportType: async (id) => {
    try {
      const response = await api.patch(`/report-types/${id}`, { is_active: true }, { withCredentials: true });
      toast.success('Report type activated successfully!');
      return response.data;
    } catch (error) {
      const errorMsg = error.response?.data?.detail || 'Failed to activate report type';
      toast.error(errorMsg);
      throw error;
    }
  },

  // Deactivate report type
  deactivateReportType: async (id) => {
    try {
      const response = await api.patch(`/report-types/${id}`, { is_active: false }, { withCredentials: true });
      toast.success('Report type deactivated successfully!');
      return response.data;
    } catch (error) {
      const errorMsg = error.response?.data?.detail || 'Failed to deactivate report type';
      toast.error(errorMsg);
      throw error;
    }
  },

  // Get report type statistics
  getReportTypeStats: async (typeId) => {
    try {
      const response = await api.get(`/report-types/${typeId}/stats`);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Clone report type
  cloneReportType: async (id, data = {}) => {
    try {
      const response = await api.post(`/report-types/${id}/clone`, data);
      toast.success('Report type cloned successfully!');
      return response.data;
    } catch (error) {
      const errorMsg = error.response?.data?.detail || 'Failed to clone report type';
      toast.error(errorMsg);
      throw error;
    }
  },

  // Export report type schema
  exportReportType: async (id) => {
    try {
      const response = await api.get(`/report-types/${id}/export`, {
        responseType: 'blob'
      });
      return response.data;
    } catch (error) {
      toast.error('Failed to export report type');
      throw error;
    }
  },

  // Every report type in the organization as one workbook — the same format
  // the importer reads. Resolves to { blob, filename }; the server names it.
  exportReportTypes: async ({ activeOnly = false } = {}) => {
    try {
      const response = await api.get('/report-types/export', {
        params: { active_only: activeOnly },
        responseType: 'blob',
      });
      return blobDownload(response, 'report_types.xlsx');
    } catch (error) {
      toast.error('Failed to export report types');
      throw error;
    }
  },

  // Download the blank Excel template used for bulk-importing report types.
  // Resolves to { blob, filename }; the server names it.
  downloadImportTemplate: async () => {
    try {
      const response = await api.get('/report-types/import/template', {
        responseType: 'blob'
      });
      return blobDownload(response, 'report_types_import_template.xlsx');
    } catch (error) {
      toast.error('Failed to download the import template');
      throw error;
    }
  },

  // Bulk import report types from a filled-in Excel template
  importReportTypes: async (file) => {
    try {
      const formData = new FormData();
      formData.append('file', file);
      const response = await api.post('/report-types/import', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      return normalizeImportResult(response.data);
    } catch (error) {
      const result = normalizeImportResult(error.response?.data);
      if (result.message || result.problems.length > 0) {
        // Structured feedback — the page shows it in the import results modal.
        error.importResult = result;
      } else {
        toast.error('Failed to import report types');
      }
      throw error;
    }
  },

  // Validate form data against report type
  validateFormData: async (reportTypeId, formData) => {
    try {
      const response = await api.post(`/report-types/${reportTypeId}/validate`, {
        form_data: formData
      });
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Get report type sections for multi-step forms
  getReportTypeSections: async (id) => {
    try {
      const response = await api.get(`/report-types/${id}/sections`);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Get active report types count (for dashboard)
  getActiveReportTypesCount: async () => {
    try {
      const response = await api.get('/report-types/active/count');
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Search report types by name or description
  searchReportTypes: async (query, activeOnly = true) => {
    try {
      const response = await api.get('/report-types/search', {
        params: {
          q: query,
          active_only: activeOnly
        }
      });
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Reorder sections in report type
  reorderSections: async (reportTypeId, sectionOrder) => {
    try {
      const response = await api.post(`/report-types/${reportTypeId}/reorder-sections`, {
        section_order: sectionOrder
      });
      toast.success('Sections reordered successfully!');
      return response.data;
    } catch (error) {
      const errorMsg = error.response?.data?.detail || 'Failed to reorder sections';
      toast.error(errorMsg);
      throw error;
    }
  },

  // Get report type templates
  getTemplates: async () => {
    try {
      const response = await api.get('/report-types/templates');
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Create report type from template
  createFromTemplate: async (templateId, data = {}) => {
    try {
      const response = await api.post(`/report-types/templates/${templateId}/create`, data);
      toast.success('Report type created from template!');
      return response.data;
    } catch (error) {
      const errorMsg = error.response?.data?.detail || 'Failed to create from template';
      toast.error(errorMsg);
      throw error;
    }
  }
};