import { env } from "cloudflare:workers";

const sectionIds = new Set(["legends", "history", "identity", "made"]);
const corsHeaders = {
  "Access-Control-Allow-Origin": "https://arishafil231-debug.github.io",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  Vary: "Origin",
};

function json(body: unknown, init?: ResponseInit) {
  return Response.json(body, { ...init, headers: { ...corsHeaders, ...init?.headers } });
}

async function ensureTable() {
  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      section TEXT NOT NULL,
      content TEXT NOT NULL,
      author TEXT NOT NULL DEFAULT '',
      video_key TEXT,
      youtube_url TEXT,
      tiktok_url TEXT,
      instagram_url TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `).run();
  const columns = await env.DB.prepare("PRAGMA table_info(entries)").all<{ name: string }>();
  if (!columns.results.some((column) => column.name === "author")) {
    await env.DB.prepare("ALTER TABLE entries ADD COLUMN author TEXT NOT NULL DEFAULT ''").run();
  }
  if (!columns.results.some((column) => column.name === "video_key")) {
    await env.DB.prepare("ALTER TABLE entries ADD COLUMN video_key TEXT").run();
  }
  for (const column of ["youtube_url", "tiktok_url", "instagram_url"]) {
    if (!columns.results.some((item) => item.name === column)) {
      await env.DB.prepare(`ALTER TABLE entries ADD COLUMN ${column} TEXT`).run();
    }
  }
}

function normalizeUrl(value: unknown) {
  if (typeof value !== "string") return null;
  const text = value.trim();
  if (!text) return "";
  try {
    const url = new URL(text);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders });
}

export async function GET() {
  try {
    await ensureTable();
    const result = await env.DB.prepare(
      "SELECT id, section, content, author, video_key AS videoKey, youtube_url AS youtubeUrl, tiktok_url AS tiktokUrl, instagram_url AS instagramUrl, created_at AS createdAt FROM entries ORDER BY id DESC LIMIT 500",
    ).all<Record<string, unknown>>();
    return json({
      entries: result.results.map((entry) => ({
        ...entry,
        hasVideo: Boolean(entry.videoKey),
        videoUrl: entry.videoKey ? `/api/videos?id=${entry.id}` : undefined,
      })),
    });
  } catch {
    return json({ error: "Не удалось загрузить записи" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { section?: string; content?: string; author?: string };
    const section = body.section?.trim() ?? "";
    const content = body.content?.trim() ?? "";
    const author = body.author?.trim() ?? "";
    const allowedAuthors = new Set(["Алёна", "Даниил", "Владимир", "Арина", "Михаил", "Филипп"]);
    if (!sectionIds.has(section) || !content || content.length > 500 || !allowedAuthors.has(author)) {
      return json({ error: "Некорректная запись" }, { status: 400 });
    }
    await ensureTable();
    const result = await env.DB.prepare(
      "INSERT INTO entries (section, content, author) VALUES (?, ?, ?) RETURNING id, section, content, author, NULL AS videoKey, NULL AS youtubeUrl, NULL AS tiktokUrl, NULL AS instagramUrl, created_at AS createdAt",
    ).bind(section, content, author).first();
    return json({ entry: { ...result, hasVideo: false } }, { status: 201 });
  } catch {
    return json({ error: "Не удалось сохранить запись" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = (await request.json()) as { id?: number; content?: string; youtubeUrl?: string; tiktokUrl?: string; instagramUrl?: string };
    const id = Number(body.id);
    const updates: [string, string][] = [];
    if (Object.hasOwn(body, "content")) {
      const content = body.content?.trim() ?? "";
      if (!content || content.length > 500) {
        return json({ error: "Некорректная запись" }, { status: 400 });
      }
      updates.push(["content", content]);
    }
    for (const [key, column] of [["youtubeUrl", "youtube_url"], ["tiktokUrl", "tiktok_url"], ["instagramUrl", "instagram_url"]] as const) {
      if (Object.hasOwn(body, key)) {
        const url = normalizeUrl(body[key]);
        if (url === null) {
          return json({ error: "Укажите корректную ссылку, начинающуюся с http:// или https://" }, { status: 400 });
        }
        updates.push([column, url]);
      }
    }
    if (!Number.isInteger(id) || updates.length === 0) {
      return json({ error: "Некорректная запись" }, { status: 400 });
    }
    await ensureTable();
    const statement = `UPDATE entries SET ${updates.map(([column]) => `${column} = ?`).join(", ")} WHERE id = ?`;
    await env.DB.prepare(statement).bind(...updates.map(([, value]) => value), id).run();
    const entry = await env.DB.prepare(
      "SELECT id, section, content, author, video_key AS videoKey, youtube_url AS youtubeUrl, tiktok_url AS tiktokUrl, instagram_url AS instagramUrl, created_at AS createdAt FROM entries WHERE id = ?",
    ).bind(id).first<Record<string, unknown>>();
    return json({ entry: entry && { ...entry, hasVideo: Boolean(entry.videoKey), videoUrl: entry.videoKey ? `/api/videos?id=${id}` : undefined } });
  } catch {
    return json({ error: "Не удалось изменить запись" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const id = Number(new URL(request.url).searchParams.get("id"));
    if (!Number.isInteger(id)) return json({ error: "Некорректная запись" }, { status: 400 });
    await ensureTable();
    const entry = await env.DB.prepare("SELECT video_key AS videoKey FROM entries WHERE id = ?").bind(id).first<{ videoKey: string | null }>();
    await env.DB.prepare("DELETE FROM entries WHERE id = ?").bind(id).run();
    if (entry?.videoKey) await env.VIDEOS.delete(entry.videoKey);
    return json({ ok: true });
  } catch {
    return json({ error: "Не удалось удалить запись" }, { status: 500 });
  }
}
