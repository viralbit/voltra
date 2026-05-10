/**
 * Multi-API downloader fallback chain.
 *
 * Each downloader tries several public scraper endpoints in order and
 * returns the first usable result. This dramatically improves reliability
 * vs. the single-API implementations that ship in the bot — when one
 * scraper rate-limits, blocks regional traffic, or goes offline, the
 * next one is tried automatically.
 *
 * Result shape: { ok: true, type: 'video'|'image', url, urls?, title?,
 * author?, mimetype?, source } OR { ok: false, error }.
 */

const axios = require('axios');

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36';
const DEFAULT_TIMEOUT = 25000;

const get = (url, opts = {}) => axios.get(url, {
  timeout: DEFAULT_TIMEOUT,
  headers: { 'User-Agent': UA, Accept: 'application/json,*/*' },
  validateStatus: s => s >= 200 && s < 500,
  ...opts,
});

// Pull a download URL out of any of the common response shapes used by
// the scraper APIs we hit.
function pickUrl(obj, keys = ['url', 'download', 'dl', 'video', 'videoUrl', 'mediaUrl', 'file', 'src']) {
  if (!obj) return null;
  if (typeof obj === 'string' && /^https?:\/\//.test(obj)) return obj;
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === 'string' && /^https?:\/\//.test(v)) return v;
  }
  return null;
}

// ───────── TikTok ─────────
const tiktokAPIs = [
  {
    name: 'tikwm',
    fn: async (url) => {
      const r = await get(`https://www.tikwm.com/api/?url=${encodeURIComponent(url)}&hd=1`);
      const d = r.data?.data;
      if (!d) return null;
      const videoUrl = d.hdplay || d.play || d.wmplay;
      if (!videoUrl) return null;
      return { ok: true, type: 'video', url: videoUrl, title: d.title, author: d.author?.unique_id, source: 'tikwm' };
    }
  },
  {
    name: 'siputzx',
    fn: async (url) => {
      const r = await get(`https://api.siputzx.my.id/api/d/tiktok?url=${encodeURIComponent(url)}`);
      const d = r.data?.data || r.data;
      const videoUrl = pickUrl(d, ['video', 'play', 'noWatermark', 'url']);
      if (!videoUrl) return null;
      return { ok: true, type: 'video', url: videoUrl, title: d?.title, source: 'siputzx' };
    }
  },
  {
    name: 'ssstik',
    fn: async (url) => {
      const r = await get(`https://api.ssstik.io/api/2/fetch?url=${encodeURIComponent(url)}`);
      const v = pickUrl(r.data, ['video', 'url']);
      if (!v) return null;
      return { ok: true, type: 'video', url: v, source: 'ssstik' };
    }
  },
];

// ───────── Facebook ─────────
const facebookAPIs = [
  {
    name: 'siputzx',
    fn: async (url) => {
      const r = await get(`https://api.siputzx.my.id/api/d/facebook?url=${encodeURIComponent(url)}`);
      const arr = r.data?.data || [];
      const hd = arr.find(x => /hd|720|1080/i.test(x.resolution || x.quality || '')) || arr[0];
      const v = pickUrl(hd, ['url', 'download']);
      if (!v) return null;
      return { ok: true, type: 'video', url: v, source: 'siputzx' };
    }
  },
  {
    name: 'snapsave',
    fn: async (url) => {
      const r = await get(`https://api.dreaded.site/api/facebook2?url=${encodeURIComponent(url)}`);
      const d = r.data?.result || r.data;
      const v = pickUrl(d?.hd ? { url: d.hd } : d, ['hd', 'sd', 'url', 'download']);
      if (!v) return null;
      return { ok: true, type: 'video', url: v, source: 'dreaded' };
    }
  },
  {
    name: 'fdown',
    fn: async (url) => {
      const r = await get(`https://api.nexray.web.id/downloader/facebook?url=${encodeURIComponent(url)}`);
      const d = r.data?.result || r.data;
      const v = pickUrl(d, ['hd', 'sd', 'url', 'video']);
      if (!v) return null;
      return { ok: true, type: 'video', url: v, source: 'nexray' };
    }
  },
];

