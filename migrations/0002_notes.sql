CREATE TABLE IF NOT EXISTS notes (
  user_email TEXT NOT NULL REFERENCES users(email) ON DELETE CASCADE,
  sermon_slug TEXT NOT NULL,
  sermon_title TEXT NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
  PRIMARY KEY (user_email, sermon_slug)
);
