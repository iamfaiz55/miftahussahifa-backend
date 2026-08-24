import { Router } from 'express';
import {
    register,
    login,
    googleLogin,
    getAllUsers,
    updateUser,
    blockUser,
    unblockUser,
    getProfile,
    getUserById
} from '../controllers/auth.controller.js';
import { authenticateJWT, requireRole } from '../middlewares/protected.js';

const router = Router();

// Public routes
router.post('/register', register);
router.post('/login', login);
router.post('/google-login', googleLogin);
router.get('/get-profile', authenticateJWT, getProfile);

// Admin only routes
router.get('/users', authenticateJWT, requireRole('admin'), getAllUsers);
router.get('/users/:id', authenticateJWT, requireRole('admin'), getUserById);
router.put('/users/:id', authenticateJWT, requireRole('admin'), updateUser);
router.put('/users/block/:id', authenticateJWT, requireRole('admin'), blockUser);
router.put('/users/unblock/:id', authenticateJWT, requireRole('admin'), unblockUser);

export default router;
