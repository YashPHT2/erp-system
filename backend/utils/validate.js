const mongoose = require('mongoose');
const ApiError = require('./ApiError');
const { parseRupees } = require('./money');

function requiredText(value, fieldName, { min = 1, max = 80 } = {}) {
  if (typeof value !== 'string') {
    throw new ApiError(400, `${fieldName} is required.`, 'VALIDATION_ERROR');
  }
  const text = value.trim().replace(/\s+/g, ' ');
  if (text.length < min || text.length > max) {
    throw new ApiError(400, `${fieldName} must be between ${min} and ${max} characters.`, 'VALIDATION_ERROR');
  }
  if (/[\u0000-\u001F]/.test(text)) {
    throw new ApiError(400, `${fieldName} contains invalid characters.`, 'VALIDATION_ERROR');
  }
  return text;
}

function optionalText(value, fieldName, options) {
  if (value == null || value === '') return '';
  return requiredText(value, fieldName, options);
}

function assertAcademicYear(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{4}$/.test(value.trim())) {
    throw new ApiError(400, 'Academic year must use the format YYYY-YYYY.', 'INVALID_ACADEMIC_YEAR');
  }
  const [start, end] = value.trim().split('-').map(Number);
  if (end !== start + 1) {
    throw new ApiError(400, 'Academic year must cover two consecutive years.', 'INVALID_ACADEMIC_YEAR');
  }
  return `${start}-${end}`;
}

function classKey(className) {
  return className.trim().replace(/\s+/g, ' ').toLowerCase();
}

function sectionKey(section) {
  return section ? section.trim().toUpperCase() : '';
}

function assertObjectId(id) {
  if (typeof id !== 'string' || !mongoose.Types.ObjectId.isValid(id)) {
    throw new ApiError(400, 'Invalid identifier.', 'INVALID_ID');
  }
  return id;
}

function queryString(query, key, max = 80) {
  const value = query?.[key];
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, max);
}

function pageParams(query) {
  const page = Math.max(Number.parseInt(query?.page, 10) || 1, 1);
  const limit = Math.min(Math.max(Number.parseInt(query?.limit, 10) || 20, 1), 100);
  return { page, limit, skip: (page - 1) * limit };
}

function actorSnapshot(user) {
  return {
    userId: user.userId,
    name: user.name,
    role: user.role,
  };
}

function validateComponents(items, catalogue, fieldName) {
  if (!Array.isArray(items) || items.length === 0) {
    throw new ApiError(400, `Add at least one ${fieldName}.`, 'VALIDATION_ERROR');
  }
  if (items.length > 12) {
    throw new ApiError(400, `A maximum of 12 ${fieldName} lines is allowed.`, 'VALIDATION_ERROR');
  }

  const seen = new Set();
  return items.map((item) => {
    const code = typeof item?.code === 'string' ? item.code.trim().toUpperCase() : '';
    const known = catalogue.find((entry) => entry.code === code);
    if (!known) {
      throw new ApiError(400, `Unknown ${fieldName} "${code || 'blank'}".`, 'VALIDATION_ERROR');
    }
    const label = code === 'OTHER'
      ? requiredText(item.label, `${fieldName} label`, { min: 2, max: 60 })
      : known.label;
    const amountPaise = parseRupees(item.amount, { fieldName: label });
    const dedupeKey = code === 'OTHER' ? `OTHER:${label.toLowerCase()}` : code;
    if (seen.has(dedupeKey)) {
      throw new ApiError(400, `Duplicate ${fieldName}: ${label}.`, 'DUPLICATE_COMPONENT');
    }
    seen.add(dedupeKey);
    return { code, label, amountPaise };
  });
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

module.exports = {
  requiredText,
  optionalText,
  assertAcademicYear,
  classKey,
  sectionKey,
  assertObjectId,
  queryString,
  pageParams,
  actorSnapshot,
  validateComponents,
  escapeRegex,
};
