CREATE TABLE IF NOT EXISTS users (
  email TEXT PRIMARY KEY,
  full_name TEXT,
  role TEXT NOT NULL DEFAULT 'user',
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS bookmarks (
  id TEXT PRIMARY KEY,
  user_email TEXT NOT NULL REFERENCES users(email) ON DELETE CASCADE,
  sermon_file TEXT NOT NULL,
  sermon_title TEXT NOT NULL,
  sermon_url TEXT,
  is_read INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  read_at INTEGER,
  UNIQUE(user_email, sermon_file)
);

INSERT OR IGNORE INTO users (email, role) VALUES ('maratkurbanov@gmail.com', 'admin');
