-- Run with the existing backend PostgreSQL connection, or the owner SQL Editor.
-- Owner mode checks role grants/policies but does not impersonate the backend.
-- The final result records which connection role actually executed the checks.
-- All test identities, events and reviews are rolled back; no committed fixtures.
BEGIN;
SET LOCAL statement_timeout = '15s';

DO $verify$
DECLARE
  fixture_organizer_id UUID := gen_random_uuid();
  customer_id UUID := gen_random_uuid();
  other_customer_id UUID := gen_random_uuid();
  first_event_id UUID := gen_random_uuid();
  second_event_id UUID := gen_random_uuid();
  review_id UUID;
  joined_count INTEGER;
  invalid_rating INTEGER;
  denied_role TEXT;
BEGIN
  IF current_user NOT IN ('temuevent_app', 'postgres') THEN
    RAISE EXCEPTION 'Use the backend account or the authorized SQL Editor';
  END IF;
  IF has_schema_privilege('temuevent_app', 'temuevent', 'CREATE') THEN
    RAISE EXCEPTION 'Backend unexpectedly has schema-creation privilege';
  END IF;
  IF NOT has_table_privilege('temuevent_app', 'temuevent.reviews', 'SELECT')
     OR NOT has_table_privilege('temuevent_app', 'temuevent.reviews', 'INSERT')
     OR has_table_privilege('temuevent_app', 'temuevent.reviews', 'UPDATE')
     OR has_table_privilege('temuevent_app', 'temuevent.reviews', 'DELETE') THEN
    RAISE EXCEPTION 'Review backend privileges differ from the insert/read contract';
  END IF;
  FOREACH denied_role IN ARRAY ARRAY['anon', 'authenticated', 'service_role'] LOOP
    IF has_table_privilege(denied_role, 'temuevent.reviews', 'SELECT')
       OR has_table_privilege(denied_role, 'temuevent.reviews', 'INSERT')
       OR has_table_privilege(denied_role, 'temuevent.reviews', 'UPDATE')
       OR has_table_privilege(denied_role, 'temuevent.reviews', 'DELETE') THEN
      RAISE EXCEPTION 'Unexpected review access for role %', denied_role;
    END IF;
  END LOOP;
  IF NOT (SELECT relrowsecurity FROM pg_class
          WHERE oid = 'temuevent.reviews'::regclass) THEN
    RAISE EXCEPTION 'Reviews must have RLS enabled';
  END IF;

  INSERT INTO temuevent.users(id, email, name, role, referral_code) VALUES
    (fixture_organizer_id, 'review-check-' || fixture_organizer_id || '@example.test',
     'Rollback review organizer', 'ORGANIZER', left(replace(fixture_organizer_id::text, '-', ''), 16)),
    (customer_id, 'review-check-' || customer_id || '@example.test',
     'Rollback review customer', 'CUSTOMER', left(replace(customer_id::text, '-', ''), 16)),
    (other_customer_id, 'review-check-' || other_customer_id || '@example.test',
     'Rollback other customer', 'CUSTOMER', left(replace(other_customer_id::text, '-', ''), 16));

  INSERT INTO temuevent.events(id, organizer_id, slug, name, category, location,
                              start_at, end_at) VALUES
    (first_event_id, fixture_organizer_id, 'review-check-' || first_event_id,
     'Rollback first event', 'Test', 'Test', now() - interval '2 days', now() - interval '1 day'),
    (second_event_id, fixture_organizer_id, 'review-check-' || second_event_id,
     'Rollback second event', 'Test', 'Test', now() - interval '2 days', now() - interval '1 day');

  INSERT INTO temuevent.reviews(event_id, user_id, rating, comment)
    VALUES (first_event_id, customer_id, 1, NULL) RETURNING id INTO review_id;
  INSERT INTO temuevent.reviews(event_id, user_id, rating, comment)
    VALUES (first_event_id, other_customer_id, 5, 'Rollback-only review');
  IF review_id IS NULL THEN
    RAISE EXCEPTION 'Review UUID default was not generated';
  END IF;
  SELECT count(*) INTO joined_count
    FROM temuevent.reviews r
    JOIN temuevent.events e ON e.id = r.event_id
    JOIN temuevent.users u ON u.id = r.user_id
    WHERE r.event_id = first_event_id AND e.organizer_id = fixture_organizer_id
      AND u.role = 'CUSTOMER';
  IF joined_count <> 2 THEN
    RAISE EXCEPTION 'Review/user/event joins failed';
  END IF;

  BEGIN
    INSERT INTO temuevent.reviews(event_id, user_id, rating)
      VALUES (first_event_id, customer_id, 3);
    RAISE EXCEPTION 'Duplicate user/event review unexpectedly succeeded';
  EXCEPTION WHEN unique_violation THEN NULL;
  END;
  FOREACH invalid_rating IN ARRAY ARRAY[0, 6] LOOP
    BEGIN
      INSERT INTO temuevent.reviews(event_id, user_id, rating)
        VALUES (second_event_id, customer_id, invalid_rating);
      RAISE EXCEPTION 'Invalid rating unexpectedly succeeded';
    EXCEPTION WHEN check_violation THEN NULL;
    END;
  END LOOP;
  BEGIN
    INSERT INTO temuevent.reviews(event_id, user_id, rating)
      VALUES (second_event_id, customer_id, NULL);
    RAISE EXCEPTION 'Missing rating unexpectedly succeeded';
  EXCEPTION WHEN not_null_violation THEN NULL;
  END;
  BEGIN
    INSERT INTO temuevent.reviews(event_id, user_id, rating)
      VALUES (gen_random_uuid(), customer_id, 3);
    RAISE EXCEPTION 'Missing event unexpectedly succeeded';
  EXCEPTION WHEN foreign_key_violation THEN NULL;
  END;
  BEGIN
    INSERT INTO temuevent.reviews(event_id, user_id, rating)
      VALUES (first_event_id, gen_random_uuid(), 3);
    RAISE EXCEPTION 'Missing user unexpectedly succeeded';
  EXCEPTION WHEN foreign_key_violation THEN NULL;
  END;
END;
$verify$;
ROLLBACK;

SELECT 'REVIEW_SCHEMA_DB_OK; test rows rolled back; API/attendance are separate' AS result,
       current_user AS connection_role,
       current_user = 'temuevent_app' AS runtime_role_exercised;
