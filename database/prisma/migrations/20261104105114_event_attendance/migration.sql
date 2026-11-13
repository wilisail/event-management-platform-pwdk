-- One manual attendance record per event and customer, anchored to their confirmed purchase.
CREATE TABLE temuevent.attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL,
  customer_id UUID NOT NULL,
  transaction_id UUID NOT NULL,
  marked_by_organizer_id UUID NOT NULL REFERENCES temuevent.users(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  attended_at TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT attendance_event_id_customer_id_key UNIQUE(event_id, customer_id),
  CONSTRAINT attendance_event_id_transaction_id_fkey FOREIGN KEY(event_id, transaction_id)
    REFERENCES temuevent.purchases(event_id, id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT attendance_customer_id_transaction_id_fkey FOREIGN KEY(customer_id, transaction_id)
    REFERENCES temuevent.purchases(customer_id, id) ON DELETE RESTRICT ON UPDATE RESTRICT
);
CREATE INDEX attendance_transaction_id_idx ON temuevent.attendance(transaction_id);
CREATE INDEX attendance_marked_by_organizer_id_idx ON temuevent.attendance(marked_by_organizer_id);

ALTER TABLE temuevent.attendance ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON temuevent.attendance FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT ON temuevent.attendance TO temuevent_app;
CREATE POLICY attendance_backend_access ON temuevent.attendance
  FOR ALL TO temuevent_app USING (true) WITH CHECK (true);
