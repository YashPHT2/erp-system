const ApiError = require('../utils/ApiError');
const { roleAllowed } = require('../utils/permissions');

function requirePermission(permission) {
  return (req, res, next) => {
    if (!req.user) return next(new ApiError(401, 'Authentication required.', 'UNAUTHENTICATED'));
    if (!roleAllowed(req.user.role, permission)) {
      return next(new ApiError(403, 'You do not have permission to perform this action.', 'FORBIDDEN'));
    }
    return next();
  };
}

module.exports = { requirePermission };
