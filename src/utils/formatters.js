// src/utils/formatters.js
import { format, parseISO, parse, isValid } from 'date-fns';

/**
 * The backend serializes timestamps in UTC but often omits the timezone
 * marker (e.g. "2026-07-28T12:38:59" instead of "...Z" or "...+00:00").
 * Per the ISO 8601 / ECMA-262 spec, JS parses a date-time string with no
 * offset as LOCAL time, not UTC — silently shifting every timestamp by
 * the user's UTC offset. Date-only strings ("2026-07-28") are unaffected
 * since those already default to UTC.
 *
 * This normalizes a naive "date+time, no offset" string by appending "Z"
 * so it's correctly interpreted as UTC before conversion to the user's
 * local timezone for display.
 */
const NAIVE_DATETIME_REGEX = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(:\d{2}(\.\d+)?)?$/;

export const normalizeToUTC = (dateString) => {
  const trimmed = dateString.trim();
  if (NAIVE_DATETIME_REGEX.test(trimmed)) {
    return `${trimmed.replace(' ', 'T')}Z`;
  }
  return trimmed;
};

/**
 * Parse a value coming from the API (string, epoch number, or Date) into
 * a Date object, treating timezone-less date-time strings as UTC.
 * @param {string|number|Date} date
 * @returns {Date|null}
 */
export const parseServerDate = (date) => {
  if (date === null || date === undefined || date === '') return null;

  if (date instanceof Date) return date;

  if (typeof date === 'number') {
    return new Date(date < 1e12 ? date * 1000 : date);
  }

  if (typeof date === 'string') {
    const trimmed = date.trim();
    // Numeric timestamp (seconds or ms)
    if (/^\d+$/.test(trimmed)) {
      const asNumber = Number(trimmed);
      return new Date(trimmed.length === 10 ? asNumber * 1000 : asNumber);
    }

    let dateObj = parseISO(normalizeToUTC(trimmed));
    if (!isValid(dateObj)) {
      // Try common backend formats (assumed UTC, no offset present)
      const formatsToTry = [
        'yyyy-MM-dd HH:mm:ss',
        'yyyy-MM-dd HH:mm',
        'yyyy-MM-dd',
      ];
      for (const fmt of formatsToTry) {
        const parsed = parse(trimmed, fmt, new Date());
        if (isValid(parsed)) {
          dateObj = parsed;
          break;
        }
      }
    }
    return dateObj;
  }

  return new Date(date);
};

/**
 * Format date for display
 * @param {string|Date} date - Date to format
 * @param {string} formatString - Date format string
 * @returns {string} Formatted date
 */
export const formatDate = (date, formatString = 'MMM dd, yyyy') => {
  if (!date) return 'N/A';

  try {
    const dateObj = parseServerDate(date);

    if (!dateObj || !isValid(dateObj)) {
      return 'Invalid date';
    }

    return format(dateObj, formatString);
  } catch (error) {
    console.error('Error formatting date:', error);
    return 'Invalid date';
  }
};

/**
 * Format date with time
 * @param {string|Date} date - Date to format
 * @returns {string} Formatted date time
 */
export const formatDateTime = (date) => {
  return formatDate(date, 'MMM dd, yyyy HH:mm:ss');
};

/**
 * Format date for API (YYYY-MM-DD)
 * @param {string|Date} date - Date to format
 * @returns {string} API formatted date
 */
export const formatDateForAPI = (date) => {
  return formatDate(date, 'yyyy-MM-dd');
};

/**
 * Format date time for API
 * @param {string|Date} date - Date to format
 * @returns {string} API formatted date time
 */
export const formatDateTimeForAPI = (date) => {
  return formatDate(date, "yyyy-MM-dd'T'HH:mm:ss");
};

/**
 * Format relative time (e.g., "2 hours ago")
 * @param {string|Date} date - Date to format
 * @returns {string} Relative time string
 */
