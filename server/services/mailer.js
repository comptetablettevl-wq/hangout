const nodemailer = require('nodemailer');
const { email: cfg } = require('../config');

let transporter = null;

const getTransporter = () => {
  if (transporter) return transporter;
  if (!cfg.host || !cfg.user || !cfg.pass) return null;
  transporter = nodemailer.createTransport({
    host: cfg.host, port: cfg.port, secure: cfg.secure,
    auth: { user: cfg.user, pass: cfg.pass },
  });
  return transporter;
};

const sendMail = async ({ to, subject, html, text }) => {
  const t = getTransporter();
  if (!t) {
    console.log(`[Mailer] DEV — Email non envoyé\nTo: ${to}\nSubject: ${subject}\n${text || ''}`);
    return { dev: true };
  }
  return t.sendMail({ from: cfg.from, to, subject, html, text });
};

module.exports = { sendMail };
