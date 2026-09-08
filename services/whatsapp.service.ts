import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
  Browsers,
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
  pairingCode: string | null;
  phoneNumber: string | null;
  pushName: string | null;
  lastConnectedAt: Date | null;
  errorReason: string | null;
}

const AUTH_FOLDER = path.join(process.cwd(), '.baileys_auth');

class WhatsAppService {
  private sock: WASocket | null = null;
  private isInitializing: boolean = false;
  private pendingPairPhone: string | null = null;
  private reconnectTimer: any = null;
  private state: WhatsAppServiceState = {
    status: 'DISCONNECTED',
    qrCodeDataUrl: null,
    qrRaw: null,
    pairingCode: null,
    phoneNumber: null,
    pushName: null,
    lastConnectedAt: null,
    errorReason: null,
  };

  constructor() {
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

  public async initialize(pairPhoneNumber?: string): Promise<void> {
    if (pairPhoneNumber) {
      this.pendingPairPhone = pairPhoneNumber;
    }

    if (this.isInitializing) {
      console.log('[WhatsAppService] Initialization already in progress, skipping duplicate call.');
      return;
    }

    this.isInitializing = true;
    this.state.errorReason = null;

    if (this.state.status !== 'READY') {
      this.state.status = 'INITIALIZING';
    }

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    try {
      if (!fs.existsSync(AUTH_FOLDER)) {
        fs.mkdirSync(AUTH_FOLDER, { recursive: true });
      }

      // Clean up previous socket if existing
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
      } catch {}

      console.log('[WhatsAppService] Starting Baileys socket with Ubuntu Chrome profile...');

      this.sock = makeWASocket({
        version,
        auth: {
          creds: state.creds,
          keys: makeCacheableSignalKeyStore(state.keys, logger),
        },
        logger,
        printQRInTerminal: false,
        browser: Browsers.ubuntu('Chrome'),
        syncFullHistory: false,
        markOnlineOnConnect: false,
        generateHighQualityLinkPreview: false,
        connectTimeoutMs: 60000,
        keepAliveIntervalMs: 25000,
        emitOwnEvents: false,
        retryRequestDelayMs: 250,
        getMessage: async () => undefined,
      });

      this.sock.ev.on('creds.update', saveCreds);

      // Request pairing code if requested and device not yet registered
      if (this.pendingPairPhone && !this.sock.authState.creds.registered) {
        let cleanPhone = this.pendingPairPhone.replace(/\D/g, '');
        if (cleanPhone.length === 10) cleanPhone = '91' + cleanPhone;

        setTimeout(async () => {
          try {
            if (this.sock && !this.sock.authState.creds.registered) {
              const code = await this.sock.requestPairingCode(cleanPhone);
              console.log('[WhatsAppService] Generated 8-digit Pairing Code:', code);
              this.state.pairingCode = code;
              this.state.status = 'SCAN_QR';
            }
          } catch (codeErr: any) {
            console.error('[WhatsAppService] Failed to request pairing code:', codeErr);
          }
        }, 1500);
      }

      this.sock.ev.on('connection.update', async (update: Partial<ConnectionState>) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr && !this.pendingPairPhone) {
          console.log('[WhatsAppService] New QR code generated');
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
          console.log('[WhatsAppService] WhatsApp Web is READY and connected!');
          this.state.status = 'READY';
          this.state.errorReason = null;
          this.state.lastConnectedAt = new Date();
          this.state.qrCodeDataUrl = null;
          this.state.qrRaw = null;
          this.state.pairingCode = null;
          this.pendingPairPhone = null;

          const rawId = this.sock?.user?.id || '';
          this.state.phoneNumber = rawId.split(':')[0] || rawId.split('@')[0] || null;
          this.state.pushName = this.sock?.user?.name || 'Miftahussahifa OS';
        }

        if (connection === 'close') {
          const statusCode = (lastDisconnect?.error as any)?.output?.statusCode;
          const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

          console.warn('[WhatsAppService] Connection closed. StatusCode:', statusCode, 'Should reconnect:', shouldReconnect);

          if (statusCode === DisconnectReason.loggedOut) {
            console.log('[WhatsAppService] Logged out from phone. Resetting session...');
            this.state.status = 'DISCONNECTED';
            this.state.phoneNumber = null;
            this.state.pushName = null;
            this.state.qrCodeDataUrl = null;
            this.state.qrRaw = null;
            this.state.pairingCode = null;
            this.pendingPairPhone = null;
            this.state.errorReason = 'Logged out from device.';
            this.clearAuthFiles();
            this.sock = null;
          } else if (shouldReconnect) {
            // Reconnect immediately (handles 515 RestartRequired after entering pairing code)
            console.log('[WhatsAppService] Automatically reconnecting socket to complete handshake...');
            this.isInitializing = false;
            this.reconnectTimer = setTimeout(() => {
              this.initialize();
            }, 1000);
          } else {
            this.state.status = 'DISCONNECTED';
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

  public clearAuthFiles() {
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
      if (this.reconnectTimer) {
        clearTimeout(this.reconnectTimer);
        this.reconnectTimer = null;
      }
      this.pendingPairPhone = null;

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
      this.state.pairingCode = null;
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
   */
  public async sendDirectMessage(rawPhone: string, messageText: string): Promise<{ success: boolean; messageId?: string; error?: string }> {
    if (!this.sock || this.state.status !== 'READY') {
      return {
        success: false,
        error: 'WhatsApp client is not connected. Please pair your WhatsApp device under Settings / WhatsApp.',
      };
    }

    try {
      let cleaned = (rawPhone || '').toString().replace(/\D/g, '');
      if (!cleaned) {
        return { success: false, error: 'Empty phone number provided.' };
      }

      if (cleaned.length === 10) {
        cleaned = '91' + cleaned;
      }

      const jid = `${cleaned}@s.whatsapp.net`;

      try {
        const [result] = await this.sock.onWhatsApp(jid);
        if (result && !result.exists) {
          console.warn(`[WhatsAppService] Phone number ${cleaned} is not registered on WhatsApp.`);
          return {
            success: false,
            error: `Phone number ${cleaned} is not registered on WhatsApp.`,
          };
        }
      } catch {}

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
