import type { Request, Response } from 'express';
import { Student, Batch, ClassSession, AttendanceLog, User } from '../models/index.js';

/**
 * Check in a student via Barcode, QR Token, or Roll Number
 */
export const checkInStudent = async (req: Request, res: Response): Promise<void> => {
  try {
    const { identifier, barcode, token, roll_number, student_id, batch_id, scan_method } = req.body;
    const searchTarget = (identifier || barcode || token || roll_number || student_id || '').toString().trim();

    if (!searchTarget) {
      res.status(400).json({ success: false, message: 'Barcode, QR token, or Roll Number is required for check-in.' });
      return;
    }

    // 1. Locate student
    let student = null;
    if (!isNaN(Number(searchTarget)) && Number(searchTarget) > 0) {
      student = await Student.findByPk(Number(searchTarget));
    }
    if (!student) {
      student = await Student.findOne({ where: { barcode_data: searchTarget } });
    }
    if (!student) {
      student = await Student.findOne({ where: { roll_number: searchTarget } });
    }
    if (!student) {
      student = await Student.findOne({ where: { qr_token: searchTarget } });
    }

    if (!student) {
      res.status(404).json({
        success: false,
        message: `No student found matching barcode/token '${searchTarget}'.`,
      });
      return;
    }

    // 2. Resolve student's active batch
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

    let targetBatchId = batch_id ? Number(batch_id) : null;
    if (!targetBatchId && batchesArr.length > 0) {
      const activeEnrollment = batchesArr.find((b: any) => b.status === 'ACTIVE') || batchesArr[0];
      targetBatchId = activeEnrollment?.batch_id || null;
    }

    let batch = null;
    if (targetBatchId) {
      batch = await Batch.findByPk(targetBatchId, {
        include: [
          {
            model: User,
            as: 'instructor',
            attributes: ['id', 'name', 'email'],
          },
        ],
      });
    }

    // If still no batch found, grab any available active batch or default
    if (!batch) {
      batch = await Batch.findOne({ where: { status: 'ACTIVE' } });
    }

    if (!batch) {
      res.status(400).json({
        success: false,
        message: `Student '${student.full_name}' is not assigned to any active batch. Please enroll the student in a class first.`,
        student,
      });
      return;
    }

    // 3. Verify if TODAY is a scheduled class day for this student's batch
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

    const todayIndex = new Date().getDay(); // 0 = Sun, 1 = Mon, ..., 6 = Sat
    const todayDayCode = dayMap[todayIndex];
    const todayFullName = fullDayNames[todayDayCode] || 'Today';

    const scheduleDays: string[] = Array.isArray(batch.schedule_days)
      ? batch.schedule_days
      : [];

    const isTodayScheduled = scheduleDays.includes(todayDayCode);

    // If student scans on a non-scheduled day, alert with days remaining until next session
    const allowOverride = req.body.allow_off_schedule_override === true;
    if (!isTodayScheduled && scheduleDays.length > 0 && !allowOverride) {
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
      const daysText = minDaysLeft === 1 ? '1 day (Tomorrow)' : `${minDaysLeft} days`;

      res.status(200).json({
        success: false,
        is_wrong_day: true,
        days_left: minDaysLeft,
        next_day_name: nextDayName,
        next_day_code: nextDayCode,
        today_day_name: todayFullName,
        message: `You are not scheduled for class today (${todayFullName}). Your batch '${batch.name}' meets on ${nextDayName} (in ${daysText}).`,
        student,
        batch,
      });
      return;
    }

    // 4. Find or create today's ClassSession for this batch
    const todayStr = new Date().toISOString().split('T')[0];
    let session = await ClassSession.findOne({
      where: {
        batch_id: batch.id,
        session_date: todayStr,
      },
    });

    if (!session) {
      session = await ClassSession.create({
        batch_id: batch.id,
        session_date: todayStr,
        actual_start_time: new Date(),
        status: 'OPEN',
        summary: {
          total_enrolled: 1,
          present: 0,
          late: 0,
          absent: 0,
        },
      });
    }

    // 4. Check if student already checked in for today's session
    const existingLog = await AttendanceLog.findOne({
      where: {
        session_id: session.id,
        student_id: student.id,
      },
    });

    if (existingLog) {
      res.json({
        success: true,
        already_checked_in: true,
        message: `Student '${student.full_name}' is ALREADY marked ${existingLog.status} today (${new Date(existingLog.scan_timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}).`,
        student,
        batch,
        attendance_log: existingLog,
      });
      return;
    }

    // 5. Create new AttendanceLog
    const method = scan_method || 'QR_CAMERA';
    const newLog = await AttendanceLog.create({
      session_id: session.id,
      batch_id: batch.id,
      student_id: student.id,
      scan_timestamp: new Date(),
      status: 'PRESENT',
      scan_method: method,
      scanned_code: searchTarget,
      marked_by: (req as any).user?.id || null,
      notes: `Scanned via ${method}`,
    });

    // 6. Update student streak
    const nextStreak = (student.current_streak || 0) + 1;
    await student.update({
      current_streak: nextStreak,
    });

    res.json({
      success: true,
      already_checked_in: false,
      message: `Check-in recorded! ${student.full_name} (${student.roll_number}) marked PRESENT.`,
      student: {
        ...student.toJSON(),
        current_streak: nextStreak,
      },
      batch,
      attendance_log: newLog,
    });
  } catch (error: any) {
    console.error('Error checking in student:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Internal server error while recording attendance.',
    });
  }
};

