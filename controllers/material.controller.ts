import { Request, Response } from 'express';
import { Op } from 'sequelize';
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
 * Create new course material (Admin / Faculty)
 */
export const createMaterial = async (req: any, res: Response): Promise<void> => {
  try {
    const { batch_id, title, description, file_url, file_type, file_size } = req.body;
    const uploaderId = req.user?.id;

    if (!title || !file_url) {
      res.status(400).json({
        success: false,
        message: 'Material title and file URL / resource link are required.',
      });
      return;
    }

    let targetBatchId: number | null = null;
    if (batch_id && batch_id !== 'all' && batch_id !== 'general' && !isNaN(Number(batch_id))) {
      targetBatchId = Number(batch_id);
    }

    const material = await CourseMaterial.create({
      batch_id: targetBatchId,
      title: title.trim(),
      description: description ? description.trim() : undefined,
      file_url: file_url.trim(),
      file_type: file_type || 'PDF',
      file_size: file_size ? file_size.trim() : undefined,
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
      message: 'Course material published successfully.',
      material: populatedMaterial,
    });
  } catch (error: any) {
    console.error('Error creating course material:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create course material.',
      error: error.message,
    });
  }
};

/**
 * Delete course material (Admin / Faculty)
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
