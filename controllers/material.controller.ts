import { Request, Response } from 'express';
import { Op } from 'sequelize';
import path from 'path';
import fs from 'fs';
import { CourseMaterial, Batch, User, Student } from '../models/index.js';

/**
 * Get all course materials (Admin / Faculty view)
 */
export const getAllMaterials = async (req: Request, res: Response): Promise<void> => {
  try {
    const { batch_id, file_type, search } = req.query;

    const whereClause: any = {};

    if (batch_id) {
      if (batch_id === 'general' || batch_id === 'null') {
        whereClause.batch_id = null;
      } else {
        whereClause.batch_id = Number(batch_id);
      }
    }

    if (file_type) {
      whereClause.file_type = file_type;
    }

    if (search) {
      whereClause[Op.or] = [
        { title: { [Op.like]: `%${search}%` } },
        { description: { [Op.like]: `%${search}%` } },
      ];
    }

    const materials = await CourseMaterial.findAll({
      where: whereClause,
      include: [
        {
          model: Batch,
          as: 'batch',
          attributes: ['id', 'batch_code', 'name'],
        },
        {
          model: User,
          as: 'uploader',
          attributes: ['id', 'name', 'email', 'role'],
        },
      ],
      order: [['created_at', 'DESC']],
    });

    res.json({
      success: true,
      count: materials.length,
      materials,
    });
  } catch (error: any) {
    console.error('Error fetching materials:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch course materials.',
      error: error.message,
    });
  }
};

/**
 * Get materials for authenticated student based on enrolled batches
 */
export const getStudentMaterials = async (req: any, res: Response): Promise<void> => {
  try {
    const studentId = req.student?.id || req.user?.student_id || req.user?.id;

    const student = await Student.findByPk(studentId);
    if (!student) {
      res.status(404).json({
        success: false,
        message: 'Student profile not found.',
      });
      return;
    }

    let enrolledBatchIds: number[] = [];
    try {
      if (Array.isArray(student.enrolled_batches)) {
        enrolledBatchIds = student.enrolled_batches
          .map((b: any) => Number(b.batch_id))
          .filter((id: number) => !isNaN(id));
      }
    } catch {
      enrolledBatchIds = [];
    }

    // Fetch materials for enrolled batches OR general institute resources (batch_id is null)
    const materials = await CourseMaterial.findAll({
      where: {
        [Op.or]: [
          { batch_id: null },
          { batch_id: { [Op.in]: enrolledBatchIds.length > 0 ? enrolledBatchIds : [-1] } },
        ],
      },
      include: [
        {
          model: Batch,
          as: 'batch',
          attributes: ['id', 'batch_code', 'name'],
        },
        {
          model: User,
          as: 'uploader',
          attributes: ['id', 'name', 'role'],
        },
      ],
      order: [['created_at', 'DESC']],
    });

    res.json({
      success: true,
      count: materials.length,
      materials,
    });
  } catch (error: any) {
    console.error('Error fetching student materials:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch course materials for student.',
      error: error.message,
    });
  }
};

/**
 * Create new course material (Admin / Faculty) - Supports Direct Device Uploads
 */
export const createMaterial = async (req: any, res: Response): Promise<void> => {
  try {
    const { batch_id, title, description, file_type } = req.body;
    const uploaderId = req.user?.id;
    const uploadedFile = req.file;

    let finalFileUrl = req.body.file_url || '';
    let finalFileType = file_type || 'PDF';
    let finalFileSize = req.body.file_size || '';
    let finalTitle = (title || '').trim();

    if (uploadedFile) {
      // Relative path for database storage and static serving
      finalFileUrl = `/uploads/materials/${uploadedFile.filename}`;

      // Automatically format file size
      const bytes = uploadedFile.size;
      if (bytes >= 1024 * 1024) {
        finalFileSize = (bytes / (1024 * 1024)).toFixed(1) + ' MB';
      } else {
        finalFileSize = (bytes / 1024).toFixed(0) + ' KB';
      }

      // Auto-detect file type based on extension
      const ext = path.extname(uploadedFile.originalname).toLowerCase();
      if (ext === '.pdf') finalFileType = 'PDF';
      else if (ext === '.doc' || ext === '.docx') finalFileType = 'DOCX';
      else if (['.png', '.jpg', '.jpeg', '.webp'].includes(ext)) finalFileType = 'WORKSHEET';
      else if (['.mp4', '.mkv', '.webm', '.mov'].includes(ext)) finalFileType = 'VIDEO';
      else if (['.mp3', '.wav', '.m4a', '.aac'].includes(ext)) finalFileType = 'AUDIO';

      if (!finalTitle) {
        finalTitle = path.basename(uploadedFile.originalname, ext);
      }
    }

    if (!finalTitle || !finalFileUrl) {
      res.status(400).json({
        success: false,
        message: 'Please select a document/file to upload from your device.',
      });
      return;
    }

    let targetBatchId: number | null = null;
    if (batch_id && batch_id !== 'all' && batch_id !== 'general' && !isNaN(Number(batch_id))) {
      targetBatchId = Number(batch_id);
    }

    const material = await CourseMaterial.create({
      batch_id: targetBatchId,
      title: finalTitle,
      description: description ? description.trim() : undefined,
      file_url: finalFileUrl,
      file_type: finalFileType,
      file_size: finalFileSize || undefined,
      uploaded_by: uploaderId,
    });

    const populatedMaterial = await CourseMaterial.findByPk(material.id, {
      include: [
        {
          model: Batch,
          as: 'batch',
          attributes: ['id', 'batch_code', 'name'],
        },
        {
          model: User,
          as: 'uploader',
          attributes: ['id', 'name', 'email', 'role'],
        },
      ],
    });

    res.status(201).json({
      success: true,
      message: 'Course material uploaded and published successfully.',
      material: populatedMaterial,
    });
  } catch (error: any) {
    console.error('Error creating course material:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to upload and create course material.',
      error: error.message,
    });
  }
};

/**
 * Delete course material (Admin / Faculty) - Also deletes file from uploads/
 */
export const deleteMaterial = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const material = await CourseMaterial.findByPk(Number(id));
    if (!material) {
      res.status(404).json({
        success: false,
        message: 'Course material not found.',
      });
      return;
    }

    // If file is stored locally in /uploads/, delete from disk
    if (material.file_url && material.file_url.startsWith('/uploads/')) {
      const filePath = path.join(process.cwd(), material.file_url);
      if (fs.existsSync(filePath)) {
        try {
          fs.unlinkSync(filePath);
        } catch (fileErr) {
          console.error('Error deleting local file from disk:', fileErr);
        }
      }
    }

    await material.destroy();

    res.json({
      success: true,
      message: 'Course material deleted successfully.',
    });
  } catch (error: any) {
    console.error('Error deleting course material:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete course material.',
      error: error.message,
    });
  }
};
