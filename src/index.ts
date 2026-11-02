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

const app = new Hono<{ Bindings: Env }>();

app.get("/api/health", (c) => c.json({ ok: true }));

type Memo = { id: number; text: string; createdAt: string };

app.get("/api/memos", async (c) => {
  const { results } = await c.env.DB
    .prepare("SELECT id, text, created_at AS createdAt FROM memos ORDER BY id")
    .all<Memo>();
  return c.json(results);
});

app.post("/api/memos", async (c) => {
  const { text } = await c.req.json<{ text: string }>();
  const memo = await c.env.DB
    .prepare("INSERT INTO memos (text) VALUES (?) RETURNING id, text, created_at AS createdAt")
    .bind(text)
    .first<Memo>();
  return c.json(memo, 201);
});

app.delete("/api/memos/:id", async (c) => {
  const id = Number(c.req.param("id"));
  const { meta } = await c.env.DB
    .prepare("DELETE FROM memos WHERE id = ?")
    .bind(id)
    .run();
  if (meta.changes === 0) return c.json({ error: "not found" }, 404);
  return c.body(null, 204);
});

export default app;