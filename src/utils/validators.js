// src/utils/validators.js
import { parseISO, isValid } from 'date-fns';

/**
 * Validate email address
 * @param {string} email - Email to validate
 * @returns {boolean} True if valid
 */
export const isValidEmail = (email) => {
  if (!email) return false;

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email.trim());
};

/**
 * Validate phone number
 * @param {string} phone - Phone number to validate
 * @returns {boolean} True if valid
 */
export const isValidPhone = (phone) => {
  if (!phone) return false;

  // Remove spaces, dashes, dots for simplification
  const cleaned = phone.replace(/[\s-.]/g, '');
  // Allow optional leading '+' or '0', then 7 to 15 digits total
  const phoneRegex = /^(\+|0)?\d{7,15}$/;
  return phoneRegex.test(cleaned);
};

/**
 * Validate password strength
 * @param {string} password - Password to validate
 * @returns {object} Validation result with checks and score
 */
export const validatePassword = (password) => {
  const checks = {
    length: password.length >= 8,
    hasUppercase: /[A-Z]/.test(password),
    hasLowercase: /[a-z]/.test(password),
    hasNumber: /[0-9]/.test(password),
    hasSpecial: /[^A-Za-z0-9]/.test(password)
  };

  const score = Object.values(checks).filter(Boolean).length;
  let strength = 'weak';
  let message = 'Password is weak';

  if (score === 5) {
    strength = 'strong';
    message = 'Password is strong';
  } else if (score >= 3) {
    strength = 'medium';
    message = 'Password is medium strength';
  }

  return {
    isValid: score >= 3, // Minimum 3 requirements met
    checks,
    score,
    strength,
    message
  };
};

/**
 * Validate URL
 * @param {string} url - URL to validate
 * @returns {boolean} True if valid
 */
export const isValidUrl = (url) => {
  if (!url) return false;

  try {
    const urlObj = new URL(url);
    return urlObj.protocol === 'http:' || urlObj.protocol === 'https:';
  } catch {
    return false;
  }
};

/**
 * Validate date
 * @param {string|Date} date - Date to validate
 * @returns {boolean} True if valid
 */
export const isValidDate = (date) => {
  if (!date) return false;

  try {
    const dateObj = typeof date === 'string' ? parseISO(date) : new Date(date);
    return isValid(dateObj);
  } catch {
    return false;
  }
};

/**
 * Validate date is in the past
 * @param {string|Date} date - Date to validate
 * @returns {boolean} True if date is in the past
 */
export const isPastDate = (date) => {
  if (!isValidDate(date)) return false;

  const dateObj = typeof date === 'string' ? parseISO(date) : new Date(date);
  const now = new Date();

  return dateObj < now;
};

/**
 * Validate date is in the future
 * @param {string|Date} date - Date to validate
 * @returns {boolean} True if date is in the future
 */
export const isFutureDate = (date) => {
  if (!isValidDate(date)) return false;

  const dateObj = typeof date === 'string' ? parseISO(date) : new Date(date);
  const now = new Date();

  return dateObj > now;
};

/**
 * Validate date range
 * @param {string|Date} startDate - Start date
 * @param {string|Date} endDate - End date
 * @returns {boolean} True if start date is before end date
 */
export const isValidDateRange = (startDate, endDate) => {
  if (!isValidDate(startDate) || !isValidDate(endDate)) return false;

  const start = typeof startDate === 'string' ? parseISO(startDate) : new Date(startDate);
  const end = typeof endDate === 'string' ? parseISO(endDate) : new Date(endDate);

  return start <= end;
};

/**
 * Validate file type
 * @param {File} file - File to validate
 * @param {Array} allowedTypes - Array of allowed MIME types
 * @returns {boolean} True if file type is allowed
 */
export const isValidFileType = (file, allowedTypes) => {
  if (!file || !allowedTypes || !Array.isArray(allowedTypes)) return false;

  return allowedTypes.includes(file.type);
};

/**
 * Validate file size
 * @param {File} file - File to validate
 * @param {number} maxSize - Maximum file size in bytes
 * @returns {boolean} True if file size is within limit
 */
export const isValidFileSize = (file, maxSize) => {
  if (!file || !maxSize) return false;

  return file.size <= maxSize;
};

/**
 * Validate report number format (8 alphanumeric characters)
 * @param {string} reportNumber - Report number to validate
 * @returns {boolean} True if valid
 */
export const isValidReportNumber = (reportNumber) => {
  if (!reportNumber) return false;

  const reportNumberRegex = /^[A-Z0-9]{8}$/i;
  return reportNumberRegex.test(reportNumber);
};

