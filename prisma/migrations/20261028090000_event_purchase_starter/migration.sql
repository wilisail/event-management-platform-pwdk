-- Additive shared starter based on Rizky's event/ticket forms and the PRD.
-- No existing user data is changed. Runtime authorization stays in the backend.
CREATE TYPE temuevent."EventStatus" AS ENUM ('DRAFT','PUBLISHED','CANCELED');
CREATE TYPE temuevent."PurchaseStatus" AS ENUM (
 'WAITING_FOR_PAYMENT','WAITING_FOR_ADMIN_CONFIRMATION','DONE','REJECTED','EXPIRED','CANCELED'
);
CREATE TABLE temuevent.events (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 organizer_id UUID NOT NULL REFERENCES temuevent.users(id) ON DELETE RESTRICT,
 slug TEXT NOT NULL UNIQUE,
 name TEXT NOT NULL,
 category TEXT NOT NULL,
 location TEXT NOT NULL,
 venue TEXT NOT NULL DEFAULT '',
 address TEXT NOT NULL DEFAULT '',
 description TEXT NOT NULL DEFAULT '',
 image_url TEXT,
 start_at TIMESTAMPTZ(3) NOT NULL,
 end_at TIMESTAMPTZ(3) NOT NULL,
 status temuevent."EventStatus" NOT NULL DEFAULT 'DRAFT',
 created_at TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT events_schedule_check CHECK (end_at > start_at),
 CONSTRAINT events_name_check CHECK (btrim(name) <> ''),
 CONSTRAINT events_slug_check CHECK (btrim(slug) <> '')
);
CREATE INDEX events_organizer_id_start_at_idx ON temuevent.events(organizer_id,start_at);
CREATE INDEX events_category_location_start_at_idx ON temuevent.events(category,location,start_at);
CREATE TABLE temuevent.ticket_types (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 event_id UUID NOT NULL REFERENCES temuevent.events(id) ON DELETE RESTRICT,
 name TEXT NOT NULL,
 description TEXT NOT NULL DEFAULT '',
 price BIGINT NOT NULL,
 quota INTEGER NOT NULL,
 available_seats INTEGER NOT NULL,
 created_at TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT ticket_types_event_id_name_key UNIQUE(event_id,name),
 CONSTRAINT ticket_types_event_id_id_key UNIQUE(event_id,id),
 CONSTRAINT ticket_types_name_check CHECK (btrim(name) <> ''),
 CONSTRAINT ticket_types_price_check CHECK (price >= 0 AND price <= 9007199254740991),
 CONSTRAINT ticket_types_capacity_check CHECK (quota > 0 AND available_seats >= 0 AND available_seats <= quota)
);
CREATE TABLE temuevent.purchases (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 reference TEXT NOT NULL UNIQUE,
 customer_id UUID NOT NULL REFERENCES temuevent.users(id) ON DELETE RESTRICT,
 event_id UUID NOT NULL REFERENCES temuevent.events(id) ON DELETE RESTRICT,
 status temuevent."PurchaseStatus" NOT NULL DEFAULT 'WAITING_FOR_PAYMENT',
 subtotal BIGINT NOT NULL,
 voucher_discount BIGINT NOT NULL DEFAULT 0,
 coupon_discount BIGINT NOT NULL DEFAULT 0,
 points_used BIGINT NOT NULL DEFAULT 0,
 total_price BIGINT NOT NULL,
 payment_due_at TIMESTAMPTZ(3),
 proof_uploaded_at TIMESTAMPTZ(3),
 decision_due_at TIMESTAMPTZ(3),
 payment_proof_key TEXT,
 completed_at TIMESTAMPTZ(3),
 created_at TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT purchases_event_id_id_key UNIQUE(event_id,id),
 CONSTRAINT purchases_amounts_check CHECK (
   subtotal BETWEEN 0 AND 9007199254740991 AND voucher_discount >= 0
   AND coupon_discount >= 0 AND points_used >= 0 AND total_price >= 0
   AND total_price = subtotal - voucher_discount - coupon_discount - points_used
 ),
 CONSTRAINT purchases_payment_deadline_check CHECK (
   status <> 'WAITING_FOR_PAYMENT' OR (total_price > 0 AND payment_due_at IS NOT NULL)
 ),
 CONSTRAINT purchases_review_deadline_check CHECK (
   status <> 'WAITING_FOR_ADMIN_CONFIRMATION'
   OR (proof_uploaded_at IS NOT NULL AND decision_due_at IS NOT NULL AND payment_proof_key IS NOT NULL)
 ),
 CONSTRAINT purchases_completion_check CHECK (status <> 'DONE' OR completed_at IS NOT NULL)
);
CREATE INDEX purchases_customer_id_created_at_idx ON temuevent.purchases(customer_id,created_at);
CREATE INDEX purchases_event_id_status_idx ON temuevent.purchases(event_id,status);
CREATE INDEX purchases_status_payment_due_at_idx ON temuevent.purchases(status,payment_due_at);
CREATE INDEX purchases_status_decision_due_at_idx ON temuevent.purchases(status,decision_due_at);
CREATE TABLE temuevent.purchase_items (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 event_id UUID NOT NULL,
 purchase_id UUID NOT NULL,
 ticket_type_id UUID NOT NULL,
 quantity INTEGER NOT NULL,
 unit_price BIGINT NOT NULL,
 line_total BIGINT NOT NULL,
 CONSTRAINT purchase_items_event_id_purchase_id_fkey FOREIGN KEY(event_id,purchase_id)
   REFERENCES temuevent.purchases(event_id,id) ON DELETE RESTRICT,
 CONSTRAINT purchase_items_event_id_ticket_type_id_fkey FOREIGN KEY(event_id,ticket_type_id)
   REFERENCES temuevent.ticket_types(event_id,id) ON DELETE RESTRICT,
 CONSTRAINT purchase_items_purchase_id_ticket_type_id_key UNIQUE(purchase_id,ticket_type_id),
 CONSTRAINT purchase_items_quantity_check CHECK (quantity > 0),
 CONSTRAINT purchase_items_amounts_check CHECK (
   unit_price >= 0 AND line_total <= 9007199254740991 AND line_total = unit_price * quantity
 )
);
CREATE INDEX purchase_items_event_id_purchase_id_idx ON temuevent.purchase_items(event_id,purchase_id);
CREATE INDEX purchase_items_event_id_ticket_type_id_idx ON temuevent.purchase_items(event_id,ticket_type_id);
-- The backend login has explicit permissions. No grants to Data API roles.
GRANT USAGE ON TYPE temuevent."EventStatus",temuevent."PurchaseStatus" TO temuevent_app;
GRANT SELECT,INSERT,UPDATE,DELETE ON temuevent.events,temuevent.ticket_types TO temuevent_app;
GRANT SELECT,INSERT,UPDATE ON temuevent.purchases,temuevent.purchase_items TO temuevent_app;
ALTER TABLE temuevent.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE temuevent.ticket_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE temuevent.purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE temuevent.purchase_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY events_backend_access ON temuevent.events FOR ALL TO temuevent_app USING(true) WITH CHECK(true);
CREATE POLICY ticket_types_backend_access ON temuevent.ticket_types FOR ALL TO temuevent_app USING(true) WITH CHECK(true);
CREATE POLICY purchases_backend_access ON temuevent.purchases FOR ALL TO temuevent_app USING(true) WITH CHECK(true);
CREATE POLICY purchase_items_backend_access ON temuevent.purchase_items FOR ALL TO temuevent_app USING(true) WITH CHECK(true);
REVOKE ALL ON temuevent.events,temuevent.ticket_types,temuevent.purchases,temuevent.purchase_items FROM PUBLIC,anon,authenticated,service_role;
