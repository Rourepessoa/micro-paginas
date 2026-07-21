const nodemailer = require('nodemailer');

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;
  const port = Number(process.env.SMTP_PORT) || 587;
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port,
    // Porta 465 usa TLS implícito; qualquer outra (587 é o padrão aqui)
    // usa STARTTLS. 465 fica sujeita a bloqueio por antivírus/firewall
    // que fazem inspeção de tráfego de email — 587 é mais confiável.
    secure: port === 465,
    requireTLS: port !== 465,
    // Alguns hosts (ex: containers do Render) resolvem smtp.gmail.com para
    // um endereço IPv6 mas não têm saída IPv6, causando ENETUNREACH.
    // Forçar IPv4 evita isso.
    family: 4,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
  return transporter;
}

function isConfigured() {
  return Boolean(process.env.SMTP_USER && process.env.SMTP_PASS);
}

async function sendVerificationEmail(to, token, username) {
  const appUrl = process.env.APP_URL || 'http://localhost:3000';
  const link = `${appUrl}/verify-email.html?token=${token}`;

  // Sem credenciais SMTP configuradas (dev local): não envia de verdade,
  // só imprime o link no console para permitir testar o fluxo.
  if (!isConfigured()) {
    console.log(`\n[email de verificação — modo dev, SMTP não configurado]\nPara: ${to}\nLink: ${link}\n`);
    return;
  }

  await getTransporter().sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to,
    subject: 'Confirme seu email — MicroPáginas',
    text: `Olá, ${username}!\n\nConfirme seu email clicando no link abaixo (válido por 24 horas):\n${link}\n\nSe você não criou uma conta no MicroPáginas, ignore este email.`,
    html: `
      <p>Olá, ${username}!</p>
      <p>Confirme seu email clicando no link abaixo (válido por 24 horas):</p>
      <p><a href="${link}">${link}</a></p>
      <p>Se você não criou uma conta no MicroPáginas, ignore este email.</p>
    `,
  });
}

module.exports = { sendVerificationEmail, isConfigured };