/**
 * Validate username
 * @param {string} username - Username to validate
 * @returns {object} Validation result
 */
export const validateUsername = (username) => {
  if (!username) {
    return { isValid: false, message: 'Username is required' };
  }

  if (username.length < 3) {
    return { isValid: false, message: 'Username must be at least 3 characters' };
  }

  if (username.length > 50) {
    return { isValid: false, message: 'Username must be less than 50 characters' };
  }

  const usernameRegex = /^[a-zA-Z0-9_\-\.]+$/;
  if (!usernameRegex.test(username)) {
    return { isValid: false, message: 'Username can only contain letters, numbers, dots, dashes, and underscores' };
  }

  return { isValid: true, message: 'Username is valid' };
};

/**
 * Validate required field
 * @param {any} value - Field value
 * @param {string} fieldName - Field name for error message
 * @returns {object} Validation result
 */
export const validateRequired = (value, fieldName = 'Field') => {
  if (value === null || value === undefined || value === '') {
    return { isValid: false, message: `${fieldName} is required` };
  }

  if (Array.isArray(value) && value.length === 0) {
    return { isValid: false, message: `${fieldName} is required` };
  }

  return { isValid: true, message: '' };
};

/**
 * Validate minimum length
 * @param {string} value - Field value
 * @param {number} minLength - Minimum length
 * @param {string} fieldName - Field name for error message
 * @returns {object} Validation result
 */
export const validateMinLength = (value, minLength, fieldName = 'Field') => {
  if (!value || value.length < minLength) {
    return {
      isValid: false,
      message: `${fieldName} must be at least ${minLength} characters`
    };
  }

  return { isValid: true, message: '' };
};

/**
 * Validate maximum length
 * @param {string} value - Field value
 * @param {number} maxLength - Maximum length
 * @param {string} fieldName - Field name for error message
 * @returns {object} Validation result
 */
export const validateMaxLength = (value, maxLength, fieldName = 'Field') => {
  if (value && value.length > maxLength) {
    return {
      isValid: false,
      message: `${fieldName} must be less than ${maxLength} characters`
    };
  }

  return { isValid: true, message: '' };
};

/**
 * Validate number range
 * @param {number} value - Number value
 * @param {number} min - Minimum value
 * @param {number} max - Maximum value
 * @param {string} fieldName - Field name for error message
 * @returns {object} Validation result
 */
export const validateNumberRange = (value, min, max, fieldName = 'Field') => {
  const num = Number(value);

  if (isNaN(num)) {
    return { isValid: false, message: `${fieldName} must be a number` };
  }

  if (num < min || num > max) {
    return {
      isValid: false,
      message: `${fieldName} must be between ${min} and ${max}`
    };
  }

  return { isValid: true, message: '' };
};

/**
 * Validate array length
 * @param {Array} array - Array to validate
 * @param {number} minLength - Minimum array length
 * @param {number} maxLength - Maximum array length
 * @param {string} fieldName - Field name for error message
 * @returns {object} Validation result
 */
export const validateArrayLength = (array, minLength = 1, maxLength = null, fieldName = 'Field') => {
  if (!Array.isArray(array)) {
    return { isValid: false, message: `${fieldName} must be an array` };
  }

  if (array.length < minLength) {
    return {
      isValid: false,
      message: `${fieldName} must have at least ${minLength} item(s)`
    };
  }

  if (maxLength !== null && array.length > maxLength) {
    return {
      isValid: false,
      message: `${fieldName} must have at most ${maxLength} item(s)`
    };
  }

  return { isValid: true, message: '' };
};

/**
 * Validate credit card number (Luhn algorithm)
 * @param {string} cardNumber - Credit card number
 * @returns {boolean} True if valid
 */
export const isValidCreditCard = (cardNumber) => {
  if (!cardNumber) return false;

  // Remove all non-digits
  const cleaned = cardNumber.replace(/\D/g, '');

  // Check length
  if (cleaned.length < 13 || cleaned.length > 19) {
    return false;
  }

  // Luhn algorithm
  let sum = 0;
  let isEven = false;

  for (let i = cleaned.length - 1; i >= 0; i--) {
    let digit = parseInt(cleaned.charAt(i), 10);

    if (isEven) {
      digit *= 2;
      if (digit > 9) {
        digit -= 9;
      }
    }

    sum += digit;
    isEven = !isEven;
  }

  return sum % 10 === 0;
};

