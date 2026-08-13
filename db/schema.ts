import { sql } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const entries = sqliteTable("entries", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  section: text("section").notNull(),
  content: text("content").notNull(),
  author: text("author").notNull().default(""),
  videoKey: text("video_key"),
  youtubeUrl: text("youtube_url"),
  tiktokUrl: text("tiktok_url"),
  instagramUrl: text("instagram_url"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});
