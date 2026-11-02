/**
 * Welcome to Cloudflare Workers! This is your first worker.
 *
 * - Run `npm run dev` in your terminal to start a development server
 * - Open a browser tab at http://localhost:8787/ to see your worker in action
 * - Run `npm run deploy` to publish your worker
 *
 * Bind resources to your worker in `wrangler.jsonc`. After adding bindings, a type definition for the
 * `Env` object can be regenerated with `npm run cf-typegen`.
 *
 * Learn more at https://developers.cloudflare.com/workers/
 */

/*
export default {
	async fetch(request, env, ctx): Promise<Response> {
		return new Response("Hello World!");
	},
} satisfies ExportedHandler<Env>;
*/


import { Hono } from "hono";
import { asc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { memos } from "./db/schema";

const app = new Hono<{ Bindings: Env }>();

app.get("/api/health", (c) => c.json({ ok: true }));

app.get("/api/memos", async (c) => {
  const db = drizzle(c.env.DB);
  const rows = await db.select().from(memos).orderBy(asc(memos.id));
  return c.json(rows);
});

app.post("/api/memos", async (c) => {
  const { text } = await c.req.json<{ text: string }>();
  const db = drizzle(c.env.DB);
  const [memo] = await db.insert(memos).values({ text }).returning();
  return c.json(memo, 201);
});

app.delete("/api/memos/:id", async (c) => {
  const id = Number(c.req.param("id"));
  const db = drizzle(c.env.DB);
  const deleted = await db.delete(memos).where(eq(memos.id, id)).returning();
  if (deleted.length === 0) return c.json({ error: "not found" }, 404);
  return c.body(null, 204);
});

export default app;
