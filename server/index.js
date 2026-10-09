/* Public photography API with authenticated admin mutations.
   Private runtime configuration belongs on the backend host; see SECURITY_SETUP.md.
*/

const fs = require('fs');
const path = require('path');
const crypto = require('node:crypto');
const { pipeline } = require('node:stream');
const { isPlaceholder, allowedImageUrl, nasImageUrl, csrfProtection } = require('./security');
const envLocalPath = path.resolve(__dirname, '..', '.env.local');
const envPath = path.resolve(__dirname, '..', '.env');
const envFile = fs.existsSync(envLocalPath) ? envLocalPath : envPath;
require('dotenv').config({ path: envFile });

const express = require('express');
const session = require('express-session');
const FileStore = require('session-file-store')(session);
const sharp = require('sharp');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const fetch = require('node-fetch');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const app = express();
const IS_PRODUCTION = process.env.NODE_ENV === 'production';
// If running behind a proxy (Render, Heroku, etc.) enable trust proxy so req.protocol and host are correct
app.set('trust proxy', IS_PRODUCTION ? 1 : false);
const PORT = process.env.PORT || 4000;

const NAS_BASE = process.env.NAS_BASE_URL;
const NAS_USER = process.env.NAS_USER;
const NAS_PASS = process.env.NAS_PASS;
const IMAGE_LIST_URL = process.env.IMAGE_LIST_URL;
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const GOOGLE_CALLBACK_URL = process.env.GOOGLE_CALLBACK_URL || 'http://localhost:4000/auth/google/callback';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';
const BACKEND_URL_ENV = process.env.BACKEND_URL || '';
const SESSION_SECRET = process.env.SESSION_SECRET;
const SESSION_COOKIE_NAME = 'connect.sid';
const ALLOWED_EMAILS = (process.env.GOOGLE_ALLOWED_EMAILS || '').split(',').map((email) => email.trim().toLowerCase()).filter(Boolean);

if (isPlaceholder(SESSION_SECRET) || SESSION_SECRET.length < 32) {
  throw new Error('Set SESSION_SECRET to a random secret of at least 32 characters on the backend host.');
}
if (IS_PRODUCTION) {
  for (const key of ['FRONTEND_URL', 'BACKEND_URL', 'GOOGLE_CALLBACK_URL']) {
    const url = new URL(process.env[key] || 'invalid');
    if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) throw new Error(`${key} must be an HTTPS URL`);
    if (key !== 'GOOGLE_CALLBACK_URL' && url.pathname !== '/') throw new Error(`${key} must be an origin without a path`);
  }
  for (const value of [NAS_BASE, IMAGE_LIST_URL].filter(Boolean)) {
    if (new URL(value).protocol !== 'https:') throw new Error('Production NAS and image-list URLs must use HTTPS');
  }
}
const ALLOWED_ORIGINS = [new URL(FRONTEND_URL).origin];

function logEvent(event, details = {}, level = 'info') {
  console[level](JSON.stringify({ timestamp: new Date().toISOString(), event, ...details }));
}

function getLogRoute(pathname) {
  if (pathname.startsWith('/api/admin/profiles/')) return '/api/admin/profiles/:profileId';
  if (pathname.startsWith('/api/admin/upload/')) return '/api/admin/upload/:profileId';
  if (pathname.startsWith('/api/profiles/')) return '/api/profiles/:profileId';
  if (pathname.startsWith('/uploads/')) return '/uploads/:profileId/:filename';
  if (pathname.startsWith('/images/')) return '/images/*';
  return pathname;
}

const GOOGLE_ENABLED = Boolean(GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET && !isPlaceholder(GOOGLE_CLIENT_ID) && !isPlaceholder(GOOGLE_CLIENT_SECRET));
if ((IS_PRODUCTION || GOOGLE_ENABLED) && (!GOOGLE_ENABLED || !ALLOWED_EMAILS.length || ALLOWED_EMAILS.some(isPlaceholder))) {
  throw new Error('Configure Google OAuth credentials and a nonempty GOOGLE_ALLOWED_EMAILS on the backend host.');
}

