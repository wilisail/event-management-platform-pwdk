"""Bounded hosted F2 checks using disposable accounts and a short-lived Preview link."""
import argparse
import copy
import datetime as dt
import hashlib
import http.cookiejar
import json
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
    parser.add_argument('--phase', choices=['reads', 'accept', 'reject', 'attendance-review'], required=True)
    parser.add_argument('--private-config', required=True)
    parser.add_argument('--report', required=True)
    args = parser.parse_args()
    with open(args.private_config, encoding='utf8') as source:
        config = json.load(source)
    run_id = str(uuid.UUID(config['runId']))
    origin = config['origin']
    assert origin == 'https://temuevent-combined-qa-andor2.vercel.app'
    assert config['shareUrl'].startswith(origin + '/?_vercel_share=')
    assert dt.datetime.fromisoformat(config['expiresAt'].replace('Z', '+00:00')) > dt.datetime.now(dt.timezone.utc)

    def identifier(label):
        data = bytearray(hashlib.sha256((run_id + ':' + label).encode()).digest()[:16])
        data[6] = (data[6] & 15) | 64
        data[8] = (data[8] & 63) | 128
        return str(uuid.UUID(bytes=bytes(data)))

    platform = http.cookiejar.CookieJar()
    entry = urllib.request.build_opener(SameOriginRedirect(), urllib.request.HTTPCookieProcessor(platform))
    response = entry.open(config['shareUrl'], timeout=25)
    assert response.status == 200
    response.read()

    def client():
        jar = http.cookiejar.CookieJar()
        for cookie in platform:
            jar.set_cookie(copy.copy(cookie))
        return urllib.request.build_opener(SameOriginRedirect(), urllib.request.HTTPCookieProcessor(jar))

    anonymous = client()

    def request(path, user=None, body=None):
        assert path.startswith('/api/')
        opener, csrf = user if user else (anonymous, None)
        headers = {'Origin': origin}
        if csrf:
            headers['x-csrf-token'] = csrf
        payload = None
        if body is not None:
            payload = json.dumps(body).encode()
            headers.update({'Content-Type': 'application/json', 'x-temuevent-client': 'web'})
        try:
            result = opener.open(urllib.request.Request(origin + path, data=payload, headers=headers), timeout=25)
        except urllib.error.HTTPError as error:
            result = error
        data = result.read()
        print(json.dumps({'request': path, 'status': result.code}), flush=True)
        parsed = json.loads(data) if 'application/json' in result.headers.get('content-type', '') else None
        return result.code, parsed, data, result.headers

    def login(label):
        email = 'final-c-' + run_id[:8] + '-' + label + '@example.test'
        opener = client()
        status, body, _, _ = request('/api/auth/login', (opener, None), {'email': email, 'password': config['password']})
        assert status == 200, 'Disposable login: ' + str(status)
        return opener, body['data']['csrfToken']

    organizer = login('organizer')
    purchase_id = identifier('purchase-accept')
    path = '/api/organizer/transactions/' + purchase_id
    checks = []
    if args.phase == 'reads':
        buyer = login('buyer-a')
        other = login('other-organizer')
        assert request(path + '/proof')[0] == 401
        assert request(path + '/proof', buyer)[0] == 403
        assert request(path + '/proof', other)[0] == 404
        status, _, data, headers = request(path + '/proof', organizer)
        assert status == 200 and data.startswith(b'\x89PNG\r\n\x1a\n')
        assert headers.get('cache-control') == 'private, no-store'
        assert request(path, organizer)[1]['data']['decisionAvailability'] == 'READY'
        checks = ['Owned private PNG bytes', 'Signed-out/Customer/foreign-owner denials', 'No-store response', 'Ready decision binding']
    elif args.phase in ['accept', 'reject']:
        for label, decision in [(args.phase, 'ACCEPT' if args.phase == 'accept' else 'REJECT')]:
            target = '/api/organizer/transactions/' + identifier('purchase-' + label) + '/decision'
            status = request(target, organizer, {'decision': decision})[0]
            assert status == 200, 'Decision ' + decision + ': ' + str(status)
            assert request(target, organizer, {'decision': decision})[0] == 409
        checks = ['Live ' + args.phase, 'Duplicate decision returns 409']
    else:
        event_id = identifier('event-auto')
        status = request('/api/organizer/events/' + event_id + '/attendance', organizer,
                         {'customerId': identifier('user-buyer-a'), 'transactionId': purchase_id})[0]
        assert status in [200, 201], 'Attendance: ' + str(status)
        buyer = login('buyer-a')
        root = '/api/events/' + event_id + '/reviews'
        assert request(root + '/eligibility', buyer)[1]['data']['eligible'] is True
        assert request(root, buyer, {'rating': 5, 'comment': 'Ulasan uji integrasi sementara.'})[0] in [200, 201]
        assert request(root, buyer, {'rating': 5, 'comment': 'Duplikat harus ditolak.'})[0] == 409
        checks = ['Live attendance', 'Attended Customer eligibility', 'Persisted review', 'Duplicate review returns 409']
    report = {'checkedAt': dt.datetime.now(dt.timezone.utc).isoformat(), 'phase': args.phase,
              'passed': True, 'checks': checks, 'manualUserAcceptance': False}
    with open(args.report, 'w', encoding='utf8') as target:
        json.dump(report, target, indent=2)
        target.write('\n')
    print(json.dumps(report))


if __name__ == '__main__':
    main()
