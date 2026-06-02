import { randomBytes } from "crypto";
import { sendEmail as sendReplitEmail } from "./replitmail";

export interface EmailOptions {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

export async function sendEmail(options: EmailOptions): Promise<boolean> {
  try {
    console.log(`[email] 📧 Sending email to: ${options.to}`);
    console.log(`[email] 📝 Subject: ${options.subject}`);
    
    const result = await sendReplitEmail({
      to: options.to,
      subject: options.subject,
      text: options.text,
      html: options.html,
    });
    
    console.log(`[email] ✅ Email sent successfully to: ${result.accepted.join(', ')}`);
    console.log(`[email] 📬 Message ID: ${result.messageId}`);
    
    return true;
  } catch (error) {
    console.error(`[email] ❌ Failed to send email:`, error);
    throw error;
  }
}

export function generateVerificationEmailHtml(username: string, verificationUrl: string): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Verify Your Email</title>
    </head>
    <body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f4f4f4;">
      <table role="presentation" style="width: 100%; border-collapse: collapse;">
        <tr>
          <td style="padding: 40px 0; text-align: center;">
            <table role="presentation" style="width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
              <tr>
                <td style="padding: 40px;">
                  <h1 style="color: #333333; margin: 0 0 20px 0; font-size: 28px;">Welcome to AmourScans!</h1>
                  <p style="color: #666666; font-size: 16px; line-height: 1.5; margin: 0 0 20px 0;">
                    Hi ${username},
                  </p>
                  <p style="color: #666666; font-size: 16px; line-height: 1.5; margin: 0 0 30px 0;">
                    Thank you for signing up! Please verify your email address to activate your account and start reading your favorite manga.
                  </p>
                  <a href="${verificationUrl}" style="display: inline-block; padding: 14px 32px; background-color: #7c3aed; color: #ffffff; text-decoration: none; border-radius: 4px; font-size: 16px; font-weight: bold;">
                    Verify Email Address
                  </a>
                  <p style="color: #999999; font-size: 14px; line-height: 1.5; margin: 30px 0 0 0;">
                    If the button doesn't work, copy and paste this link into your browser:<br>
                    <a href="${verificationUrl}" style="color: #7c3aed; word-break: break-all;">${verificationUrl}</a>
                  </p>
                  <p style="color: #999999; font-size: 14px; line-height: 1.5; margin: 20px 0 0 0;">
                    This link will expire in 24 hours.
                  </p>
                  <p style="color: #999999; font-size: 14px; line-height: 1.5; margin: 20px 0 0 0;">
                    If you didn't create an account on AmourScans, you can safely ignore this email.
                  </p>
                </td>
              </tr>
              <tr>
                <td style="padding: 20px; background-color: #f8f8f8; border-radius: 0 0 8px 8px; text-align: center;">
                  <p style="color: #999999; font-size: 12px; margin: 0;">
                    © ${new Date().getFullYear()} AmourScans. All rights reserved.
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;
}

export function generatePasswordResetEmailHtml(username: string, resetUrl: string): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Reset Your Password</title>
    </head>
    <body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f4f4f4;">
      <table role="presentation" style="width: 100%; border-collapse: collapse;">
        <tr>
          <td style="padding: 40px 0; text-align: center;">
            <table role="presentation" style="width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
              <tr>
                <td style="padding: 40px;">
                  <h1 style="color: #333333; margin: 0 0 20px 0; font-size: 28px;">Reset Your Password</h1>
                  <p style="color: #666666; font-size: 16px; line-height: 1.5; margin: 0 0 20px 0;">
                    Hi ${username},
                  </p>
                  <p style="color: #666666; font-size: 16px; line-height: 1.5; margin: 0 0 30px 0;">
                    We received a request to reset your password. Click the button below to create a new password:
                  </p>
                  <a href="${resetUrl}" style="display: inline-block; padding: 14px 32px; background-color: #7c3aed; color: #ffffff; text-decoration: none; border-radius: 4px; font-size: 16px; font-weight: bold;">
                    Reset Password
                  </a>
                  <p style="color: #999999; font-size: 14px; line-height: 1.5; margin: 30px 0 0 0;">
                    If the button doesn't work, copy and paste this link into your browser:<br>
                    <a href="${resetUrl}" style="color: #7c3aed; word-break: break-all;">${resetUrl}</a>
                  </p>
                  <p style="color: #999999; font-size: 14px; line-height: 1.5; margin: 20px 0 0 0;">
                    This link will expire in 1 hour.
                  </p>
                  <p style="color: #e53e3e; font-size: 14px; line-height: 1.5; margin: 20px 0 0 0; font-weight: bold;">
                    If you didn't request a password reset, please ignore this email and your password will remain unchanged.
                  </p>
                </td>
              </tr>
              <tr>
                <td style="padding: 20px; background-color: #f8f8f8; border-radius: 0 0 8px 8px; text-align: center;">
                  <p style="color: #999999; font-size: 12px; margin: 0;">
                    © ${new Date().getFullYear()} AmourScans. All rights reserved.
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;
}
