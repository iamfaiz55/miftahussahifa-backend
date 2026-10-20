import type { Request, Response } from 'express';
import { Op } from 'sequelize';
import { Referrer, Student, Batch, ClassSession, AttendanceLog } from '../models/index.js';

/**
 * Get all referrers with aggregated stats (total referred, active, absent today)
 */
export const getReferrers = async (req: Request, res: Response): Promise<void> => {
  try {
    const { search, is_active } = req.query;

    const whereClause: any = {};
    if (is_active !== undefined) {
      whereClause.is_active = is_active === 'true';
    }

    if (search) {
      const q = String(search).trim();
      whereClause[Op.or] = [
        { name: { [Op.like]: `%${q}%` } },
        { mobile_number: { [Op.like]: `%${q}%` } },
        { email: { [Op.like]: `%${q}%` } },
        { relation_or_role: { [Op.like]: `%${q}%` } },
      ];
    }

    const referrers = await Referrer.findAll({
      where: whereClause,
      order: [['id', 'DESC']],
    });

    const todayDateStr = new Date().toISOString().split('T')[0];

    // Find sessions conducted today to check for absentees
    const todaySessions = await ClassSession.findAll({
      where: { session_date: todayDateStr },
      attributes: ['id', 'batch_id'],
    });
    const sessionIds = todaySessions.map((s) => s.id);

    // Fetch all students associated with any referrer
    const allReferredStudents = await Student.findAll({
      where: {
        referred_by: { [Op.ne]: null },
      },
      attributes: ['id', 'referred_by', 'full_name', 'is_active', 'regularity_score'],
    });

    // Fetch absent logs for today
    let todayAbsentStudentIds = new Set<number>();
    if (sessionIds.length > 0) {
      const absentLogs = await AttendanceLog.findAll({
        where: {
          session_id: sessionIds,
          status: 'ABSENT',
        },
        attributes: ['student_id'],
      });
      todayAbsentStudentIds = new Set(absentLogs.map((l) => l.student_id));
    }

    // Build map of referrer id -> student statistics
    const statsMap = new Map<
      number,
      { total_students: number; active_students: number; absent_today_count: number }
    >();

    for (const student of allReferredStudents) {
      const refId = student.referred_by;
      if (!refId) continue;

      const current = statsMap.get(refId) || {
        total_students: 0,
        active_students: 0,
        absent_today_count: 0,
      };

      current.total_students += 1;
      if (student.is_active) {
        current.active_students += 1;
      }
      if (todayAbsentStudentIds.has(student.id)) {
        current.absent_today_count += 1;
      }

      statsMap.set(refId, current);
    }

    const result = referrers.map((r) => {
      const stats = statsMap.get(r.id) || {
        total_students: 0,
        active_students: 0,
        absent_today_count: 0,
      };
      return {
        ...r.toJSON(),
        stats,
      };
    });

    res.json({
      success: true,
      count: result.length,
      referrers: result,
    });
  } catch (error: any) {
    console.error('Error fetching referrers:', error);
    res.status(500).json({ success: false, message: error.message || 'Server error fetching referrers' });
  }
};

/**
 * Get single referrer with complete list of referred students
 */
export const getReferrerById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const referrer = await Referrer.findByPk(id as string, {
      include: [
        {
          model: Student,
          as: 'referred_students',
          attributes: [
            'id',
            'roll_number',
            'username',
            'full_name',
            'gender',
            'phone_number',
            'whatsapp_number',
            'enrolled_batches',
            'regularity_score',
            'current_streak',
            'is_active',
            'createdAt',
          ],
        },
      ],
    });

    if (!referrer) {
      res.status(404).json({ success: false, message: 'Referrer not found.' });
      return;
    }

    // Fetch batch names for context
    const batches = await Batch.findAll({
      attributes: ['id', 'name', 'batch_code'],
    });
    const batchMap = new Map<number, { name: string; batch_code: string }>(
      batches.map((b) => [b.id, { name: b.name, batch_code: b.batch_code }])
    );

    const jsonRef: any = referrer.toJSON();
    const enrichedStudents = (jsonRef.referred_students || []).map((s: any) => {
      const enrolled = Array.isArray(s.enrolled_batches) ? s.enrolled_batches : [];
      const batchNames = enrolled
        .map((eb: any) => batchMap.get(Number(eb.batch_id))?.name)
        .filter(Boolean);

      return {
        ...s,
        batch_names: batchNames,
      };
    });

    jsonRef.referred_students = enrichedStudents;

    res.json({
      success: true,
      referrer: jsonRef,
    });
  } catch (error: any) {
    console.error('Error fetching referrer details:', error);
    res.status(500).json({ success: false, message: error.message || 'Server error fetching referrer' });
  }
};