export const formatRelativeTime = (date) => {
  if (!date) return 'Unknown';

  const dateObj = parseServerDate(date);
  const now = new Date();
  const diffInSeconds = Math.floor((now - dateObj) / 1000);
  
  if (diffInSeconds < 0) {
    return 'Just now';
  }
  
  const intervals = [
    { label: 'year', seconds: 31536000 },
    { label: 'month', seconds: 2592000 },
    { label: 'week', seconds: 604800 },
    { label: 'day', seconds: 86400 },
    { label: 'hour', seconds: 3600 },
    { label: 'minute', seconds: 60 },
    { label: 'second', seconds: 1 }
  ];
  
  for (const interval of intervals) {
    const count = Math.floor(diffInSeconds / interval.seconds);
    if (count >= 1) {
      return count === 1 
        ? `${count} ${interval.label} ago`
        : `${count} ${interval.label}s ago`;
    }
  }
  
  return 'Just now';
};

/**
 * Format file size in human-readable format
 * @param {number} bytes - File size in bytes
 * @returns {string} Formatted file size
 */
export const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

/**
 * Format phone number
 * @param {string} phone - Phone number to format
 * @returns {string} Formatted phone number
 */
export const formatPhoneNumber = (phone) => {
  if (!phone) return '';
  
  // Remove all non-digits
  const cleaned = phone.replace(/\D/g, '');
  
  // Format based on length
  if (cleaned.length === 10) {
    return cleaned.replace(/(\d{3})(\d{3})(\d{4})/, '($1) $2-$3');
  } else if (cleaned.length === 11 && cleaned[0] === '1') {
    return cleaned.replace(/(\d{1})(\d{3})(\d{3})(\d{4})/, '+$1 ($2) $3-$4');
  }
  
  return phone;
};

/**
 * Format currency
 * @param {number} amount - Amount to format
 * @param {string} currency - Currency code (default: USD)
 * @returns {string} Formatted currency
 */
export const formatCurrency = (amount, currency = 'USD') => {
  if (amount === null || amount === undefined) return 'N/A';
  
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount);
};

/**
 * Format percentage
 * @param {number} value - Percentage value (0-100)
 * @param {number} decimals - Number of decimal places
 * @returns {string} Formatted percentage
 */
export const formatPercentage = (value, decimals = 1) => {
  if (value === null || value === undefined) return 'N/A';
  
  return new Intl.NumberFormat('en-US', {
    style: 'percent',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  }).format(value / 100);
};

/**
 * Format report number with dashes
 * @param {string} reportNumber - Report number to format
 * @returns {string} Formatted report number
 */
export const formatReportNumber = (reportNumber) => {
  if (!reportNumber) return '';
  
  // Remove all non-alphanumeric characters
  const cleaned = reportNumber.replace(/[^a-zA-Z0-9]/g, '');
  
  // Format as XXXXX-XXX or similar based on length
  if (cleaned.length === 8) {
    return cleaned.replace(/(\w{4})(\w{4})/, '$1-$2');
  } else if (cleaned.length === 10) {
    return cleaned.replace(/(\w{4})(\w{3})(\w{3})/, '$1-$2-$3');
  }
  
  return reportNumber;
};

/**
 * Format initials from name
 * @param {string} name - Full name
 * @param {number} maxLength - Maximum initials length
 * @returns {string} Initials
 */
export const formatInitials = (name, maxLength = 2) => {
  if (!name) return '?';
  
  return name
    .split(' ')
    .map(word => word[0])
    .join('')
    .toUpperCase()
    .substring(0, maxLength);
};

/**
 * Format status text for display
 * @param {string} status - Status string
 * @returns {string} Formatted status
 */
export const formatStatus = (status) => {
  const statusMap = {
    pending: 'Pending',
    in_progress: 'In Progress',
    under_review: 'Under Review',
    resolved: 'Resolved',
    closed: 'Closed',
    rejected: 'Rejected',
    draft: 'Draft',
    submitted: 'Submitted',
    approved: 'Approved',
    declined: 'Declined'
  };
  
  return statusMap[status] || status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
};

/**
 * Format priority text for display
 * @param {string} priority - Priority string
 * @returns {string} Formatted priority
 */
export const formatPriority = (priority) => {
  const priorityMap = {
    low: 'Low',
    medium: 'Medium',
    high: 'High',
    critical: 'Critical'
  };
  
  return priorityMap[priority] || priority.charAt(0).toUpperCase() + priority.slice(1);
};

/**
 * Format role text for display
 * @param {string} role - Role string
 * @returns {string} Formatted role
 */
