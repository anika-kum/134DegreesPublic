// Resources route: returns live SF resources (shelters, rent relief, Section 8).
// Optionally filtered by type and/or district. Resources with null district
// (e.g. citywide rent relief funds) are always included when filtering by district.

import { Router } from 'express';
import db from '../db/index.js';

const router = Router();

// GET /resources?type=emergency_shelter&district=9
// No auth required — resources are public information.
router.get('/', (req, res) => {
  const { type, district } = req.query;
  let sql = "SELECT * FROM resources WHERE status = 'active'";
  const params = [];
  if (type) { sql += ' AND type = ?'; params.push(type); }
  // Include citywide resources (district IS NULL) alongside district-specific ones
  if (district) { sql += ' AND (district = ? OR district IS NULL)'; params.push(Number(district)); }
  sql += ' ORDER BY type, name';
  res.json(db.prepare(sql).all(...params));
});

export default router;
