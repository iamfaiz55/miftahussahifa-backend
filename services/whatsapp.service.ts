import pkg from 'whatsapp-web.js';
const { Client, LocalAuth } = pkg;
import qrcode from 'qrcode';
import path from 'path';
import fs from 'fs';

export type WhatsAppConnectionStatus = 'DISCONNECTED' | 'INITIALIZING' | 'SCAN_QR' | 'AUTHENTICATED' | 'READY';

function getChromeExecutablePath(): string | undefined {
  const paths = [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium-browser',
    '/usr/bin/chromium',
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
    if (this.client && (this.state.status === 'READY' || this.state.status === 'SCAN_QR' || this.state.status === 'INITIALIZING')) {
      console.log('[WhatsAppService] Client already initialized or in progress.');
      return;
    }

    try {
      this.state.status = 'INITIALIZING';
      this.state.errorReason = null;
      this.state.qrCodeDataUrl = null;
      this.state.qrRaw = null;

      console.log('[WhatsAppService] Starting WhatsApp Web client with LocalAuth...');

      const chromePath = getChromeExecutablePath();
      if (chromePath) {
        console.log(`[WhatsAppService] Using system Chrome at: ${chromePath}`);
      }

      this.client = new Client({
        authStrategy: new LocalAuth({
          dataPath: path.join(process.cwd(), '.wwebjs_auth'),
        }),
        webVersionCache: {
          type: 'remote',
          remotePath: 'https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/2.3000.1045443729-alpha.html',
        },
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
            '--disable-gpu',
            '--user-agent=Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
          ],
        },
      });

      this.client.on('qr', async (qr: string) => {
        console.log('[WhatsAppService] New QR code generated for pairing');
        this.state.status = 'SCAN_QR';
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
        this.state.qrCodeDataUrl = null;
        this.state.qrRaw = null;
      });

      this.client.on('auth_failure', (msg: string) => {
        console.error('[WhatsAppService] Authentication failure:', msg);
        this.state.status = 'DISCONNECTED';
        this.state.errorReason = `Auth failure: ${msg}`;
      });

      this.client.on('ready', async () => {
        console.log('[WhatsAppService] WhatsApp Web is READY and connected!');
        this.state.status = 'READY';
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
        } catch {}
        try {
          await this.client.destroy();
        } catch {}
        this.client = null;
      }
      this.state.status = 'DISCONNECTED';
      this.state.qrCodeDataUrl = null;
      this.state.qrRaw = null;
      this.state.phoneNumber = null;
      this.state.pushName = null;

      // Clean session auth cache
      const authPath = path.join(process.cwd(), '.wwebjs_auth');
      if (fs.existsSync(authPath)) {
        try {
          fs.rmSync(authPath, { recursive: true, force: true });
        } catch {}
      }

      console.log('[WhatsAppService] Logged out, destroyed client session, and cleared session cache.');
    } catch (err: any) {
      console.error('[WhatsAppService] Logout error:', err);
      this.client = null;
      this.state.status = 'DISCONNECTED';
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