export const formatRole = (role) => {
  const roleMap = {
    reporter: 'Reporter',
    officer: 'Compliance Officer',
    reviewer: 'Reviewer',
    manager: 'Manager',
    admin: 'Administrator'
  };
  
  return roleMap[role] || role.charAt(0).toUpperCase() + role.slice(1);
};

/**
 * Truncate text with ellipsis
 * @param {string} text - Text to truncate
 * @param {number} maxLength - Maximum length
 * @param {boolean} showTooltip - Whether to show full text on hover
 * @returns {string} Truncated text
 */
export const truncateText = (text, maxLength = 100, showTooltip = false) => {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  
  const truncated = text.substring(0, maxLength) + '...';
  
  if (showTooltip) {
    return `<span title="${text.replace(/"/g, '&quot;')}">${truncated}</span>`;
  }
  
  return truncated;
};

/**
 * Format JSON for display
 * @param {object} data - JSON data
 * @param {number} indent - Indentation spaces
 * @returns {string} Formatted JSON
 */
export const formatJSON = (data, indent = 2) => {
  try {
    return JSON.stringify(data, null, indent);
  } catch (error) {
    return 'Invalid JSON';
  }
};

/**
 * Format CSV data
 * @param {Array} data - Array of objects
 * @returns {string} CSV formatted string
 */
export const formatCSV = (data) => {
  if (!data || !Array.isArray(data) || data.length === 0) {
    return '';
  }
  
  const headers = Object.keys(data[0]);
  const csvRows = [];
  
  // Add headers
  csvRows.push(headers.join(','));
  
  // Add data rows
  for (const row of data) {
    const values = headers.map(header => {
      const value = row[header];
      // Escape quotes and wrap in quotes if contains comma or quotes
      const escaped = String(value).replace(/"/g, '""');
      return /[,"\n]/.test(escaped) ? `"${escaped}"` : escaped;
    });
    csvRows.push(values.join(','));
  }
  
  return csvRows.join('\n');
};

/**
 * Format duration in human readable format
 * @param {number} seconds - Duration in seconds
 * @returns {string} Formatted duration
 */
export const formatDuration = (seconds) => {
  if (seconds < 0) return '0s';
  
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  
  const parts = [];
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (secs > 0 || parts.length === 0) parts.push(`${secs}s`);
  
  return parts.join(' ');
};

/**
 * Format number with commas
 * @param {number} number - Number to format
 * @returns {string} Formatted number
 */
export const formatNumber = (number) => {
  if (number === null || number === undefined) return 'N/A';
  
  return new Intl.NumberFormat('en-US').format(number);
};

/**
 * Format tags array for display
 * @param {Array} tags - Array of tags
 * @param {number} maxTags - Maximum tags to show
 * @returns {string} Formatted tags
 */
export const formatTags = (tags, maxTags = 3) => {
  if (!tags || !Array.isArray(tags) || tags.length === 0) {
    return 'No tags';
  }
  
  if (tags.length <= maxTags) {
    return tags.join(', ');
  }
  
  return `${tags.slice(0, maxTags).join(', ')} +${tags.length - maxTags} more`;
};

/**
 * Format boolean for display
 * @param {boolean} value - Boolean value
 * @param {string} trueText - Text for true
 * @param {string} falseText - Text for false
 * @returns {string} Formatted boolean
 */
export const formatBoolean = (value, trueText = 'Yes', falseText = 'No') => {
  return value ? trueText : falseText;
};

/**
 * Format array for display
 * @param {Array} array - Array to format
 * @param {string} separator - Separator string
 * @returns {string} Formatted array
 */
export const formatArray = (array, separator = ', ') => {
  if (!array || !Array.isArray(array)) return '';
  return array.filter(item => item != null).join(separator);
};

/**
 * Format object as key-value pairs
 * @param {object} obj - Object to format
 * @returns {string} Formatted object
 */
export const formatObject = (obj) => {
  if (!obj || typeof obj !== 'object') return '';
  
  return Object.entries(obj)
    .map(([key, value]) => {
      if (Array.isArray(value)) {
        return `${key}: [${formatArray(value)}]`;
      } else if (typeof value === 'object' && value !== null) {
        return `${key}: {${formatObject(value)}}`;
      }
      return `${key}: ${value}`;
    })
    .join(', ');
};
