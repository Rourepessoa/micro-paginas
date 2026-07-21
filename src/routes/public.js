const express = require('express');
const { pool } = require('../db');
const { isValidUsername } = require('../utils/validation');

const router = express.Router();

router.get('/check-username/:username', async (req, res, next) => {
  try {
    const { username } = req.params;
    if (!isValidUsername(username)) return res.json({ available: false });
    const { rows } = await pool.query('SELECT id FROM users WHERE username = $1', [username.toLowerCase()]);
    res.json({ available: !rows[0] });
  } catch (err) {
    next(err);
  }
});

router.get('/u/:username', async (req, res, next) => {
  try {
    const { username } = req.params;
    if (!isValidUsername(username)) return res.status(404).json({ error: 'Página não encontrada.' });

    const { rows: userRows } = await pool.query(
      `SELECT id, username, display_name, bio, avatar_url, theme FROM users WHERE username = $1`,
      [username.toLowerCase()]
    );
    const user = userRows[0];

    if (!user) return res.status(404).json({ error: 'Página não encontrada.' });

    const { rows: links } = await pool.query(
      'SELECT id, title, url FROM links WHERE user_id = $1 ORDER BY position ASC, id ASC',
      [user.id]
    );

    const { rows: portfolio } = await pool.query(
      `SELECT id, title, description, url, image_url FROM portfolio_items
       WHERE user_id = $1 ORDER BY position ASC, id ASC`,
      [user.id]
    );

    res.json({
      profile: {
        username: user.username,
        displayName: user.display_name,
        bio: user.bio,
        avatarUrl: user.avatar_url,
        theme: user.theme,
      },
      links,
      portfolio,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
