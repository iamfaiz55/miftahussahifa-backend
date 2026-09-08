import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
  type WASocket,
  type ConnectionState,
} from '@whiskeysockets/baileys';
import pino from 'pino';
import qrcode from 'qrcode';
import path from 'path';
import fs from 'fs';

export type WhatsAppConnectionStatus = 'DISCONNECTED' | 'INITIALIZING' | 'SCAN_QR' | 'AUTHENTICATED' | 'READY';

interface WhatsAppServiceState {
  status: WhatsAppConnectionStatus;
  qrCodeDataUrl: string | null;
  qrRaw: string | null;
  phoneNumber: string | null;
  pushName: string | null;
  lastConnectedAt: Date | null;
  errorReason: string | null;
}

const AUTH_FOLDER = path.join(process.cwd(), '.baileys_auth');

class WhatsAppService {
  private sock: WASocket | null = null;
  private isInitializing: boolean = false;
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
    // If previous auth session exists, attempt passive restore on startup
    this.checkSavedSession();
  }

  private async checkSavedSession() {
    try {
      const credsPath = path.join(AUTH_FOLDER, 'creds.json');
      if (fs.existsSync(credsPath)) {
        console.log('[WhatsAppService] Found saved session in .baileys_auth, initializing...');
        await this.initialize();
      }
    } catch (err) {
      console.warn('[WhatsAppService] Session auto-restore notice:', err);
    }
  }

  public getState(): WhatsAppServiceState {
    return { ...this.state };
  }

  public async initialize(): Promise<void> {
    if (this.isInitializing) {
      console.log('[WhatsAppService] Initialization already in progress, skipping duplicate call.');
      return;
    }

    this.isInitializing = true;
    this.state.status = 'INITIALIZING';
    this.state.errorReason = null;
    this.state.qrCodeDataUrl = null;
    this.state.qrRaw = null;

    try {
      // Ensure auth directory exists
      if (!fs.existsSync(AUTH_FOLDER)) {
        fs.mkdirSync(AUTH_FOLDER, { recursive: true });
      }

      // Close previous socket if any
      if (this.sock) {
        try {
          this.sock.ev.removeAllListeners('connection.update');
          this.sock.ev.removeAllListeners('creds.update');
          this.sock.end(undefined);
        } catch {}
        this.sock = null;
      }

      const { state, saveCreds } = await useMultiFileAuthState(AUTH_FOLDER);
      const logger = pino({ level: 'silent' }) as any;

      let version: [number, number, number] | undefined = undefined;
      try {
        const vResult = await fetchLatestBaileysVersion();
        version = vResult.version;
      } catch {
        // Fallback to default Baileys version
      }

      console.log('[WhatsAppService] Creating Baileys pure WebSocket connection (Zero Chromium)...');

      this.sock = makeWASocket({
        version,
        auth: {
          creds: state.creds,
          keys: makeCacheableSignalKeyStore(state.keys, logger),
        },
        logger,
        printQRInTerminal: false,
        browser: ['Miftahussahifa OS', 'Chrome', '1.0.0'],
        connectTimeoutMs: 60000,
        keepAliveIntervalMs: 25000,
        emitOwnEvents: false,
        retryRequestDelayMs: 250,
      });

      this.sock.ev.on('creds.update', saveCreds);

      this.sock.ev.on('connection.update', async (update: Partial<ConnectionState>) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
          console.log('[WhatsAppService] New QR code generated for pairing');
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
        }

        if (connection === 'open') {
          console.log('[WhatsAppService] WhatsApp Web is READY and connected via WebSocket!');
          this.state.status = 'READY';
          this.state.errorReason = null;
          this.state.lastConnectedAt = new Date();
          this.state.qrCodeDataUrl = null;
          this.state.qrRaw = null;

          const rawId = this.sock?.user?.id || '';
          this.state.phoneNumber = rawId.split(':')[0] || rawId.split('@')[0] || null;
          this.state.pushName = this.sock?.user?.name || 'Miftahussahifa OS';
        }

        if (connection === 'close') {
          const statusCode = (lastDisconnect?.error as any)?.output?.statusCode;
          const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

          console.warn('[WhatsAppService] Connection closed. StatusCode:', statusCode, 'Should reconnect:', shouldReconnect);

          if (statusCode === DisconnectReason.loggedOut) {
            console.log('[WhatsAppService] User logged out from phone. Cleaning session...');
            this.state.status = 'DISCONNECTED';
            this.state.phoneNumber = null;
            this.state.pushName = null;
            this.state.qrCodeDataUrl = null;
            this.state.qrRaw = null;
            this.state.errorReason = 'Logged out from device.';
            this.clearAuthFiles();
            this.sock = null;
          } else {
            // Transient disconnect, will keep status or reconnect on next request
            if (this.state.status !== 'READY') {
              this.state.status = 'DISCONNECTED';
            }
          }
        }
      });
    } catch (error: any) {
      console.error('[WhatsAppService] Error initializing Baileys WhatsApp client:', error);
      this.state.status = 'DISCONNECTED';
      this.state.errorReason = error?.message || 'Initialization failed';
      this.sock = null;
    } finally {
      this.isInitializing = false;
    }
  }

  private clearAuthFiles() {
    try {
      if (fs.existsSync(AUTH_FOLDER)) {
        fs.rmSync(AUTH_FOLDER, { recursive: true, force: true });
      }
    } catch (err) {
      console.warn('[WhatsAppService] Error clearing auth files:', err);
    }
  }

  public async logout(): Promise<void> {
    try {
      if (this.sock) {
        try {
          await this.sock.logout();
        } catch {}
        try {
          this.sock.end(undefined);
        } catch {}
        this.sock = null;
      }

      this.clearAuthFiles();

      this.state.status = 'DISCONNECTED';
      this.state.errorReason = null;
      this.state.qrCodeDataUrl = null;
      this.state.qrRaw = null;
      this.state.phoneNumber = null;
      this.state.pushName = null;

      console.log('[WhatsAppService] Successfully unlinked session and cleared auth credentials.');
    } catch (err: any) {
      console.error('[WhatsAppService] Logout error:', err);
      this.sock = null;
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
    if (!this.sock || this.state.status !== 'READY') {
      return {
        success: false,
        error: 'WhatsApp client is not connected. Please pair your WhatsApp device under Settings / WhatsApp.',
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

      const jid = `${cleaned}@s.whatsapp.net`;

      // Check on WhatsApp presence
      try {
        const [result] = await this.sock.onWhatsApp(jid);
        if (result && !result.exists) {
          console.warn(`[WhatsAppService] Phone number ${cleaned} is not registered on WhatsApp.`);
          return {
            success: false,
            error: `Phone number ${cleaned} is not registered on WhatsApp.`,
          };
        }
      } catch (checkErr) {
        // Proceed even if check fails
      }

      const sentMsg = await this.sock.sendMessage(jid, { text: messageText });
      const msgId = sentMsg?.key?.id || 'SENT_OK';
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
