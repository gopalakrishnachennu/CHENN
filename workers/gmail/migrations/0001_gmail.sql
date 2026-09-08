CREATE TABLE connections (
  id TEXT PRIMARY KEY, owner_uid TEXT NOT NULL, email TEXT NOT NULL UNIQUE,
  token TEXT NOT NULL, senders TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'connected',
  history_id TEXT, last_sync TEXT, next_sync INTEGER NOT NULL DEFAULT 0,
  lease_until INTEGER NOT NULL DEFAULT 0, failures INTEGER NOT NULL DEFAULT 0,
  last_error TEXT, consent_at TEXT NOT NULL, consent_version TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE candidate_permissions (
  candidate_id TEXT PRIMARY KEY, email TEXT NOT NULL, enabled INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL
);
CREATE INDEX connections_due ON connections(status, next_sync, lease_until);
CREATE TABLE oauth_states (
  id TEXT PRIMARY KEY, candidate_id TEXT NOT NULL, owner_uid TEXT NOT NULL,
  email TEXT NOT NULL, senders TEXT NOT NULL, verifier TEXT NOT NULL,
  expires INTEGER NOT NULL
);
CREATE TABLE messages (
  id TEXT NOT NULL, candidate_id TEXT NOT NULL REFERENCES connections(id) ON DELETE CASCADE,
  thread_id TEXT NOT NULL, sender TEXT NOT NULL, subject TEXT NOT NULL,
  received_at TEXT NOT NULL, category TEXT NOT NULL, preview TEXT NOT NULL,
  job_id TEXT, PRIMARY KEY(candidate_id, id)
);
CREATE INDEX messages_candidate_date ON messages(candidate_id, received_at);
CREATE TABLE processed_messages (
  candidate_id TEXT NOT NULL REFERENCES connections(id) ON DELETE CASCADE,
  message_id TEXT NOT NULL, processed_at TEXT NOT NULL,
  PRIMARY KEY(candidate_id, message_id)
);
CREATE TABLE audit (
  id TEXT PRIMARY KEY, candidate_id TEXT NOT NULL, actor TEXT NOT NULL,
  action TEXT NOT NULL, created_at TEXT NOT NULL
);
