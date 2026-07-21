const express = require('express');
const { pool } = require('../db');
const { requireAuth } = require('../middleware/auth');
const { isSafeUrl, clampText, isValidUsername } = require('../utils/validation');

const router = express.Router();

const ALLOWED_THEMES = new Set(['default', 'dark', 'sunset', 'ocean', 'forest']);

router.use(requireAuth);

async function getUser(id) {
  const { rows } = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
  return rows[0];
}

// --- Perfil ---

router.put('/profile', async (req, res, next) => {
  try {
    const { displayName, bio, avatarUrl, theme } = req.body || {};

    const safeDisplayName = clampText(displayName, 80);
    const safeBio = clampText(bio, 280);
    const safeTheme = ALLOWED_THEMES.has(theme) ? theme : 'default';

    let safeAvatarUrl = '';
    if (avatarUrl) {
      if (!isSafeUrl(avatarUrl)) {
        return res.status(400).json({ error: 'URL de avatar inválida.' });
      }
      safeAvatarUrl = avatarUrl;
    }

    await pool.query(
      `UPDATE users SET display_name = $1, bio = $2, avatar_url = $3, theme = $4 WHERE id = $5`,
      [safeDisplayName, safeBio, safeAvatarUrl, safeTheme, req.session.userId]
    );

    const user = await getUser(req.session.userId);
    res.json({
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        displayName: user.display_name,
        bio: user.bio,
        avatarUrl: user.avatar_url,
        theme: user.theme,
      },
    });
  } catch (err) {
    next(err);
  }
});

// --- Links ---

router.get('/links', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM links WHERE user_id = $1 ORDER BY position ASC, id ASC',
      [req.session.userId]
    );
    res.json({ links: rows });
  } catch (err) {
    next(err);
  }
});

router.post('/links', async (req, res, next) => {
  try {
    const { title, url } = req.body || {};
    const safeTitle = clampText(title, 100).trim();
    if (!safeTitle) return res.status(400).json({ error: 'Título é obrigatório.' });
    if (!isSafeUrl(url)) return res.status(400).json({ error: 'URL inválida (use http:// ou https://).' });

    const { rows: maxRows } = await pool.query(
      'SELECT COALESCE(MAX(position), -1) AS m FROM links WHERE user_id = $1',
      [req.session.userId]
    );
    const maxPos = maxRows[0].m;

    const { rows } = await pool.query(
      'INSERT INTO links (user_id, title, url, position) VALUES ($1, $2, $3, $4) RETURNING *',
      [req.session.userId, safeTitle, url, maxPos + 1]
    );
    res.status(201).json({ link: rows[0] });
  } catch (err) {
    next(err);
  }
});

router.put('/links/:id', async (req, res, next) => {
  try {
    const { rows: linkRows } = await pool.query('SELECT * FROM links WHERE id = $1 AND user_id = $2', [
      req.params.id,
      req.session.userId,
    ]);
    const link = linkRows[0];
    if (!link) return res.status(404).json({ error: 'Link não encontrado.' });

    const { title, url, position } = req.body || {};
    const safeTitle = title !== undefined ? clampText(title, 100).trim() : link.title;
    if (!safeTitle) return res.status(400).json({ error: 'Título é obrigatório.' });

    let safeUrl = link.url;
    if (url !== undefined) {
      if (!isSafeUrl(url)) return res.status(400).json({ error: 'URL inválida.' });
      safeUrl = url;
    }
    const safePosition = Number.isInteger(position) ? position : link.position;

    await pool.query('UPDATE links SET title = $1, url = $2, position = $3 WHERE id = $4', [
      safeTitle,
      safeUrl,
      safePosition,
      link.id,
    ]);
    const { rows } = await pool.query('SELECT * FROM links WHERE id = $1', [link.id]);
    res.json({ link: rows[0] });
  } catch (err) {
    next(err);
  }
});

