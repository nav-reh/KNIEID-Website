CREATE TABLE users (
 id TEXT PRIMARY KEY, username TEXT NOT NULL UNIQUE, display_username TEXT NOT NULL,
 name TEXT NOT NULL DEFAULT '', email TEXT NOT NULL DEFAULT '', role TEXT NOT NULL CHECK(role IN ('member','committee','admin')),
 password_hash TEXT NOT NULL, password_salt TEXT NOT NULL, blocked INTEGER NOT NULL DEFAULT 0,
 must_change INTEGER NOT NULL DEFAULT 1, owner INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL
);
CREATE UNIQUE INDEX single_owner ON users(owner) WHERE owner=1;
CREATE TABLE sessions (token_hash TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,expires_at INTEGER NOT NULL);
CREATE INDEX sessions_expiry ON sessions(expires_at);
CREATE INDEX sessions_user ON sessions(user_id);
CREATE TABLE rate_limits (key TEXT PRIMARY KEY,attempts INTEGER NOT NULL,expires_at INTEGER NOT NULL);
CREATE INDEX rate_expiry ON rate_limits(expires_at);
CREATE TABLE information (id TEXT PRIMARY KEY,title_de TEXT NOT NULL,title_en TEXT NOT NULL,body_de TEXT NOT NULL,body_en TEXT NOT NULL,audience TEXT NOT NULL CHECK(audience IN ('public','member','committee','admin')),updated_at TEXT NOT NULL);
CREATE TABLE audit_log(id TEXT PRIMARY KEY,actor TEXT NOT NULL,action TEXT NOT NULL,target TEXT NOT NULL,at TEXT NOT NULL);