/**
 * Get recent attendance logs for today
 */
export const getTodayAttendanceLogs = async (req: Request, res: Response): Promise<void> => {
  try {
    const todayStr = new Date().toISOString().split('T')[0];
    const sessions = await ClassSession.findAll({
      where: { session_date: todayStr },
      attributes: ['id'],
    });

    const sessionIds = sessions.map((s) => s.id);
    const logs = await AttendanceLog.findAll({
      where: { session_id: sessionIds },
      order: [['scan_timestamp', 'DESC']],
      include: [
        {
          model: Student,
          as: 'student',
          attributes: ['id', 'roll_number', 'full_name', 'phone_number'],
        },
        {
          model: Batch,
          as: 'batch',
          attributes: ['id', 'batch_code', 'name'],
        },
      ],
    });

    res.json({
      success: true,
      total: logs.length,
      logs,
    });
  } catch (error: any) {
    console.error('Error fetching today attendance:', error);
    res.status(500).json({ success: false, message: error.message || 'Server error' });
  }
};

/**
 * Save manual bulk attendance for a batch session today
 */
export const saveBulkAttendance = async (req: Request, res: Response): Promise<void> => {
  try {
    const { batch_id, records } = req.body;

    if (!batch_id || !Array.isArray(records)) {
      res.status(400).json({
        success: false,
        message: 'batch_id and records array are required for bulk manual attendance.',
      });
      return;
    }

    const batch = await Batch.findByPk(Number(batch_id));
    if (!batch) {
      res.status(404).json({
        success: false,
        message: `Batch with ID ${batch_id} not found.`,
      });
      return;
    }

    const todayStr = new Date().toISOString().split('T')[0];
    let session = await ClassSession.findOne({
      where: {
        batch_id: batch.id,
        session_date: todayStr,
      },
    });

    if (!session) {
      session = await ClassSession.create({
        batch_id: batch.id,
        session_date: todayStr,
        actual_start_time: new Date(),
        status: 'OPEN',
        summary: {
          total_enrolled: records.length,
          present: 0,
          late: 0,
          absent: 0,
        },
      });
    }

    const markedBy = (req as any).user?.id || null;

    for (const rec of records) {
      const studentId = Number(rec.student_id);
      if (!studentId || isNaN(studentId)) continue;

      const status: 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED' =
        ['PRESENT', 'ABSENT', 'LATE', 'EXCUSED'].includes(rec.status) ? rec.status : 'PRESENT';

      const existingLog = await AttendanceLog.findOne({
        where: {
          session_id: session.id,
          student_id: studentId,
        },
      });

      if (existingLog) {
        await existingLog.update({
          status,
          scan_method: 'MANUAL_OVERRIDE',
          marked_by: markedBy,
          notes: 'Manual batch attendance override',
        });
      } else {
        await AttendanceLog.create({
          session_id: session.id,
          batch_id: batch.id,
          student_id: studentId,
          scan_timestamp: new Date(),
          status,
          scan_method: 'MANUAL_OVERRIDE',
          scanned_code: null,
          marked_by: markedBy,
          notes: 'Manual batch attendance entry',
        });
      }

      if (status === 'PRESENT') {
        const student = await Student.findByPk(studentId);
        if (student) {
          await student.update({
            current_streak: (student.current_streak || 0) + 1,
          });
        }
      }
    }

    // Update Session Summary
    const allLogs = await AttendanceLog.findAll({
      where: { session_id: session.id },
    });

    const presentCount = allLogs.filter((l) => l.status === 'PRESENT').length;
    const lateCount = allLogs.filter((l) => l.status === 'LATE').length;
    const absentCount = allLogs.filter((l) => l.status === 'ABSENT').length;

    const summary = {
      total_enrolled: records.length,
      present: presentCount,
      late: lateCount,
      absent: absentCount,
    };

    await session.update({ summary });

    res.json({
      success: true,
      message: `Manual attendance recorded successfully for batch '${batch.name}'. (${presentCount} Present, ${absentCount} Absent)`,
      summary,
      total_updated: records.length,
    });
  } catch (error: any) {
    console.error('Error saving bulk attendance:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Internal server error while saving bulk attendance.',
    });
  }
};

