import { env } from "cloudflare:workers";

const corsHeaders = {
  "Access-Control-Allow-Origin": "https://arishafil231-debug.github.io",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  Vary: "Origin",
};
const videoExtensions = /\.(mp4|m4v|mov|webm|avi)$/i;
const maxVideoSize = 100 * 1024 * 1024;

type VideoMetadata = { entryId?: number; name?: string; type?: string; size?: number };
type UploadedPart = { partNumber: number; etag: string };

function json(body: unknown, init?: ResponseInit) {
  return Response.json(body, { ...init, headers: { ...corsHeaders, ...init?.headers } });
}

function isSupportedVideo(name: string, type: string) {
  return type.startsWith("video/") || videoExtensions.test(name);
}

function contentTypeFor(name: string, type: string) {
  if (type.startsWith("video/")) return type;
  const extension = name.split(".").pop()?.toLowerCase();
  return ({ mp4: "video/mp4", m4v: "video/x-m4v", mov: "video/quicktime", webm: "video/webm", avi: "video/x-msvideo" }[extension ?? ""] ?? "video/mp4");
}

async function findEntry(id: number) {
  return env.DB.prepare(
    "SELECT id, section, content, author, video_key AS videoKey, created_at AS createdAt FROM entries WHERE id = ?",
  ).bind(id).first<Record<string, unknown>>();
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

async function startUpload(request: Request) {
  const body = (await request.json()) as VideoMetadata;
  const id = Number(body.entryId);
  const name = body.name?.trim() ?? "";
  const type = body.type?.trim() ?? "";
  const size = Number(body.size);
  if (!Number.isInteger(id) || !name) return json({ error: "Выберите видеофайл." }, { status: 400 });
  if (!isSupportedVideo(name, type)) return json({ error: "Поддерживаются видео MP4, MOV, WebM, M4V и AVI." }, { status: 400 });
  if (!Number.isFinite(size) || size <= 0 || size > maxVideoSize) return json({ error: "Размер видео не должен превышать 100 МБ." }, { status: 400 });
  const entry = await findEntry(id);
  if (!entry) return json({ error: "Запись не найдена." }, { status: 404 });

  const safeName = name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-100) || "video";
  const key = `videos/${id}/${crypto.randomUUID()}-${safeName}`;
  const upload = await env.VIDEOS.createMultipartUpload(key, { httpMetadata: { contentType: contentTypeFor(name, type) } });
  return json({ key, uploadId: upload.uploadId });
}

async function uploadPart(request: Request, url: URL) {
  const key = url.searchParams.get("key") ?? "";
  const uploadId = url.searchParams.get("uploadId") ?? "";
  const partNumber = Number(url.searchParams.get("partNumber"));
  if (!key || !uploadId || !Number.isInteger(partNumber) || partNumber < 1 || !request.body) {
    return json({ error: "Не удалось подготовить фрагмент видео." }, { status: 400 });
  }
  const upload = env.VIDEOS.resumeMultipartUpload(key, uploadId);
  const part = await upload.uploadPart(partNumber, request.body);
  return json({ partNumber: part.partNumber, etag: part.etag });
}

async function completeUpload(request: Request) {
  const body = (await request.json()) as { entryId?: number; key?: string; uploadId?: string; parts?: UploadedPart[] };
  const id = Number(body.entryId);
  if (!Number.isInteger(id) || !body.key || !body.uploadId || !Array.isArray(body.parts) || body.parts.length === 0) {
    return json({ error: "Не удалось завершить загрузку видео." }, { status: 400 });
  }
  const entry = await findEntry(id);
  if (!entry) return json({ error: "Запись не найдена." }, { status: 404 });

  const upload = env.VIDEOS.resumeMultipartUpload(body.key, body.uploadId);
  await upload.complete(body.parts);
  await env.DB.prepare("UPDATE entries SET video_key = ? WHERE id = ?").bind(body.key, id).run();
  if (entry.videoKey) await env.VIDEOS.delete(String(entry.videoKey));
  return json({ entry: { ...entry, videoKey: body.key, hasVideo: true, videoUrl: `/api/videos?id=${id}` } });
}

export async function POST(request: Request) {
  try {
    if (!env.VIDEOS) return json({ error: "Хранилище видео временно недоступно. Попробуйте позже." }, { status: 503 });
    const url = new URL(request.url);
    const mode = url.searchParams.get("upload");
    if (mode === "start") return startUpload(request);
    if (mode === "part") return uploadPart(request, url);
    if (mode === "complete") return completeUpload(request);
    return json({ error: "Неизвестный этап загрузки видео." }, { status: 400 });
  } catch {
    return json({ error: "Хранилище не приняло фрагмент видео. Проверьте соединение и попробуйте ещё раз." }, { status: 502 });
  }
}
