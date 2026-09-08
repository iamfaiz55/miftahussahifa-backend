import type { Request, Response } from 'express';
import { Batch, User, Student, ClassSession, AttendanceLog } from '../models/index.js';

/**
 * Helper to auto-generate batch code if not provided
 */
async function generateBatchCode(name: string): Promise<string> {
  const year = new Date().getFullYear();
  // Take first letters of words in batch name (e.g., Arabic Level 1 -> AL1)
  const initials = name
    .replace(/[^a-zA-Z0-9\s]/g, '')
    .split(/\s+/)
    .map((w) => w[0]?.toUpperCase() || '')
    .join('')
    .slice(0, 4) || 'CLS';

  const count = await Batch.count();
  const nextNum = (count + 1).toString().padStart(2, '0');
  let code = `MS-${year}-${initials}-${nextNum}`;

  let exists = await Batch.findOne({ where: { batch_code: code } });
  let salt = 1;
  while (exists) {
    const candidateNum = (count + 1 + salt).toString().padStart(2, '0');
    code = `MS-${year}-${initials}-${candidateNum}`;
    exists = await Batch.findOne({ where: { batch_code: code } });
    salt++;
  }

  return code;
}

/**
 * Register a new Class / Batch
 * Required: name, start_date
 * Optional: batch_code, expected_end_date, schedule_days, timing, grace_period_mins, instructor_id, is_public, status
 */
export const createBatch = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      name,
      batch_code,
      start_date,
      expected_end_date,
      schedule_days,
      timing,
      grace_period_mins,
      instructor_id,
      teacher_id,
      is_public,
      status,
    } = req.body;

    if (!name || !name.trim()) {
      res.status(400).json({ success: false, message: 'Class/Batch name is required.' });
      return;
    }

    if (!start_date) {
      res.status(400).json({ success: false, message: 'Start date is required.' });
      return;
    }

    const resolvedInstructorId = instructor_id || teacher_id || null;

    // If teacher provided, verify they exist and have teacher/admin role
    if (resolvedInstructorId) {
      const teacher = await User.findByPk(resolvedInstructorId);
      if (!teacher) {
        res.status(404).json({ success: false, message: 'Assigned teacher not found.' });
        return;
      }
    }

    // Auto-generate or use custom batch code
    let finalBatchCode = batch_code ? batch_code.trim().toUpperCase() : await generateBatchCode(name.trim());

    // Check unique batch_code
    const existingCode = await Batch.findOne({ where: { batch_code: finalBatchCode } });
    if (existingCode) {
      res.status(400).json({ success: false, message: `Batch code ${finalBatchCode} is already in use.` });
      return;
    }

    const newBatch = await Batch.create({
      batch_code: finalBatchCode,
      name: name.trim(),
      start_date,
      expected_end_date: expected_end_date || null,
      schedule_days: Array.isArray(schedule_days) && schedule_days.length > 0 ? schedule_days : ['MON', 'TUE', 'WED', 'THU', 'FRI'],
      timing: timing || { start_time: '07:00', end_time: '08:30', timezone: 'IST' },
      grace_period_mins: grace_period_mins !== undefined ? Number(grace_period_mins) : 15,
      status: status || 'ACTIVE',
      is_public: is_public !== undefined ? Boolean(is_public) : true,
      instructor_id: resolvedInstructorId ? Number(resolvedInstructorId) : null,
    });

    // Update teacher assigned_batches if applicable
    if (resolvedInstructorId) {
      const teacher = await User.findByPk(resolvedInstructorId);
      if (teacher) {
        const assigned = Array.isArray(teacher.assigned_batches) ? [...teacher.assigned_batches] : [];
        if (!assigned.includes(newBatch.id)) {
          assigned.push(newBatch.id);
          await teacher.update({ assigned_batches: assigned });
        }
      }
    }

    // Load with instructor details
    const populated = await Batch.findByPk(newBatch.id, {
      include: [
        {
          model: User,
          as: 'instructor',
          attributes: ['id', 'name', 'email', 'mobileNumber'],
        },
      ],
    });

    res.status(201).json({
      success: true,
      message: 'Class/Batch registered successfully.',
      batch: populated,
    });
  } catch (error: any) {
    console.error('Error creating batch:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Internal server error while creating batch.',
    });
  }
};

/**
 * Get all classes/batches (with teacher details and student counts)
 */
