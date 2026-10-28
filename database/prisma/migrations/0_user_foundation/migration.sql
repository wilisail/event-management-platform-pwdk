-- Initial identity foundation. Matches prisma/schema.prisma.
CREATE SCHEMA IF NOT EXISTS temuevent;
CREATE TYPE temuevent."UserRole" AS ENUM ('CUSTOMER', 'ORGANIZER');
CREATE TABLE temuevent.users (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  name TEXT NOT NULL,
  role temuevent."UserRole" NOT NULL DEFAULT 'CUSTOMER',
  password_hash TEXT,
  referral_code VARCHAR(16) NOT NULL,
  profile_picture_key TEXT,
  created_at TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT users_pkey PRIMARY KEY (id)
);
CREATE UNIQUE INDEX users_email_key ON temuevent.users(email);
CREATE UNIQUE INDEX users_referral_code_key ON temuevent.users(referral_code);

-- Backend-only schema. It is not exposed through the Supabase Data API.
REVOKE ALL ON SCHEMA temuevent FROM PUBLIC, anon, authenticated;
REVOKE ALL ON ALL TABLES IN SCHEMA temuevent FROM PUBLIC, anon, authenticated;

-- The API login is activated separately, with a generated password outside Git.
CREATE ROLE temuevent_app NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
GRANT USAGE ON SCHEMA temuevent TO temuevent_app;
GRANT USAGE ON TYPE temuevent."UserRole" TO temuevent_app;
GRANT SELECT, INSERT, UPDATE ON temuevent.users TO temuevent_app;

ALTER TABLE temuevent.users ENABLE ROW LEVEL SECURITY;
CREATE POLICY users_backend_access ON temuevent.users
  FOR ALL TO temuevent_app USING (true) WITH CHECK (true);

ALTER TABLE temuevent.users ADD CONSTRAINT users_email_normalized
  CHECK (email = lower(btrim(email)));
ALTER TABLE temuevent.users ADD CONSTRAINT users_referral_not_empty
  CHECK (referral_code <> '');

CREATE FUNCTION temuevent.protect_user_identity()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, temuevent
AS $$
BEGIN
  IF NEW.referral_code IS DISTINCT FROM OLD.referral_code THEN
    RAISE EXCEPTION 'Referral codes cannot be changed' USING ERRCODE = '23514';
  END IF;
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION temuevent.protect_user_identity() FROM PUBLIC;
CREATE TRIGGER users_immutable_referral
  BEFORE UPDATE ON temuevent.users
  FOR EACH ROW EXECUTE FUNCTION temuevent.protect_user_identity();
