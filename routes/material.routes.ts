import { Router } from 'express';
import {
  getAllMaterials,
  getStudentMaterials,
  createMaterial,
  deleteMaterial,
} from '../controllers/material.controller.js';
import { authenticateJWT, studentProtected } from '../middlewares/protected.js';

const router = Router();

// Student-facing route to fetch enrolled batch materials
router.get('/student', authenticateJWT, studentProtected, getStudentMaterials);

// Faculty & Admin routes
router.get('/', authenticateJWT, getAllMaterials);
router.post('/', authenticateJWT, createMaterial);
router.delete('/:id', authenticateJWT, deleteMaterial);

export default router;
