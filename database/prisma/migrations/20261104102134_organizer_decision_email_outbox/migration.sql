-- Private, durable notification job for each terminal organizer decision.
CREATE TABLE temuevent.organizer_decision_emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_id UUID NOT NULL UNIQUE REFERENCES temuevent.purchases(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  decision VARCHAR(6) NOT NULL,
  recipient_email VARCHAR(254) NOT NULL,
  subject TEXT NOT NULL,
  text_body TEXT NOT NULL,
  html_body TEXT NOT NULL,
  delivery_state VARCHAR(16) NOT NULL DEFAULT 'PENDING',
  attempt_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  next_attempt_at TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  lease_id UUID,
  leased_until TIMESTAMPTZ(3),
  retry_until TIMESTAMPTZ(3),
  accepted_at TIMESTAMPTZ(3),
  CONSTRAINT decision_email_decision CHECK (decision IN ('ACCEPT', 'REJECT')),
  CONSTRAINT decision_email_state CHECK (delivery_state IN ('PENDING', 'SENDING', 'RETRY', 'ACCEPTED', 'FAILED')),
  CONSTRAINT decision_email_attempts CHECK (attempt_count BETWEEN 0 AND 3 AND
    ((delivery_state = 'PENDING') = (attempt_count = 0)) AND ((retry_until IS NULL) = (attempt_count = 0))),
  CONSTRAINT decision_email_lease CHECK (
    (delivery_state = 'SENDING' AND lease_id IS NOT NULL AND leased_until IS NOT NULL) OR
    (delivery_state <> 'SENDING' AND lease_id IS NULL AND leased_until IS NULL)),
  CONSTRAINT decision_email_acceptance CHECK ((delivery_state = 'ACCEPTED') = (accepted_at IS NOT NULL))
);
CREATE INDEX organizer_decision_emails_delivery_state_next_attempt_at_idx
  ON temuevent.organizer_decision_emails(delivery_state, next_attempt_at);
CREATE INDEX organizer_decision_emails_delivery_state_leased_until_idx
  ON temuevent.organizer_decision_emails(delivery_state, leased_until);

ALTER TABLE temuevent.organizer_decision_emails ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON temuevent.organizer_decision_emails FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT ON temuevent.organizer_decision_emails TO temuevent_app;
-- The worker can update delivery bookkeeping only. The message stays stable across retries.
GRANT UPDATE (delivery_state, attempt_count, next_attempt_at, lease_id, leased_until, retry_until, accepted_at)
  ON temuevent.organizer_decision_emails TO temuevent_app;
CREATE POLICY organizer_decision_emails_backend_access ON temuevent.organizer_decision_emails
  FOR ALL TO temuevent_app USING (true) WITH CHECK (true);
