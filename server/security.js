const crypto = require('node:crypto');

function isPlaceholder(value) {
  return typeof value !== 'string' || !value.trim() || /^(replace-with|your-|change-me|change-this)/i.test(value);
}

function allowedImageUrl(value) {
  if (typeof value !== 'string' || value.length > 2048) return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password;
  } catch { return false; }
}

function nasImageUrl(baseValue, relative) {
  const base = new URL(baseValue.endsWith('/') ? baseValue : `${baseValue}/`);
  if (!['http:', 'https:'].includes(base.protocol) || base.username || base.password || base.search || base.hash) {
    throw new Error('Invalid NAS base URL');
  }
  // Express has already decoded the route. Reject further encodings and URL syntax
  // so the upstream cannot decode a second traversal or reinterpret a separator.
  if (typeof relative !== 'string' || !relative || /[%\\?#\x00-\x1f\x7f]/.test(relative) ||
      relative.split('/').some((part) => !part || part === '.' || part === '..')) {
    throw new Error('Invalid image path');
  }
  if (!/\.(jpe?g|png|webp|gif|avif|tiff?)$/i.test(relative)) throw new Error('Unsupported image path');
  const target = new URL(relative.split('/').map(encodeURIComponent).join('/'), base);
  if (target.origin !== base.origin || !target.pathname.startsWith(base.pathname)) throw new Error('Invalid image path');
  return target.href;
}

function csrfProtection(allowedOrigins) {
  return (req, res, next) => {
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
    const token = req.get('X-CSRF-Token');
    const expected = req.session?.csrfToken;
    if (!allowedOrigins.includes(req.get('Origin')) || typeof token !== 'string' || !/^[a-f0-9]{64}$/.test(token) ||
        typeof expected !== 'string' || token.length !== expected.length ||
        !crypto.timingSafeEqual(Buffer.from(token), Buffer.from(expected))) {
      return res.status(403).json({ error: 'Invalid request origin or CSRF token' });
    }
    next();
  };
}

module.exports = { isPlaceholder, allowedImageUrl, nasImageUrl, csrfProtection };
