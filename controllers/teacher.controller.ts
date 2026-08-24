import type { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { User, Batch } from '../models/index.js';

/**
 * Register a new Teacher
 * Required: name, email, mobileNumber, password
 */
export const registerTeacher = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, email, mobileNumber, password } = req.body;

    if (!name || !email || !password) {
      res.status(400).json({
        success: false,
        message: 'Name, email, and password are required to register a teacher.',
      });
      return;
    }

    const normalizedEmail = email.toLowerCase().trim();
    const existing = await User.findOne({ where: { email: normalizedEmail } });
    if (existing) {
      res.status(400).json({
        success: false,
        message: 'A user/teacher with this email already exists.',
      });
      return;
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const teacher = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      mobileNumber: mobileNumber ? mobileNumber.trim() : null,
      password_hash: hashedPassword,
      password: hashedPassword,
      role: 'TEACHER',
      assigned_batches: [],
      is_active: true,
      isBlocked: false,
    });

    res.status(201).json({
      success: true,
      message: 'Teacher registered successfully.',
      teacher: {
        id: teacher.id,
        name: teacher.name,
        email: teacher.email,
        mobileNumber: teacher.mobileNumber,
        role: teacher.role,
        is_active: teacher.is_active,
        createdAt: teacher.createdAt,
      },
    });
  } catch (error: any) {
    console.error('Error registering teacher:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Internal server error while registering teacher.',
    });
  }
};

/**
 * Get all teachers (for dropdowns and teacher management)
 */
export const getTeachers = async (req: Request, res: Response): Promise<void> => {
  try {
    const { search, is_active } = req.query;

    const whereClause: any = {
      role: ['TEACHER', 'SUPER_ADMIN'],
    };

    if (is_active !== undefined) {
      whereClause.is_active = is_active === 'true';
    }

    const teachers = await User.findAll({
      where: whereClause,
      attributes: ['id', 'name', 'email', 'mobileNumber', 'role', 'is_active', 'createdAt'],
      include: [
        {
          model: Batch,
          as: 'instructedBatches',
          attributes: ['id', 'batch_code', 'name', 'status', 'schedule_days', 'timing'],
        },
      ],
      order: [['name', 'ASC']],
    });

    let filtered = teachers;
    if (search) {
      const q = String(search).toLowerCase();
      filtered = teachers.filter(
        (t) =>
          t.name?.toLowerCase().includes(q) ||
          t.email?.toLowerCase().includes(q) ||
          t.mobileNumber?.toLowerCase().includes(q)
      );
    }

    res.json({
      success: true,
      total: filtered.length,
      teachers: filtered,
    });
  } catch (error: any) {
    console.error('Error fetching teachers:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Internal server error while fetching teachers.',
    });
  }
};

/**
 * Get single teacher by ID
 */
export const getTeacherById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const teacher = await User.findByPk(id as string, {
      attributes: ['id', 'name', 'email', 'mobileNumber', 'role', 'is_active', 'createdAt'],
      include: [
        {
          model: Batch,
          as: 'instructedBatches',
        },
      ],
    });

    if (!teacher) {
      res.status(404).json({ success: false, message: 'Teacher not found.' });
      return;
    }

    res.json({ success: true, teacher });
  } catch (error: any) {
    console.error('Error fetching teacher:', error);
    res.status(500).json({ success: false, message: error.message || 'Server error' });
  }
};

/**
 * Update teacher details
 */
export const updateTeacher = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const teacher = await User.findByPk(id as string);

    if (!teacher) {
      res.status(404).json({ success: false, message: 'Teacher not found.' });
      return;
    }

    const { name, email, mobileNumber, password, is_active } = req.body;

    let updatedHashedPassword = teacher.password_hash;
    if (password && password.trim()) {
      updatedHashedPassword = await bcrypt.hash(password.trim(), 10);
    }

    await teacher.update({
      name: name ? name.trim() : teacher.name,
      email: email ? email.toLowerCase().trim() : teacher.email,
      mobileNumber: mobileNumber !== undefined ? mobileNumber : teacher.mobileNumber,
      password_hash: updatedHashedPassword,
      password: updatedHashedPassword,
      is_active: is_active !== undefined ? is_active : teacher.is_active,
    });

    res.json({
      success: true,
      message: 'Teacher updated successfully.',
      teacher: {
        id: teacher.id,
        name: teacher.name,
        email: teacher.email,
        mobileNumber: teacher.mobileNumber,
        role: teacher.role,
        is_active: teacher.is_active,
      },
    });
  } catch (error: any) {
    console.error('Error updating teacher:', error);
    res.status(500).json({ success: false, message: error.message || 'Server error' });
  }
};

/**
 * Delete a teacher
 */
export const deleteTeacher = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const teacher = await User.findByPk(id as string);

    if (!teacher) {
      res.status(404).json({ success: false, message: 'Teacher not found.' });
      return;
    }

    // Unassign instructor from any batches before deletion
    await Batch.update({ instructor_id: null }, { where: { instructor_id: teacher.id } });

    await teacher.destroy();

    res.json({
      success: true,
      message: `Teacher '${teacher.name}' deleted successfully.`,
    });
  } catch (error: any) {
    console.error('Error deleting teacher:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Internal server error while deleting teacher.',
    });
  }
};
