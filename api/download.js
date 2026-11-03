
/**
 * Vercel Serverless Function
 * POST /api/download
 * Resolves an Instagram URL to a direct media download_url via FastSaver.
 */

export default async function handler(req, res) {
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

    // Strip tracking query/hash
    let cleanUrl = url.trim();
    try {
      const parsed = new URL(cleanUrl.startsWith('http') ? cleanUrl : 'https://' + cleanUrl);
      cleanUrl = parsed.origin + parsed.pathname.replace(/\/$/, '') + '/';
    } catch (_) {
      cleanUrl = url.trim();
    }

    const instagramRegex =
      /^(https?:\/\/)?(www\.)?(instagram\.com|instagr\.am)\/(p|reel|reels|tv)\/[A-Za-z0-9_-]+/i;
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

    const endpoint =
      'https://api.fastsaver.io/v1/fetch?url=' + encodeURIComponent(cleanUrl);

    const response = await fetch(endpoint, {
      method: 'GET',
      headers: {
        'X-Api-Key': apiKey,
        Accept: 'application/json',
      },
    });

    const data = await response.json().catch(() => ({}));

    // FastSaver: read `ok`, not only HTTP status
    if (data.ok === false || (!response.ok && data.ok !== true)) {
      return res.status(response.status === 404 ? 404 : 400).json({
        error: 'provider_error',
        message:
          data.message ||
          data.error ||
          (response.status === 400
            ? 'Out of credits or invalid request.'
            : 'Media provider temporarily unavailable.'),
      });
    }

    // Albums/carousels: media is in items[], no top-level download_url
    let downloadUrl =
      data.download_url ||
      data.downloadUrl ||
      null;
    let mediaType = data.type || 'video';
    let thumbnail = data.thumbnail_url || data.thumbnail || null;
    let title = data.caption || data.title || 'Instagram Video';
    let mediaId = data.id || 'video';

    if (!downloadUrl && Array.isArray(data.items) && data.items.length) {
      // Prefer first video item, else first item with a URL
      const videoItem =
        data.items.find(
          (it) =>
            it &&
            (it.type === 'video' || it.download_url || it.downloadUrl) &&
            (it.download_url || it.downloadUrl)
        ) || data.items.find((it) => it && (it.download_url || it.downloadUrl));

      if (videoItem) {
        downloadUrl = videoItem.download_url || videoItem.downloadUrl;
        mediaType = videoItem.type || mediaType;
        thumbnail =
          videoItem.thumbnail_url || videoItem.thumbnail || thumbnail;
      }
    }

    // Some responses nest under media / medias
    if (!downloadUrl && data.media) {
      downloadUrl =
        data.media.download_url ||
        data.media.downloadUrl ||
        data.media.url ||
        null;
    }
    if (!downloadUrl && Array.isArray(data.medias)) {
      const m = data.medias.find((x) => x && (x.download_url || x.url));
      if (m) downloadUrl = m.download_url || m.url;
    }

    if (!downloadUrl || typeof downloadUrl !== 'string') {
      return res.status(404).json({
        error: 'not_found',
        message:
          data.message ||
          'No downloadable video found. The post may be private, a photo-only carousel, deleted, or restricted.',
      });
    }

    // Must be http(s)
    if (!/^https?:\/\//i.test(downloadUrl)) {
      return res.status(502).json({
        error: 'invalid_media_url',
        message: 'Provider returned an invalid media URL.',
      });
    }

    const safeTitle = String(title || 'Instagram Video')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 120);

    return res.status(200).json({
      success: true,
      downloadUrl,
      thumbnail,
      title: safeTitle,
      duration: data.duration || null,
      type: mediaType,
      filename: 'instagram-' + String(mediaId).replace(/[^\w.-]+/g, '') + '.mp4',
    });
  } catch (err) {
    console.error('[download]', err);
    return res.status(500).json({
      error: 'processing_failed',
      message: 'An unexpected error occurred while processing the request.',
    });
  }
}
