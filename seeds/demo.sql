-- Repeatable development fixtures. No passwords or working customer logins.
-- Re-running adds missing demo records only; it does not reset other data.
DO $$
DECLARE
 org_id UUID; customer_uuid UUID;
 coffee_id UUID; music_id UUID; meetup_id UUID;
 regular_id UUID; workshop_id UUID; music_ticket_id UUID; free_ticket_id UUID;
 selected_ticket UUID; selected_event UUID; selected_price BIGINT;
 new_purchase UUID; ref TEXT; state temuevent."PurchaseStatus";
 states TEXT[] := ARRAY['WAITING_FOR_PAYMENT','WAITING_FOR_ADMIN_CONFIRMATION','DONE','REJECTED','EXPIRED','CANCELED'];
 created TIMESTAMPTZ(3); proof TIMESTAMPTZ(3); completed TIMESTAMPTZ(3);
 seed_now TIMESTAMPTZ(3) := CURRENT_TIMESTAMP;
 i INTEGER;
BEGIN
 SELECT id INTO org_id FROM temuevent.users WHERE email='organizer@example.test' AND role='ORGANIZER';
 SELECT id INTO customer_uuid FROM temuevent.users WHERE email='ayu@example.test' AND role='CUSTOMER';
 IF org_id IS NULL OR customer_uuid IS NULL THEN RAISE EXCEPTION 'Expected development organizer and customer are missing'; END IF;
 INSERT INTO temuevent.events(organizer_id,slug,name,category,location,venue,address,description,start_at,end_at,status)
 VALUES
 (org_id,'jakarta-coffee-festival-demo','Jakarta Coffee Festival (Demo)','Food & Beverage','Jakarta','Senayan Park','Jakarta Pusat','Development sample based on the feature 1 coffee-event layout.',seed_now+interval '7 days',seed_now+interval '7 days 8 hours','PUBLISHED'),
 (org_id,'independent-music-night-demo','Independent Music Night (Demo)','Musik','Bandung','Spasial Soda','Bandung','Development sample for paid tickets.',seed_now+interval '14 days',seed_now+interval '14 days 4 hours','PUBLISHED'),
 (org_id,'jakarta-tech-meetup-demo','Jakarta Tech Meetup (Demo)','Teknologi','Jakarta','GoWork Pacific Place','Jakarta Selatan','Development sample for free registration.',seed_now+interval '21 days',seed_now+interval '21 days 3 hours','PUBLISHED')
 ON CONFLICT(slug) DO NOTHING;
 SELECT id INTO coffee_id FROM temuevent.events WHERE slug='jakarta-coffee-festival-demo' AND organizer_id=org_id;
 SELECT id INTO music_id FROM temuevent.events WHERE slug='independent-music-night-demo' AND organizer_id=org_id;
 SELECT id INTO meetup_id FROM temuevent.events WHERE slug='jakarta-tech-meetup-demo' AND organizer_id=org_id;
 IF coffee_id IS NULL OR music_id IS NULL OR meetup_id IS NULL THEN RAISE EXCEPTION 'A demo slug belongs to another organizer'; END IF;
 INSERT INTO temuevent.ticket_types(event_id,name,description,price,quota,available_seats)
 VALUES
 (coffee_id,'Regular Pass','Main festival area',150000,30,30),
 (coffee_id,'Workshop Pass','Festival and one brewing workshop',250000,10,10),
 (music_id,'Regular Pass','Music event entry',85000,18,18),
 (meetup_id,'Free RSVP','Free meetup registration',0,60,60)
 ON CONFLICT(event_id,name) DO NOTHING;
 SELECT id INTO regular_id FROM temuevent.ticket_types WHERE event_id=coffee_id AND name='Regular Pass';
 SELECT id INTO workshop_id FROM temuevent.ticket_types WHERE event_id=coffee_id AND name='Workshop Pass';
 SELECT id INTO music_ticket_id FROM temuevent.ticket_types WHERE event_id=music_id AND name='Regular Pass';
 SELECT id INTO free_ticket_id FROM temuevent.ticket_types WHERE event_id=meetup_id AND name='Free RSVP';
 FOR i IN 1..30 LOOP
  state := states[1+((i-1)%6)]::temuevent."PurchaseStatus";
  ref := 'DEMO-20261028-'||lpad(i::text,3,'0');
  selected_ticket := CASE WHEN i=3 THEN free_ticket_id WHEN i%2=0 THEN music_ticket_id WHEN i%5=0 THEN workshop_id ELSE regular_id END;
  SELECT event_id,price INTO selected_event,selected_price FROM temuevent.ticket_types WHERE id=selected_ticket;
  created := CASE WHEN state='WAITING_FOR_PAYMENT' THEN seed_now-interval '15 minutes'
    WHEN state IN ('WAITING_FOR_ADMIN_CONFIRMATION','EXPIRED') THEN seed_now-interval '3 hours'
    WHEN state='CANCELED' THEN seed_now-interval '5 days'
    ELSE seed_now-make_interval(days=>1+(i%5)) END;
  proof := CASE WHEN state IN ('WAITING_FOR_ADMIN_CONFIRMATION','REJECTED','CANCELED')
    OR (state='DONE' AND selected_price>0) THEN created+interval '30 minutes' ELSE NULL END;
  completed := CASE WHEN state='DONE' THEN created+interval '1 hour' ELSE NULL END;
  new_purchase := NULL;
  INSERT INTO temuevent.purchases(reference,customer_id,event_id,status,subtotal,total_price,payment_due_at,proof_uploaded_at,decision_due_at,payment_proof_key,completed_at,created_at)
  VALUES(ref,customer_uuid,selected_event,state,selected_price,selected_price,
    CASE WHEN selected_price>0 THEN created+interval '2 hours' ELSE NULL END,
    proof,CASE WHEN proof IS NOT NULL THEN proof+interval '72 hours' ELSE NULL END,
    CASE WHEN proof IS NOT NULL THEN 'DEMO_ONLY_NO_FILE/'||ref ELSE NULL END,completed,created)
  ON CONFLICT(reference) DO NOTHING RETURNING id INTO new_purchase;
  IF new_purchase IS NOT NULL THEN
   INSERT INTO temuevent.purchase_items(event_id,purchase_id,ticket_type_id,quantity,unit_price,line_total)
   VALUES(selected_event,new_purchase,selected_ticket,1,selected_price,selected_price);
   IF state IN ('WAITING_FOR_PAYMENT','WAITING_FOR_ADMIN_CONFIRMATION','DONE') THEN
    UPDATE temuevent.ticket_types SET available_seats=available_seats-1 WHERE id=selected_ticket;
   END IF;
  END IF;
 END LOOP;
END;
$$;
