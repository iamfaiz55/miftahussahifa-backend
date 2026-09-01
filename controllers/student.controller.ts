import type { Request, Response } from 'express';
import crypto from 'node:crypto';
import { Op } from 'sequelize';
import sequelize from '../utils/db.js';
import { Student, Batch, User, ClassSession, AttendanceLog } from '../models/index.js';
import { signToken } from '../middlewares/jwt.js';

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
 * Helper to generate unique student username using:
 * First 4 letters of Student Full Name + Last 4 digits of Mobile Number
 * e.g. "Zaid Pathan" & "9359314406" -> "zaid4406"
 */
export async function generateUniqueStudentUsername(
  fullName: string,
  phoneNumber?: string,
  excludeStudentId?: number
): Promise<string> {
  const cleanName = (fullName || '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .trim();

  // First 4 letters of name (or fallback if shorter)
  const namePart = cleanName.slice(0, 4) || 'stud';

  // Last 4 digits of phone number
  const cleanPhone = (phoneNumber || '').replace(/\D/g, '');
  const phonePart = cleanPhone.slice(-4) || '0000';

  let baseUsername = `${namePart}${phonePart}`.toLowerCase();

  let candidate = baseUsername;
  let counter = 1;

  while (true) {
    const whereClause: any = { username: candidate };
    if (excludeStudentId) {
      whereClause.id = { [Op.ne]: excludeStudentId };
    }
    const existing = await Student.findOne({ where: whereClause });
    if (!existing) {
      return candidate;
    }

    candidate = `${baseUsername}${counter}`;
    counter++;
  }
}

/**
 * Backfill usernames for all existing students in the database who do not have one
 */
export async function backfillAllStudentUsernames(): Promise<void> {
  try {
    // 1. Ensure 'username' column exists in students table
    try {
      await sequelize.query('ALTER TABLE `students` ADD COLUMN `username` VARCHAR(100) NULL AFTER `roll_number`');
      console.log('[Migration] Added username column to students table');
    } catch {
      // Column already exists
    }

    // 2. Add unique index if missing
    try {
      await sequelize.query('ALTER TABLE `students` ADD UNIQUE KEY `students_username_unique` (`username`)');
    } catch {
      // Index already exists
    }

    // 3. Backfill missing usernames
    const studentsWithoutUser = await Student.findAll({
      where: {
        [Op.or]: [{ username: null }, { username: '' }],
      },
    });

    if (studentsWithoutUser.length > 0) {
      console.log(`[Migration] Backfilling unique usernames for ${studentsWithoutUser.length} student(s)...`);
      for (const st of studentsWithoutUser) {
        const generatedUser = await generateUniqueStudentUsername(st.full_name, st.phone_number, st.id);
        await st.update({ username: generatedUser });
      }
      console.log('[Migration] Student usernames backfill complete.');
    }
  } catch (err) {
    console.error('[Migration] Error backfilling student usernames:', err);
  }
}

/**
 * Register a new Student and assign to Class/Batch
 * Required: full_name (or name), phone_number (or mobileNumber)
 * Optional: batch_id (or class_id), whatsapp_number, parent_contact, barcode_data, roll_number, username
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
      username: customUsername,
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

    // Generate unique username (First 4 letters of name + Last 4 digits of phone)
    let finalUsername = (customUsername || '').toLowerCase().trim();
    if (!finalUsername) {
      finalUsername = await generateUniqueStudentUsername(resolvedName, resolvedPhone);
    } else {
      const existingUser = await Student.findOne({ where: { username: finalUsername } });
      if (existingUser) {
        res.status(400).json({ success: false, message: `Username @${finalUsername} is already taken.` });
        return;
      }
    }

    const finalWhatsapp = (whatsapp_number || resolvedPhone).trim();

    const finalParentContact = {
      name: parent_contact?.name || '',
      phone: parent_contact?.phone || '',
      relation: parent_contact?.relation || '',
    };

    const newStudent = await Student.create({
      full_name: resolvedName,
      username: finalUsername,
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
          s.username?.toLowerCase().includes(q) ||
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
      count: filtered.length,
      students: filtered,
    });
  } catch (error: any) {
    console.error('Error fetching students:', error);
    res.status(500).json({ success: false, message: error.message || 'Server error' });
  }
};

/**
 * Get single student by ID, Roll Number, Barcode, or QR Token
 */
export const getStudentByIdentifier = async (req: Request, res: Response): Promise<void> => {
  try {
    const identifierRaw = req.params.identifier;
    const identifier = Array.isArray(identifierRaw) ? identifierRaw[0] : identifierRaw;

    if (!identifier) {
      res.status(400).json({ success: false, message: 'Student identifier is required.' });
      return;
    }

    const cleanIdentifier = String(identifier).trim();

    const student = await Student.findOne({
      where: {
        [Op.or]: [
          { id: isNaN(Number(cleanIdentifier)) ? -1 : Number(cleanIdentifier) },
          { roll_number: cleanIdentifier.toUpperCase() },
          { username: cleanIdentifier.toLowerCase() },
          { barcode_data: cleanIdentifier.toUpperCase() },
          { qr_token: cleanIdentifier },
        ],
      },
    });

    if (!student) {
      res.status(404).json({ success: false, message: `Student '${identifier}' not found.` });
      return;
    }

    // Resolve enrolled batch names
    const batchIds: number[] = Array.isArray(student.enrolled_batches)
      ? student.enrolled_batches.map((eb: any) => eb.batch_id)
      : [];

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
      username,
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

    // Handle username update if provided
    let finalUsername = student.username;
    if (username !== undefined) {
      const cleanUser = (username || '').toLowerCase().trim();
      if (cleanUser && cleanUser !== student.username) {
        const existing = await Student.findOne({
          where: {
            username: cleanUser,
            id: { [Op.ne]: student.id },
          },
        });
        if (existing) {
          res.status(400).json({ success: false, message: `Username @${cleanUser} is already taken by another student.` });
          return;
        }
        finalUsername = cleanUser;
      }
    }

    if (!finalUsername) {
      finalUsername = await generateUniqueStudentUsername(full_name || student.full_name, phone_number || student.phone_number, student.id);
    }

    await student.update({
      full_name: full_name || name || student.full_name,
      username: finalUsername,
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

/**
 * Levenshtein distance helper
 */
function computeLevenshtein(a: string, b: string): number {
  const matrix = Array.from({ length: b.length + 1 }, () =>
    Array.from({ length: a.length + 1 }, () => 0)
  );

  for (let i = 0; i <= a.length; i++) matrix[0][i] = i;
  for (let j = 0; j <= b.length; j++) matrix[j][0] = j;

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  return matrix[b.length][a.length];
}

/**
 * Fuzzy check if input name matches student name
 */
function isStudentNameMatch(input: string, studentName: string): boolean {
  if (!input || !studentName) return false;
  const cleanInput = input.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
  const cleanStudent = studentName.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();

  if (cleanInput === cleanStudent) return true;
  if (cleanStudent.includes(cleanInput) || cleanInput.includes(cleanStudent)) return true;

  const inputWords = cleanInput.split(/\s+/).filter(Boolean);
  const studentWords = cleanStudent.split(/\s+/).filter(Boolean);

  const hasMatchingWord = inputWords.some((w1) =>
    studentWords.some((w2) => {
      if (w1 === w2 && w1.length >= 3) return true;
      if (w1.length >= 3 && w2.length >= 3 && (w1.includes(w2) || w2.includes(w1))) return true;
      if (w1.length >= 3 && w2.length >= 3 && computeLevenshtein(w1, w2) <= 1) return true;
      return false;
    })
  );

  if (hasMatchingWord) return true;

  return computeLevenshtein(cleanInput, cleanStudent) <= 2;
}

/**
 * Find Students / Usernames registered with a Mobile Number (Public Lookup)
 */
export const findStudentsByPhone = async (req: Request, res: Response): Promise<void> => {
  try {
    const phoneInput = (
      req.body?.phone ||
      req.body?.phone_number ||
      req.body?.mobileNumber ||
      req.query?.phone ||
      req.query?.phone_number ||
      ''
    ).toString().trim();

    const cleanDigits = phoneInput.replace(/\D/g, '');
    const last10Digits = cleanDigits.slice(-10);

    if (!last10Digits || last10Digits.length < 6) {
      res.status(400).json({
        success: false,
        message: 'Please enter a valid mobile number (at least 6-10 digits).',
      });
      return;
    }

    // Load active batches map
    const allBatches = await Batch.findAll({
      attributes: ['id', 'batch_code', 'name'],
    });
    const batchMap = new Map<number, string>();
    allBatches.forEach((b) => batchMap.set(b.id, `${b.name} (${b.batch_code})`));

    // Fetch active students
    const students = await Student.findAll({
      where: { is_active: true },
      attributes: ['id', 'roll_number', 'username', 'full_name', 'phone_number', 'whatsapp_number', 'parent_contact', 'enrolled_batches'],
    });

    const matchedStudents = students.filter((s) => {
      const sPhone = (s.phone_number || '').replace(/\D/g, '');
      const sWhatsapp = (s.whatsapp_number || '').replace(/\D/g, '');
      const sParentPhone = (s.parent_contact?.phone || '').replace(/\D/g, '');

      return (
        (last10Digits && sPhone.endsWith(last10Digits)) ||
        (last10Digits && sWhatsapp.endsWith(last10Digits)) ||
        (last10Digits && sParentPhone.endsWith(last10Digits)) ||
        sPhone.includes(cleanDigits) ||
        sWhatsapp.includes(cleanDigits)
      );
    });

    // Make sure all matched students have username populated
    const formatted = await Promise.all(
      matchedStudents.map(async (s) => {
        let username = s.username;
        if (!username) {
          username = await generateUniqueStudentUsername(s.full_name, s.phone_number, s.id);
          await s.update({ username });
        }

        let batchNames: string[] = [];
        if (Array.isArray(s.enrolled_batches)) {
          batchNames = s.enrolled_batches
            .map((b: any) => batchMap.get(typeof b === 'object' ? Number(b.batch_id) : Number(b)))
            .filter(Boolean) as string[];
        }

        return {
          id: s.id,
          roll_number: s.roll_number,
          username: username,
          full_name: s.full_name,
          phone_number: s.phone_number,
          batches: batchNames,
        };
      })
    );

    res.json({
      success: true,
      count: formatted.length,
      students: formatted,
    });
  } catch (error: any) {
    console.error('Error finding students by phone:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to find registered student accounts for this mobile number.',
      error: error.message,
    });
  }
};

/**
 * Student Login via Username (or Full Name / Roll Number) and Mobile Number (as Password)
 */
export const studentLogin = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      username,
      full_name,
      name,
      phone_number,
      mobileNumber,
      password,
      phone,
      roll_number,
    } = req.body;

    const inputUserIdentifier = (username || full_name || name || roll_number || '').trim().toLowerCase();
    const inputPasswordOrPhone = (password || phone_number || mobileNumber || phone || '').trim();
    const cleanPhoneDigits = inputPasswordOrPhone.replace(/\D/g, '');
    const last10Digits = cleanPhoneDigits.slice(-10);

    if (!inputUserIdentifier) {
      res.status(400).json({
        success: false,
        message: 'Username, Student Name, or Roll Number is required for login.',
      });
      return;
    }

    if (!cleanPhoneDigits) {
      res.status(400).json({
        success: false,
        message: 'Mobile Number / Password is required for login.',
      });
      return;
    }

    // Helper to check phone match
    const isPhoneMatch = (s: any) => {
      const sPhoneDigits = (s.phone_number || '').replace(/\D/g, '');
      const sWhatsappDigits = (s.whatsapp_number || '').replace(/\D/g, '');
      const sParentPhoneDigits = (s.parent_contact?.phone || '').replace(/\D/g, '');

      return (
        (last10Digits && sPhoneDigits.endsWith(last10Digits)) ||
        (last10Digits && sWhatsappDigits.endsWith(last10Digits)) ||
        (last10Digits && sParentPhoneDigits.endsWith(last10Digits)) ||
        (cleanPhoneDigits && sPhoneDigits.includes(cleanPhoneDigits))
      );
    };

    // 1. Direct Search by Username or Roll Number
    let matchedStudent = await Student.findOne({
      where: {
        is_active: true,
        [Op.or]: [
          { username: inputUserIdentifier },
          { roll_number: inputUserIdentifier.toUpperCase() },
        ],
      },
    });

    if (matchedStudent) {
      // Verify phone number / password
      if (!isPhoneMatch(matchedStudent)) {
        res.status(401).json({
          success: false,
          message: 'Incorrect Mobile Number / Password for this student username. Please check your credentials or use "Find Username".',
        });
        return;
      }
    } else {
      // 2. Fallback: Search all active students for matching name and phone
      const allActive = await Student.findAll({ where: { is_active: true } });
      const phoneMatches = allActive.filter(isPhoneMatch);

      if (phoneMatches.length === 1) {
        matchedStudent = phoneMatches[0];
      } else if (phoneMatches.length > 1) {
        matchedStudent = phoneMatches.find((s) =>
          (s.username && s.username.toLowerCase() === inputUserIdentifier) ||
          (s.roll_number && s.roll_number.toLowerCase() === inputUserIdentifier) ||
          isStudentNameMatch(inputUserIdentifier, s.full_name)
        ) || phoneMatches[0];
      } else {
        matchedStudent = allActive.find((s) =>
          ((s.username && s.username.toLowerCase() === inputUserIdentifier) ||
           (s.roll_number && s.roll_number.toLowerCase() === inputUserIdentifier) ||
           isStudentNameMatch(inputUserIdentifier, s.full_name)) &&
          isPhoneMatch(s)
        );
      }
    }

    if (!matchedStudent) {
      res.status(401).json({
        success: false,
        message: 'No active student found matching this Username and Mobile Number. Click "Find Username" to check registered accounts.',
      });
      return;
    }

    // Ensure matchedStudent has a username if it was missing
    if (!matchedStudent.username) {
      const generated = await generateUniqueStudentUsername(matchedStudent.full_name, matchedStudent.phone_number, matchedStudent.id);
      await matchedStudent.update({ username: generated });
      matchedStudent.username = generated;
    }

    // Sign Student JWT Token
    const token = signToken({
      id: matchedStudent.id,
      student_id: matchedStudent.id,
      username: matchedStudent.username,
      role: 'STUDENT',
      name: matchedStudent.full_name,
    });

    res.json({
      success: true,
      message: `Welcome, ${matchedStudent.full_name}!`,
      token,
      student: {
        id: matchedStudent.id,
        roll_number: matchedStudent.roll_number,
        username: matchedStudent.username,
        full_name: matchedStudent.full_name,
        phone_number: matchedStudent.phone_number,
        whatsapp_number: matchedStudent.whatsapp_number,
        barcode_data: matchedStudent.barcode_data,
        qr_token: matchedStudent.qr_token,
        current_streak: matchedStudent.current_streak,
        regularity_score: matchedStudent.regularity_score,
      },
    });
  } catch (error: any) {
    console.error('Student login error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Internal server error during student login.',
    });
  }
};

