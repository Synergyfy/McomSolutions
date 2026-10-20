import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import axios from 'axios';

export interface SendMailInput {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

/**
 * Transactional email transport (Resend first, SMTP fallback).
 * Shared by coupon rewards and future non-OTP transactional mail.
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private smtpTransporter: nodemailer.Transporter | null = null;

  constructor(private readonly config: ConfigService) {}

  private fromAddress(): string {
    return (
      this.config.get<string>('SMTP_FROM') ||
      process.env.SMTP_FROM ||
      'Central Hub Solution <no-reply@centralhubsolution.com>'
    );
  }

  private resendApiKey(): string | undefined {
    const raw = this.config.get<string>('RESEND_API_KEY') || process.env.RESEND_API_KEY;
    const key = raw ? raw.replace(/['"\s]+/g, '') : undefined;
    return key || undefined;
  }

  private getSmtpTransporter(): nodemailer.Transporter | null {
    if (this.smtpTransporter) return this.smtpTransporter;

    const smtpHost = this.config.get<string>('SMTP_HOST');
    const smtpPort = this.config.get<string>('SMTP_PORT');
    const smtpUser = this.config.get<string>('SMTP_USER');
    const smtpPass = this.config.get<string>('SMTP_PASS')
      ? this.config.get<string>('SMTP_PASS')!.replace(/\s+/g, '')
      : undefined;

    if (!smtpHost || !smtpUser || !smtpPass) return null;

    this.smtpTransporter = nodemailer.createTransport({
      host: smtpHost,
      port: parseInt(smtpPort || '587', 10),
      secure: parseInt(smtpPort || '587', 10) === 465,
      auth: { user: smtpUser, pass: smtpPass },
    });
    return this.smtpTransporter;
  }

  async send(input: SendMailInput): Promise<void> {
    const from = this.fromAddress();
    const resendKey = this.resendApiKey();

    if (resendKey) {
      try {
        const response = await axios.post(
          'https://api.resend.com/emails',
          { from, to: [input.to], subject: input.subject, html: input.html },
          {
            headers: {
              Authorization: `Bearer ${resendKey}`,
              'Content-Type': 'application/json',
            },
            timeout: 10000,
          },
        );
        this.logger.log(
          `[Resend] Transactional email sent to ${input.to} (id=${response.data?.id ?? 'n/a'})`,
        );
        return;
      } catch (err: any) {
        this.logger.error(
          `[Resend] Failed to send email to ${input.to}: ${JSON.stringify(
            err.response?.data || err.message,
          )}`,
        );
      }
    }

    const transporter = this.getSmtpTransporter();
    if (!transporter) {
      throw new ServiceUnavailableException(
        'No email transport is configured. Please try again later.',
      );
    }

    try {
      await transporter.sendMail({
        from,
        to: input.to,
        subject: input.subject,
        text: input.text,
        html: input.html,
      });
      this.logger.log(`[SMTP Mailer] Transactional email sent to ${input.to}`);
    } catch (err) {
      this.logger.error('[SMTP Mailer] Failed to send transactional email:', err as any);
      throw new ServiceUnavailableException('Could not send email. Please try again later.');
    }
  }
}
