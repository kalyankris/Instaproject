
/**
 * Vercel Serverless Function
 * GET /api/file?url=...&filename=...
 * Proxies the Instagram CDN file and forces download.
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

    // Basic safety: only allow Instagram / Facebook CDN domains
    const allowedHosts = [
      'cdninstagram.com',
      'fbcdn.net',
      'instagram.com',
      'scontent',
      'fna.fbcdn.net',
    ];

    let parsed;
    try {
      parsed = new URL(url);
    } catch {
      return res.status(400).json({ error: 'invalid_url' });
    }

    const isAllowed = allowedHosts.some((h) => parsed.hostname.includes(h));
    if (!isAllowed) {
      return res.status(403).json({ error: 'domain_not_allowed' });
    }

    const upstream = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        Accept: '*/*',
      },
    });

    if (!upstream.ok) {
      return res.status(upstream.status).json({ error: 'upstream_failed' });
    }

    const contentType = (upstream.headers.get('content-type') || 'video/mp4').toLowerCase();
    if (contentType.includes('application/json') || contentType.includes('text/html')) {
      return res.status(502).json({ error: 'invalid_media', message: 'Upstream did not return a video file.' });
    }

    const buffer = Buffer.from(await upstream.arrayBuffer());
    if (!buffer.length || buffer.length < 50 * 1024) {
      return res.status(502).json({ error: 'empty_file', message: 'Downloaded file was empty or too small.' });
    }

    const safeName = (filename || 'instagram-video.mp4').replace(/[^\w.\-]+/g, '_');

    res.setHeader('Content-Type', contentType.startsWith('video/') ? contentType : 'video/mp4');
    res.setHeader('Content-Disposition', `attachment; filename="${safeName}"`);
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Content-Length', String(buffer.length));

    return res.status(200).send(buffer);
  } catch (err) {
    console.error('[file proxy]', err);
    return res.status(500).json({ error: 'proxy_failed', message: err.message });
  }
}