export const getBatches = async (req: Request, res: Response): Promise<void> => {
  try {
    const { status, instructor_id, is_public } = req.query;

    const whereClause: any = {};

    if (status) {
      whereClause.status = status;
    }

    if (instructor_id) {
      whereClause.instructor_id = Number(instructor_id);
    }

    if (is_public !== undefined) {
      whereClause.is_public = is_public === 'true';
    }

    const batches = await Batch.findAll({
      where: whereClause,
      include: [
        {
          model: User,
          as: 'instructor',
          attributes: ['id', 'name', 'email', 'mobileNumber'],
        },
      ],
      order: [['id', 'DESC']],
    });

    // Fetch all active students to calculate enrolled student counts per batch
    const allStudents = await Student.findAll({
      where: { is_active: true },
      attributes: ['id', 'enrolled_batches'],
    });

    const formatted = batches.map((b) => {
      const bObj = b.toJSON();
      const studentCount = allStudents.filter((s) => {
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
        return Array.isArray(batchesArr) && batchesArr.some((eb: any) => eb.batch_id === b.id && eb.status === 'ACTIVE');
      }).length;

      return {
        ...bObj,
        enrolled_student_count: studentCount,
      };
    });

    res.json({
      success: true,
      total: formatted.length,
      batches: formatted,
    });
  } catch (error: any) {
    console.error('Error fetching batches:', error);
    res.status(500).json({ success: false, message: error.message || 'Server error' });
  }
};

/**
 * Get single class/batch details by ID
 */
export const getBatchById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const batch = await Batch.findByPk(id as string, {
      include: [
        {
          model: User,
          as: 'instructor',
          attributes: ['id', 'name', 'email', 'mobileNumber'],
        },
      ],
    });

    if (!batch) {
      res.status(404).json({ success: false, message: 'Class/Batch not found.' });
      return;
    }

    // Get all active students enrolled in this batch
    const allStudents = await Student.findAll({
      where: { is_active: true },
      attributes: ['id', 'roll_number', 'username', 'full_name', 'phone_number', 'whatsapp_number', 'enrolled_batches', 'current_streak'],
    });

    const enrolledStudents = allStudents.filter((s) => {
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
      return Array.isArray(batchesArr) && batchesArr.some((eb: any) => eb.batch_id === batch.id && eb.status === 'ACTIVE');
    });

    const enrolledStudentMap = new Map(enrolledStudents.map((s) => [s.id, s]));

    // Fetch all ClassSessions for this batch
    const sessions = await ClassSession.findAll({
      where: { batch_id: batch.id },
      order: [['session_date', 'DESC']],
    });

    // Fetch all AttendanceLogs for these sessions
    const sessionIds = sessions.map((s) => s.id);
    const logs = sessionIds.length > 0 ? await AttendanceLog.findAll({
      where: { batch_id: batch.id },
      order: [['scan_timestamp', 'DESC']],
      include: [
        {
          model: Student,
          as: 'student',
          attributes: ['id', 'roll_number', 'username', 'full_name', 'phone_number', 'whatsapp_number'],
        },
      ],
    }) : [];

    // Map logs by session_id and by student_id
    const logsBySession = new Map<number, typeof logs>();
    const logsByStudent = new Map<number, typeof logs>();

    for (const log of logs) {
      // By session
      if (!logsBySession.has(log.session_id)) {
        logsBySession.set(log.session_id, []);
      }
      logsBySession.get(log.session_id)!.push(log);

      // By student
      if (!logsByStudent.has(log.student_id)) {
        logsByStudent.set(log.student_id, []);
      }
      logsByStudent.get(log.student_id)!.push(log);
    }

    // Build session breakdowns with present and absent student lists
    const sessionBreakdowns = sessions.map((sess) => {
      const sessLogs = logsBySession.get(sess.id) || [];
      const presentLogs = sessLogs.filter((l) => l.status === 'PRESENT' || l.status === 'LATE' || l.status === 'EXCUSED');
      const presentStudentIds = new Set(presentLogs.map((l) => l.student_id));

      const presentList = presentLogs.map((l) => {
        const st = enrolledStudentMap.get(l.student_id) || (l as any).student;
        return {
          id: l.student_id,
          full_name: st?.full_name || 'Student',
          roll_number: st?.roll_number || 'N/A',
          phone_number: st?.phone_number || '',
          whatsapp_number: st?.whatsapp_number || st?.phone_number || '',
          status: l.status,
          scan_time: l.scan_timestamp,
          scan_method: l.scan_method,
        };
      });

      // Absent students are enrolled students who are not in presentList
      const absentList = enrolledStudents
        .filter((st) => !presentStudentIds.has(st.id))
        .map((st) => {
          const absentLog = sessLogs.find((l) => l.student_id === st.id && l.status === 'ABSENT');
          return {
            id: st.id,
            full_name: st.full_name,
            roll_number: st.roll_number,
            phone_number: st.phone_number,
            whatsapp_number: st.whatsapp_number || st.phone_number,
            status: 'ABSENT',
            notes: absentLog?.notes || 'Absent from class session',
          };
        });

      return {
        id: sess.id,
        session_date: sess.session_date,
        actual_start_time: sess.actual_start_time,
        status: sess.status,
        total_enrolled: enrolledStudents.length,
        present_count: presentList.length,
        absent_count: absentList.length,
        attendance_percentage: enrolledStudents.length > 0 ? Math.round((presentList.length / enrolledStudents.length) * 100) : 0,
        present_students: presentList,
        absent_students: absentList,
      };
    });

    // Build per-student stats in this batch
    const studentStats = enrolledStudents.map((st) => {
      const stLogs = logsByStudent.get(st.id) || [];
      const presentCount = stLogs.filter((l) => l.status === 'PRESENT' || l.status === 'LATE' || l.status === 'EXCUSED').length;
      const absentCount = sessions.length > 0 ? Math.max(0, sessions.length - presentCount) : 0;
      const rate = sessions.length > 0 ? Math.round((presentCount / sessions.length) * 100) : 100;

      return {
        id: st.id,
        full_name: st.full_name,
        roll_number: st.roll_number,
        phone_number: st.phone_number,
        whatsapp_number: st.whatsapp_number || st.phone_number,
        current_streak: st.current_streak || 0,
        total_sessions: sessions.length,
        present_count: presentCount,
        absent_count: absentCount,
        attendance_rate: rate,
      };
    });

    const totalSessions = sessions.length;
    const avgAttendanceRate = sessionBreakdowns.length > 0
      ? Math.round(sessionBreakdowns.reduce((acc, s) => acc + s.attendance_percentage, 0) / sessionBreakdowns.length)
      : 0;

    res.json({
      success: true,
      batch: {
        ...batch.toJSON(),
        enrolled_student_count: enrolledStudents.length,
        students: enrolledStudents,
      },
      stats: {
        total_enrolled: enrolledStudents.length,
        total_sessions: totalSessions,
        avg_attendance_rate: avgAttendanceRate,
      },
      sessions: sessionBreakdowns,
      students_stats: studentStats,
    });
  } catch (error: any) {
    console.error('Error fetching batch:', error);
    res.status(500).json({ success: false, message: error.message || 'Server error' });
  }
};