// Basic sanitizer to produce a filesystem-safe profile ID component
function sanitizeProfileId(id) {
  return String(id || '').replace(/[^A-Za-z0-9_-]/g, '').toLowerCase();
}

const DATA_DIR = path.resolve(process.env.DATA_DIR || path.join(__dirname, '..', 'data'));
const PROFILE_FILE = path.join(DATA_DIR, 'profiles.json');
fs.mkdirSync(DATA_DIR, { recursive: true });

if (!fs.existsSync(PROFILE_FILE)) {
  fs.writeFileSync(PROFILE_FILE, JSON.stringify({
    profiles: [{
      id: 'emma-johnson',
      name: 'Emma Johnson',
      category: 'portraits',
      description: 'Editorial and lifestyle portraits',
      coverImage: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=900&q=80',
      images: [
        { path: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=1200&q=80', title: 'Emma portrait 1' },
        { path: 'https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?auto=format&fit=crop&w=1200&q=80', title: 'Emma portrait 2' }
      ]
    }]
  }, null, 2));
}

function readProfiles() {
  try {
    const raw = fs.readFileSync(PROFILE_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed.profiles) ? parsed.profiles : [];
  } catch (err) {
    console.error('Failed reading profiles file:', err);
    return [];
  }
}

function writeProfiles(profiles) {
  fs.writeFileSync(PROFILE_FILE, JSON.stringify({ profiles }, null, 2));
}

// Basic security headers and rate limiting
app.use(helmet());
app.use(rateLimit({ windowMs: 60 * 1000, max: 120 })); // limit to 120 requests per minute per IP
app.use((req, res, next) => {
  const route = getLogRoute(req.path);
  const startedAt = Date.now();
  logEvent('http.request', { method: req.method, route });
  res.on('finish', () => {
    const details = {
      method: req.method,
      route,
      status: res.statusCode,
      durationMs: Date.now() - startedAt
    };
    logEvent('http.response', details, res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info');
  });
  next();
});

const sessionStore = new FileStore({
  path: path.join(DATA_DIR, 'sessions'),
  secret: SESSION_SECRET,
  ttl: 8 * 60 * 60,
  retries: 0,
  reapInterval: process.env.NODE_ENV === 'test' ? -1 : 3600,
  logFn: () => logEvent('session.store.error', {}, 'error')
});
app.use(session({
  name: SESSION_COOKIE_NAME,
  store: sessionStore,
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, secure: IS_PRODUCTION, sameSite: IS_PRODUCTION ? 'none' : 'lax', maxAge: 8 * 60 * 60 * 1000 }
}));
app.use(passport.initialize());
app.use(passport.session());

if (GOOGLE_ENABLED) {
  passport.use(new GoogleStrategy({
    clientID: GOOGLE_CLIENT_ID,
    clientSecret: GOOGLE_CLIENT_SECRET,
    callbackURL: GOOGLE_CALLBACK_URL,
    state: true
  }, (accessToken, refreshToken, profile, done) => {
    const email = profile.emails && profile.emails[0] ? profile.emails[0].value.toLowerCase() : '';
    if (!ALLOWED_EMAILS.includes(email) || profile._json?.email_verified !== true) {
      logEvent('auth.oauth.rejected', { reason: 'email_not_allowed' }, 'warn');
      return done(null, false, { message: 'Email not allowed' });
    }
    logEvent('auth.oauth.verified', { allowlistEnabled: ALLOWED_EMAILS.length > 0 });
    return done(null, {
      id: profile.id,
      email,
      displayName: profile.displayName,
      picture: profile.photos && profile.photos[0] ? profile.photos[0].value : null
    });
  }));

  passport.serializeUser((user, done) => done(null, user));
  passport.deserializeUser((user, done) => done(null, ALLOWED_EMAILS.includes(user.email) ? user : false));
} else {
  console.warn('Google OAuth is disabled because the local credentials are still placeholders. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to real values.');
}

if (!NAS_BASE && !IMAGE_LIST_URL) {
  console.warn('Warning: NAS_BASE_URL and IMAGE_LIST_URL are not configured. The server will serve a sample list only.');
}

app.use(function (req, res, next) {
  const origin = req.headers.origin;
  res.vary('Origin');
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else if (!origin) {
    res.setHeader('Access-Control-Allow-Origin', FRONTEND_URL);
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,X-CSRF-Token');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

app.use('/api', (req, res, next) => {
  if (req.path.startsWith('/auth') || req.path.startsWith('/admin')) res.set('Cache-Control', 'no-store');
  next();
});
app.use('/api', csrfProtection(ALLOWED_ORIGINS));
app.use(express.json({ limit: '100kb' }));
app.get('/api/auth/csrf', (req, res) => {
  if (!req.session.csrfToken) req.session.csrfToken = crypto.randomBytes(32).toString('hex');
  res.json({ csrfToken: req.session.csrfToken });
});

app.get('/api/auth/config', (req, res) => {
  return res.json({ googleEnabled: GOOGLE_ENABLED, frontendUrl: FRONTEND_URL });
});

app.get('/api/auth/user', (req, res) => {
  logEvent('auth.session.checked', { authenticated: Boolean(req.user) });
  if (!req.user) return res.json({ user: null });
  return res.json({ user: req.user });
});

app.post('/api/auth/logout', (req, res) => {
  logEvent('auth.logout.started', { authenticated: Boolean(req.user) });
  const destroySession = () => {
    req.session.destroy((error) => {
      res.clearCookie(SESSION_COOKIE_NAME, {
        path: '/',
        secure: IS_PRODUCTION,
        sameSite: IS_PRODUCTION ? 'none' : 'lax'
      });
      if (error) {
        logEvent('auth.logout.failed', { stage: 'session_destroy', message: error.message }, 'error');
        return res.status(500).json({ ok: false });
      }
      logEvent('auth.logout.completed');
      return res.json({ ok: true });
    });
  };

  if (typeof req.logout !== 'function') return destroySession();
  return req.logout((error) => {
    if (error) {
      logEvent('auth.logout.failed', { stage: 'passport_logout', message: error.message }, 'error');
      return res.status(500).json({ ok: false });
    }
    return destroySession();
  });
});

if (GOOGLE_ENABLED) {
  // Save an optional redirect path in the session before starting OAuth so we can
  // return the user to the original frontend route after successful login.
  app.get('/auth/google', (req, res, next) => {
    req.session.redirectTo = req.query.redirect || '/admin';
    logEvent('auth.oauth.started');
    passport.authenticate('google', { scope: ['profile', 'email'], prompt: 'select_account' })(req, res, next);
  });

  // Use passport to authenticate, then redirect to a success page on the frontend which will
  // forward the user to the intended path. On failure redirect to the public home page.
  app.get('/auth/google/callback', passport.authenticate('google', { failureRedirect: `${FRONTEND_URL}/?auth=failed` }), (req, res) => {
    logEvent('auth.oauth.completed', { authenticated: Boolean(req.user) });
    const redirectPath = req.session.redirectTo || '/admin/upload';
    delete req.session.redirectTo;
    // Ensure redirect is relative (prevent open redirect). Only allow paths starting with '/'.
    const safePath = (typeof redirectPath === 'string' && /^\/(?!\/)/.test(redirectPath) && !/[\\\r\n]/.test(redirectPath)) ? redirectPath : '/admin/upload';
    // Redirect to frontend success page with the intended path encoded
    res.redirect(`${FRONTEND_URL.replace(/\/$/, '')}/auth/success?redirect=${encodeURIComponent(safePath)}`);
  });
}

app.get('/api/profiles', (req, res) => {
  const category = req.query.category;
  const profiles = readProfiles();
  if (category) {
    const categoryProfiles = profiles.filter((profile) => profile.category === category);
    logEvent('profiles.listed', { category, count: categoryProfiles.length });
    return res.json(categoryProfiles);
  }
  logEvent('profiles.listed', { category: 'all', count: profiles.length });
  return res.json(profiles);
});

app.get('/api/profiles/:profileId', (req, res) => {
  const profile = readProfiles().find((item) => item.id === req.params.profileId);
  if (!profile) {
    logEvent('profiles.not_found', {}, 'warn');
    return res.status(404).json({ error: 'Profile not found' });
  }
  logEvent('profiles.detail.read', { category: profile.category, imageCount: (profile.images || []).length });
  return res.json(profile);
});

app.get('/api/admin/profiles', ensureAuthenticated, (req, res) => {
  const profiles = readProfiles();
  logEvent('admin.profiles.listed', { count: profiles.length });
  return res.json(profiles);
});

app.post('/api/admin/profiles', ensureAuthenticated, (req, res) => {
  const profile = req.body;
  if (!profile || typeof profile.id !== 'string' || !/^[a-z0-9_-]{1,100}$/.test(profile.id) ||
      typeof profile.name !== 'string' || !profile.name.trim() || profile.name.length > 200 ||
      !['portraits', 'landscapes', 'events', 'nature'].includes(profile.category) ||
      typeof profile.description !== 'string' || profile.description.length > 5000 ||
      !Array.isArray(profile.images) || profile.images.length || profile.coverImage) {
    return res.status(400).json({ error: 'Invalid project. Add photos through the upload endpoint.' });
  }

  const profiles = readProfiles();
  const existingIndex = profiles.findIndex((item) => item.id === profile.id);
  if (existingIndex > -1) return res.status(409).json({ error: 'A project with this ID already exists' });
  profiles.push({ id: profile.id, name: profile.name.trim(), category: profile.category, description: profile.description, coverImage: '', images: [] });
  writeProfiles(profiles);
  logEvent('admin.profile.saved', { category: profile.category, created: existingIndex === -1, profileCount: profiles.length });
  return res.json({ ok: true, profile });
});

const multer = require('multer');

// Simple middleware to ensure the user is authenticated via passport session
function ensureAuthenticated(req, res, next) {
  if (req.user && ALLOWED_EMAILS.includes(req.user.email)) return next();
  return res.status(401).json({ error: 'Unauthorized' });
}

app.post('/api/admin/profiles/:profileId/cover', ensureAuthenticated, (req, res) => {
  const profileId = sanitizeProfileId(req.params.profileId || '');
  const imagePath = req.body && req.body.imagePath;
  const profiles = readProfiles();
  const profile = profiles.find((item) => sanitizeProfileId(item.id) === profileId);

  if (!profile) return res.status(404).json({ error: 'Profile not found' });
  if (typeof imagePath !== 'string' || !(profile.images || []).some((image) => image.path === imagePath)) {
    return res.status(400).json({ error: 'Cover photo must be one of this project’s images' });
  }

  profile.coverImage = imagePath;
  writeProfiles(profiles);
  logEvent('admin.profile.cover_updated', { category: profile.category });
  return res.json({ ok: true, coverImage: profile.coverImage });
});

app.delete('/api/admin/profiles/:profileId', ensureAuthenticated, (req, res) => {
  const profileId = sanitizeProfileId(req.params.profileId || '');
  if (!profileId) return res.status(400).json({ error: 'Invalid profile ID' });

  const uploadsRoot = path.resolve(UPLOADS_ROOT);
  const profileDirectory = path.resolve(uploadsRoot, profileId);
  if (!profileDirectory.startsWith(`${uploadsRoot}${path.sep}`)) {
    return res.status(400).json({ error: 'Invalid profile path' });
  }

  const profiles = readProfiles();
  const profileIndex = profiles.findIndex((profile) => sanitizeProfileId(profile.id) === profileId);
  if (profileIndex === -1) {
    logEvent('admin.profile.delete.not_found', {}, 'warn');
    return res.status(404).json({ error: 'Profile not found' });
  }

  const [deletedProfile] = profiles.splice(profileIndex, 1);
  writeProfiles(profiles);
  fs.rmSync(profileDirectory, { recursive: true, force: true });
  logEvent('admin.profile.deleted', { category: deletedProfile.category, remainingProfiles: profiles.length });
  return res.json({ ok: true });
});

// Gallery images are public; upload and delete endpoints remain admin-only.
const UPLOADS_ROOT = path.resolve(process.env.UPLOADS_DIR || path.join(__dirname, '..', 'uploads'));

app.get('/uploads/:profileId/:filename', (req, res) => {
  const profileId = sanitizeProfileId(req.params.profileId || '');
  const filename = req.params.filename || '';

  // filename should be a simple name (no path separators)
  if (!/^[a-zA-Z0-9._-]+$/.test(filename)) return res.status(400).send('Invalid filename');

  const filePath = path.join(UPLOADS_ROOT, profileId, filename);
  const resolved = path.resolve(filePath);
  const uploadsResolved = path.resolve(UPLOADS_ROOT);

  // Prevent path traversal — resolved path must be inside uploads root
  if (!resolved.startsWith(`${uploadsResolved}${path.sep}`) || !/\.(jpe?g|png|webp|gif|avif|tiff?)$/i.test(filename)) return res.status(400).send('Invalid path');
  if (!fs.existsSync(resolved)) return res.status(404).send('Not found');

  res.set('Cache-Control', 'public, max-age=86400');
  res.set('Cross-Origin-Resource-Policy', 'cross-origin');
  return res.sendFile(resolved);
});

// Configure multer storage to place files under uploads/<profileId>/
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dest = path.join(UPLOADS_ROOT, '.pending');
    fs.mkdirSync(dest, { recursive: true });
    cb(null, dest);
  },
  filename: (req, file, cb) => {
    const safeName = `${crypto.randomUUID()}.upload`;
    cb(null, safeName);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024, files: 20, fields: 2, fieldSize: 50 * 1024, parts: 22 },
  fileFilter: (req, file, cb) => {
    if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif', 'image/tiff'].includes(file.mimetype)) {
      return cb(new Error('Only image files are allowed'), false);
    }
    cb(null, true);
  }
});

