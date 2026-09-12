import { Router } from 'express';
import { checkInStudent, getTodayAttendanceLogs, saveBulkAttendance, updateAttendanceStatus } from '../controllers/attendance.controller.js';
import { staffProtected } from '../middlewares/protected.js';

const router = Router();

// Check in student attendance via Barcode / QR
router.post('/check-in', staffProtected, checkInStudent);
router.post('/', staffProtected, checkInStudent);

// Update attendance status for a student (e.g. absent -> present)
router.post('/update-status', staffProtected, updateAttendanceStatus);
router.put('/update-status', staffProtected, updateAttendanceStatus);
router.put('/:id', staffProtected, updateAttendanceStatus);

// Bulk manual attendance for a batch
router.post('/bulk-manual', staffProtected, saveBulkAttendance);

// Get today's attendance logs
router.get('/today', staffProtected, getTodayAttendanceLogs);

export default router;

