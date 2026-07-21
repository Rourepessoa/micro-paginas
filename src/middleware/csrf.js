const { nanoid } = require('nanoid');

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

// Token de sessão (não visível via JS de outros sites) comparado com um
// header enviado explicitamente pelo front-end — protege contra CSRF
// porque um site malicioso não consegue ler nosso token de sessão nem
// forjar o header customizado em uma requisição cross-site simples.
function ensureCsrfToken(req, res, next) {
  if (!req.session.csrfToken) {
    req.session.csrfToken = nanoid(32);
  }
  next();
}

function verifyCsrfToken(req, res, next) {
  if (SAFE_METHODS.has(req.method)) return next();

  const sent = req.get('x-csrf-token');
  const expected = req.session && req.session.csrfToken;

  if (!sent || !expected || sent !== expected) {
    return res.status(403).json({ error: 'Token CSRF inválido ou ausente.' });
  }
  next();
}

module.exports = { ensureCsrfToken, verifyCsrfToken };