const uploadLimiter = rateLimit({ windowMs: 60 * 60 * 1000, max: 30 });
function requireProject(req, res, next) {
  if (!/^[a-z0-9_-]{1,100}$/.test(req.params.profileId) || !readProfiles().some((p) => p.id === req.params.profileId)) {
    return res.status(404).json({ error: 'Project not found' });
  }
  next();
}

async function validateUploads(req, res, next) {
  const files = req.files || [];
  const cleanup = () => {
    for (const file of files) {
      try { fs.unlinkSync(file.path); } catch (error) { if (error.code !== 'ENOENT') logEvent('upload.cleanup.failed', {}, 'error'); }
    }
  };
  // Never leave files behind after validation errors or an interrupted request.
  res.on('finish', () => { if (!req.uploadCommitted) cleanup(); });
  res.on('close', () => { if (!req.uploadCommitted) cleanup(); });
  try {
    const urls = req.body.urls ? JSON.parse(req.body.urls) : [];
    if (!Array.isArray(urls) || urls.length + files.length > 20 || !urls.every(allowedImageUrl) || !urls.length && !files.length) {
      throw new Error('Provide up to 20 photos or HTTPS image URLs');
    }
    const extensions = { jpeg: 'jpg', png: 'png', webp: 'webp', gif: 'gif', heif: 'avif', tiff: 'tiff' };
    for (const file of files) {
      const image = sharp(file.path, { limitInputPixels: 100000000, failOn: 'warning' });
      const metadata = await image.metadata();
      if (!extensions[metadata.format] || metadata.pages > 1 || (metadata.format === 'heif' && metadata.compression !== 'av1')) {
        throw new Error('Only single-frame JPEG, PNG, WebP, GIF, AVIF, and TIFF photos are supported');
      }
      // Decode the original to catch corrupted/forged images without changing stored bytes.
      await image.stats();
      file.validatedExtension = extensions[metadata.format];
    }
    if (req.aborted || res.destroyed) throw new Error('Upload interrupted');
    const destination = path.join(UPLOADS_ROOT, req.params.profileId);
    fs.mkdirSync(destination, { recursive: true });
    for (const file of files) {
      file.filename = `${crypto.randomUUID()}.${file.validatedExtension}`;
      const published = path.join(destination, file.filename);
      fs.renameSync(file.path, published);
      file.path = published;
    }
    next();
  } catch (error) {
    cleanup();
    if (!res.destroyed) res.status(400).json({ error: 'Invalid upload. Use up to 20 valid, single-frame photos (10MB each) or HTTPS URLs.' });
  }
}

