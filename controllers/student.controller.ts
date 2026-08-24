import type { Request, Response } from 'express';
import crypto from 'node:crypto';
import { Student, Batch, User } from '../models/index.js';

/**
 * Helper to generate next unique roll number and barcode
 */
async function generateUniqueStudentCodes(): Promise<{ roll_number: string; barcode_data: string; qr_token: string }> {
  const count = await Student.count();
  const nextNum = (count + 1).toString().padStart(4, '0');
  const year = new Date().getFullYear();

  let roll_number = `MS-${year}-${nextNum}`;
  let barcode_data = `MS${year}${nextNum}`;

  let exists = await Student.findOne({ where: { roll_number } });
  let salt = 1;
  while (exists) {
    const candidateNum = (count + 1 + salt).toString().padStart(4, '0');
    roll_number = `MS-${year}-${candidateNum}`;
    barcode_data = `MS${year}${candidateNum}`;
    exists = await Student.findOne({ where: { roll_number } });
    salt++;
  }

  const qr_token = `QR_${crypto.randomUUID().replace(/-/g, '')}`;

  return { roll_number, barcode_data, qr_token };
}

/**
 * Register a new Student and assign to Class/Batch
 * Required: full_name (or name), phone_number (or mobileNumber)
 * Optional: batch_id (or class_id), whatsapp_number, parent_contact, barcode_data, roll_number
 */
export const registerStudent = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      name,
      full_name,
      mobileNumber,
      phone_number,
      whatsapp_number,
      parent_contact,
      batch_id,
      class_id,
      enrolled_batches,
      barcode_data: customBarcode,
      roll_number: customRoll,
    } = req.body;

    // Validate required fields
    const resolvedName = (full_name || name || '').trim();
    const resolvedPhone = (phone_number || mobileNumber || '').trim();

    if (!resolvedName) {
      res.status(400).json({ success: false, message: 'Student full name is required.' });
      return;
    }

    if (!resolvedPhone) {
      res.status(400).json({ success: false, message: 'Student mobile/phone number is required.' });
      return;
    }

    // Format enrolled batches from batch_ids array or single batch_id
    const singleBatchId = batch_id || class_id;
    let targetBatchIds: number[] = [];
    if (Array.isArray(req.body.batch_ids)) {
      targetBatchIds = req.body.batch_ids.map((id: any) => Number(id)).filter((id: number) => !isNaN(id) && id > 0);
    } else if (Array.isArray(enrolled_batches)) {
      targetBatchIds = enrolled_batches.map((b: any) => (typeof b === 'object' ? Number(b.batch_id) : Number(b))).filter((id: number) => !isNaN(id) && id > 0);
    } else if (singleBatchId) {
      targetBatchIds = [Number(singleBatchId)];
    }

    // Deduplicate batch IDs
    targetBatchIds = Array.from(new Set(targetBatchIds));

    // Verify all batches exist
    let verifiedBatches: any[] = [];
    if (targetBatchIds.length > 0) {
      verifiedBatches = await Batch.findAll({
        where: { id: targetBatchIds },
        attributes: ['id', 'batch_code', 'name', 'status'],
      });
    }

    const todayDateStr = new Date().toISOString().split('T')[0];
    const finalEnrolledBatches = verifiedBatches.map((b) => ({
      batch_id: b.id,
      enrollment_date: todayDateStr,
      status: 'ACTIVE',
    }));

    // Generate automatic unique codes if not custom
    const autoCodes = await generateUniqueStudentCodes();
    const finalRoll = (customRoll || autoCodes.roll_number).trim().toUpperCase();
    const finalBarcode = (customBarcode || autoCodes.barcode_data).trim().toUpperCase();
    const finalQrToken = autoCodes.qr_token;

    // Check if roll number or barcode is already taken
    const existingRoll = await Student.findOne({ where: { roll_number: finalRoll } });
    if (existingRoll) {
      res.status(400).json({ success: false, message: `Roll number ${finalRoll} is already registered.` });
      return;
    }

    const existingBarcode = await Student.findOne({ where: { barcode_data: finalBarcode } });
    if (existingBarcode) {
      res.status(400).json({ success: false, message: `Barcode ${finalBarcode} is already in use.` });
      return;
    }

    const finalWhatsapp = (whatsapp_number || resolvedPhone).trim();

    const finalParentContact = {
      name: parent_contact?.name || '',
      phone: parent_contact?.phone || '',
      relation: parent_contact?.relation || '',
    };

    const newStudent = await Student.create({
      full_name: resolvedName,
      phone_number: resolvedPhone,
      whatsapp_number: finalWhatsapp,
      parent_contact: finalParentContact,
      roll_number: finalRoll,
      barcode_data: finalBarcode,
      qr_token: finalQrToken,
      enrolled_batches: finalEnrolledBatches,
      regularity_score: 100.0,
      current_streak: 0,
      is_active: true,
    });

    res.status(201).json({
      success: true,
      message: `Student registered successfully and enrolled in ${finalEnrolledBatches.length} batch(es).`,
      student: newStudent,
      enrolled_classes: verifiedBatches,
    });
  } catch (error: any) {
    console.error('Error registering student:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Internal server error while registering student.',
    });
  }
};

