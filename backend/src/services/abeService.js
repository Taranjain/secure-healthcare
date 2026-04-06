/**
 * Attribute-Based Encryption (ABE) Service - Simplified Implementation
 * 
 * Enforces attribute-based access policies on medical records.
 * A record's ABE policy specifies required attributes (e.g., department, role).
 * A user must match ALL required attributes to decrypt/access the record.
 * 
 * Example policy:
 *   { "role": "DOCTOR", "department": "Cardiology" }
 * 
 * User attributes (stored in user.attributes JSON):
 *   { "department": "Cardiology", "specialization": "Interventional" }
 * 
 * The user's role is also checked from user.role field.
 */

/**
 * Check if user attributes satisfy record's ABE policy
 * @param {Object} user - User object with role and attributes
 * @param {Object} policy - ABE policy from the record
 * @returns {{ allowed: boolean, reason?: string }}
 */
function checkPolicy(user, policy) {
    if (!policy || Object.keys(policy).length === 0) {
        // No policy means open access (still requires consent)
        return { allowed: true };
    }

    const userAttrs = {
        role: user.role,
        ...(typeof user.attributes === 'string' ? JSON.parse(user.attributes) : user.attributes),
    };

    for (const [key, requiredValue] of Object.entries(policy)) {
        const userValue = userAttrs[key];

        if (!userValue) {
            return {
                allowed: false,
                reason: `Missing required attribute: ${key}`,
            };
        }

        // Support array values (user has any of the required values)
        if (Array.isArray(requiredValue)) {
            if (!requiredValue.includes(userValue)) {
                return {
                    allowed: false,
                    reason: `Attribute '${key}' value '${userValue}' not in allowed values: ${requiredValue.join(', ')}`,
                };
            }
        } else if (String(userValue).toUpperCase() !== String(requiredValue).toUpperCase()) {
            return {
                allowed: false,
                reason: `Attribute '${key}' mismatch: expected '${requiredValue}', got '${userValue}'`,
            };
        }
    }

    return { allowed: true };
}

/**
 * Validate an ABE policy object
 * @param {Object} policy - Policy to validate
 * @returns {{ valid: boolean, error?: string }}
 */
function validatePolicy(policy) {
    if (!policy || typeof policy !== 'object') {
        return { valid: false, error: 'Policy must be a non-null object' };
    }

    for (const [key, value] of Object.entries(policy)) {
        if (typeof key !== 'string' || key.length === 0) {
            return { valid: false, error: 'Policy keys must be non-empty strings' };
        }
        if (typeof value !== 'string' && !Array.isArray(value)) {
            return { valid: false, error: `Policy value for '${key}' must be string or array` };
        }
    }

    return { valid: true };
}

module.exports = {
    checkPolicy,
    validatePolicy,
};