// New upload endpoint: accepts multipart/form-data with files named 'images' and an optional 'urls' JSON field
// IMPORTANT: ensureAuthenticated runs BEFORE multer so unauthenticated users cannot upload files.
app.post('/api/admin/upload/:profileId', ensureAuthenticated, uploadLimiter, requireProject, upload.array('images'), validateUploads, (req, res) => {
  const profileId = sanitizeProfileId(req.params.profileId || '');
  const profiles = readProfiles();
  const profile = profiles.find((item) => item.id === profileId);

  if (!profile) return res.status(404).json({ error: 'Profile not found' });

  // Files saved on disk
  const files = req.files || [];

  // Optional typed URLs sent as a JSON string field 'urls'
  let typedUrls = [];
  if (req.body && req.body.urls) {
    try {
      typedUrls = JSON.parse(req.body.urls);
    } catch (err) {
      // ignore parse errors
    }
  }

  // Build public URLs pointing to this backend (prefer BACKEND_URL env when set to handle proxies/CDNs)
  const origin = BACKEND_URL_ENV || 'http://localhost:4000';
  const mappedFromFiles = files.map((f) => ({
    path: `${origin.replace(/\/$/, '')}/uploads/${encodeURIComponent(sanitizeProfileId(profileId))}/${encodeURIComponent(f.filename)}`,
    title: f.originalname.replace(/\.[^.]+$/, '')
  }));

  const mappedFromUrls = (Array.isArray(typedUrls) ? typedUrls : []).map((u) => ({
    path: u,
    title: String(u).split('/').pop().replace(/\.[^.]+$/, '')
  }));

  const mappedImages = [...mappedFromFiles, ...mappedFromUrls];

  profile.images = [...(profile.images || []), ...mappedImages];
  const coverIndex = Number.parseInt(req.body && req.body.coverIndex, 10);
  if (Number.isInteger(coverIndex) && coverIndex >= 0 && coverIndex < mappedImages.length) {
    profile.coverImage = mappedImages[coverIndex].path;
  } else if (!profile.coverImage && mappedImages.length > 0) {
    profile.coverImage = mappedImages[0].path;
  }
  writeProfiles(profiles);

  req.uploadCommitted = true;
  logEvent('admin.images.uploaded', {
    category: profile.category,
    fileCount: files.length,
    totalBytes: files.reduce((total, file) => total + file.size, 0),
    urlCount: mappedFromUrls.length,
    imageCount: profile.images.length,
    coverImageSet: Boolean(profile.coverImage)
  });
  return res.json({ ok: true, message: `Added ${mappedImages.length} photo(s) to ${profile.name}` });
});