/**
 * Enroll existing student into an additional class/batch
 */
export const enrollStudentInBatch = async (req: Request, res: Response): Promise<void> => {
  try {
    const { student_id } = req.params;
    const { batch_id, class_id } = req.body;

    const targetBatchId = batch_id || class_id;

    if (!targetBatchId) {
      res.status(400).json({ success: false, message: 'Batch/Class ID is required for enrollment.' });
      return;
    }

    const student = await Student.findByPk(student_id as string);
    if (!student) {
      res.status(404).json({ success: false, message: 'Student not found.' });
      return;
    }

    const batch = await Batch.findByPk(targetBatchId);
    if (!batch) {
      res.status(404).json({ success: false, message: 'Target Class/Batch not found.' });
      return;
    }

    const enrolled = Array.isArray(student.enrolled_batches) ? [...student.enrolled_batches] : [];

    const existingIndex = enrolled.findIndex((eb: any) => eb.batch_id === Number(targetBatchId));

    if (existingIndex >= 0) {
      enrolled[existingIndex] = {
        ...enrolled[existingIndex],
        status: 'ACTIVE',
        enrollment_date: new Date().toISOString().split('T')[0],
      };
    } else {
      enrolled.push({
        batch_id: Number(targetBatchId),
        enrollment_date: new Date().toISOString().split('T')[0],
        status: 'ACTIVE',
      });
    }

    await student.update({ enrolled_batches: enrolled });

    res.json({
      success: true,
      message: `Student successfully enrolled in ${batch.name} (${batch.batch_code}).`,
      student,
    });
  } catch (error: any) {
    console.error('Error enrolling student in batch:', error);
    res.status(500).json({ success: false, message: error.message || 'Server error' });
  }
};

/**
 * Get all students (with optional search and batch filter)
 */
export const getStudents = async (req: Request, res: Response): Promise<void> => {
  try {
    const { search, batch_id, class_id, is_active } = req.query;

    const whereClause: any = {};

    if (is_active !== undefined) {
      whereClause.is_active = is_active === 'true';
    }

    const students = await Student.findAll({
      where: whereClause,
      order: [['id', 'DESC']],
    });

    let filtered = students;
    if (search) {
      const q = String(search).toLowerCase();
      filtered = students.filter(
        (s) =>
          s.full_name?.toLowerCase().includes(q) ||
          s.roll_number?.toLowerCase().includes(q) ||
          s.phone_number?.toLowerCase().includes(q) ||
          s.barcode_data?.toLowerCase().includes(q)
      );
    }

    const filterBatchId = batch_id || class_id;
    if (filterBatchId) {
      const bId = Number(filterBatchId);
      filtered = filtered.filter((s) => {
        let batchesArr: any[] = [];
        try {
          if (Array.isArray(s.enrolled_batches)) {
            batchesArr = s.enrolled_batches;
          } else if (typeof s.enrolled_batches === 'string') {
            batchesArr = JSON.parse(s.enrolled_batches || '[]');
          }
        } catch {
          batchesArr = [];
        }
        return Array.isArray(batchesArr) && batchesArr.some((b: any) => b.batch_id === bId && b.status === 'ACTIVE');
      });
    }

    res.json({
      success: true,
      total: filtered.length,
      students: filtered,
    });
  } catch (error: any) {
    console.error('Error fetching students:', error);
    res.status(500).json({ success: false, message: error.message || 'Server error' });
  }
};

/**
 * Get student by ID, Roll Number, Barcode, or QR Token
 */
