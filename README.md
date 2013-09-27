# Alt

Alt is a clean and simple alternative interface to NewsBlur.

Alt is hosted online at [altfeedreader.com](http://www.altfeedreader.com/). The [introductory blog post](http://davidjohnstone.net/blog/2013/06/alt-is-a-simpler-and-prettier-interface-to-newsblur) has more information.

![](http://www.altfeedreader.com/static/front-1.png)

## What is this?

[NewsBlur](http://www.newsblur.com/) exposes an [API](http://www.newsblur.com/api) that allows one to get their feeds, get items from their feeds and do everything else that NewsBlur supports. Rather than creating another feed fetching and parsing backend, Alt makes use of a NewsBlur account so that NewsBlur's servers do all the work of making the data ready to display.

Therefore, Alt is an alternative interface to a NewsBlur account. It displays the same data that NewsBlur does, and items marked as read in Alt are marked as read in NewsBlur, but it's designed to be cleaner and simpler. I might be biased, but I prefer using this.

There are some big advantages to this approach:

* It makes this project much simpler, as there are a lot of moving parts in a system that has to fetch and parse feeds for any number of users (Alt doesn't even use a database).
* It means, provided you already have a NewsBlur account, you can try it out without having to set up a new account (hands up, those who have more accounts with feed readers than you can count on one hand).
* It also means it's not the end of the world if this project is disappears, since NewsBlur will still be there, and all your data will be unaffected.

## Main features

Alt isn't yet a fully featured replacement interface for NewsBlur. Here are some of the things it currently does:

* Infinite scrolling — as you scroll down, more items appear.
* View items from all feeds, all feeds in a folder, or a single feed.
* Options to show unread items or all of them, sort by newest or oldest first, and show full items or only headlines. These preferences are saved between visits.
* A hideable feeds list, for a cleaner feed reading experience.

## Getting it running

The backend is a simple Flask (Python) application. It only requires `Flask` and `requests`, which can be installed with:

    pip install flask requests

The server can then be started with:

    python run.py

The site will then be available on `http://127.0.0.1:5001/`.

## Some notes about the code

### Server side

The server side code mostly exists to pass API calls on to the NewsBlur API and handle logging in.

This doesn't use a database, so the only state the server has to worry about is in the authentication cookie. When authenticating with the NewsBlur API, an authentication cookie is returned, and this cookie is stored in Alt's cookie.

### Client side

This was originally intended to be a complete feed reader system, so the JavaScript was structured to work well with the backend I was developing. However, the NewsBlur API is conceptually different which means the code isn't nearly as beautiful as it could be — NewsBlur API support mostly been shoehorned onto the structure that was already there. Add to that a "just get it working" attitude, and you get what we have today (although that might make it sound worse than it actually is).

At a high level, this is what happens when you load the page:

* The current settings (show unread/all, newest/oldest first, show full/headlines, show feeds box) are loaded from `localStorage`, or given default values.
* The user's subscriptions are loaded.
* When the user's subscriptions are loaded:
  * The "feeds box" is instantiated.
  * The current queue is set to be the user's "river of news" (all items).
* When the queue is set to be something:
  * The current queue is cleared.
  * The first page of the feed is retrieved with the current settings (for sorting and showing).

Most of it isn't too complicated, although there is a bit of magic involved in deciding whether or not to resize the box that items are shown in because of what they contain. That is, the boxes are normally a certain width, but if they contain large images, they are expanded to show them in their full glory (without going larger than the window). Alternatively, if they contain images that are slightly smaller than the box, the box might be resized to more naturally frame the image, depending on the amount of text and the width of the image[s].

## What's next?

There are all sorts of things that could be done, including:

* Feed and folder management (adding and deleting feeds and folders, and moving them around).
* A better "headlines" mode, which would look better and be more information dense.
* A resizable "feeds box".
* Loading the subscriptions list and the initial items simultaneously to make the site load faster.
* Improvements for working on mobile devices.

## About me

I'm [David Johnstone](http://davidjohnstone.net). I keep myself busy building [Cycling Analytics](https://www.cyclinganalytics.com/), a website for cyclists (which means I'm not going out of my way to spend lots of time on Alt). I can be found on Twitter as [@cyclist_dave](https://twitter.com/cyclist_dave), or emailed at [david@davidjohnstone.net](mailto:david@davidjohnstone.net).

## License

MIT
