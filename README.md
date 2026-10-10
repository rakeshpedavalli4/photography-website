Photography site (starter scaffold)

Production deployment and security configuration: see [SECURITY_SETUP.md](SECURITY_SETUP.md). Netlify hosts the frontend; Render hosts the Express API. Configure private backend variables on Render, not Netlify. Node 24 is recommended.

This repository contains a Vite + React photography frontend and an Express API. Photos hosted on Cloudflare R2 use full public HTTPS URLs and load directly from Cloudflare. The backend also retains local uploads and an optional legacy NAS proxy.

Highlights / Goals
- Preserve original image bytes for web viewing and download (no automatic re-encoding by the proxy).
- Provide a responsive gallery that links directly to full-resolution R2 photos.
- Keep storage credentials on the backend only; do NOT commit real credentials.

Quick start (local development)
1. Copy and edit the environment file:
   cp .env.example .env
   Fill the backend session and login settings. Add full public R2 image URLs through the admin URL field. Optionally set IMAGE_LIST_URL to a JSON index with full image URLs. NAS variables are not needed for R2.

2. Install dependencies:
   npm install

3. Run the server and web app (dev):
   npm run dev

What the server does
- Full R2 URLs bypass the Express image proxy. Cache headers for these images come from Cloudflare/R2.
- File uploads in this checkout still save to local backend storage; automatic R2 uploads are not implemented.
- /images/* -> optional legacy NAS proxy, used only for relative NAS paths.
- /api/images -> if IMAGE_LIST_URL is set, the server will fetch it and return it to the web app. Otherwise the repo ships a small sample list.

Important notes on image fidelity and color
- Browsers may render color differently depending on color profile. For best cross-browser fidelity, ensure master files either use embedded ICC profiles (preferred) or are converted to sRGB using a high-quality tool (libvips or ImageMagick with careful flags).
- If you need smaller derivatives for responsive images, create them offline using libvips (vips resize/thumbnail) and keep originals in R2.
- Avoid automatic on-the-fly transcoding unless you carefully preserve ICC profiles and use a high-quality library (libvips is recommended). If you later add on-the-fly conversion, configure it to embed profiles and use lossless or very high-quality settings.

Google admin login (OIDC)
The admin area is protected by Google sign-in and only allows configured emails. To enable it:
1. Create a Google OAuth 2.0 Client ID in Google Cloud Console.
2. Add the redirect URI:
   http://localhost:4000/auth/google/callback
3. Set the following env vars using local-only values in `.env.local` or Render environment settings (not Netlify):
   GOOGLE_CLIENT_ID=replace-with-google-client-id
   GOOGLE_CLIENT_SECRET=replace-with-google-client-secret
   GOOGLE_CALLBACK_URL=http://localhost:4000/auth/google/callback
   GOOGLE_ALLOWED_EMAILS=your-email@example.com
   SESSION_SECRET=<a freshly generated random secret of at least 32 characters>
4. Restart the app and visit /admin.
5. The public site remains public; admin APIs require an explicitly allowed Google account, including during local development. Production also requires HTTPS frontend/backend/callback URLs; see SECURITY_SETUP.md.

Next steps (optional)
- Use an R2 custom domain for production image delivery and Cloudflare edge caching.
- Add authentication and access control to the proxy (JWT/OAuth) if you need per-user private albums.
- Add offline generation of web-optimized derivatives and store them next to originals.

Docs and credentials
- Use readme.io to host detailed credential setup instructions and to store non-sensitive operational docs. Keep secrets out of public docs and source control.

Netlify env safety
- EmailJS frontend values are intentionally public and can use the `VITE_` prefix: `VITE_EMAILJS_PUBLIC_KEY`, `VITE_EMAILJS_SERVICE_ID`, and `VITE_EMAILJS_TEMPLATE_ID`.
- Real secrets such as `GOOGLE_CLIENT_SECRET`, `NAS_PASS`, and `SESSION_SECRET` must stay server-side and must never use the `VITE_` prefix.
- If Netlify flags the EmailJS variables as possible secrets, add this to site settings to suppress the false positive:
  `SECRETS_SCAN_OMIT_KEYS=VITE_EMAILJS_PUBLIC_KEY,VITE_EMAILJS_SERVICE_ID,VITE_EMAILJS_TEMPLATE_ID,VITE_BACKEND_URL,GOOGLE_ALLOWED_EMAILS`
- `GOOGLE_ALLOWED_EMAILS` is excluded only because its current value is also the intentionally public contact email. This does not expose the backend allowlist to the frontend or change login authorization. If the allowlist later contains private addresses, remove this exception.
- The Netlify frontend does not need `GOOGLE_ALLOWED_EMAILS`, `SESSION_SECRET`, or `GOOGLE_CALLBACK_URL`. Keep those variables on the backend host and remove unnecessary copies from Netlify's environment settings. Secret scanning remains enabled for credentials.
- Keep `.env` and `.env.local` out of version control. Use Netlify variables only for public frontend values, Render variables for backend secrets, and ignored local files for development.

Files created
- server/index.js: tiny Express proxy server
- src/: Vite + React PWA frontend
- .env.example: backend configuration and optional image-source settings
- README.md: this file

If you'd like, proceed and I can:
- Install dependencies and run the dev server locally (requires confirmation), or
- Generate web-optimized derivative script using libvips to preserve color and quality.

## Caching

- **Current R2 delivery:** full image URLs use Cloudflare/R2 response headers, not the Express or Netlify cache rules below. For production edge caching, connect a custom domain to the R2 bucket; `r2.dev` is intended for development and does not provide Cloudflare edge caching. See [Cloudflare R2 public bucket documentation](https://developers.cloudflare.com/r2/buckets/public-buckets/).
- Set R2 object `Cache-Control` metadata to `public, max-age=31536000, immutable` only for unique/versioned photo filenames. For keys you overwrite, use `public, max-age=3600, must-revalidate`; configure Cloudflare rules to respect origin headers. Publishing a new filename is the reliable way to refresh browser copies immediately. These are recommended settings, not changes applied to your Cloudflare account.

- Netlify caches Vite's content-hashed `/assets/*` files for one year. The root page and `index.html` revalidate so new deployments can load new asset filenames.
- UUID-named uploads cache for one year with `immutable`; older, reusable filenames cache for one hour. Uploads must always get new filenames when their contents change.
- NAS photos cache for one hour, then forward ETag and Last-Modified validators to the NAS. A NAS 304 response avoids retransferring the image. Existing browser copies stored under the former one-year policy may require a new image URL to refresh immediately.
- Public API JSON revalidates on each request using Express ETags. Unchanged responses return 304; admin/auth responses use `no-store`.
- Parsed profiles are cached in server memory, checked against file metadata on each read, and invalidated after writes. Mutation handlers receive independent copies.
- External image URLs retain their host's caching policy; the optional external image-list endpoint still fetches its source on each request.

Validation: `npm test` exercises cache headers, conditional requests, external profile edits, and admin mutations. Deploy the frontend and restart/deploy the backend to activate their respective policies.

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>
