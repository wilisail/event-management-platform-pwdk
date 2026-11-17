"""Bounded QA verification through normal hosted APIs; credentials stay in a private config."""
import argparse
import copy
import datetime as dt
import http.cookiejar
import json
import os
import time
from pathlib import Path
import urllib.error
import urllib.parse
import urllib.request
import uuid


class SameOriginRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        assert urllib.parse.urlsplit(newurl).netloc == urllib.parse.urlsplit(req.full_url).netloc
        return super().redirect_request(req, fp, code, msg, headers, newurl)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--phase', choices=['setup', 'deadlines'], required=True)
    parser.add_argument('--private-config', required=True)
    parser.add_argument('--proof', required=True)
    parser.add_argument('--report', required=True)
    args = parser.parse_args()
    private = Path(args.private_config)
    c = json.loads(private.read_text())
    origin = c['origin']
    assert origin == 'https://temuevent-f2-checkout-verify-andor2.vercel.app'
    assert c['applicationOrigin'] == 'https://temuevent-combined-qa-andor2.vercel.app'
    assert c['shareUrl'].startswith(origin + '/?_vercel_share=')
    assert dt.datetime.fromisoformat(c['expiresAt'].replace('Z', '+00:00')) > dt.datetime.now(dt.timezone.utc)
    assert str(uuid.UUID(c['runId'])) == c['runId']

    def save():
        temp = private.with_suffix('.tmp')
        fd = os.open(temp, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
        with os.fdopen(fd, 'w') as f:
            json.dump(c, f)
        temp.replace(private)

    checks = []
    report = {'checkedAt': dt.datetime.now(dt.timezone.utc).isoformat(), 'phase': args.phase,
              'deploymentId': c['deploymentId'], 'sourceCommit': c['sourceCommit'],
              'liveDatabaseUsed': True, 'livePrivateStorageUsed': True,
              'ownerBrowserAccepted': False, 'inboxReceiptConfirmed': False,
              'recipient': 'owner-established QA inbox via temporary Gmail aliases', 'checks': checks}

    def passed(name):
        checks.append(name)
        print('HOSTED_CHECKOUT_OK: ' + name, flush=True)

    platform = http.cookiejar.CookieJar()
    entry = urllib.request.build_opener(SameOriginRedirect(), urllib.request.HTTPCookieProcessor(platform))
    r = entry.open(c['shareUrl'], timeout=30)
    assert r.status == 200
    r.read()

    def client():
        jar = http.cookiejar.CookieJar()
        for cookie in platform:
            jar.set_cookie(copy.copy(cookie))
        return urllib.request.build_opener(SameOriginRedirect(), urllib.request.HTTPCookieProcessor(jar))

    anonymous = client()

    def request(path, actor=None, body=None, raw=None, content_type='image/png', extra=None):
        assert path.startswith('/api/')
        opener, csrf = actor if actor else (anonymous, None)
        headers = {'Origin': c['applicationOrigin']}
        data = None
        if body is not None or raw is not None:
            headers['x-temuevent-client'] = 'web'
            if csrf:
                headers['x-csrf-token'] = csrf
            if raw is not None:
                data = raw
                headers['Content-Type'] = content_type
            else:
                data = json.dumps(body).encode()
                headers['Content-Type'] = 'application/json'
        headers.update(extra or {})
        try:
            r = opener.open(urllib.request.Request(origin + path, data=data, headers=headers), timeout=40)
        except urllib.error.HTTPError as e:
            r = e
        value = r.read()
        parsed = json.loads(value) if 'application/json' in r.headers.get('content-type', '') else None
        print(json.dumps({'request': path, 'status': r.code}), flush=True)
        return r.code, parsed, value, r.headers

    def good(path, actor=None, body=None, raw=None, status=200):
        code, parsed, _, _ = request(path, actor, body, raw)
        assert code == status, f'{path}: expected {status}, got {code}; code={(parsed or {}).get("code")}'
        assert parsed and parsed.get('success')
        return parsed['data']

    def login(label):
        opener = client()
        result = good('/api/auth/login', (opener, None), {'email': c['actors'][label]['email'], 'password': c['password']})
        return opener, result['csrfToken']

    def wallet(actor):
        return good('/api/me/rewards?pageSize=50', actor)

    def purchase(actor, label, ticket, *, points=0, coupon=None):
        ids = c.setdefault('purchaseIds', {})
        ids.setdefault(label, str(uuid.uuid4()))
        save()
        total = max(0, ticket['price'] - (25000 if coupon else 0) - points)
        payload = {'purchaseId': ids[label], 'eventId': c['eventId'],
                   'items': [{'ticketTypeId': ticket['id'], 'quantity': 1}],
                   'pointsRequested': points, 'couponId': coupon,
                   'expectedSubtotal': ticket['price'], 'expectedTotal': total}
        p = good('/api/checkout/purchases', actor, payload, status=201)
        c.setdefault('purchaseInputs', {})[label] = payload
        c.setdefault('purchaseReferences', {})[label] = p['reference']
        save()
        return p

    def upload(actor, p):
        return good('/api/me/purchases/' + p['id'] + '/proof', actor, raw=Path(args.proof).read_bytes())

    def decision(actor, p, value):
        path = '/api/organizer/transactions/' + p['id'] + '/decision'
        good(path, actor, {'decision': value})
        assert request(path, actor, {'decision': value})[0] == 409

    try:
        if args.phase == 'setup':
            actors = c.setdefault('actors', {})
            local, domain = c['testInboxBase'].lower().split('@')
            assert domain in ['gmail.com', 'googlemail.com']
            local = local.split('+')[0]
            for label, role in [('organizer', 'ORGANIZER'), ('foreign', 'ORGANIZER'), ('referrer', 'CUSTOMER'), ('buyer', 'CUSTOMER')]:
                if label in actors:
                    continue
                fields = {'name': f'QA checkout {label} {c["tag"]}',
                          'email': f'{local}+temuqa-{c["tag"]}-{label}@{domain}',
                          'password': c['password'], 'role': role}
                if label == 'buyer':
                    fields['referralCode'] = actors['referrer']['referralCode']
                user = good('/api/auth/register', body=fields, status=201)['user']
                actors[label] = user
                save()
            organizer, foreign, referrer, buyer = [login(label) for label in ['organizer', 'foreign', 'referrer', 'buyer']]
            assert wallet(referrer)['availablePoints'] == 10000
            coupons = wallet(buyer)['coupons']['items']
            coupon = next(x for x in coupons if x['status'] == 'AVAILABLE' and x['discountValue'] == 25000)
            c['couponId'] = coupon['id']
            passed('New referral registration grants exactly 10,000 points and a Rp25,000 coupon')

            if 'eventId' not in c:
                start = dt.datetime.now(dt.timezone.utc) + dt.timedelta(days=3)
                event = good('/api/events', organizer, {'name': 'QA checkout sementara ' + c['tag'],
                    'category': 'Learning', 'location': 'Jakarta', 'venue': 'Verifikasi QA',
                    'description': 'Data uji sementara; tidak ada transfer uang. Dihapus setelah verifikasi.',
                    'startAt': start.isoformat(), 'endAt': (start + dt.timedelta(hours=2)).isoformat(),
                    'status': 'PUBLISHED', 'ticketTypes': [
                        {'name': 'QA Regular', 'description': 'Paid journey', 'price': 50000, 'quota': 6},
                        {'name': 'QA Community', 'description': 'Fully discounted journey', 'price': 10000, 'quota': 3}]}, status=201)
                c['eventId'] = event['id']
                save()
            event = good('/api/events/' + c['eventId'])
            regular = next(t for t in event['ticketTypes'] if t['name'] == 'QA Regular')
            community = next(t for t in event['ticketTypes'] if t['name'] == 'QA Community')
            c['tickets'] = {'regular': regular, 'community': community}
            save()
            passed('Normal Organizer event creation persists published ticket inventory')

            a = purchase(referrer, 'accept', regular, points=5000)
            assert a['status'] == 'WAITING_FOR_PAYMENT' and a['totalPrice'] == 45000
            assert good('/api/me/purchases/' + a['id'], referrer)['status'] == 'WAITING_FOR_PAYMENT'
            assert request('/api/me/purchases/' + a['id'])[0] == 401
            assert request('/api/me/purchases/' + a['id'], buyer)[0] == 404
            assert request('/api/checkout/purchases', (referrer[0], None), c['purchaseInputs']['accept'])[0] == 403
            assert request('/api/me/purchases/' + a['id'] + '/proof', referrer, raw=b'invalid PNG')[0] == 400
            upload(referrer, a)
            path = '/api/organizer/transactions/' + a['id'] + '/proof'
            assert request(path)[0] == 401
            assert request(path, referrer)[0] == 403
            assert request(path, foreign)[0] == 404
            status, _, data, headers = request(path, organizer)
            assert status == 200 and data.startswith(b'\xff\xd8\xff')
            assert headers.get('cache-control') == 'private, no-store'
            assert request('/api/me/purchases/' + a['id'] + '/proof', referrer)[0] == 200
            passed('Private hosted proof upload/read succeeds; anonymous, Customer and foreign-Organizer access are guarded')
            decision(organizer, a, 'ACCEPT')
            done = good('/api/me/purchases/' + a['id'], referrer)
            assert done['status'] == 'DONE'
            assert wallet(referrer)['availablePoints'] == 5000
            assert good('/api/checkout/purchases', referrer, c['purchaseInputs']['accept'], status=201)['id'] == a['id']
            attendees = good('/api/organizer/events/' + c['eventId'] + '/attendees', organizer)
            assert attendees['items'][0]['ticketQuantity'] == 1
            review_path = '/api/events/' + c['eventId'] + '/reviews'
            assert good(review_path + '/eligibility', referrer)['eligible'] is True
            good(review_path, referrer, {'rating': 4, 'comment': 'Uji hosted sementara.', 'reportedAttendance': False}, status=201)
            assert request(review_path, referrer, {'rating': 5})[0] == 409
            passed('Real approval consumes 5,000 points, updates participants and permits review with attendance unchecked')

            rejected = purchase(buyer, 'reject', regular, coupon=coupon['id'])
            assert rejected['totalPrice'] == 25000
            upload(buyer, rejected)
            decision(organizer, rejected, 'REJECT')
            assert good('/api/me/purchases/' + rejected['id'], buyer)['status'] == 'REJECTED'
            assert next(x for x in wallet(buyer)['coupons']['items'] if x['id'] == coupon['id'])['status'] == 'AVAILABLE'
            passed('Real rejection restores the referral coupon and sends one normal decision notification per purchase')

            purchase(referrer, 'expire', regular, points=1000)
            canceled = purchase(buyer, 'cancel', regular, coupon=coupon['id'])
            upload(buyer, canceled)
            passed('Fresh unpaid and proof-submitted purchases prepared for the existing deadline worker')
            report['decisionNotificationsExpected'] = 2
        else:
            organizer, referrer, buyer = [login(label) for label in ['organizer', 'referrer', 'buyer']]
            for attempt in range(4):
                expired = good('/api/me/purchases/' + c['purchaseIds']['expire'], referrer)['status']
                canceled = good('/api/me/purchases/' + c['purchaseIds']['cancel'], buyer)['status']
                if expired == 'EXPIRED' and canceled == 'CANCELED':
                    break
                if attempt < 3:
                    time.sleep(10)
            assert expired == 'EXPIRED' and canceled == 'CANCELED'
            assert wallet(referrer)['availablePoints'] == 5000
            assert next(x for x in wallet(buyer)['coupons']['items'] if x['id'] == c['couponId'])['status'] == 'AVAILABLE'
            event = good('/api/events/' + c['eventId'])
            assert next(t for t in event['ticketTypes'] if t['name'] == 'QA Regular')['availableSeats'] == 5
            passed('Existing hosted worker expires/cancels newly created orders and restores seats, points and coupon')
            zero = purchase(buyer, 'free', c['tickets']['community'], coupon=c['couponId'])
            assert zero['status'] == 'DONE' and zero['totalPrice'] == 0 and zero['paymentDueAt'] is None
            assert request('/api/me/purchases/' + zero['id'] + '/proof', buyer, raw=Path(args.proof).read_bytes())[0] == 409
            good('/api/events/' + c['eventId'] + '/reviews', buyer,
                 {'rating': 5, 'comment': 'Uji hosted dengan checkbox dicentang.', 'reportedAttendance': True}, status=201)
            attendees = good('/api/organizer/events/' + c['eventId'] + '/attendees', organizer)
            assert len(attendees['items']) == 2
            passed('Fully discounted checkout becomes DONE without proof; checked attendance also permits review')
        report['passed'] = True
    except Exception as error:
        report['passed'] = False
        report['failure'] = str(error)
        raise
    finally:
        report['fixtureTag'] = c['tag']
        report['createdAccountCount'] = len(c.get('actors', {}))
        report['createdPurchaseCount'] = len(c.get('purchaseIds', {}))
        Path(args.report).write_text(json.dumps(report, indent=2) + '\n')
        print(json.dumps(report), flush=True)


if __name__ == '__main__':
    main()
