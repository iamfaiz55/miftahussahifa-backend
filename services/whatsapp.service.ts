import pkg from 'whatsapp-web.js';
const { Client, LocalAuth } = pkg;
import qrcode from 'qrcode';
import path from 'path';
import fs from 'fs';
import { execSync } from 'child_process';

export type WhatsAppConnectionStatus = 'DISCONNECTED' | 'INITIALIZING' | 'SCAN_QR' | 'AUTHENTICATED' | 'READY';

function getChromeExecutablePath(): string | undefined {
  // 1. Try dynamic 'which' discovery on Linux/Unix systems
  try {
    const whichResult = execSync('which google-chrome || which google-chrome-stable || which chromium || which chromium-browser', {
      stdio: ['ignore', 'pipe', 'ignore'],
    })
      .toString()
      .trim();
    if (whichResult && fs.existsSync(whichResult)) {
      return whichResult;
    }
  } catch {}

  // 2. Try known explicit filesystem paths
  const paths = [
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium-browser',
    '/usr/bin/chromium',
    '/snap/bin/chromium',
    '/usr/local/bin/chromium',
    '/usr/local/bin/google-chrome',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  ];

  for (const p of paths) {
    if (fs.existsSync(p)) {
      return p;
    }
  }
  return undefined;
}

function cleanupSingletonLocks(dataPath: string) {
  try {
    // Kill any lingering orphan chrome processes on this session path
    try {
      execSync('pkill -f "Google Chrome.*\.wwebjs_auth" || pkill -f "chromium.*\.wwebjs_auth" || true', { stdio: 'ignore' });
    } catch {}

    const sessionDir = path.join(dataPath, 'session');
    if (fs.existsSync(sessionDir)) {
      const lockFiles = ['SingletonLock', 'SingletonCookie', 'SingletonSocket', 'DevToolsActivePort', 'LOCK'];
      for (const file of lockFiles) {
        const fullPath = path.join(sessionDir, file);
        if (fs.existsSync(fullPath)) {
          try {
            fs.unlinkSync(fullPath);
          } catch {}
        }
      }
    }
  } catch (err) {
    console.warn('[WhatsAppService] Lock cleanup warning:', err);
  }
}

interface WhatsAppServiceState {
  status: WhatsAppConnectionStatus;
  qrCodeDataUrl: string | null;
  qrRaw: string | null;
  phoneNumber: string | null;
  pushName: string | null;
  lastConnectedAt: Date | null;
  errorReason: string | null;
}

class WhatsAppService {
  private client: any = null;
  private state: WhatsAppServiceState = {
    status: 'DISCONNECTED',
    qrCodeDataUrl: null,
    qrRaw: null,
    phoneNumber: null,
    pushName: null,
    lastConnectedAt: null,
    errorReason: null,
  };

  constructor() {
    // Session state initialized
  }

  public getState(): WhatsAppServiceState {
    return { ...this.state };
  }

