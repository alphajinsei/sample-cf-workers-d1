-- Migration number: 0001 	 2026-11-02T09:33:49.898Z
CREATE TABLE memos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  text TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);