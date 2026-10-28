// src/api/reportTypes.js
import api from './axios';
import { toast } from 'react-toastify';
import { DEFAULT_PAGE_SIZE, normalizeListResponse } from '../utils/pagination';
import { blobDownload } from '../utils/download';

// Page size used when pulling the full list for pickers: the most the API
// allows, so one request almost always covers an organization, with paging as
// the fallback. (At 10, an organization with ~110 types took 11 requests in a
// row, which is what made case lists show placeholder categories for seconds.)
const FULL_LIST_PAGE_SIZE = 100;

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

// Memoised promise for supportsSearch().
let searchSupport = null;
// Memoised promise for typeIndex(); cleared by every write below.
let typeIndexPromise = null;

let fieldCatalogPromise = null;

// `${typeId}:${version}` → Promise<version>. Versions are immutable.
const versionCache = new Map();

/**
 * The type and form version a report was filed against. Voice and chat
 * reports matched to a type carry it as matched_report_type_*.
 */
export const reportTypeVersionOf = (report) => {
  const id = report?.report_type_id || report?.matched_report_type_id || null;
  const version = report?.report_type_version
    ?? (id && id === report?.matched_report_type_id ? report?.matched_report_type_version : null)
    ?? null;
  return { id, version };
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

  /**
   * Whether the server filters on `search` (name, category, compliance code)
   * before paging. Older backends ignore the parameter and return everything,
   * so the answer is probed once — a term nothing can contain must come back
   * empty — and remembered for the session. An organization with no types at
   * all reads as supported, which is harmless: there is nothing to search.
   */
  supportsSearch: async () => {
    if (searchSupport === null) {
      searchSupport = reportTypesAPI
        .listReportTypes({ page: 1, pageSize: 1, includeSections: false, search: `zz-no-such-type-${Date.now()}` })
        .then((data) => (data?.total ?? data?.items?.length ?? 0) === 0)
        .catch(() => false);
    }
    return searchSupport;
  },

  /**
   * Every report type, without its form definition, fetched once and shared by
   * every screen that only needs names (case lists, dashboards, the case
   * page). Cleared whenever a type is created, changed or removed, so a rename
   * shows on the next screen opened.
   */
  typeIndex: async () => {
    if (!typeIndexPromise) {
      typeIndexPromise = reportTypesAPI.getReportTypes(false, false).catch((error) => {
        typeIndexPromise = null;
        throw error;
      });
    }
    return typeIndexPromise;
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

  /**
   * A type's form history, newest first, without sections:
   * `[{ id, report_type_id, version, code, name, category, created_at, created_by }]`.
   * Needs report_type:manage.
   */
  listVersions: async (id) => {
    const response = await api.get(`/report-types/${id}/versions`, { skipErrorToast: true });
    return Array.isArray(response.data) ? response.data : normalizeListResponse(response.data).items;
  },

  /**
   * One saved version of a type's form: `{ version, name, category, sections, … }`.
   * A version never changes, so each is fetched once per session. 404 when the
   * type has no such version (versions before the backend kept history).
   */
  getVersion: (id, version) => {
    const key = `${id}:${version}`;
    if (!versionCache.has(key)) {
      versionCache.set(
        key,
        api
          .get(`/report-types/${id}/versions/${version}`, { skipErrorToast: true })
          .then((response) => response.data)
          .catch((error) => {
            versionCache.delete(key);
            throw error;
          }),
      );
    }
    return versionCache.get(key);
  },

  /**
   * The form a report was filled in against: its pinned version when it has
   * one, else the type's current form (reports from before versioning, or a
   * version the server no longer has). Labels, options and order of a report's
   * answers come from here, never from the live type alone.
   */
  formForReport: async (report, { quiet = true } = {}) => {
    const { id, version } = reportTypeVersionOf(report);
    if (!id) return null;
    if (version != null) {
      try {
        return await reportTypesAPI.getVersion(id, version);
      } catch (error) {
        if (error?.response?.status !== 404) throw error;
      }
    }
    return reportTypesAPI.getReportType(id, true, { quiet });
  },

  // Update report type
  updateReportType: async (id, data) => {
    // The caller says what was saved — "Saved as version 3" when the questions changed.
    const response = await api.patch(`/report-types/${id}`, data, { skipErrorToast: true });
    return response.data;
  },

  // Delete report type (soft delete)
  deleteReportType: async (id) => {
    try {
      const response = await api.delete(`/report-types/${id}`);
      // A soft delete: it sets the type inactive (a draft stays a draft).
      toast.success('Report type deactivated.');
      return response.data;
    } catch (error) {
      // The interceptor has already shown the server's reason.
      throw error;
    }
  },

  /**
   * The standard questions: { core, recommended, optional, baseline_order }.
   * Each entry is a ready-to-insert question (name, type, label, options,
   * section…) plus what it's for (`tier`, `can_disable`, `default_on`,
   * `locked`, `drives`, `why`, `if_disabled`). Fetched once per session;
   * needs report_type:manage. Quiet: the builder still works without it.
   */
  fieldCatalog: () => {
    if (!fieldCatalogPromise) {
      fieldCatalogPromise = api
        .get('/report-types/field-catalog', { skipErrorToast: true })
        .then((response) => response.data)
        .catch((error) => {
          fieldCatalogPromise = null;
          throw error;
        });
    }
    return fieldCatalogPromise;
  },

  /**
   * Roles a report type's cases can be owned by — every staff role, reporter
   * excluded, without permissions: `[{ code, name, level_code, level_title,
   * level_rank }]`. For the Default Owner / Backup Owner pickers. Needs
   * report_type:manage.
   */
  ownerRoles: async () => {
    const response = await api.get('/report-types/owner-roles', { skipErrorToast: true });
    return response.data;
  },

  /** Draft, active or inactive — `status` is a type's whole availability. */
  setReportTypeStatus: async (id, status) => {
    const response = await api.patch(`/report-types/${id}`, { status });
    return response.data;
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
      // The interceptor has already shown the server's reason.
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
      // The interceptor has already shown the server's reason.
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
      // The interceptor has already shown the server's reason.
      throw error;
    }
  }
};

// Anything that can add, rename or remove a type makes the shared name index
// stale; drop it after the call, whether or not the call succeeded.
['createReportType', 'updateReportType', 'deleteReportType', 'setReportTypeStatus', 'cloneReportType', 'importReportTypes', 'createFromTemplate'].forEach(
  (name) => {
    const call = reportTypesAPI[name];
    if (typeof call !== 'function') return;
    reportTypesAPI[name] = async (...args) => {
      try {
        return await call(...args);
      } finally {
        typeIndexPromise = null;
      }
    };
  },
);
