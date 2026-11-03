
/**
 * Vercel Serverless Function
 * POST /api/download
 */

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({
      error: 'method_not_allowed',
      message: 'Only POST is allowed',
    });
  }

  try {
    const { url } = req.body || {};

    if (!url || typeof url !== 'string') {
      return res.status(400).json({
        error: 'missing_url',
        message: 'Please provide a valid Instagram URL.',
      });
    }

    // Strip tracking query/hash so provider gets a clean post/reel URL
    let cleanUrl = url.trim();
    try {
      const parsed = new URL(cleanUrl.startsWith('http') ? cleanUrl : 'https://' + cleanUrl);
      cleanUrl = parsed.origin + parsed.pathname.replace(/\/$/, '') + '/';
    } catch (_) {
      cleanUrl = url.trim();
    }

    // Basic Instagram URL validation
    const instagramRegex = /^(https?:\/\/)?(www\.)?(instagram\.com|instagr\.am)\/(p|reel|reels|tv)\/[A-Za-z0-9_-]+/i;
    if (!instagramRegex.test(cleanUrl)) {
      return res.status(400).json({
        error: 'invalid_url',
        message: 'Invalid Instagram URL. Only public posts, Reels and IGTV are supported.',
      });
    }

    const apiKey = process.env.FASTSAVER_API_KEY;
    if (!apiKey) {
      return res.status(500).json({
        error: 'config_error',
        message: 'Server is not configured. Missing API key.',
      });
    }

    const endpoint = `https://api.fastsaver.io/v1/fetch?url=${encodeURIComponent(cleanUrl)}`;

    const response = await fetch(endpoint, {
      method: 'GET',
      headers: {
        'X-Api-Key': apiKey,
        Accept: 'application/json',
      },
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      return res.status(response.status === 404 ? 404 : 502).json({
        error: 'provider_error',
        message: data.message || data.error || 'Media provider temporarily unavailable.',
      });
    }

    const downloadUrl = data.download_url || data.downloadUrl;

    if (!downloadUrl) {
      return res.status(404).json({
        error: 'not_found',
        message: data.message || 'No downloadable video found. The post may be private, deleted, or restricted.',
      });
    }

    return res.status(200).json({
      success: true,
      downloadUrl,
      thumbnail: data.thumbnail_url || data.thumbnail || null,
      title: (data.caption || data.title || 'Instagram Video').slice(0, 120),
      duration: data.duration || null,
      type: data.type || 'video',
      filename: `instagram-${data.id || 'video'}.mp4`,
    });
  } catch (err) {
    console.error('[download]', err);
    return res.status(500).json({
      error: 'processing_failed',
      message: 'An unexpected error occurred while processing the request.',
    });
  }
}