/**
 * Get Comprehensive Student Portal Details (Attendance, Batch Progress, Schedule, ID Card)
 */
export const getStudentPortalDetails = async (req: Request, res: Response): Promise<void> => {
  try {
    const studentId = (req as any).user?.studentId || (req as any).user?.userId || req.params.student_id;

    if (!studentId) {
      res.status(401).json({ success: false, message: 'Unauthorized student access.' });
      return;
    }

    const student = await Student.findByPk(studentId);
    if (!student) {
      res.status(404).json({ success: false, message: 'Student record not found.' });
      return;
    }

    // Ensure student has a username
    if (!student.username) {
      const generated = await generateUniqueStudentUsername(student.full_name, student.phone_number, student.id);
      await student.update({ username: generated });
      student.username = generated;
    }

    // 1. Resolve Enrolled Batches
    let enrolledBatchesList: any[] = [];
    try {
      if (Array.isArray(student.enrolled_batches)) {
        enrolledBatchesList = student.enrolled_batches;
      } else if (typeof student.enrolled_batches === 'string') {
        enrolledBatchesList = JSON.parse(student.enrolled_batches || '[]');
      }
    } catch {
      enrolledBatchesList = [];
    }

    const batchIds = enrolledBatchesList.map((b: any) => (typeof b === 'object' ? b.batch_id : b)).filter(Boolean);

    let batches: any[] = [];
    if (batchIds.length > 0) {
      batches = await Batch.findAll({
        where: { id: batchIds },
        include: [
          {
            model: User,
            as: 'instructor',
            attributes: ['id', 'name', 'email', 'mobileNumber'],
          },
        ],
      });
    }

    // If student has no enrolled batches in array, fall back to any active batch
    if (batches.length === 0) {
      const defaultBatch = await Batch.findOne({
        where: { status: 'ACTIVE' },
        include: [{ model: User, as: 'instructor', attributes: ['id', 'name', 'email', 'mobileNumber'] }],
      });
      if (defaultBatch) batches = [defaultBatch];
    }

    const primaryBatch = batches[0] || null;

    // 2. Calculate Batch Progress & Sessions
    let totalSessionsConducted = 0;
    let totalEstimatedDays = 60; // Default estimate
    let batchDaysCompleted = 0;
    let batchDaysRemaining = 0;
    let batchProgressPercent = 0;

    const dayMap: { [key: number]: string } = {
      0: 'SUN',
      1: 'MON',
      2: 'TUE',
      3: 'WED',
      4: 'THU',
      5: 'FRI',
      6: 'SAT',
    };
    const dayIndices: { [key: string]: number } = {
      SUN: 0,
      MON: 1,
      TUE: 2,
      WED: 3,
      THU: 4,
      FRI: 5,
      SAT: 6,
    };
    const fullDayNames: { [key: string]: string } = {
      SUN: 'Sunday',
      MON: 'Monday',
      TUE: 'Tuesday',
      WED: 'Wednesday',
      THU: 'Thursday',
      FRI: 'Friday',
      SAT: 'Saturday',
    };

    const todayIndex = new Date().getDay();
    const todayDayCode = dayMap[todayIndex];

    let nextClass = {
      is_today: false,
      next_day_name: 'Scheduled Days',
      next_day_code: '',
      days_left: 0,
      days_text: 'Active',
      formatted_time: 'Class Hours',
    };

    if (primaryBatch) {
      const scheduleDays: string[] = Array.isArray(primaryBatch.schedule_days) ? primaryBatch.schedule_days : [];

      // Calculate actual scheduled calendar classes from start_date to today
      let calendarClassesCount = 0;

      if (primaryBatch.start_date && scheduleDays.length > 0) {
        const start = new Date(primaryBatch.start_date);
        const today = new Date();
        const curr = new Date(start.getFullYear(), start.getMonth(), start.getDate());
        const end = new Date(today.getFullYear(), today.getMonth(), today.getDate());

        const dayCodeMap = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

        while (curr <= end) {
          const code = dayCodeMap[curr.getDay()];
          if (scheduleDays.includes(code)) {
            calendarClassesCount++;
          }
          curr.setDate(curr.getDate() + 1);
        }
      }

      // Count actual class session rows in database
      const dbSessionsCount = await ClassSession.count({
        where: { batch_id: primaryBatch.id },
      });

      totalSessionsConducted = Math.max(calendarClassesCount, dbSessionsCount);
      batchDaysCompleted = totalSessionsConducted;

      // Next class calculation
      if (scheduleDays.includes(todayDayCode)) {
        nextClass = {
          is_today: true,
          next_day_name: 'Today',
          next_day_code: todayDayCode,
          days_left: 0,
          days_text: 'Today',
          formatted_time: 'Class Scheduled Today',
        };
      } else if (scheduleDays.length > 0) {
        let minDaysLeft = 8;
        let nextDayCode = scheduleDays[0];

        for (const sDay of scheduleDays) {
          const targetIndex = dayIndices[sDay];
          if (targetIndex !== undefined) {
            let diff = (targetIndex - todayIndex + 7) % 7;
            if (diff === 0) diff = 7;
            if (diff < minDaysLeft) {
              minDaysLeft = diff;
              nextDayCode = sDay;
            }
          }
        }

        const nextDayName = fullDayNames[nextDayCode] || nextDayCode;
        nextClass = {
          is_today: false,
          next_day_name: nextDayName,
          next_day_code: nextDayCode,
          days_left: minDaysLeft,
          days_text: minDaysLeft === 1 ? 'Tomorrow' : `In ${minDaysLeft} Days`,
          formatted_time: `${nextDayName}`,
        };
      }
    }

    // 3. Attendance Logs & Analytics
    const attendanceLogs = await AttendanceLog.findAll({
      where: { student_id: student.id },
      order: [['scan_timestamp', 'DESC']],
      include: [
        {
          model: ClassSession,
          as: 'session',
          attributes: ['id', 'session_date', 'status'],
        },
        {
          model: Batch,
          as: 'batch',
          attributes: ['id', 'batch_code', 'name'],
        },
      ],
    });

    const presentCount = attendanceLogs.filter((l) => l.status === 'PRESENT').length;
    const lateCount = attendanceLogs.filter((l) => l.status === 'LATE').length;
    const absentCount = attendanceLogs.filter((l) => l.status === 'ABSENT').length;
    const attendedCount = presentCount + lateCount;

    const effectiveTotalSessions = Math.max(totalSessionsConducted, attendedCount + absentCount, 1);
    const attendancePercentage = Math.min(
      100,
      Math.round((attendedCount / effectiveTotalSessions) * 100)
    );

    // Format logs for frontend
    const formattedLogs = attendanceLogs.map((log) => {
      const d = new Date(log.scan_timestamp);
      return {
        id: log.id,
        session_id: log.session_id,
        date: d.toLocaleDateString('en-US', {
          weekday: 'short',
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        }),
        raw_date: d.toISOString().split('T')[0],
        time: d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        status: log.status,
        scan_method: log.scan_method,
        notes: log.notes,
        batch_name: (log as any).batch?.name || primaryBatch?.name || 'Class Batch',
      };
    });

    res.json({
      success: true,
      student: {
        id: student.id,
        roll_number: student.roll_number,
        username: student.username || student.roll_number.toLowerCase(),
        full_name: student.full_name,
        phone_number: student.phone_number,
        whatsapp_number: student.whatsapp_number,
        parent_contact: student.parent_contact,
        barcode_data: student.barcode_data,
        qr_token: student.qr_token,
        regularity_score: student.regularity_score,
        current_streak: student.current_streak,
        is_active: student.is_active,
        joined_date: student.createdAt
          ? new Date(student.createdAt).toLocaleDateString('en-US', {
              month: 'long',
              day: 'numeric',
              year: 'numeric',
            })
          : 'Enrolled',
      },
      primary_batch: primaryBatch
        ? {
            id: primaryBatch.id,
            batch_code: primaryBatch.batch_code,
            name: primaryBatch.name,
            description: primaryBatch.description,
            schedule_days: primaryBatch.schedule_days,
            start_date: primaryBatch.start_date,
            end_date: primaryBatch.end_date,
            status: primaryBatch.status,
            instructor: primaryBatch.instructor
              ? {
                  name: primaryBatch.instructor.name,
                  email: primaryBatch.instructor.email,
                  mobileNumber: primaryBatch.instructor.mobileNumber,
                }
              : null,
            progress: {
              total_estimated_days: totalEstimatedDays,
              days_completed: batchDaysCompleted,
              days_remaining: batchDaysRemaining,
              progress_percentage: Math.min(100, batchProgressPercent),
              total_sessions_conducted: totalSessionsConducted,
            },
          }
        : null,
      all_batches: batches.map((b) => ({
        id: b.id,
        batch_code: b.batch_code,
        name: b.name,
        schedule_days: b.schedule_days,
        status: b.status,
      })),
      analytics: {
        attendance_percentage: attendancePercentage,
        total_sessions_conducted: totalSessionsConducted,
        attended_count: attendedCount,
        present_count: presentCount,
        late_count: lateCount,
        absent_count: absentCount,
        current_streak: student.current_streak || 0,
        regularity_score: student.regularity_score || 100,
      },
      next_class: nextClass,
      attendance_logs: formattedLogs,
    });
  } catch (error: any) {
    console.error('Error fetching student portal details:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Internal server error while fetching student portal details.',
    });
  }
};
