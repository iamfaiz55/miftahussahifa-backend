import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import {
  getAllMaterials,
  getStudentMaterials,
  createMaterial,
  deleteMaterial,
} from '../controllers/material.controller.js';
import { authenticateJWT, studentProtected } from '../middlewares/protected.js';

const uploadDir = path.join(process.cwd(), 'uploads', 'materials');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadDir);
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    const rawBase = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9_-]/g, '_');
    cb(null, `${rawBase}-${uniqueSuffix}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 100 * 1024 * 1024 }, // 100 MB max limit
});

const router = Router();

// Student-facing route to fetch enrolled batch materials
router.get('/student', authenticateJWT, studentProtected, getStudentMaterials);

// Faculty & Admin routes
router.get('/', authenticateJWT, getAllMaterials);
router.post('/', authenticateJWT, upload.single('file'), createMaterial);
router.delete('/:id', authenticateJWT, deleteMaterial);

export default router;
