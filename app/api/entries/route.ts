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
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `).run();
  const columns = await env.DB.prepare("PRAGMA table_info(entries)").all<{ name: string }>();
  if (!columns.results.some((column) => column.name === "author")) {
    await env.DB.prepare("ALTER TABLE entries ADD COLUMN author TEXT NOT NULL DEFAULT ''").run();
  }
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders });
}

export async function GET() {
  try {
    await ensureTable();
    const result = await env.DB.prepare(
      "SELECT id, section, content, author, created_at AS createdAt FROM entries ORDER BY id DESC LIMIT 500",
    ).all();
    return json({ entries: result.results });
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
      "INSERT INTO entries (section, content, author) VALUES (?, ?, ?) RETURNING id, section, content, author, created_at AS createdAt",
    ).bind(section, content, author).first();
    return json({ entry: result }, { status: 201 });
  } catch {
    return json({ error: "Не удалось сохранить запись" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = (await request.json()) as { id?: number; content?: string };
    const id = Number(body.id);
    const content = body.content?.trim() ?? "";
    if (!Number.isInteger(id) || !content || content.length > 500) {
      return json({ error: "Некорректная запись" }, { status: 400 });
    }
    await ensureTable();
    await env.DB.prepare("UPDATE entries SET content = ? WHERE id = ?").bind(content, id).run();
    return json({ ok: true });
  } catch {
    return json({ error: "Не удалось изменить запись" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const id = Number(new URL(request.url).searchParams.get("id"));
    if (!Number.isInteger(id)) return json({ error: "Некорректная запись" }, { status: 400 });
    await ensureTable();
    await env.DB.prepare("DELETE FROM entries WHERE id = ?").bind(id).run();
    return json({ ok: true });
  } catch {
    return json({ error: "Не удалось удалить запись" }, { status: 500 });
  }
}