/**
 * Validate postal code (US/Canada)
 * @param {string} postalCode - Postal code to validate
 * @param {string} country - Country code (US or CA)
 * @returns {boolean} True if valid
 */
export const isValidPostalCode = (postalCode, country = 'US') => {
  if (!postalCode) return false;

  const patterns = {
    US: /^\d{5}(-\d{4})?$/, // 5 digits or 5+4 digits
    CA: /^[A-Z]\d[A-Z] \d[A-Z]\d$/i // A1A 1A1 format
  };

  const pattern = patterns[country.toUpperCase()];
  if (!pattern) return true; // No validation for other countries

  return pattern.test(postalCode.trim());
};

/**
 * Validate Social Security Number (US)
 * @param {string} ssn - SSN to validate
 * @returns {boolean} True if valid
 */
export const isValidSSN = (ssn) => {
  if (!ssn) return false;

  // Remove all non-digits
  const cleaned = ssn.replace(/\D/g, '');

  // Check length
  if (cleaned.length !== 9) {
    return false;
  }

  // Validate format (no area number 000, group number 00, serial number 0000)
  const area = cleaned.substring(0, 3);
  const group = cleaned.substring(3, 5);
  const serial = cleaned.substring(5, 9);

  if (area === '000' || area === '666' || area.startsWith('9')) {
    return false;
  }

  if (group === '00') {
    return false;
  }

  if (serial === '0000') {
    return false;
  }

  return true;
};

/**
 * Validate integer
 * @param {any} value - Value to validate
 * @returns {boolean} True if valid integer
 */
export const isValidInteger = (value) => {
  if (value === null || value === undefined) return false;

  const str = String(value);
  const num = Number(value);

  return Number.isInteger(num) && str === num.toString();
};

/**
 * Validate positive number
 * @param {any} value - Value to validate
 * @returns {boolean} True if valid positive number
 */
export const isValidPositiveNumber = (value) => {
  if (value === null || value === undefined) return false;

  const num = Number(value);
  return !isNaN(num) && num > 0;
};

/**
 * Validate non-negative number
 * @param {any} value - Value to validate
 * @returns {boolean} True if valid non-negative number
 */
export const isValidNonNegativeNumber = (value) => {
  if (value === null || value === undefined) return false;

  const num = Number(value);
  return !isNaN(num) && num >= 0;
};

/**
 * Validate JSON string
 * @param {string} jsonString - JSON string to validate
 * @returns {boolean} True if valid JSON
 */
export const isValidJSON = (jsonString) => {
  if (!jsonString) return false;

  try {
    JSON.parse(jsonString);
    return true;
  } catch {
    return false;
  }
};

/**
 * Validate UUID
 * @param {string} uuid - UUID to validate
 * @returns {boolean} True if valid UUID
 */
export const isValidUUID = (uuid) => {
  if (!uuid) return false;

  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
};

/**
 * Validate IP address
 * @param {string} ip - IP address to validate
 * @returns {boolean} True if valid IP
 */
export const isValidIP = (ip) => {
  if (!ip) return false;

  // IPv4 validation
  const ipv4Regex = /^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;

  // IPv6 validation (simplified)
  const ipv6Regex = /^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/;

  return ipv4Regex.test(ip) || ipv6Regex.test(ip);
};

/**
 * Validate domain name
 * @param {string} domain - Domain name to validate
 * @returns {boolean} True if valid domain
 */
