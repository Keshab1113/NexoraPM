// Role-Based Access Control Middleware
// Roles hierarchy: super_admin > company_admin > manager > project_admin > employee

const ROLE_HIERARCHY = {
  super_admin: 5,
  company_admin: 4,
  manager: 3,
  project_admin: 2,
  employee: 1,
};

// Check if user has one of the allowed roles
export const rbac = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const userRole = req.user.role;

    if (!allowedRoles.includes(userRole)) {
      return res.status(403).json({
        error: 'Access denied',
        message: `This action requires one of the following roles: ${allowedRoles.join(', ')}`,
      });
    }

    next();
  };
};

// Check if user has minimum role level (e.g., manager or above)
export const minRole = (minRole) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const userLevel = ROLE_HIERARCHY[req.user.role] || 0;
    const requiredLevel = ROLE_HIERARCHY[minRole] || 0;

    if (userLevel < requiredLevel) {
      return res.status(403).json({
        error: 'Access denied',
        message: `This action requires ${minRole} role or higher`,
      });
    }

    next();
  };
};

// Check if user belongs to the same company (for company-scoped resources)
export const sameCompany = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  // Super admin can access all companies
  if (req.user.role === 'super_admin') {
    return next();
  }

  // For company_admin, manager, project_admin, employee - check company_id matches
  const resourceCompanyId = req.params.companyId || req.body.companyId || req.query.companyId;

  if (resourceCompanyId && req.user.companyId !== parseInt(resourceCompanyId)) {
    return res.status(403).json({
      error: 'Access denied',
      message: 'You can only access resources within your company',
    });
  }

  next();
};

// Check if user owns the resource or has appropriate role
export const ownerOrRole = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Check if user is the owner of the resource
    const isOwner = req.params.userId === String(req.user.id) ||
                   req.body.userId === req.user.id ||
                   req.params.id === String(req.user.id);

    if (isOwner) {
      return next();
    }

    // Check if user has one of the allowed roles
    if (allowedRoles.includes(req.user.role)) {
      return next();
    }

    return res.status(403).json({
      error: 'Access denied',
      message: 'You do not have permission to perform this action',
    });
  };
};

export default { rbac, minRole, sameCompany, ownerOrRole };