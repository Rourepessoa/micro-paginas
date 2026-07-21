const crypto = require('crypto');
const express = require('express');
const bcrypt = require('bcryptjs');
const { pool } = require('../db');
const { authLimiter } = require('../middleware/rateLimit');
const { requireAuth } = require('../middleware/auth');
const { sendVerificationEmail } = require('../utils/mailer');
const {
  isValidUsername,
  isValidEmail,
  isValidPassword,
} = require('../utils/validation');

const router = express.Router();

const MAX_FAILED_ATTEMPTS = 8;
const LOCK_DURATION_SECONDS = 15 * 60;
const VERIFICATION_TOKEN_TTL_SECONDS = 24 * 60 * 60;

function publicUser(user) {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    displayName: user.display_name,
    bio: user.bio,
    avatarUrl: user.avatar_url,
    theme: user.theme,
    emailVerified: Boolean(user.email_verified),
  };
}

function hashToken(rawToken) {
  return crypto.createHash('sha256').update(rawToken).digest('hex');
}

// Gera um novo token de verificação para o usuário, salva o hash no banco
// (o token bruto nunca é persistido) e dispara o email com o link.
async function issueVerificationToken(user) {
  const rawToken = crypto.randomBytes(32).toString('hex');
  const expires = Math.floor(Date.now() / 1000) + VERIFICATION_TOKEN_TTL_SECONDS;

  await pool.query('UPDATE users SET verification_token = $1, verification_token_expires = $2 WHERE id = $3', [
    hashToken(rawToken),
    expires,
    user.id,
  ]);

  return sendVerificationEmail(user.email, rawToken, user.username);
}

router.post('/register', authLimiter, async (req, res, next) => {
  try {
    const { username, email, password, displayName } = req.body || {};

    if (!isValidUsername(username)) {
      return res.status(400).json({
        error: 'Nome de usuário inválido. Use 3-30 caracteres: letras minúsculas, números, - ou _.',
      });
    }
    if (!isValidEmail(email)) {
      return res.status(400).json({ error: 'Email inválido.' });
    }
    if (!isValidPassword(password)) {
      return res.status(400).json({ error: 'A senha deve ter entre 8 e 200 caracteres.' });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const normalizedUsername = username.trim().toLowerCase();

    const { rows: existingRows } = await pool.query(
      'SELECT id FROM users WHERE username = $1 OR email = $2',
      [normalizedUsername, normalizedEmail]
    );
    if (existingRows[0]) {
      return res.status(409).json({ error: 'Usuário ou email já cadastrado.' });
    }

    const passwordHash = bcrypt.hashSync(password, 12);
    const safeDisplayName = typeof displayName === 'string' ? displayName.trim().slice(0, 80) : normalizedUsername;

    const { rows } = await pool.query(
      `INSERT INTO users (username, email, password_hash, display_name)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [normalizedUsername, normalizedEmail, passwordHash, safeDisplayName]
    );
    const user = rows[0];

    // Não bloqueia o cadastro se o envio do email falhar (ex: SMTP fora do ar);
    // o usuário pode reenviar depois pelo painel.
    issueVerificationToken(user).catch((err) => console.error('Falha ao enviar email de verificação:', err));

    req.session.regenerate((err) => {
      if (err) return res.status(500).json({ error: 'Erro ao criar sessão.' });
      req.session.userId = user.id;
      res.status(201).json({ user: publicUser(user) });
    });
  } catch (err) {
    next(err);
  }
});

router.post('/login', authLimiter, async (req, res, next) => {
  try {
    const { emailOrUsername, password } = req.body || {};

    if (typeof emailOrUsername !== 'string' || typeof password !== 'string') {
      return res.status(400).json({ error: 'Credenciais inválidas.' });
    }

    const key = emailOrUsername.trim().toLowerCase();
    const { rows } = await pool.query('SELECT * FROM users WHERE username = $1 OR email = $1', [key]);
    const user = rows[0];

    // Mensagem genérica para não revelar se o usuário existe.
    const genericError = { error: 'Email/usuário ou senha incorretos.' };

    if (!user) return res.status(401).json(genericError);

    const now = Math.floor(Date.now() / 1000);
    if (user.locked_until && Number(user.locked_until) > now) {
      const waitMin = Math.ceil((Number(user.locked_until) - now) / 60);
      return res.status(423).json({ error: `Conta bloqueada temporariamente. Tente novamente em ${waitMin} min.` });
    }

    const ok = bcrypt.compareSync(password, user.password_hash);
    if (!ok) {
      const failedCount = user.failed_login_count + 1;
      let lockedUntil = null;
      if (failedCount >= MAX_FAILED_ATTEMPTS) {
        lockedUntil = now + LOCK_DURATION_SECONDS;
      }
      await pool.query('UPDATE users SET failed_login_count = $1, locked_until = $2 WHERE id = $3', [
        failedCount,
        lockedUntil,
        user.id,
      ]);
      return res.status(401).json(genericError);
    }

    await pool.query('UPDATE users SET failed_login_count = 0, locked_until = NULL WHERE id = $1', [user.id]);

    req.session.regenerate((err) => {
      if (err) return res.status(500).json({ error: 'Erro ao criar sessão.' });
      req.session.userId = user.id;
      res.json({ user: publicUser(user) });
    });
  } catch (err) {
    next(err);
  }
});

router.post('/logout', requireAuth, (req, res) => {
  req.session.destroy((err) => {
    if (err) return res.status(500).json({ error: 'Erro ao encerrar sessão.' });
    res.clearCookie('connect.sid');
    res.json({ ok: true });
  });
});

router.get('/me', async (req, res, next) => {
  try {
    if (!req.session || !req.session.userId) {
      return res.json({ user: null });
    }
    const { rows } = await pool.query('SELECT * FROM users WHERE id = $1', [req.session.userId]);
    if (!rows[0]) return res.json({ user: null });
    res.json({ user: publicUser(rows[0]) });
  } catch (err) {
    next(err);
  }
});

router.post('/verify-email', authLimiter, async (req, res, next) => {
  try {
    const { token } = req.body || {};
    if (typeof token !== 'string' || !token) {
      return res.status(400).json({ error: 'Token inválido.' });
    }

    const now = Math.floor(Date.now() / 1000);
    const { rows } = await pool.query(
      'SELECT * FROM users WHERE verification_token = $1 AND verification_token_expires > $2',
      [hashToken(token), now]
    );
    const user = rows[0];

    if (!user) {
      return res.status(400).json({ error: 'Link de verificação inválido ou expirado.' });
    }

    await pool.query(
      'UPDATE users SET email_verified = true, verification_token = NULL, verification_token_expires = NULL WHERE id = $1',
      [user.id]
    );

    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

router.post('/resend-verification', authLimiter, requireAuth, async (req, res, next) => {
  try {
    const { rows } = await pool.query('SELECT * FROM users WHERE id = $1', [req.session.userId]);
    const user = rows[0];
    if (!user) return res.status(401).json({ error: 'Não autenticado.' });
    if (user.email_verified) {
      return res.json({ ok: true, alreadyVerified: true });
    }

    await issueVerificationToken(user);
    res.json({ ok: true });
  } catch (err) {
    console.error('Falha ao reenviar email de verificação:', err);
    res.status(502).json({ error: 'Não foi possível enviar o email agora. Tente novamente em instantes.' });
  }
});

module.exports = router;
