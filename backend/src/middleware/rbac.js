/**
 * Role-Based Access Control (RBAC) Middleware
 * Restricts routes to specific roles.
 */

/**
 * Create middleware that checks if user has one of the allowed roles
 * @param  {...string} allowedRoles - Roles that can access this route
 * @returns {Function} Express middleware
 */
function authorize(...allowedRoles) {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        if (!allowedRoles.includes(req.user.role)) {
            return res.status(403).json({
                error: 'Insufficient permissions',
                required: allowedRoles,
                current: req.user.role,
            });
        }

        next();
    };
}

module.exports = { authorize };
