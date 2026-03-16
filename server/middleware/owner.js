// Middleware to extract owner_id from X-Owner-Id header
export function extractOwnerId(req, res, next) {
  req.ownerId = req.headers['x-owner-id'] || null;
  next();
}

// Helper: adds WHERE owner_id = ? clause
export function ownerFilter(req) {
  const ownerId = req.ownerId;
  if (!ownerId) return { where: '', params: [] };
  return { where: ' AND owner_id = ?', params: [ownerId] };
}