router.delete('/links/:id', async (req, res, next) => {
  try {
    const result = await pool.query('DELETE FROM links WHERE id = $1 AND user_id = $2', [
      req.params.id,
      req.session.userId,
    ]);
    if (result.rowCount === 0) return res.status(404).json({ error: 'Link não encontrado.' });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// --- Portfólio ---

router.get('/portfolio', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM portfolio_items WHERE user_id = $1 ORDER BY position ASC, id ASC',
      [req.session.userId]
    );
    res.json({ items: rows });
  } catch (err) {
    next(err);
  }
});

router.post('/portfolio', async (req, res, next) => {
  try {
    const { title, description, url, imageUrl } = req.body || {};
    const safeTitle = clampText(title, 100).trim();
    if (!safeTitle) return res.status(400).json({ error: 'Título é obrigatório.' });

    const safeDescription = clampText(description, 500);

    if (url && !isSafeUrl(url)) return res.status(400).json({ error: 'URL do projeto inválida.' });
    if (imageUrl && !isSafeUrl(imageUrl)) return res.status(400).json({ error: 'URL da imagem inválida.' });

    const { rows: maxRows } = await pool.query(
      'SELECT COALESCE(MAX(position), -1) AS m FROM portfolio_items WHERE user_id = $1',
      [req.session.userId]
    );
    const maxPos = maxRows[0].m;

    const { rows } = await pool.query(
      `INSERT INTO portfolio_items (user_id, title, description, url, image_url, position)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [req.session.userId, safeTitle, safeDescription, url || '', imageUrl || '', maxPos + 1]
    );
    res.status(201).json({ item: rows[0] });
  } catch (err) {
    next(err);
  }
});

router.put('/portfolio/:id', async (req, res, next) => {
  try {
    const { rows: itemRows } = await pool.query(
      'SELECT * FROM portfolio_items WHERE id = $1 AND user_id = $2',
      [req.params.id, req.session.userId]
    );
    const item = itemRows[0];
    if (!item) return res.status(404).json({ error: 'Item não encontrado.' });

    const { title, description, url, imageUrl, position } = req.body || {};
    const safeTitle = title !== undefined ? clampText(title, 100).trim() : item.title;
    if (!safeTitle) return res.status(400).json({ error: 'Título é obrigatório.' });

    const safeDescription = description !== undefined ? clampText(description, 500) : item.description;

    let safeUrl = item.url;
    if (url !== undefined) {
      if (url && !isSafeUrl(url)) return res.status(400).json({ error: 'URL inválida.' });
      safeUrl = url || '';
    }
    let safeImageUrl = item.image_url;
    if (imageUrl !== undefined) {
      if (imageUrl && !isSafeUrl(imageUrl)) return res.status(400).json({ error: 'URL de imagem inválida.' });
      safeImageUrl = imageUrl || '';
    }
    const safePosition = Number.isInteger(position) ? position : item.position;

    await pool.query(
      `UPDATE portfolio_items SET title = $1, description = $2, url = $3, image_url = $4, position = $5 WHERE id = $6`,
      [safeTitle, safeDescription, safeUrl, safeImageUrl, safePosition, item.id]
    );

    const { rows } = await pool.query('SELECT * FROM portfolio_items WHERE id = $1', [item.id]);
    res.json({ item: rows[0] });
  } catch (err) {
    next(err);
  }
});

router.delete('/portfolio/:id', async (req, res, next) => {
  try {
    const result = await pool.query('DELETE FROM portfolio_items WHERE id = $1 AND user_id = $2', [
      req.params.id,
      req.session.userId,
    ]);
    if (result.rowCount === 0) return res.status(404).json({ error: 'Item não encontrado.' });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// --- Utilidade: checar disponibilidade de username (autenticado, p/ trocar handle no futuro) ---
router.get('/username-available/:username', async (req, res, next) => {
  try {
    const { username } = req.params;
    if (!isValidUsername(username)) return res.json({ available: false });
    const { rows } = await pool.query('SELECT id FROM users WHERE username = $1', [username.toLowerCase()]);
    const existing = rows[0];
    res.json({ available: !existing || existing.id === req.session.userId });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
