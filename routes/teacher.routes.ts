import { Router } from 'express';
import {
  registerTeacher,
  getTeachers,
  getTeacherById,
  updateTeacher,
  deleteTeacher,
} from '../controllers/teacher.controller.js';
import { adminProtected, staffProtected } from '../middlewares/protected.js';

const router = Router();

// Register a new teacher
router.post('/register', staffProtected, registerTeacher);
router.post('/', staffProtected, registerTeacher);

// Get list of all teachers (for batch creation dropdown / staff)
router.get('/', staffProtected, getTeachers);

// Get single teacher details
router.get('/:id', staffProtected, getTeacherById);

// Update teacher details
router.put('/:id', staffProtected, updateTeacher);

// Delete teacher
router.delete('/:id', staffProtected, deleteTeacher);

export default router;