app.get('/api/images', async (req, res) => {
  const category = req.query.category;

  if (IMAGE_LIST_URL) {
    try {
      const r = await fetch(IMAGE_LIST_URL, { redirect: 'error', timeout: 15000, size: 2 * 1024 * 1024 });
      if (!r.ok) return res.status(502).send('Failed to fetch image list from IMAGE_LIST_URL');
      let list = await r.json();
      if (Array.isArray(list) && list.length && typeof list[0] === 'object' && Array.isArray(list[0].images)) {
        list = list.flatMap((profile) => (profile.images || []).map((image, index) => ({ ...image, category: profile.category || category, profileId: profile.id || index })));
      }
      if (category) list = list.filter((item) => item.category === category);
      return res.json(list);
    } catch (err) {
      console.error(err);
      return res.status(502).send('Error fetching image list');
    }
  }

  let sampleList = [
    { path: 'sample/portrait1.jpg', title: 'Sample Portrait 1', category: 'portraits' },
    { path: 'sample/portrait2.jpg', title: 'Sample Portrait 2', category: 'portraits' },
    { path: 'sample/landscape1.jpg', title: 'Sample Landscape 1', category: 'landscapes' },
    { path: 'sample/landscape2.jpg', title: 'Sample Landscape 2', category: 'landscapes' },
    { path: 'sample/event1.jpg', title: 'Sample Event 1', category: 'events' },
    { path: 'sample/nature1.jpg', title: 'Sample Nature 1', category: 'nature' }
  ];

  if (category) sampleList = sampleList.filter((item) => item.category === category);
  return res.json(sampleList);
});

