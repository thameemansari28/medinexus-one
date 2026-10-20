/**
 * MediNexus One - Role-Based Access Control (RBAC) Middleware
 * 
 * Enforces server-side role boundaries.
 */

export function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: "Unauthorized",
        message: "You must be signed in to perform this action.",
      });
    }

    const userRole = String(req.user.role || "patient").toLowerCase();
    const hasPermission = allowedRoles.some((role) => role.toLowerCase() === userRole);

    if (!hasPermission) {
      return res.status(403).json({
        error: "Forbidden",
        message: `Access denied. Required role: [${allowedRoles.join(", ")}]. Your role: ${userRole}.`,
      });
    }

    next();
  };
}
