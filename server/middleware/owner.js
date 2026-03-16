import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'cobranca-pro-jwt-secret-2024';

// Middleware to extract owner_id from JWT token or X-Owner-Id header
export function extractOwnerId(req, res, next) {
  // 1) Try JWT from Authorization header
  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    try {
      const token = authHeader.slice(7);
      const decoded = jwt.verify(token, JWT_SECRET);
      if (decoded && decoded.id) {
        req.ownerId = String(decoded.id);
        req.userRole = decoded.role || 'user';
        return next();
      }
    } catch (err) {
      // Token invalid/expired — fall through to header
    }
  }

  // 2) Fallback to X-Owner-Id header
  req.ownerId = req.headers['x-owner-id'] || null;
  req.userRole = null;
  next();
}

// Helper: adds WHERE owner_id = ? clause
export function ownerFilter(req) {
  const ownerId = req.ownerId;
  if (!ownerId) return { where: '', params: [] };
  return { where: ' AND owner_id = ?', params: [ownerId] };
}
