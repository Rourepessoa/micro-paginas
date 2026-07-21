const USERNAME_RE = /^[a-z0-9_-]{3,30}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isValidUsername(username) {
  return typeof username === 'string' && USERNAME_RE.test(username);
}

function isValidEmail(email) {
  return typeof email === 'string' && email.length <= 254 && EMAIL_RE.test(email);
}

function isValidPassword(password) {
  return typeof password === 'string' && password.length >= 8 && password.length <= 200;
}

// Só permite http(s) para evitar esquemas perigosos como javascript: em links salvos pelo usuário.
function isSafeUrl(url) {
  if (typeof url !== 'string' || url.length > 2000) return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function clampText(value, maxLen) {
  if (typeof value !== 'string') return '';
  return value.slice(0, maxLen);
}

module.exports = {
  isValidUsername,
  isValidEmail,
  isValidPassword,
  isSafeUrl,
  clampText,
};
