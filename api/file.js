
/**
 * Vercel Serverless Function
 * GET /api/file?url=...&filename=...
 *
 * Redirects the browser to the real media URL (302).
 * Buffering the full video on Vercel fails for most reels (body size limit).
 * A redirect lets the browser download directly from the CDN.
 */

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'method_not_allowed' });
  }

  try {
    const { url, filename } = req.query;

    if (!url || typeof url !== 'string') {
      return res.status(400).json({ error: 'missing_url' });
    }

    let parsed;
    try {
      parsed = new URL(url);
    } catch {
      return res.status(400).json({ error: 'invalid_url' });
    }

    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return res.status(400).json({ error: 'invalid_protocol' });
    }

    // Allow Instagram / Facebook CDN hosts and FastSaver tunnels
    const host = parsed.hostname.toLowerCase();
    const allowed =
      host.includes('cdninstagram') ||
      host.includes('fbcdn') ||
      host.includes('instagram.com') ||
      host.includes('scontent') ||
      host.includes('fastsaver.io') ||
      host.endsWith('facebook.com') ||
      host.endsWith('fbsbx.com');

    if (!allowed) {
      return res.status(403).json({ error: 'domain_not_allowed', host });
    }

    const safeName = (filename || 'instagram-video.mp4').replace(/[^\w.\-]+/g, '_');

    // 302 to the media file — browser handles the real download (no size limit)
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Content-Disposition', 'attachment; filename="' + safeName + '"');
    res.writeHead(302, { Location: url });
    return res.end();
  } catch (err) {
    console.error('[file proxy]', err);
    return res.status(500).json({ error: 'proxy_failed', message: err.message || 'Proxy failed' });
  }
}
