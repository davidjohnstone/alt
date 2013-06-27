# Alt

Alt is a clean and simple alternative interface to NewsBlur by [David Johnstone](http://davidjohnstone.net).

Alt is hosted online at [altfeedreader.com](http://www.altfeedreader.com/). The [introductory blog post](http://davidjohnstone.net/blog/2013/06/alt-is-a-simpler-and-prettier-interface-to-newsblur) has more information about Alt.

## Getting it running

The backend is a simple Flask (Python) application. It only requires `Flask` and `requests`, which can be installed with:

    pip install flask requests

The server can then be started with:

    python run.py

The site will then be available on `127.0.0.1:5001`.

## Some notes about the code

### Server side

The server side code mostly exists to pass API calls on to the NewsBlur API and handle logging in.

This doesn't use a database, so the only state the server has to worry about is in the authentication cookie. When authenticating with the NewsBlur API, an authentication cookie is returned, and this cookie is stored in Alt's cookie.

### Client side

This was originally intended to be a complete feed reader system, so the JavaScript was structured to work well with the backend I was developing. However, the NewsBlur API is conceptually different which means the code isn't nearly as beautiful as it could be — NewsBlur API support mostly been shoehorned onto the structure that was already there. Add to that a "just get it working" attitude, and you get what we have today.

At a high level, this is what happens when you load the page:

* The current settings (show unread/all, newest/oldest first, show full/headlines, show feeds box) are loaded from `localStorage`, or given default values.
* The user's subscriptions are loaded.
* When the user's subscriptions are loaded:
  * The "feeds box" is instantiated.
  * The current queue is set to be the user's "river of news" (all items).
* When the queue is set to be something:
  * The current queue is cleared.
  * The first page of the feed is retrieved with the current settings (for sorting and showing).

Most if it isn't too complicated, although there is a bit of magic involved in deciding whether or not to resize the box that items are shown in because of what they contain. That is, the boxes are normally a certain width, but if they contain large images, they are expanded to show them in their full glory (without going larger than the window). Alternatively, if they contain images that are slighty smaller than the box, the box might be resized to more naturally frame the image, depending on the amount of text and the width of the image[s].

## License

The MIT License.