app.get('/images/*', async (req, res) => {
  if (!NAS_BASE) return res.status(500).send('NAS_BASE_URL not configured');
  const rel = req.params[0];
  let targetUrl;
  try { targetUrl = nasImageUrl(NAS_BASE, rel); }
  catch { return res.status(400).send('Invalid image path'); }
  const headers = {};
  if (NAS_USER && NAS_PASS) headers.Authorization = 'Basic ' + Buffer.from(`${NAS_USER}:${NAS_PASS}`).toString('base64');

  try {
    const upstream = await fetch(targetUrl, { headers, redirect: 'error', timeout: 15000 });
    if (!upstream.ok) return res.status(upstream.status).send('Upstream returned ' + upstream.status);

    const contentType = upstream.headers.get('content-type');
    const contentLength = upstream.headers.get('content-length');
    const lastModified = upstream.headers.get('last-modified');

    if (!/^image\/(jpeg|png|webp|gif|avif|tiff)(;|$)/i.test(contentType || '')) {
      upstream.body.destroy();
      return res.status(415).send('Unsupported image type');
    }

    if (contentType) res.set('Content-Type', contentType);
    if (contentLength) res.set('Content-Length', contentLength);
    if (lastModified) res.set('Last-Modified', lastModified);
    res.set('Cache-Control', 'public, max-age=31536000, immutable');
    res.set('Cross-Origin-Resource-Policy', 'cross-origin');
    pipeline(upstream.body, res, (error) => { if (error) logEvent('image.stream.failed', {}, 'warn'); });
  } catch (err) {
    console.error('Proxy error', err);
    res.status(502).send('Proxy error');
  }
});

app.use((error, req, res, next) => {
  if (res.headersSent) return next(error);
  logEvent('request.failed', { errorName: error.name }, 'error');
  const status = error instanceof multer.MulterError || error.message === 'Only image files are allowed' ? 400 : error.status || 500;
  res.status(status).json({ error: status === 500 ? 'Request failed' : 'Invalid request or upload limit exceeded' });
});

if (require.main === module) app.listen(PORT, IS_PRODUCTION ? '0.0.0.0' : '127.0.0.1', () => {
  logEvent('server.started', {
    port: Number(PORT),
    environment: process.env.NODE_ENV || 'development',
    googleEnabled: GOOGLE_ENABLED,
    imageListConfigured: Boolean(IMAGE_LIST_URL),
    nasConfigured: Boolean(NAS_BASE)
  });
});

module.exports = { app, sessionStore };