// ───────── Instagram ─────────
const instagramAPIs = [
  {
    name: 'siputzx',
    fn: async (url) => {
      const r = await get(`https://api.siputzx.my.id/api/d/igdl?url=${encodeURIComponent(url)}`);
      const arr = r.data?.data || [];
      const urls = arr.map(x => pickUrl(x, ['url', 'download'])).filter(Boolean);
      if (!urls.length) return null;
      return { ok: true, type: 'mixed', urls, source: 'siputzx' };
    }
  },
  {
    name: 'nexray',
    fn: async (url) => {
      const r = await get(`https://api.nexray.web.id/downloader/instagram?url=${encodeURIComponent(url)}`);
      const d = r.data?.result;
      const urls = Array.isArray(d) ? d.map(x => pickUrl(x)).filter(Boolean) : [pickUrl(d)].filter(Boolean);
      if (!urls.length) return null;
      return { ok: true, type: 'mixed', urls, source: 'nexray' };
    }
  },
  {
    name: 'dreaded',
    fn: async (url) => {
      const r = await get(`https://api.dreaded.site/api/igdl?url=${encodeURIComponent(url)}`);
      const arr = r.data?.result || r.data?.data || [];
      const urls = (Array.isArray(arr) ? arr : [arr]).map(x => pickUrl(x)).filter(Boolean);
      if (!urls.length) return null;
      return { ok: true, type: 'mixed', urls, source: 'dreaded' };
    }
  },
];

// ───────── Pinterest ─────────
const pinterestAPIs = [
  {
    name: 'nexray',
    fn: async (url) => {
      const r = await get(`https://api.nexray.web.id/downloader/pinterest?url=${encodeURIComponent(url)}`);
      const d = r.data?.result;
      if (!d) return null;
      const isVideo = !!d.video;
      const u = d.video || d.image || d.url;
      if (!u) return null;
      return { ok: true, type: isVideo ? 'video' : 'image', url: u, title: d.title, author: d.author, source: 'nexray' };
    }
  },
  {
    name: 'siputzx',
    fn: async (url) => {
      const r = await get(`https://api.siputzx.my.id/api/d/pinterest?url=${encodeURIComponent(url)}`);
      const d = r.data?.data || r.data?.result || r.data;
      const u = pickUrl(d, ['video', 'image', 'url', 'download']);
      if (!u) return null;
      const isVideo = /\.mp4($|\?)/i.test(u) || !!d?.video;
      return { ok: true, type: isVideo ? 'video' : 'image', url: u, title: d?.title, source: 'siputzx' };
    }
  },
];

async function tryChain(apis, url) {
  const errors = [];
  for (const api of apis) {
    try {
      const r = await api.fn(url);
      if (r && r.ok) return r;
      errors.push(`${api.name}: empty result`);
    } catch (e) {
      errors.push(`${api.name}: ${e.message || e}`);
    }
  }
  return { ok: false, error: 'All download sources failed', tried: errors };
}

module.exports = {
  downloadTikTok:    (url) => tryChain(tiktokAPIs, url),
  downloadFacebook:  (url) => tryChain(facebookAPIs, url),
  downloadInstagram: (url) => tryChain(instagramAPIs, url),
  downloadPinterest: (url) => tryChain(pinterestAPIs, url),
  // Helpers re-exported for command files that need a UA-matched buffer fetch
  fetchBuffer: async (url, opts = {}) => {
    const r = await axios.get(url, {
      responseType: 'arraybuffer',
      timeout: 120000,
      maxContentLength: 100 * 1024 * 1024,
      headers: { 'User-Agent': UA, Accept: '*/*', ...(opts.headers || {}) },
      ...opts,
    });
    return Buffer.from(r.data);
  },
};
