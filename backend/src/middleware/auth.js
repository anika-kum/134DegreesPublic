// Express middleware that validates JWT tokens on protected routes.
// Attaches the decoded payload (id, email, district) to req.user
// so downstream route handlers don't need to re-verify.

import jwt from 'jsonwebtoken';

export function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  // Tokens must be sent as "Bearer <token>" in the Authorization header
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing token' });
  }
  try {
    req.user = jwt.verify(header.slice(7), process.env.JWT_SECRET || 'dev-secret');
    next();
  } catch {
    // Covers both expired and malformed tokens
    res.status(401).json({ error: 'Invalid token' });
  }
}
