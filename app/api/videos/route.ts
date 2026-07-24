import { env } from "cloudflare:workers";

const corsHeaders = {
  "Access-Control-Allow-Origin": "https://arishafil231-debug.github.io",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  Vary: "Origin",
};

function json(body: unknown, init?: ResponseInit) {
  return Response.json(body, { ...init, headers: { ...corsHeaders, ...init?.headers } });
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders });
}

export async function GET(request: Request) {
  const id = Number(new URL(request.url).searchParams.get("id"));
  if (!Number.isInteger(id)) return json({ error: "Видео не найдено" }, { status: 400 });

  const entry = await env.DB.prepare("SELECT video_key AS videoKey FROM entries WHERE id = ?").bind(id).first<{ videoKey: string | null }>();
  if (!entry?.videoKey) return json({ error: "Видео не найдено" }, { status: 404 });

  const object = await env.VIDEOS.get(entry.videoKey);
  if (!object) return json({ error: "Видео не найдено" }, { status: 404 });
  return new Response(object.body, {
    headers: {
      ...corsHeaders,
      "Content-Type": object.httpMetadata?.contentType ?? "video/mp4",
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const id = Number(form.get("entryId"));
    const video = form.get("video");
    if (!Number.isInteger(id) || !(video instanceof File) || !video.type.startsWith("video/") || video.size > 100 * 1024 * 1024) {
      return json({ error: "Выберите видеофайл размером до 100 МБ" }, { status: 400 });
    }

    const entry = await env.DB.prepare(
      "SELECT id, section, content, author, video_key AS videoKey, created_at AS createdAt FROM entries WHERE id = ?",
    ).bind(id).first<Record<string, unknown>>();
    if (!entry) return json({ error: "Запись не найдена" }, { status: 404 });

    const safeName = video.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-100) || "video";
    const key = `videos/${id}/${crypto.randomUUID()}-${safeName}`;
    await env.VIDEOS.put(key, video.stream(), { httpMetadata: { contentType: video.type } });
    await env.DB.prepare("UPDATE entries SET video_key = ? WHERE id = ?").bind(key, id).run();
    if (entry.videoKey) await env.VIDEOS.delete(String(entry.videoKey));

    return json({ entry: { ...entry, videoKey: key, hasVideo: true, videoUrl: `/api/videos?id=${id}` } });
  } catch {
    return json({ error: "Не удалось прикрепить видео" }, { status: 500 });
  }
}
