import type { Request, Response } from 'express';
import whatsappService from '../services/whatsapp.service.js';
import absenceAlertService from '../services/absenceAlert.service.js';
import { NotificationLog, Student, ClassSession, Batch } from '../models/index.js';

/**
 * Get current WhatsApp connection status & QR code
 */
export const getWhatsAppStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const state = whatsappService.getState();
    res.json({
      success: true,
      ...state,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Error fetching status' });
  }
};

/**
 * Start/initialize WhatsApp Web client (generate pairing QR)
 */
export const initializeWhatsApp = async (req: Request, res: Response): Promise<void> => {
  try {
    // Non-blocking initialization so response returns immediately
    whatsappService.initialize().catch((err) => {
      console.error('[WhatsAppController] Init error:', err);
    });

    res.json({
      success: true,
      message: 'WhatsApp Web client initialization started. QR will be generated shortly.',
      ...whatsappService.getState(),
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Failed to initialize' });
  }
};

/**
 * Logout/unlink WhatsApp session
 */
export const logoutWhatsApp = async (req: Request, res: Response): Promise<void> => {
  try {
    await whatsappService.logout();
    res.json({
      success: true,
      message: 'WhatsApp session disconnected successfully.',
      ...whatsappService.getState(),
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Failed to logout' });
  }
};

/**
 * Send a test WhatsApp message to verify connection
 */
export const sendTestMessage = async (req: Request, res: Response): Promise<void> => {
  try {
    const { phone, message } = req.body;
    if (!phone) {
      res.status(400).json({ success: false, message: 'Phone number is required.' });
      return;
    }

    const text =
      message ||
      `السَّلاَمُ عَلَيْكُمْ وَرَحْمَةُ اللهِ وَبَرَكَاتُهُ\n\nThis is a test notification from *Miftahussahifa Arabic Academy OS*.\nYour WhatsApp connection is active and working properly! ✨`;

    const result = await whatsappService.sendDirectMessage(phone, text);

    if (result.success) {
      res.json({
        success: true,
        message: `Test message sent successfully to ${phone}!`,
        messageId: result.messageId,
      });
    } else {
      res.status(400).json({
        success: false,
        message: result.error || 'Failed to send WhatsApp message.',
      });
    }
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Error sending test message' });
  }
};

/**
 * Trigger absentee check and WhatsApp alerts for today's batches
 */
export const triggerAbsenteeAlerts = async (req: Request, res: Response): Promise<void> => {
  try {
    const { batch_id } = req.body;
    const results = await absenceAlertService.checkAndNotifyFinishedBatches(batch_id ? Number(batch_id) : undefined);

    res.json({
      success: true,
      message: `Processed ${results.length} batches for absentee notifications.`,
      results,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Error triggering alerts' });
  }
};

/**
 * Get notification logs
 */
export const getNotificationLogs = async (req: Request, res: Response): Promise<void> => {
  try {
    const logs = await NotificationLog.findAll({
      limit: 50,
      order: [['createdAt', 'DESC']],
      include: [
        {
          model: Student,
          as: 'student',
          attributes: ['id', 'roll_number', 'full_name', 'phone_number', 'whatsapp_number'],
        },
      ],
    });

    res.json({
      success: true,
      total: logs.length,
      logs,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Error fetching notification logs' });
  }
};
