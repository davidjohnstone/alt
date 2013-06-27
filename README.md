# Alt

Alt is a clean and simple alternative interface to NewsBlur by [David Johnstone](http://davidjohnstone.net).

## Getting it running

The backend is a simple Flask (Python) server. It requires `Flask`, `Flask-Assets`, `closure`, `cssmin` and `requests`, which can be installed with:

    pip install flask flask-assets closure cssmin requests

*The dependency on `Flask-Assets`, `closure` and `cssmin` could easily be removed if desired, as they only exist to minify the CSS and JS.*

The server can then be started with:

    python run.py

The site will then be available on `127.0.0.1:5001`.