/**
 * Create a new Referrer
 */
export const createReferrer = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, mobile_number, phone, email, relation_or_role, notes, is_active } = req.body;

    const resolvedName = (name || '').trim();
    const resolvedPhone = (mobile_number || phone || '').trim();

    if (!resolvedName) {
      res.status(400).json({ success: false, message: 'Referrer name is required.' });
      return;
    }

    if (!resolvedPhone) {
      res.status(400).json({ success: false, message: 'Referrer mobile number is required.' });
      return;
    }

    const newReferrer = await Referrer.create({
      name: resolvedName,
      mobile_number: resolvedPhone,
      email: email ? String(email).toLowerCase().trim() : null,
      relation_or_role: relation_or_role ? String(relation_or_role).trim() : null,
      notes: notes ? String(notes).trim() : null,
      is_active: is_active !== undefined ? Boolean(is_active) : true,
    });

    res.status(201).json({
      success: true,
      message: 'Referrer created successfully.',
      referrer: newReferrer,
    });
  } catch (error: any) {
    console.error('Error creating referrer:', error);
    res.status(500).json({ success: false, message: error.message || 'Server error creating referrer' });
  }
};

/**
 * Update an existing Referrer
 */
export const updateReferrer = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const referrer = await Referrer.findByPk(id as string);

    if (!referrer) {
      res.status(404).json({ success: false, message: 'Referrer not found.' });
      return;
    }

    const { name, mobile_number, phone, email, relation_or_role, notes, is_active } = req.body;

    await referrer.update({
      name: name !== undefined ? String(name).trim() : referrer.name,
      mobile_number: mobile_number !== undefined || phone !== undefined
        ? String(mobile_number || phone).trim()
        : referrer.mobile_number,
      email: email !== undefined ? (email ? String(email).toLowerCase().trim() : null) : referrer.email,
      relation_or_role: relation_or_role !== undefined
        ? (relation_or_role ? String(relation_or_role).trim() : null)
        : referrer.relation_or_role,
      notes: notes !== undefined ? (notes ? String(notes).trim() : null) : referrer.notes,
      is_active: is_active !== undefined ? Boolean(is_active) : referrer.is_active,
    });

    res.json({
      success: true,
      message: 'Referrer updated successfully.',
      referrer,
    });
  } catch (error: any) {
    console.error('Error updating referrer:', error);
    res.status(500).json({ success: false, message: error.message || 'Server error updating referrer' });
  }
};

/**
 * Delete Referrer (unlinks students safely without deleting students)
 */
export const deleteReferrer = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const referrer = await Referrer.findByPk(id as string);

    if (!referrer) {
      res.status(404).json({ success: false, message: 'Referrer not found.' });
      return;
    }

    // Safely unlink referred students
    await Student.update(
      { referred_by: null },
      { where: { referred_by: referrer.id } }
    );

    await referrer.destroy();

    res.json({
      success: true,
      message: 'Referrer removed successfully and associated students unlinked.',
    });
  } catch (error: any) {
    console.error('Error deleting referrer:', error);
    res.status(500).json({ success: false, message: error.message || 'Server error deleting referrer' });
  }
};

/**
 * Follow-up Dispatch Center:
 * Returns absent students grouped by Referrer for a given date,
 * with ready-to-use WhatsApp message templates and direct phone links.
 */
