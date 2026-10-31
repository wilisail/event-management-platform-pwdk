-- Add account-session storage without changing existing user/event/purchase data.
-- Prisma models describe the relations; SQL also enforces dates, hash format and access.
CREATE TABLE temuevent.auth_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  created_at TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMPTZ(3) NOT NULL,
  revoked_at TIMESTAMPTZ(3),
  CONSTRAINT auth_sessions_pkey PRIMARY KEY (id),
  CONSTRAINT auth_sessions_user_id_fkey FOREIGN KEY (user_id)
    REFERENCES temuevent.users(id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT auth_sessions_expiry_order CHECK (expires_at > created_at),
  CONSTRAINT auth_sessions_revocation_order CHECK (revoked_at IS NULL OR revoked_at >= created_at)
);

CREATE TABLE temuevent.auth_refresh_tokens (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL,
  token_hash VARCHAR(64) NOT NULL,
  created_at TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMPTZ(3) NOT NULL,
  consumed_at TIMESTAMPTZ(3),
  CONSTRAINT auth_refresh_tokens_pkey PRIMARY KEY (id),
  CONSTRAINT auth_refresh_tokens_session_id_fkey FOREIGN KEY (session_id)
    REFERENCES temuevent.auth_sessions(id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT auth_refresh_tokens_hash_format CHECK (token_hash ~ '^[0-9a-f]{64}$'),
  CONSTRAINT auth_refresh_tokens_expiry_order CHECK (expires_at > created_at),
  CONSTRAINT auth_refresh_tokens_consumption_order CHECK (consumed_at IS NULL OR consumed_at >= created_at)
);

CREATE INDEX auth_sessions_user_id_idx ON temuevent.auth_sessions(user_id);
CREATE INDEX auth_sessions_expires_at_idx ON temuevent.auth_sessions(expires_at);
CREATE UNIQUE INDEX auth_refresh_tokens_token_hash_key ON temuevent.auth_refresh_tokens(token_hash);
CREATE INDEX auth_refresh_tokens_session_id_idx ON temuevent.auth_refresh_tokens(session_id);
CREATE INDEX auth_refresh_tokens_expires_at_idx ON temuevent.auth_refresh_tokens(expires_at);

ALTER TABLE temuevent.auth_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE temuevent.auth_refresh_tokens ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON temuevent.auth_sessions, temuevent.auth_refresh_tokens
  FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE ON temuevent.auth_sessions, temuevent.auth_refresh_tokens
  TO temuevent_app;
CREATE POLICY auth_sessions_backend_access ON temuevent.auth_sessions
  FOR ALL TO temuevent_app USING (true) WITH CHECK (true);
CREATE POLICY auth_refresh_tokens_backend_access ON temuevent.auth_refresh_tokens
  FOR ALL TO temuevent_app USING (true) WITH CHECK (true);

