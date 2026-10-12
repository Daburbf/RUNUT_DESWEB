import nodemailer from 'nodemailer';
import { config } from '../config.js';

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;
  transporter = nodemailer.createTransport({
    host: config.mail.host,
    port: config.mail.port,
    secure: config.mail.secure,
    auth: { user: config.mail.user, pass: config.mail.pass },
  });
  return transporter;
}

export async function sendMail({ to, subject, text, html }) {
  if (!config.mail.configured) {
    throw new Error('SMTP belum dikonfigurasi (MAIL_HOST/MAIL_USER/MAIL_PASS).');
  }
  return getTransporter().sendMail({ from: config.mail.from, to, subject, text, html });
}
