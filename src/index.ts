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

const memos: Memo[] = [];
let nextId = 1;

app.get("/api/memos", (c) => c.json(memos));

app.post("/api/memos", async (c) => {
  const { text } = await c.req.json<{ text: string }>();
  const memo: Memo = { id: nextId++, text, createdAt: new Date().toISOString() };
  memos.push(memo);
  return c.json(memo, 201);
});

app.delete("/api/memos/:id", (c) => {
  const id = Number(c.req.param("id"));
  const index = memos.findIndex((m) => m.id === id);
  if (index === -1) return c.json({ error: "not found" }, 404);
  memos.splice(index, 1);
  return c.body(null, 204);
});

export default app;