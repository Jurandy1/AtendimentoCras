const MAX_CHARS = 200;

const resolveCorsOrigin = (req) => {
  const origin = req.headers.origin || req.headers.referer || "";
  if (!origin) return null;

  try {
    const host = new URL(origin).hostname;
    if (host === "localhost" || host === "127.0.0.1") return origin;
    if (host.endsWith(".vercel.app")) return origin;
    if (process.env.ALLOWED_TTS_HOST && host === process.env.ALLOWED_TTS_HOST) return origin;
    if (process.env.VERCEL_URL && host === process.env.VERCEL_URL) return origin;
  } catch (_) {}

  return null;
};

export default async function handler(req, res) {
  if (req.method === "OPTIONS") {
    const allowedOrigin = resolveCorsOrigin(req);
    if (allowedOrigin) {
      res.setHeader("Access-Control-Allow-Origin", allowedOrigin);
      res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    }
    return res.status(204).end();
  }

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const allowedOrigin = resolveCorsOrigin(req);
  const originHeader = req.headers.origin;

  // Smart TVs e <audio src> direto costumam não enviar Origin — bloqueia só origem explícita inválida
  if (originHeader && !allowedOrigin) {
    return res.status(403).json({ error: "Origin not allowed" });
  }

  const text = String(req.query.q || req.query.text || "").trim();
  if (!text) {
    return res.status(400).json({ error: "Missing text parameter (q)" });
  }
  if (text.length > MAX_CHARS) {
    return res.status(400).json({ error: `Text exceeds ${MAX_CHARS} characters` });
  }

  const clients = ["tw-ob", "gtx"];
  let lastStatus = null;

  try {
    for (const client of clients) {
      const upstream = `https://translate.google.com/translate_tts?ie=UTF-8&tl=pt-BR&client=${client}&q=${encodeURIComponent(text)}`;
      const response = await fetch(upstream, {
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; PainelTV/1.0)",
        },
      });

      if (response.ok) {
        const buffer = Buffer.from(await response.arrayBuffer());
        res.setHeader("Content-Type", "audio/mpeg");
        res.setHeader("Cache-Control", "public, max-age=86400");
        if (allowedOrigin) {
          res.setHeader("Access-Control-Allow-Origin", allowedOrigin);
          res.setHeader("Vary", "Origin");
        }
        return res.status(200).send(buffer);
      }
      lastStatus = response.status;
    }

    return res.status(502).json({ error: "TTS upstream unavailable", status: lastStatus });
  } catch (err) {
    return res.status(500).json({ error: err?.message || "Internal error" });
  }
}
