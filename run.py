from urlparse import urljoin

from flask import Flask, render_template, jsonify, request, g, redirect, session, flash
from flask.ext.assets import Environment, Bundle
import requests
from requests.exceptions import ConnectionError

import config

app = Flask(__name__)
assets = Environment(app)
app.config['MAX_CONTENT_LENGTH'] = 4 * 1024 * 1024

app.secret_key = config.secret_key

assets.debug = False # Remember to have this as False, and run the code before deploying to build the JS.
#assets.debug = True
assets.auto_build = True
assets.manifest = 'file'
assets.config['CLOSURE_COMPRESSOR_OPTIMIZATION'] = 'SIMPLE_OPTIMIZATIONS'
assets.register('js_all', Bundle('reader.js', 'shared.js', filters='closure_js', output='script/%(version)s.js'))
assets.register('css_all', Bundle('style.css', filters='cssmin', output='style/%(version)s.css'))

@app.before_request
def before_request():
    g.user = session.get('p') is not None

@app.route('/')
def main():
    if g.user:
        return render_template('reader.html')
    else:
        failed_email = session.pop('failed_login') if 'failed_login' in session else None
        return render_template('front.html', failed_login=failed_email is not None, failed_email=failed_email)

@app.route('/try')
def trysite():
    if g.user:
        return redirect('/')
    else:
        return render_template('reader.html', trysite=True)

@app.route('/logout')
def logout():
    session.clear()
    return redirect('/')

@app.route('/login', methods=['POST'])
def login():
    auth = False
    email = request.form.get('email')
    password = request.form.get('password')
    r = requests.post('https://www.newsblur.com/api/login', data={'username': email, 'password': password})
    try:
        j = r.json()
        if j['authenticated']:
            auth = True
            cookie = r.cookies['newsblur_sessionid']
            session['p'] = 'nb' # provider=newsblur
            session['v'] = cookie # value=cookie
            session.permanent = True
    except ValueError:
        auth = False
    if not auth:
        session['failed_login'] = email
    return redirect('/')

@app.route('/api/<path:path>', methods=['GET', 'POST'])
def api(path):
    requester = requests.post if request.method == 'POST' else requests.get
    params = request.args.lists()
    data = request.form.lists()
    cookies = {'newsblur_sessionid': session['v']} if g.user else None
    response_code = 500
    try:
        r = requester(urljoin('https://www.newsblur.com/', path), cookies=cookies, params=params, data=data)
        j = r.json()
        response_code = r.status_code
    except ValueError:
        response_code = 503
        j = {'error': 'Unable to perform request'}
    except ConnectionError:
        response_code = 503
        j = {'error': 'Unable to perform request'}
    return jsonify(**j), response_code

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5001)

