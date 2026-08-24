import { Router } from 'express';
import {
  getWhatsAppStatus,
  initializeWhatsApp,
  logoutWhatsApp,
  sendTestMessage,
  triggerAbsenteeAlerts,
  getNotificationLogs,
} from '../controllers/whatsapp.controller.js';
import { staffProtected } from '../middlewares/protected.js';

const router = Router();

// Connection & pairing status
router.get('/status', staffProtected, getWhatsAppStatus);
router.post('/initialize', staffProtected, initializeWhatsApp);
router.post('/logout', staffProtected, logoutWhatsApp);

// Messaging & testing
router.post('/test', staffProtected, sendTestMessage);
router.post('/trigger-absentee-alerts', staffProtected, triggerAbsenteeAlerts);

// Notification logs
router.get('/logs', staffProtected, getNotificationLogs);

export default router;
