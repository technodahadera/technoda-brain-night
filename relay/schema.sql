CREATE TABLE rooms (
  code TEXT PRIMARY KEY,
  host_key TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  round INTEGER NOT NULL,
  phase TEXT NOT NULL,
  opened_at INTEGER NOT NULL,
  server_opened_at INTEGER NOT NULL,
  deadline INTEGER NOT NULL
);
--> statement-breakpoint
CREATE INDEX rooms_expiry ON rooms(expires_at);
--> statement-breakpoint
CREATE TABLE votes (
  room TEXT NOT NULL REFERENCES rooms(code) ON DELETE CASCADE,
  round INTEGER NOT NULL,
  opened_at INTEGER NOT NULL,
  voter TEXT NOT NULL,
  choice INTEGER NOT NULL,
  elapsed INTEGER NOT NULL,
  PRIMARY KEY (room, round, opened_at, voter)
);
