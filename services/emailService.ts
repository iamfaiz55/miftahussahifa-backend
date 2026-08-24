import nodemailer from 'nodemailer';
import fs from 'fs/promises';
import path from 'path';

// Generate 6-digit OTP
export function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export class EmailService {
  private static transporter: nodemailer.Transporter | null = null;
  private static readonly STORAGE_DIR = process.env.FILE_STORAGE_DIR || './storage/certificates';

  // Initialize email transporter
  static async initialize(): Promise<void> {
    if (this.transporter) return;

    try {
      this.transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: false, // true for 465, false for other ports
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      });

      // Verify connection
      await this.transporter.verify();
      console.log('✅ Email service initialized successfully');
    } catch (error) {
      console.error('❌ Email service initialization failed:', error);
      throw error;
    }
  }

  // Send certificate email
  static async sendCertificateEmail(
    to: string,
    studentName: string,
    levelName: string,
    certificateNo: string,
    imagePath?: string,
    pdfPath?: string
  ): Promise<void> {
    try {
      await this.initialize();

      if (!this.transporter) {
        throw new Error('Email service not initialized');
      }

      const attachments: any[] = [];

      // Add image attachment if available
      if (imagePath) {
        const fullImagePath = imagePath.replace('/storage/certificates', this.STORAGE_DIR);
        try {
          const imageBuffer = await fs.readFile(fullImagePath);
          attachments.push({
            filename: `certificate_${certificateNo}.png`,
            content: imageBuffer,
            cid: 'certificate-image'
          });
        } catch (error) {
          console.warn('Could not attach certificate image:', error);
        }
      }

      // Add PDF attachment if available
      if (pdfPath) {
        const fullPdfPath = pdfPath.replace('/storage/certificates', this.STORAGE_DIR);
        try {
          const pdfBuffer = await fs.readFile(fullPdfPath);
          attachments.push({
            filename: `certificate_${certificateNo}.pdf`,
            content: pdfBuffer
          });
        } catch (error) {
          console.warn('Could not attach certificate PDF:', error);
        }
      }

      const mailOptions = {
        from: process.env.FROM_EMAIL || 'no-reply@universalguruji.com',
        to: to,
        subject: `🎓 Certificate Issued - ${levelName}`,
        html: this.generateCertificateEmailHTML(studentName, levelName, certificateNo, !!imagePath),
        attachments: attachments
      };

      const result = await this.transporter.sendMail(mailOptions);
      console.log('✅ Certificate email sent successfully:', result.messageId);
    } catch (error) {
      console.error('❌ Error sending certificate email:', error);
      throw error;
    }
  }

  // Send OTP email for password reset
  static async sendOTPEmail(
    to: string,
    otp: string,
    expirationMinutes: number
  ): Promise<void> {
    try {
      await this.initialize();

      if (!this.transporter) {
        throw new Error('Email service not initialized');
      }

      const mailOptions = {
        from: process.env.FROM_EMAIL || 'no-reply@universalguruji.com',
        to: to,
        subject: '🔐 Password Reset OTP - Universal Guruji',
        html: this.generateOTPEmailHTML(otp, expirationMinutes)
      };

      const result = await this.transporter.sendMail(mailOptions);
      console.log('✅ OTP email sent successfully:', result.messageId);
    } catch (error) {
      console.error('❌ Error sending OTP email:', error);
      throw error;
    }
  }

  // Send certificate request notification to admin
  static async sendAdminNotification(
    studentName: string,
    levelName: string,
    certificateNo: string,
    userEmail: string
  ): Promise<void> {
    try {
      await this.initialize();

      if (!this.transporter) {
        throw new Error('Email service not initialized');
      }

      const mailOptions = {
        from: process.env.FROM_EMAIL || 'no-reply@universalguruji.com',
        to: process.env.ADMIN_EMAIL || 'admin@universalguruji.com',
        subject: `📋 New Certificate Request - ${studentName}`,
        html: this.generateAdminNotificationHTML(studentName, levelName, certificateNo, userEmail)
      };

      const result = await this.transporter.sendMail(mailOptions);
      console.log('✅ Admin notification sent successfully:', result.messageId);
    } catch (error) {
      console.error('❌ Error sending admin notification:', error);
      throw error;
    }
  }

  // Generate certificate email HTML
  private static generateCertificateEmailHTML(
    studentName: string,
    levelName: string,
    certificateNo: string,
    hasImage: boolean
  ): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Certificate Issued - ${levelName}</title>
        <style>
          body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f4f4f4;
          }
          .container {
            background: white;
            padding: 30px;
            border-radius: 10px;
            box-shadow: 0 0 20px rgba(0,0,0,0.1);
          }
          .header {
            text-align: center;
            border-bottom: 3px solid #4CAF50;
            padding-bottom: 20px;
            margin-bottom: 30px;
          }
          .header h1 {
            color: #4CAF50;
            margin: 0;
            font-size: 28px;
          }
          .content {
            margin-bottom: 30px;
          }
          .certificate-info {
            background: #f8f9fa;
            padding: 20px;
            border-radius: 8px;
            border-left: 4px solid #4CAF50;
            margin: 20px 0;
          }
          .certificate-info h3 {
            margin-top: 0;
            color: #2c3e50;
          }
          .info-row {
            display: flex;
            justify-content: space-between;
            margin: 10px 0;
            padding: 8px 0;
            border-bottom: 1px solid #eee;
          }
          .info-label {
            font-weight: bold;
            color: #555;
          }
          .info-value {
            color: #333;
          }
          .footer {
            text-align: center;
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid #eee;
            color: #666;
            font-size: 14px;
          }
          .btn {
            display: inline-block;
            background: #4CAF50;
            color: white;
            padding: 12px 24px;
            text-decoration: none;
            border-radius: 5px;
            margin: 10px 5px;
            font-weight: bold;
          }
          .btn:hover {
            background: #45a049;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🎓 Certificate Issued!</h1>
            <p>Congratulations on completing your course!</p>
          </div>
          
          <div class="content">
            <p>Dear <strong>${studentName}</strong>,</p>
            
            <p>We are pleased to inform you that your certificate for <strong>${levelName}</strong> has been successfully generated and is ready for download.</p>
            
            <div class="certificate-info">
              <h3>📜 Certificate Details</h3>
              <div class="info-row">
                <span class="info-label">Student Name:</span>
                <span class="info-value">${studentName}</span>
              </div>
              <div class="info-row">
                <span class="info-label">Course Level:</span>
                <span class="info-value">${levelName}</span>
              </div>
              <div class="info-row">
                <span class="info-label">Certificate Number:</span>
                <span class="info-value">${certificateNo}</span>
              </div>
              <div class="info-row">
                <span class="info-label">Issue Date:</span>
                <span class="info-value">${new Date().toLocaleDateString('en-IN')}</span>
              </div>
            </div>
            
            <p>Your certificate has been attached to this email in both PNG and PDF formats. You can download and print it for your records.</p>
            
            <p>Thank you for choosing Universal Guruji for your learning journey!</p>
          </div>
          
          <div class="footer">
            <p>Best regards,<br>
            <strong>Universal Guruji Team</strong></p>
            <p>This is an automated message. Please do not reply to this email.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  // Generate OTP email HTML
  private static generateOTPEmailHTML(
    otp: string,
    expirationMinutes: number
  ): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Password Reset OTP</title>
        <style>
          body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f4f4f4;
          }
          .container {
            background: white;
            padding: 30px;
            border-radius: 10px;
            box-shadow: 0 0 20px rgba(0,0,0,0.1);
          }
          .header {
            text-align: center;
            border-bottom: 3px solid #2196f3;
            padding-bottom: 20px;
            margin-bottom: 30px;
          }
          .header h1 {
            color: #2196f3;
            margin: 0;
            font-size: 28px;
          }
          .otp-container {
            background: #e3f2fd;
            padding: 30px;
            border-radius: 10px;
            text-align: center;
            margin: 30px 0;
            border: 2px solid #2196f3;
          }
          .otp-code {
            font-size: 36px;
            font-weight: bold;
            color: #1976d2;
            letter-spacing: 8px;
            margin: 20px 0;
            padding: 20px;
            background: white;
            border-radius: 8px;
            border: 2px dashed #2196f3;
          }
          .warning {
            background: #fff3e0;
            padding: 15px;
            border-radius: 8px;
            border-left: 4px solid #ff9800;
            margin: 20px 0;
          }
          .footer {
            text-align: center;
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid #eee;
            color: #666;
            font-size: 14px;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🔐 Password Reset</h1>
            <p>Your OTP code is ready</p>
          </div>
          
          <div class="content">
            <p>You have requested to reset your password. Use the following OTP code to verify your identity:</p>
            
            <div class="otp-container">
              <h3>Your OTP Code</h3>
              <div class="otp-code">${otp}</div>
              <p>This code will expire in <strong>${expirationMinutes} minutes</strong></p>
            </div>
            
            <div class="warning">
              <h4>⚠️ Security Notice</h4>
              <p>• Never share this OTP with anyone</p>
              <p>• Universal Guruji will never ask for your OTP</p>
              <p>• If you didn't request this, please ignore this email</p>
            </div>
            
            <p>Enter this code in the verification page to continue with your password reset.</p>
          </div>
          
          <div class="footer">
            <p>Best regards,<br>
            <strong>Universal Guruji Team</strong></p>
            <p>This is an automated message. Please do not reply to this email.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  // Generate admin notification HTML
  private static generateAdminNotificationHTML(
    studentName: string,
    levelName: string,
    certificateNo: string,
    userEmail: string
  ): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>New Certificate Request</title>
        <style>
          body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f4f4f4;
          }
          .container {
            background: white;
            padding: 30px;
            border-radius: 10px;
            box-shadow: 0 0 20px rgba(0,0,0,0.1);
          }
          .header {
            text-align: center;
            border-bottom: 3px solid #ff9800;
            padding-bottom: 20px;
            margin-bottom: 30px;
          }
          .header h1 {
            color: #ff9800;
            margin: 0;
            font-size: 28px;
          }
          .request-info {
            background: #fff3e0;
            padding: 20px;
            border-radius: 8px;
            border-left: 4px solid #ff9800;
            margin: 20px 0;
          }
          .info-row {
            display: flex;
            justify-content: space-between;
            margin: 10px 0;
            padding: 8px 0;
            border-bottom: 1px solid #eee;
          }
          .info-label {
            font-weight: bold;
            color: #555;
          }
          .info-value {
            color: #333;
          }
          .action-required {
            background: #e3f2fd;
            padding: 15px;
            border-radius: 8px;
            border-left: 4px solid #2196f3;
            margin: 20px 0;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>📋 New Certificate Request</h1>
            <p>Action required for certificate approval</p>
          </div>
          
          <div class="request-info">
            <h3>📝 Request Details</h3>
            <div class="info-row">
              <span class="info-label">Student Name:</span>
              <span class="info-value">${studentName}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Course Level:</span>
              <span class="info-value">${levelName}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Student Email:</span>
              <span class="info-value">${userEmail}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Certificate Number:</span>
              <span class="info-value">${certificateNo}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Request Date:</span>
              <span class="info-value">${new Date().toLocaleDateString('en-IN')}</span>
            </div>
          </div>
          
          <div class="action-required">
            <h3>⚠️ Action Required</h3>
            <p>Please review this certificate request and verify the student's offline class completion before approving the certificate.</p>
            <p>You can approve or reject this request from the admin panel.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }
}
