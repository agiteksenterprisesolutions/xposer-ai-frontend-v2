// src/utils/constants.js
// Application constants
export const ROLES = {
  REPORTER: 'reporter',
  OFFICER: 'officer',
  REVIEWER: 'reviewer',
  MANAGER: 'manager',
  ADMIN: 'admin',
  SUPER_ADMIN: 'super_admin'
};

export const REPORT_STATUS = {
  PENDING: 'pending',
  IN_PROGRESS: 'in_progress',
  UNDER_REVIEW: 'under_review',
  RESOLVED: 'resolved',
  CLOSED: 'closed',
  REJECTED: 'rejected'
};

export const REPORT_PRIORITY = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  CRITICAL: 'critical'
};

export const QUESTION_TYPES = {
  TEXT: 'text',
  TEXTAREA: 'textarea',
  NUMBER: 'number',
  SELECT: 'select',
  MULTISELECT: 'multiselect',
  DATE: 'date',
  DATETIME: 'datetime',
  BOOLEAN: 'boolean',
  FILE: 'file',
  EMAIL: 'email',
  PHONE: 'phone'
};

export const STATUS_COLORS = {
  pending: 'bg-yellow-100 text-yellow-800',
  in_progress: 'bg-blue-100 text-blue-800',
  under_review: 'bg-purple-100 text-purple-800',
  resolved: 'bg-green-100 text-green-800',
  closed: 'bg-gray-100 text-gray-800',
  rejected: 'bg-red-100 text-red-800'
};

export const PRIORITY_COLORS = {
  low: 'bg-gray-100 text-gray-800',
  medium: 'bg-blue-100 text-blue-800',
  high: 'bg-orange-100 text-orange-800',
  critical: 'bg-red-100 text-red-800'
};

export const ROLE_COLORS = {
  reporter: 'bg-gray-100 text-gray-800',
  officer: 'bg-blue-100 text-blue-800',
  reviewer: 'bg-purple-100 text-purple-800',
  manager: 'bg-green-100 text-green-800',
  admin: 'bg-red-100 text-red-800'
};

export const PAGINATION_LIMITS = [10, 20, 50, 100];

export const DATE_FORMATS = {
  DISPLAY: 'MMM dd, yyyy',
  DATETIME: 'MMM dd, yyyy HH:mm',
  API: 'yyyy-MM-dd'
};

// Evidence rules live in utils/attachments.js — a second list here is what let
// four upload sites drift apart in the first place.
export const SUPPORT_EMAIL = import.meta.env.VITE_SUPPORT_EMAIL || 'support@xposer.ai';