import { Router } from 'express';
import {
  getReferrers,
  getReferrerById,
  createReferrer,
  updateReferrer,
  deleteReferrer,
  getAbsentFollowups,
  referrerLogin,
  getReferrerPortalDashboard,
} from '../controllers/referrer.controller.js';
import { staffProtected, teacherProtected, referrerProtected } from '../middlewares/protected.js';

const router = Router();

// Referrer 1-Step Login with Mobile Number only (No password required)
router.post('/login', referrerLogin);

// Referrer Portal Dashboard: View referred students' attendance/presenty
router.get('/portal/dashboard', referrerProtected, getReferrerPortalDashboard);

// Follow-up absentee report (Grouped by Referrer with 1-click WhatsApp deep-links)
router.get('/followups/absent', staffProtected, getAbsentFollowups);

// List all referrers with aggregated stats
router.get('/', staffProtected, getReferrers);

// Get single referrer and their referred students
router.get('/:id', staffProtected, getReferrerById);

// Create new referrer
router.post('/', teacherProtected, createReferrer);

// Update existing referrer
router.put('/:id', teacherProtected, updateReferrer);

// Delete referrer (unlinks students safely)
router.delete('/:id', staffProtected, deleteReferrer);

export default router;