export const getStudentByIdentifier = async (req: Request, res: Response): Promise<void> => {
  try {
    const { identifier } = req.params;

    if (!identifier) {
      res.status(400).json({ success: false, message: 'Identifier is required.' });
      return;
    }

    let student = null;

    if (!isNaN(Number(identifier))) {
      student = await Student.findByPk(Number(identifier));
    }

    if (!student) {
      student = await Student.findOne({ where: { barcode_data: identifier } });
    }

    if (!student) {
      student = await Student.findOne({ where: { roll_number: identifier } });
    }

    if (!student) {
      student = await Student.findOne({ where: { qr_token: identifier } });
    }

    if (!student) {
      res.status(404).json({ success: false, message: 'Student not found with provided identifier.' });
      return;
    }

    // Resolve details of enrolled batches including teacher/instructor details
    let batchesArr: any[] = [];
    try {
      if (Array.isArray(student.enrolled_batches)) {
        batchesArr = student.enrolled_batches;
      } else if (typeof student.enrolled_batches === 'string') {
        batchesArr = JSON.parse(student.enrolled_batches || '[]');
      }
    } catch {
      batchesArr = [];
    }

    const batchIds = batchesArr.map((b: any) => b.batch_id);
    const batches = await Batch.findAll({
      where: { id: batchIds },
      attributes: ['id', 'batch_code', 'name', 'status', 'schedule_days', 'timing', 'instructor_id'],
      include: [
        {
          model: User,
          as: 'instructor',
          attributes: ['id', 'name', 'email', 'mobileNumber', 'role'],
        },
      ],
    });

    res.json({
      success: true,
      student,
      enrolled_batches_details: batches,
    });
  } catch (error: any) {
    console.error('Error fetching student:', error);
    res.status(500).json({ success: false, message: error.message || 'Server error' });
  }
};

/**
 * Update Student details
 */
export const updateStudent = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const student = await Student.findByPk(id as string);

    if (!student) {
      res.status(404).json({ success: false, message: 'Student not found.' });
      return;
    }

    const {
      name,
      full_name,
      phone_number,
      mobileNumber,
      whatsapp_number,
      parent_contact,
      enrolled_batches,
      batch_ids,
      class_id,
      batch_id,
      is_active,
    } = req.body;

    let updatedEnrolledBatches = student.enrolled_batches;

    if (Array.isArray(batch_ids)) {
      const targetBatchIds: number[] = Array.from(
        new Set(batch_ids.map((bId: any) => Number(bId)).filter((bId: number) => !isNaN(bId) && bId > 0))
      );

      const verifiedBatches = await Batch.findAll({
        where: { id: targetBatchIds },
        attributes: ['id', 'batch_code', 'name', 'status'],
      });

      const todayDateStr = new Date().toISOString().split('T')[0];
      const existingEnrolled = Array.isArray(student.enrolled_batches) ? student.enrolled_batches : [];

      updatedEnrolledBatches = verifiedBatches.map((b) => {
        const existing = existingEnrolled.find((eb: any) => eb.batch_id === b.id);
        return {
          batch_id: b.id,
          enrollment_date: existing?.enrollment_date || todayDateStr,
          status: 'ACTIVE',
        };
      });
    } else if (enrolled_batches !== undefined) {
      updatedEnrolledBatches = enrolled_batches;
    } else if (batch_id || class_id) {
      const singleId = Number(batch_id || class_id);
      const todayDateStr = new Date().toISOString().split('T')[0];
      updatedEnrolledBatches = [
        {
          batch_id: singleId,
          enrollment_date: todayDateStr,
          status: 'ACTIVE',
        },
      ];
    }

    await student.update({
      full_name: full_name || name || student.full_name,
      phone_number: phone_number || mobileNumber || student.phone_number,
      whatsapp_number: whatsapp_number || student.whatsapp_number,
      parent_contact: parent_contact !== undefined ? parent_contact : student.parent_contact,
      enrolled_batches: updatedEnrolledBatches,
      is_active: is_active !== undefined ? is_active : student.is_active,
    });

    res.json({
      success: true,
      message: 'Student updated successfully.',
      student,
    });
  } catch (error: any) {
    console.error('Error updating student:', error);
    res.status(500).json({ success: false, message: error.message || 'Server error' });
  }
};

/**
 * Delete Student
 */
export const deleteStudent = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const student = await Student.findByPk(id as string);

    if (!student) {
      res.status(404).json({ success: false, message: 'Student not found.' });
      return;
    }

    // Delete student record
    await student.destroy();

    res.json({
      success: true,
      message: `Student '${student.full_name}' (${student.roll_number}) deleted successfully.`,
    });
  } catch (error: any) {
    console.error('Error deleting student:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Internal server error while deleting student.',
    });
  }
};