  public async initialize(): Promise<void> {
    // Reset state immediately so any status fetch gets clean INITIALIZING state
    this.state.status = 'INITIALIZING';
    this.state.errorReason = null;
    this.state.qrCodeDataUrl = null;
    this.state.qrRaw = null;

    // If an existing client is running, tear it down cleanly first
    if (this.client) {
      console.log('[WhatsAppService] Resetting existing client before fresh initialization...');
      try {
        await this.client.destroy();
      } catch (err) {
        console.warn('[WhatsAppService] Error destroying previous client instance:', err);
      }
      this.client = null;
    }

    try {
      console.log('[WhatsAppService] Starting WhatsApp Web client with LocalAuth...');

      const authDataPath = path.join(process.cwd(), '.wwebjs_auth');
      cleanupSingletonLocks(authDataPath);

      const chromePath = getChromeExecutablePath();
      if (chromePath) {
        console.log(`[WhatsAppService] Using system Chrome/Chromium binary at: ${chromePath}`);
      }

      this.client = new Client({
        authStrategy: new LocalAuth({
          dataPath: authDataPath,
        }),
        puppeteer: {
          headless: true,
          executablePath: chromePath,
          args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--single-process',
            '--disable-gpu',
            '--disable-software-rasterizer',
            '--disable-extensions',
            '--disable-default-apps',
            '--mute-audio',
          ],
        },
      });

      this.client.on('qr', async (qr: string) => {
        console.log('[WhatsAppService] New QR code generated for pairing (length:', qr.length, ')');
        this.state.status = 'SCAN_QR';
        this.state.errorReason = null;
        this.state.qrRaw = qr;
        try {
          this.state.qrCodeDataUrl = await qrcode.toDataURL(qr, {
            margin: 2,
            scale: 8,
            color: {
              dark: '#064e3b',
              light: '#ffffff',
            },
          });
        } catch (err) {
          console.error('[WhatsAppService] Failed to generate QR data URL:', err);
        }
      });

      this.client.on('authenticated', () => {
        console.log('[WhatsAppService] Client authenticated successfully');
        this.state.status = 'AUTHENTICATED';
        this.state.errorReason = null;
        this.state.qrCodeDataUrl = null;
        this.state.qrRaw = null;
      });

      this.client.on('auth_failure', (msg: string) => {
        console.error('[WhatsAppService] Authentication failure:', msg);
        this.state.status = 'DISCONNECTED';
        this.state.errorReason = `Authentication failed: ${msg}`;
        this.client = null;
      });

      this.client.on('ready', async () => {
        console.log('[WhatsAppService] WhatsApp Web is READY and connected!');
        this.state.status = 'READY';
        this.state.errorReason = null;
        this.state.lastConnectedAt = new Date();
        this.state.qrCodeDataUrl = null;
        this.state.qrRaw = null;

        try {
          const info = this.client.info;
          if (info) {
            this.state.phoneNumber = info.wid?.user || null;
            this.state.pushName = info.pushname || 'Miftahussahifa OS';
          }
        } catch (err) {
          console.warn('[WhatsAppService] Could not retrieve client info:', err);
        }
      });

      this.client.on('disconnected', (reason: string) => {
        console.warn('[WhatsAppService] Client disconnected:', reason);
        this.state.status = 'DISCONNECTED';
        this.state.errorReason = `Disconnected: ${reason}`;
        this.state.phoneNumber = null;
        this.state.pushName = null;
        this.client = null;
      });

      await this.client.initialize();
    } catch (error: any) {
      console.error('[WhatsAppService] Error initializing WhatsApp client:', error);
      this.state.status = 'DISCONNECTED';
      this.state.errorReason = error.message || 'Initialization failed';
      this.client = null;
    }
  }

  public async logout(): Promise<void> {
    try {
      if (this.client) {
        try {
          await this.client.logout();
        } catch (err) {
          console.warn('[WhatsAppService] client.logout() notice:', err);
        }
        try {
          await this.client.destroy();
        } catch (err) {
          console.warn('[WhatsAppService] client.destroy() notice:', err);
        }
        this.client = null;
      }

      this.state.status = 'DISCONNECTED';
      this.state.errorReason = null;
      this.state.qrCodeDataUrl = null;
      this.state.qrRaw = null;
      this.state.phoneNumber = null;
      this.state.pushName = null;

      // Clean session auth cache
      try {
        execSync('pkill -f "Google Chrome.*\.wwebjs_auth" || true', { stdio: 'ignore' });
      } catch {}

      const authPath = path.join(process.cwd(), '.wwebjs_auth');
      if (fs.existsSync(authPath)) {
        try {
          fs.rmSync(authPath, { recursive: true, force: true });
        } catch (rmErr) {
          console.warn('[WhatsAppService] Error clearing .wwebjs_auth directory:', rmErr);
        }
      }

      console.log('[WhatsAppService] Successfully unlinked session, destroyed browser, and cleared session cache.');
    } catch (err: any) {
      console.error('[WhatsAppService] Logout error:', err);
      this.client = null;
      this.state.status = 'DISCONNECTED';
      this.state.errorReason = null;
    }
  }

  /**
   * Send a direct WhatsApp text message to an adult student
   * @param rawPhone Mobile number (e.g. "9960669724" or "+919960669724")
   * @param messageText Formatted message text
   */
  public async sendDirectMessage(rawPhone: string, messageText: string): Promise<{ success: boolean; messageId?: string; error?: string }> {
    if (!this.client || this.state.status !== 'READY') {
      return {
        success: false,
        error: 'WhatsApp client is not connected. Please pair your WhatsApp device under Settings.',
      };
    }

    try {
      // Standardize phone number format
      let cleaned = (rawPhone || '').toString().replace(/\D/g, '');
      if (!cleaned) {
        return { success: false, error: 'Empty phone number provided.' };
      }

      // If Indian 10-digit number without country code, prepend 91
      if (cleaned.length === 10) {
        cleaned = '91' + cleaned;
      }

      const chatId = `${cleaned}@c.us`;

      // Attempt registration check safely
      try {
        if (typeof this.client.isRegisteredUser === 'function') {
          const isRegistered = await this.client.isRegisteredUser(chatId);
          if (isRegistered === false) {
            console.warn(`[WhatsAppService] Phone number ${cleaned} is not registered on WhatsApp.`);
            return {
              success: false,
              error: `Phone number ${cleaned} is not registered on WhatsApp.`,
            };
          }
        }
      } catch (checkErr) {
        console.warn('[WhatsAppService] isRegisteredUser check skipped:', checkErr);
      }

      const sentMsg = await this.client.sendMessage(chatId, messageText);
      const msgId = sentMsg?.id?._serialized || sentMsg?.id?.id || sentMsg?.id || 'SENT_OK';
      console.log(`[WhatsAppService] Successfully sent message to ${cleaned} (Msg ID: ${msgId})`);

      return {
        success: true,
        messageId: String(msgId),
      };
    } catch (error: any) {
      console.error('[WhatsAppService] Failed to send message:', error);
      return {
        success: false,
        error: error?.message || 'Failed to send WhatsApp message.',
      };
    }
  }
}

export const whatsappService = new WhatsAppService();
export default whatsappService;