export const isValidDomain = (domain) => {
  if (!domain) return false;

  const domainRegex = /^(?!:\/\/)([a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}$/;
  return domainRegex.test(domain);
};

/**
 * Validate report form data based on report type schema
 * @param {object} formData - Form data to validate
 * @param {Array} questions - Report type questions schema
 * @returns {object} Validation result with errors
 */
export const validateReportFormData = (formData, questions) => {
  const errors = {};

  if (!questions || !Array.isArray(questions)) {
    return { isValid: false, errors: { _general: 'Invalid form schema' } };
  }

  for (const question of questions) {
    const { name, label, required, type, validation } = question;
    const value = formData[name];

    // Check required field
    if (required && (value === undefined || value === null || value === '')) {
      errors[name] = `${label || name} is required`;
      continue;
    }

    // Skip validation if value is empty
    if (value === undefined || value === null || value === '') {
      continue;
    }

    // Type-specific validation
    switch (type) {
      case 'email':
        if (!isValidEmail(value)) {
          errors[name] = `${label || name} must be a valid email address`;
        }
        break;

      case 'number':
        if (isNaN(Number(value))) {
          errors[name] = `${label || name} must be a number`;
        }
        break;

      case 'date':
        if (!isValidDate(value)) {
          errors[name] = `${label || name} must be a valid date`;
        }
        break;

      case 'url':
        if (!isValidUrl(value)) {
          errors[name] = `${label || name} must be a valid URL`;
        }
        break;

      case 'phone':
        if (!isValidPhone(value)) {
          errors[name] = `${label || name} must be a valid phone number`;
        }
        break;
    }

    // Custom validation rules
    if (validation) {
      const { min, max, minLength, maxLength, pattern, patternMessage } = validation;

      if (min !== undefined && Number(value) < min) {
        errors[name] = `${label || name} must be at least ${min}`;
      }

      if (max !== undefined && Number(value) > max) {
        errors[name] = `${label || name} must be at most ${max}`;
      }

      if (minLength !== undefined && String(value).length < minLength) {
        errors[name] = `${label || name} must be at least ${minLength} characters`;
      }

      if (maxLength !== undefined && String(value).length > maxLength) {
        errors[name] = `${label || name} must be at most ${maxLength} characters`;
      }

      if (pattern && !new RegExp(pattern).test(value)) {
        errors[name] = patternMessage || `${label || name} format is invalid`;
      }
    }
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
};

/**
 * Validate file upload
 * @param {File} file - File to validate
 * @param {object} options - Validation options
 * @returns {object} Validation result
 */
export const validateFileUpload = (file, options = {}) => {
  const {
    allowedTypes = [],
    maxSize = 10 * 1024 * 1024, // 10MB default
    maxFiles = 1
  } = options;

  const errors = [];

  if (!file) {
    return { isValid: false, errors: ['No file selected'] };
  }

  // Check file type
  if (allowedTypes.length > 0 && !isValidFileType(file, allowedTypes)) {
    const allowedExtensions = allowedTypes.map(type => {
      const parts = type.split('/');
      return parts[1] || parts[0];
    }).join(', ');

    errors.push(`File type not allowed. Allowed types: ${allowedExtensions}`);
  }

  // Check file size
  if (!isValidFileSize(file, maxSize)) {
    const maxSizeMB = maxSize / (1024 * 1024);
    errors.push(`File size exceeds ${maxSizeMB}MB limit`);
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};

/**
 * Create validation schema for Zod
 * @param {Array} questions - Report type questions
 * @returns {object} Zod schema object
 */
export const createValidationSchema = (questions) => {
  if (!questions || !Array.isArray(questions)) {
    return {};
  }

  const schema = {};

  for (const question of questions) {
    const { name, type, required, validation } = question;

    if (!name) continue;

    let fieldSchema;

    // Base schema based on type
    switch (type) {
      case 'email':
        fieldSchema = z.string().email('Invalid email address');
        break;
      case 'number':
        fieldSchema = z.coerce.number();
        break;
      case 'date':
        fieldSchema = z.string().refine(isValidDate, 'Invalid date');
        break;
      case 'boolean':
        fieldSchema = z.boolean();
        break;
      case 'select':
      case 'multiselect':
        fieldSchema = type === 'multiselect' ? z.array(z.string()) : z.string();
        break;
      default:
        fieldSchema = z.string();
    }

    // Add required validation
    if (required) {
      fieldSchema = fieldSchema.refine(val => {
        if (type === 'multiselect') {
          return Array.isArray(val) && val.length > 0;
        }
        return val !== null && val !== undefined && val !== '';
      }, 'This field is required');
    } else {
      fieldSchema = fieldSchema.optional();
    }

    // Add custom validation rules
    if (validation) {
      const { min, max, minLength, maxLength, pattern } = validation;

      if (min !== undefined) {
        fieldSchema = fieldSchema.refine(val => val >= min, `Value must be at least ${min}`);
      }

      if (max !== undefined) {
        fieldSchema = fieldSchema.refine(val => val <= max, `Value must be at most ${max}`);
      }

      if (minLength !== undefined) {
        fieldSchema = fieldSchema.refine(
          val => String(val).length >= minLength,
          `Must be at least ${minLength} characters`
        );
      }

      if (maxLength !== undefined) {
        fieldSchema = fieldSchema.refine(
          val => String(val).length <= maxLength,
          `Must be at most ${maxLength} characters`
        );
      }

      if (pattern) {
        fieldSchema = fieldSchema.refine(
          val => new RegExp(pattern).test(val),
          'Invalid format'
        );
      }
    }

    schema[name] = fieldSchema;
  }

  return schema;
};

// Note: This requires zod to be imported
import { z } from 'zod';