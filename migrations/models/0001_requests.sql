CREATE TABLE IF NOT EXISTS model_requests (
  id TEXT PRIMARY KEY,
  session TEXT NOT NULL,
  fingerprint TEXT NOT NULL,
  kind TEXT NOT NULL CHECK(kind IN ('chat', 'image')),
  day TEXT NOT NULL,
  status TEXT NOT NULL,
  result TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS model_requests_day_kind ON model_requests(day, kind);
CREATE INDEX IF NOT EXISTS model_requests_session_day ON model_requests(session, day);
