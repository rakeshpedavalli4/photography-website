/* Minimal image proxy server
   - Streams files from NAS_BASE_URL and preserves original bytes (no re-encoding)
   - Use .env to set NAS_BASE_URL, NAS_USER, NAS_PASS
   - Caution: in production put authentication and rate-limiting in front of this server
*/

const fs = require('fs');
const path = require('path');
const envLocalPath = path.resolve(__dirname, '..', '.env.local');
const envPath = path.resolve(__dirname, '..', '.env');
const envFile = fs.existsSync(envLocalPath) ? envLocalPath : envPath;
require('dotenv').config({ path: envFile });

const express = require('express');
const session = require('express-session');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const fetch = require('node-fetch');

const app = express();
const PORT = process.env.PORT || 4000;

const NAS_BASE = process.env.NAS_BASE_URL;
const NAS_USER = process.env.NAS_USER;
const NAS_PASS = process.env.NAS_PASS;
const IMAGE_LIST_URL = process.env.IMAGE_LIST_URL;
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const GOOGLE_CALLBACK_URL = process.env.GOOGLE_CALLBACK_URL || 'http://localhost:4000/auth/google/callback';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';
const SESSION_SECRET = process.env.SESSION_SECRET || 'change-me';
const ALLOWED_EMAILS = (process.env.GOOGLE_ALLOWED_EMAILS || '').split(',').map((email) => email.trim().toLowerCase()).filter(Boolean);

function isPlaceholder(value) {
  if (!value || typeof value !== 'string') return true;
  return ['your-google-client-id', 'your-google-client-secret', 'your-email@gmail.com', 'change-this-secret', 'your-nas-username', 'your-nas-password'].includes(value.trim().toLowerCase());
}

const GOOGLE_ENABLED = Boolean(GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET && !isPlaceholder(GOOGLE_CLIENT_ID) && !isPlaceholder(GOOGLE_CLIENT_SECRET));

const DATA_DIR = path.join(__dirname, '..', 'data');
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

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({ secret: SESSION_SECRET, resave: false, saveUninitialized: false, cookie: { secure: false } }));
app.use(passport.initialize());
app.use(passport.session());

if (GOOGLE_ENABLED) {
  passport.use(new GoogleStrategy({
    clientID: GOOGLE_CLIENT_ID,
    clientSecret: GOOGLE_CLIENT_SECRET,
    callbackURL: GOOGLE_CALLBACK_URL
  }, (accessToken, refreshToken, profile, done) => {
    const email = profile.emails && profile.emails[0] ? profile.emails[0].value.toLowerCase() : '';
    if (ALLOWED_EMAILS.length && !ALLOWED_EMAILS.includes(email)) {
      return done(null, false, { message: 'Email not allowed' });
    }
    return done(null, {
      id: profile.id,
      email,
      displayName: profile.displayName,
      picture: profile.photos && profile.photos[0] ? profile.photos[0].value : null
    });
  }));

  passport.serializeUser((user, done) => done(null, user));
  passport.deserializeUser((user, done) => done(null, user));
} else {
  console.warn('Google OAuth is disabled because the local credentials are still placeholders. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to real values.');
}

if (!NAS_BASE && !IMAGE_LIST_URL) {
  console.warn('Warning: NAS_BASE_URL and IMAGE_LIST_URL are not configured. The server will serve a sample list only.');
}

app.use(function (req, res, next) {
  const allowedOrigins = [FRONTEND_URL, 'http://localhost:5173'];
  const origin = req.headers.origin;
  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else if (!origin) {
    res.setHeader('Access-Control-Allow-Origin', FRONTEND_URL);
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

app.get('/api/auth/config', (req, res) => {
  return res.json({ googleEnabled: GOOGLE_ENABLED, frontendUrl: FRONTEND_URL });
});

app.get('/api/auth/user', (req, res) => {
  if (!req.user) return res.json({ user: null });
  return res.json({ user: req.user });
});

app.post('/api/auth/logout', (req, res) => {
  req.logout?.(() => {});
  req.session.destroy(() => res.json({ ok: true }));
});

if (GOOGLE_ENABLED) {
  app.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'], prompt: 'select_account' }));
  app.get('/auth/google/callback', passport.authenticate('google', {
    failureRedirect: `${FRONTEND_URL}/admin?auth=failed`,
    successRedirect: `${FRONTEND_URL}/admin`
  }));
}

app.get('/api/profiles', (req, res) => {
  const category = req.query.category;
  const profiles = readProfiles();
  if (category) {
    return res.json(profiles.filter((profile) => profile.category === category));
  }
  return res.json(profiles);
});

app.get('/api/profiles/:profileId', (req, res) => {
  const profile = readProfiles().find((item) => item.id === req.params.profileId);
  if (!profile) return res.status(404).json({ error: 'Profile not found' });
  return res.json(profile);
});

app.get('/api/admin/profiles', (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  return res.json(readProfiles());
});

app.post('/api/admin/profiles', (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  const profile = req.body;
  if (!profile || !profile.id || !profile.name) return res.status(400).json({ error: 'Invalid profile payload' });

  const profiles = readProfiles();
  const existingIndex = profiles.findIndex((item) => item.id === profile.id);
  if (existingIndex > -1) profiles[existingIndex] = profile;
  else profiles.push(profile);
  writeProfiles(profiles);
  return res.json({ ok: true, profile });
});

app.post('/api/admin/upload', (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });

  const { profileId, images } = req.body || {};
  if (!profileId || !Array.isArray(images)) return res.status(400).json({ error: 'profileId and images are required' });

  const profiles = readProfiles();
  const profile = profiles.find((item) => item.id === profileId);

  if (!profile) {
    return res.status(404).json({ error: 'Profile not found' });
  }

  const mappedImages = images.map((imagePath) => ({
    path: imagePath,
    title: imagePath.split('/').pop().replace(/\.[^.]+$/, '')
  }));

  profile.images = [...(profile.images || []), ...mappedImages];
  writeProfiles(profiles);

  return res.json({ ok: true, message: `Added ${mappedImages.length} photo(s) to ${profile.name}` });
});

app.get('/api/images', async (req, res) => {
  const category = req.query.category;

  if (IMAGE_LIST_URL) {
    try {
      const r = await fetch(IMAGE_LIST_URL);
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
  const targetUrl = (NAS_BASE.endsWith('/') ? NAS_BASE.slice(0,-1) : NAS_BASE) + '/' + rel;
  const headers = {};
  if (NAS_USER && NAS_PASS) headers.Authorization = 'Basic ' + Buffer.from(`${NAS_USER}:${NAS_PASS}`).toString('base64');

  try {
    const upstream = await fetch(targetUrl, { headers });
    if (!upstream.ok) return res.status(upstream.status).send('Upstream returned ' + upstream.status);

    const contentType = upstream.headers.get('content-type');
    const contentLength = upstream.headers.get('content-length');
    const lastModified = upstream.headers.get('last-modified');

    if (contentType) res.set('Content-Type', contentType);
    if (contentLength) res.set('Content-Length', contentLength);
    if (lastModified) res.set('Last-Modified', lastModified);
    res.set('Cache-Control', 'public, max-age=31536000, immutable');
    upstream.body.pipe(res);
  } catch (err) {
    console.error('Proxy error', err);
    res.status(502).send('Proxy error');
  }
});

app.listen(PORT, () => {
  console.log(`Image proxy server listening on port ${PORT}`);
});