export const getAbsentFollowups = async (req: Request, res: Response): Promise<void> => {
  try {
    const { date, batch_id } = req.query;
    const targetDate = (date as string) || new Date().toISOString().split('T')[0];

    // Build session where clause
    const sessionWhere: any = { session_date: targetDate };
    if (batch_id) {
      sessionWhere.batch_id = Number(batch_id);
    }

    const sessions = await ClassSession.findAll({
      where: sessionWhere,
      include: [
        {
          model: Batch,
          as: 'batch',
          attributes: ['id', 'name', 'batch_code', 'schedule_days', 'timing'],
        },
      ],
    });

    if (sessions.length === 0) {
      res.json({
        success: true,
        date: targetDate,
        total_absent: 0,
        total_referrers_involved: 0,
        referred_groups: [],
        unassigned_students: [],
        message: `No class sessions found for date ${targetDate}.`,
      });
      return;
    }

    const sessionIds = sessions.map((s) => s.id);
    const sessionMap = new Map<number, any>(sessions.map((s) => [s.id, s]));

    // Find all ABSENT attendance logs for these sessions
    const absentLogs = await AttendanceLog.findAll({
      where: {
        session_id: sessionIds,
        status: 'ABSENT',
      },
      include: [
        {
          model: Student,
          as: 'student',
          attributes: [
            'id',
            'full_name',
            'roll_number',
            'username',
            'gender',
            'phone_number',
            'whatsapp_number',
            'regularity_score',
            'current_streak',
            'referred_by',
          ],
          include: [
            {
              model: Referrer,
              as: 'referrer',
              attributes: ['id', 'name', 'mobile_number', 'email', 'relation_or_role'],
            },
          ],
        },
      ],
      order: [['scan_timestamp', 'ASC']],
    });

    // Group absent students by Referrer
    const referrerGroupsMap = new Map<number, { referrer: any; students: any[] }>();
    const unassignedStudents: any[] = [];

    // Helper to sanitize phone for WhatsApp
    const sanitizePhone = (p: string) => {
      let clean = (p || '').replace(/\D/g, '');
      if (clean.length === 10) {
        clean = `91${clean}`;
      }
      return clean;
    };

    for (const log of absentLogs) {
      const student: any = (log as any).student;
      if (!student) continue;

      const session: any = sessionMap.get(log.session_id);
      const batchName = session?.batch?.name || 'Quran & Hadees Class';

      const studentItem = {
        student_id: student.id,
        full_name: student.full_name,
        roll_number: student.roll_number,
        username: student.username,
        gender: student.gender,
        phone_number: student.phone_number,
        whatsapp_number: student.whatsapp_number,
        regularity_score: student.regularity_score,
        current_streak: student.current_streak,
        batch_id: log.batch_id,
        batch_name: batchName,
        session_id: log.session_id,
        date: targetDate,
      };

      if (student.referred_by && student.referrer) {
        const refId = student.referred_by;
        if (!referrerGroupsMap.has(refId)) {
          referrerGroupsMap.set(refId, {
            referrer: student.referrer,
            students: [],
          });
        }
        referrerGroupsMap.get(refId)!.students.push(studentItem);
      } else {
        unassignedStudents.push(studentItem);
      }
    }

    // Prepare WhatsApp templates for each referrer group
    const referred_groups = Array.from(referrerGroupsMap.values()).map((group) => {
      const ref = group.referrer;
      const cleanPhone = sanitizePhone(ref.mobile_number);

      const studentsListText = group.students
        .map((s, idx) => `${idx + 1}. *${s.full_name}* (Roll: ${s.roll_number}, Batch: ${s.batch_name})`)
        .join('\n');

      const message =
        `السلام عليكم ورحمة الله وبركاته ${ref.name} صاحب،\n\n` +
        `امید ہے آپ بخیر ہوں گے۔ آپ کے ریفر کردہ درج ذیل طالب علم آج (${targetDate}) کلاس میں غیر حاضر رہے ہیں:\n\n` +
        `${studentsListText}\n\n` +
        `براہِ کرم ان سے رابطہ فرما کر غیر حاضری کی وجہ معلوم فرمائیں۔\n` +
        `جزاکم اللہ خیراً و احسن الجزاء۔\n\n` +
        `— مفتاح القرآن والحدیث اکیڈمی (Miftahul Quran Wal Hadees)`;

      const encodedMsg = encodeURIComponent(message);
      const whatsapp_url = cleanPhone ? `https://wa.me/${cleanPhone}?text=${encodedMsg}` : null;

      return {
        referrer: ref,
        absent_count: group.students.length,
        students: group.students,
        whatsapp_message: message,
        whatsapp_url,
      };
    });

    res.json({
      success: true,
      date: targetDate,
      total_absent: absentLogs.length,
      total_referrers_involved: referred_groups.length,
      referred_groups,
      unassigned_students: unassignedStudents,
    });
  } catch (error: any) {
    console.error('Error fetching absent followups:', error);
    res.status(500).json({ success: false, message: error.message || 'Server error fetching followups' });
  }
};
