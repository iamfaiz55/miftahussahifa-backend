import { Router } from 'express';
import {
  createBatch,
  getBatches,
  getBatchById,
  updateBatch,
  deleteBatch,
} from '../controllers/batch.controller.js';
import { teacherProtected, staffProtected, optionalAuthenticateJWT } from '../middlewares/protected.js';

const router = Router();

// Register a new class/batch (Super Admin / Teacher)
router.post('/register', teacherProtected, createBatch);
router.post('/', teacherProtected, createBatch);

// Get all classes/batches (Accessible with optional auth, for both internal staff and public dashboard)
router.get('/', optionalAuthenticateJWT, getBatches);

// Get single class/batch details
router.get('/:id', staffProtected, getBatchById);

// Update class/batch details
router.put('/:id', teacherProtected, updateBatch);

// Delete class/batch
router.delete('/:id', staffProtected, deleteBatch);

export default router;
