import { Student, Batch, ClassSession, AttendanceLog, NotificationLog } from '../models/index.js';
import whatsappService from './whatsapp.service.js';

export interface AbsenteeProcessingResult {
  batchId: number;
  batchName: string;
  totalEnrolled: number;
  presentCount: number;
  absentCount: number;
  notifiedStudents: Array<{
    studentId: number;
    studentName: string;
    phone: string;
    status: 'SENT' | 'FAILED' | 'ALREADY_NOTIFIED' | 'SKIPPED_NO_PHONE';
    error?: string;
  }>;
}

export class AbsenceAlertService {
  private isProcessing = false;
  private timer: NodeJS.Timeout | null = null;

  /**
   * Start periodic auto-absence watcher (runs every 60 seconds)
   */
  public startScheduler(): void {
    if (this.timer) return;
    console.log('[AbsenceAlertService] Starting auto-absence cron watcher (60s interval)...');
    this.timer = setInterval(() => {
      this.checkAndNotifyFinishedBatches().catch((err) => {
        console.error('[AbsenceAlertService] Periodic check error:', err);
      });
    }, 60 * 1000);
  }

  public stopScheduler(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
      console.log('[AbsenceAlertService] Stopped auto-absence cron watcher.');
    }
  }

  /**
   * Main routine: Check all active batches scheduled for today whose end_time has passed
   */
  public async checkAndNotifyFinishedBatches(forceBatchId?: number): Promise<AbsenteeProcessingResult[]> {
    if (this.isProcessing) {
      console.log('[AbsenceAlertService] Previous batch processing cycle still running, skipping...');
      return [];
    }

    this.isProcessing = true;
    const results: AbsenteeProcessingResult[] = [];

    try {
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

      // Get current time in Indian Standard Time (IST) for accurate academy schedule tracking
      const now = new Date();
      const istDateStr = now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' });
      const istDate = new Date(istDateStr);
      const todayIndex = istDate.getDay();
      const todayDayCode = dayMap[todayIndex];
      const todayStr = `${istDate.getFullYear()}-${String(istDate.getMonth() + 1).padStart(2, '0')}-${String(istDate.getDate()).padStart(2, '0')}`;
      const currentMinutesSinceMidnight = istDate.getHours() * 60 + istDate.getMinutes();

      // 1. Fetch all active batches
      let batches = await Batch.findAll({
        where: { status: 'ACTIVE' },
      });

      if (forceBatchId) {
        batches = batches.filter((b) => b.id === Number(forceBatchId));
      } else {
        // Filter batches scheduled for today whose (timing.end_time + 30 minutes) has arrived
        batches = batches.filter((b) => {
          const scheduleDays = Array.isArray(b.schedule_days) ? b.schedule_days : [];
          if (!scheduleDays.includes(todayDayCode as any)) {
            return false;
          }

          const endTime = b.timing?.end_time;
          if (!endTime) return false;

          const [hStr, mStr] = endTime.split(':');
          const endMinutes = (parseInt(hStr, 10) || 0) * 60 + (parseInt(mStr, 10) || 0);
          const triggerMinutes = endMinutes + 30; // 30-minute grace buffer after class ends

          return currentMinutesSinceMidnight >= triggerMinutes;
        });
      }

      if (batches.length === 0) {
        this.isProcessing = false;
        return results;
      }

      console.log(`[AbsenceAlertService] Found ${batches.length} finished batches for today (${todayDayCode}) to inspect.`);

      // 2. Process each finished batch
      for (const batch of batches) {
        const batchResult: AbsenteeProcessingResult = {
          batchId: batch.id,
          batchName: batch.name,
          totalEnrolled: 0,
          presentCount: 0,
          absentCount: 0,
          notifiedStudents: [],
        };

        // Find or create today's ClassSession
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
              total_enrolled: 0,
              present: 0,
              late: 0,
              absent: 0,
            },
          });
        }

        // Get all students enrolled in this batch
        const allStudents = await Student.findAll({
          where: { is_active: true },
        });

        const enrolledStudents = allStudents.filter((st) => {
          let enrolledArr: any[] = [];
          try {
            if (Array.isArray(st.enrolled_batches)) {
              enrolledArr = st.enrolled_batches;
            } else if (typeof st.enrolled_batches === 'string') {
              enrolledArr = JSON.parse(st.enrolled_batches || '[]');
            }
          } catch {
            enrolledArr = [];
          }
          return enrolledArr.some((b: any) => b.batch_id === batch.id && b.status === 'ACTIVE');
        });

        batchResult.totalEnrolled = enrolledStudents.length;

        // Get all attendance logs for this session
        const attendanceLogs = await AttendanceLog.findAll({
          where: { session_id: session.id },
        });

        const presentStudentIds = new Set(
          attendanceLogs
            .filter((log) => log.status === 'PRESENT' || log.status === 'LATE' || log.status === 'EXCUSED')
            .map((log) => log.student_id)
        );

        batchResult.presentCount = presentStudentIds.size;

        // Identify absent students
        const absentStudents = enrolledStudents.filter((st) => !presentStudentIds.has(st.id));
        batchResult.absentCount = absentStudents.length;

        // Calculate next scheduled day for this batch
        const scheduleDays = Array.isArray(batch.schedule_days) ? batch.schedule_days : [];
        let nextDayName = 'your next scheduled session';
        if (scheduleDays.length > 0) {
          let minDays = 8;
          let nextCode = scheduleDays[0];
          for (const sDay of scheduleDays) {
            const targetIdx = dayIndices[sDay];
            if (targetIdx !== undefined) {
              let diff = (targetIdx - todayIndex + 7) % 7;
              if (diff === 0) diff = 7;
              if (diff < minDays) {
                minDays = diff;
                nextCode = sDay;
              }
            }
          }
          nextDayName = fullDayNames[nextCode] || nextCode;
        }

        // 3. Process absent students and send direct WhatsApp notice
        for (const student of absentStudents) {
          // Record/ensure ABSENT status in AttendanceLog
          let studentLog = attendanceLogs.find((l) => l.student_id === student.id);
          if (!studentLog) {
            studentLog = await AttendanceLog.create({
              session_id: session.id,
              batch_id: batch.id,
              student_id: student.id,
              scan_timestamp: new Date(),
              status: 'ABSENT',
              scan_method: 'AUTO_ABSENT',
              scanned_code: null,
              notes: 'Auto-marked absent at class completion',
            });
          }

          // Check if student already received WhatsApp notification for today's session
          const existingNotification = await NotificationLog.findOne({
            where: {
              session_id: session.id,
              student_id: student.id,
              channel: 'WHATSAPP',
            },
          });

          const studentPhone = student.whatsapp_number || student.phone_number;

          if (!studentPhone) {
            batchResult.notifiedStudents.push({
              studentId: student.id,
              studentName: student.full_name,
              phone: 'None',
              status: 'SKIPPED_NO_PHONE',
            });
            continue;
          }

          if (existingNotification && (existingNotification.delivery_status === 'SENT' || existingNotification.delivery_status === 'DELIVERED')) {
            batchResult.notifiedStudents.push({
              studentId: student.id,
              studentName: student.full_name,
              phone: studentPhone,
              status: 'ALREADY_NOTIFIED',
            });
            continue;
          }

          // Format respectful direct message to the adult student
          const startTimeFormatted = batch.timing?.start_time || '08:00 PM';
          const endTimeFormatted = batch.timing?.end_time || '10:00 PM';

          const messageText = `السَّلاَمُ عَلَيْكُمْ وَرَحْمَةُ اللهِ وَبَرَكَاتُهُ

Respected *${student.full_name}*,

We missed your presence at today's session of the *${batch.name}* batch (${startTimeFormatted} - ${endTimeFormatted}).

Your attendance for today was recorded as absent. If you require lesson notes, recordings, or wish to notify your instructor, please feel free to message back.

We look forward to seeing you at your next scheduled class on *${nextDayName}*!

جَزَاكُمُ اللهُ خَيْرًا
*Miftahussahifa Arabic Academy*`;

          // Send message via WhatsApp
          const sendRes = await whatsappService.sendDirectMessage(studentPhone, messageText);

          if (sendRes.success) {
            if (existingNotification) {
              await existingNotification.update({
                delivery_status: 'SENT',
                gateway_message_id: sendRes.messageId || null,
                sent_at: new Date(),
                message_body: messageText,
              });
            } else {
              await NotificationLog.create({
                session_id: session.id,
                student_id: student.id,
                channel: 'WHATSAPP',
                recipient_phone: studentPhone,
                message_body: messageText,
                delivery_status: 'SENT',
                gateway_message_id: sendRes.messageId || null,
                sent_at: new Date(),
              });
            }

            batchResult.notifiedStudents.push({
              studentId: student.id,
              studentName: student.full_name,
              phone: studentPhone,
              status: 'SENT',
            });
          } else {
            if (existingNotification) {
              await existingNotification.update({
                delivery_status: 'FAILED',
                error_reason: sendRes.error || 'Failed to send',
                sent_at: new Date(),
              });
            } else {
              await NotificationLog.create({
                session_id: session.id,
                student_id: student.id,
                channel: 'WHATSAPP',
                recipient_phone: studentPhone,
                message_body: messageText,
                delivery_status: 'FAILED',
                error_reason: sendRes.error || 'Failed to send',
                sent_at: new Date(),
              });
            }

            batchResult.notifiedStudents.push({
              studentId: student.id,
              studentName: student.full_name,
              phone: studentPhone,
              status: 'FAILED',
              error: sendRes.error,
            });
          }
        }

        // Update session summary and status
        await session.update({
          status: 'COMPLETED',
          summary: {
            total_enrolled: batchResult.totalEnrolled,
            present: batchResult.presentCount,
            late: 0,
            absent: batchResult.absentCount,
          },
        });

        results.push(batchResult);
      }
    } catch (error: any) {
      console.error('[AbsenceAlertService] Error processing absentee notifications:', error);
    } finally {
      this.isProcessing = false;
    }

    return results;
  }
}

export const absenceAlertService = new AbsenceAlertService();
export default absenceAlertService;
