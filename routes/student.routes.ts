import { Router } from 'express';
import {
  registerStudent,
  enrollStudentInBatch,
  getStudents,
  getStudentByIdentifier,
  updateStudent,
  deleteStudent,
  studentLogin,
  getStudentPortalDetails,
  findStudentsByPhone,
} from '../controllers/student.controller.js';
import { authenticateJWT, staffProtected, teacherProtected } from '../middlewares/protected.js';

const router = Router();

// Student Public Login & Username Phone Lookup (No auth required)
router.post('/login', studentLogin);
router.post('/student-login', studentLogin);
router.post('/find-by-phone', findStudentsByPhone);
router.get('/find-by-phone', findStudentsByPhone);

// Student Portal Details for Logged-In Student
router.get('/me/portal-details', authenticateJWT, getStudentPortalDetails);
router.get('/portal-details', authenticateJWT, getStudentPortalDetails);
router.get('/:student_id/portal-details', staffProtected, getStudentPortalDetails);

// Register a new student (Requires Teacher / Super Admin / Staff auth)
router.post('/register', teacherProtected, registerStudent);

// Get list of all students (filterable by batch / search)
router.get('/', staffProtected, getStudents);

// Find student by ID, Roll Number, Username, Barcode, or QR Token
router.get('/lookup/:identifier', staffProtected, getStudentByIdentifier);
router.get('/:identifier', staffProtected, getStudentByIdentifier);

// Enroll student in batch
router.post('/:student_id/enroll', teacherProtected, enrollStudentInBatch);

// Update student details
router.put('/:id', teacherProtected, updateStudent);

// Delete student
router.delete('/:id', staffProtected, deleteStudent);

export default router;
