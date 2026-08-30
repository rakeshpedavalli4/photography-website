Photography site (starter scaffold)

This repository contains a starter PWA (Vite + React) front-end and a small Express-based image proxy server to serve images from your NAS without re-encoding them (preserving clarity and embedded color profiles).

Highlights / Goals
- Preserve original image bytes for web viewing and download (no automatic re-encoding by the proxy).
- Provide responsive gallery UI that links to full-resolution images on the NAS.
- Use environment placeholders for NAS credentials; do NOT commit real credentials. Use readme.io to host or document actual credential setup.

Quick start (local development)
1. Copy and edit the environment file:
   cp .env.example .env
   Fill NAS_BASE_URL and other placeholders. Alternatively, provide IMAGE_LIST_URL pointing to a JSON array of image relative paths.

2. Install dependencies:
   npm install

3. Run the server and web app (dev):
   npm run dev

What the server does
- /images/*  -> proxies and streams files from NAS_BASE_URL (no re-encoding). Use this for <img> src and for downloads.
- /api/images -> if IMAGE_LIST_URL is set, the server will fetch it and return it to the web app. Otherwise the repo ships a small sample list.

Important notes on image fidelity and color
- Browsers may render color differently depending on color profile. For best cross-browser fidelity, ensure master files either use embedded ICC profiles (preferred) or are converted to sRGB using a high-quality tool (libvips or ImageMagick with careful flags).
- This scaffold streams master files. If you need smaller derivatives for responsive images, create them offline using libvips (vips resize/thumbnail) and keep originals on NAS.
- Avoid automatic on-the-fly transcoding unless you carefully preserve ICC profiles and use a high-quality library (libvips is recommended). If you later add on-the-fly conversion, configure it to embed profiles and use lossless or very high-quality settings.

Next steps (optional)
- Connect to your NAS via an S3-compatible gateway (MinIO or rclone serve s3) for robust access and better tooling.
- Add authentication and access control to the proxy (JWT/OAuth) if you need per-user private albums.
- Add offline generation of web-optimized derivatives and store them next to originals.

Docs and credentials
- Use readme.io to host detailed credential setup instructions and to store non-sensitive operational docs. Keep secrets out of public docs and source control.

Files created
- server/index.js: tiny Express proxy server
- src/: Vite + React PWA frontend
- .env.example: placeholders for NAS and credentials
- README.md: this file

If you'd like, proceed and I can:
- Install dependencies and run the dev server locally (requires confirmation), or
- Generate web-optimized derivative script using libvips to preserve color and quality.

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>
