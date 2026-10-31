const { PERMISSIONS, ROLES } = require('../constants');

function normalizeRole(role) {
  if (typeof role !== 'string') return '';
  return role.trim().toUpperCase().replace(/[\s-]+/g, '_');
}

function isKnownRole(role) {
  return ROLES.includes(role);
}

function roleAllowed(role, permission) {
  const allowed = PERMISSIONS[permission];
  if (!allowed) return false;
  return allowed.includes(role);
}

function permissionsForRole(role) {
  return Object.entries(PERMISSIONS)
    .filter(([, roles]) => roles.includes(role))
    .map(([permission]) => permission);
}

module.exports = {
  normalizeRole,
  isKnownRole,
  roleAllowed,
  permissionsForRole,
};
