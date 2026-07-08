import urllib.request
urls = ['http://127.0.0.1:5000',
        'http://127.0.0.1:5000/static/js/app.js',
        'http://127.0.0.1:5000/static/js/admin.js',
        'http://127.0.0.1:5000/api/flats']

for u in urls:
    try:
        with urllib.request.urlopen(u, timeout=5) as r:
            data = r.read()
            print('URL:', u)
            print('Status:', r.getcode())
            print('Content-Length:', len(data))
            print('Preview:\n', data[:800].decode('utf-8', errors='replace'))
            print('\n' + ('-'*80) + '\n')
    except Exception as e:
        print('URL:', u)
        print('ERROR:', repr(e))
        print('\n' + ('-'*80) + '\n')