/**
 * Update class/batch details
 */
export const updateBatch = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const batch = await Batch.findByPk(id as string);

    if (!batch) {
      res.status(404).json({ success: false, message: 'Class/Batch not found.' });
      return;
    }

    const {
      name,
      start_date,
      expected_end_date,
      schedule_days,
      timing,
      grace_period_mins,
      instructor_id,
      teacher_id,
      is_public,
      status,
    } = req.body;

    const resolvedInstructorId = instructor_id !== undefined ? instructor_id : teacher_id;

    if (resolvedInstructorId) {
      const teacher = await User.findByPk(resolvedInstructorId);
      if (!teacher) {
        res.status(404).json({ success: false, message: 'Assigned teacher not found.' });
        return;
      }
    }

    await batch.update({
      name: name ? name.trim() : batch.name,
      start_date: start_date || batch.start_date,
      expected_end_date: expected_end_date !== undefined ? expected_end_date : batch.expected_end_date,
      schedule_days: schedule_days || batch.schedule_days,
      timing: timing || batch.timing,
      grace_period_mins: grace_period_mins !== undefined ? Number(grace_period_mins) : batch.grace_period_mins,
      instructor_id: resolvedInstructorId !== undefined ? (resolvedInstructorId ? Number(resolvedInstructorId) : null) : batch.instructor_id,
      is_public: is_public !== undefined ? Boolean(is_public) : batch.is_public,
      status: status || batch.status,
    });

    const updated = await Batch.findByPk(batch.id, {
      include: [
        {
          model: User,
          as: 'instructor',
          attributes: ['id', 'name', 'email', 'mobileNumber'],
        },
      ],
    });

    res.json({
      success: true,
      message: 'Class/Batch updated successfully.',
      batch: updated,
    });
  } catch (error: any) {
    console.error('Error updating batch:', error);
    res.status(500).json({ success: false, message: error.message || 'Server error' });
  }
};

/**
 * Delete a class/batch
 */
export const deleteBatch = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const batch = await Batch.findByPk(id as string);

    if (!batch) {
      res.status(404).json({ success: false, message: 'Class/Batch not found.' });
      return;
    }

    const batchIdNum = Number(batch.id);

    // Remove this batch from all students' enrolled_batches arrays
    const allStudents = await Student.findAll();
    for (const student of allStudents) {
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

      if (batchesArr.some((b: any) => b.batch_id === batchIdNum)) {
        const updatedBatches = batchesArr.filter((b: any) => b.batch_id !== batchIdNum);
        await student.update({ enrolled_batches: updatedBatches });
      }
    }

    await batch.destroy();

    res.json({
      success: true,
      message: `Class/Batch '${batch.name}' deleted successfully.`,
    });
  } catch (error: any) {
    console.error('Error deleting batch:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Internal server error while deleting batch.',
    });
  }
};
