(function() {

var parseIsoDate = isNaN(new Date('2012-01-01 06:00:00').getTime()) || // Some browsers (Safari 5) don't support ISO 8601 dates.
			new Date('2012-01-01 06:00:00').getUTCHours() != 6 ? // Some browsers (Firefox) decide to understand dates created like this in the local timezone.
	function(date) {
		// Assume all dates look like '2012-03-14' or '2012-08-31T23:39:26'.
		if (date.length >= 19) {
			return new Date(Date.UTC(date.substr(0, 4), date.substr(5, 2) - 1, date.substr(8, 2), date.substr(11, 2), date.substr(14, 2), date.substr(17, 2)));
		} else {
			return new Date(Date.UTC(date.substr(0, 4), date.substr(5, 2) - 1, date.substr(8, 2)));
		}
	} :
	function(date) {
		return new Date(date);
	};

$('#back-to-top').click(function(e) {
	e.preventDefault();
	$('html, body').animate({ scrollTop: 0 });
});

$('#feeds-box').data({
	showFn: function() {
		$('#feeds-box').data('visible', true);
		$('#main').css('margin-left', 260); 
		$(window).resize();
		window.localStorage['feedsBox'] = 'show';
	},
	hideFn: function() {
		$('#feeds-box').data('visible', false);
		$('#main').css('margin-left', 0);
		$(window).resize();
		window.localStorage['feedsBox'] = 'hide';
	}
});

$('#counter').click(function(e) {
	e.preventDefault();
	if (!$('#feeds-box').is(':visible')) {
		windowManager.show($('#feeds-box'));
	} else {
		windowManager.hide($('#feeds-box'));
	}
});
/*
concepts:
	active queue
		where the visible items come from
		either the user's queue or the feed of a single website
		the user's queue may be outdated, and the new one stored locally too
	user's state
		a store of all a user's unread items, by feed
		used to create the subscriptions list box
		used to create the unread items count
		has getQueue() method
	items cache
		items are only fetched in the whole when they are needed

if there are less than five unread items rendered and there items not yet shown:
	fetch and render them

when an item is read:
	tell the DB
	tell the feeds list
	update the unread count
	check the above

every couple of minutes download the queue:
	if there are new items:
		add them to the user's state
		update the appropriate visible counts
*/

var queue = [];
var subscriptions = [];
var folders = [];

var api = new function() {
	var that = this;
	var activeRequests = 0;

	var startRequest = function() {
		activeRequests++;
		if (activeRequests > 0) {
			$('.active-requests').show();
		}
		$('.request-error').hide();
	};

	var stopRequest = function() {
		activeRequests--;
		if (activeRequests == 0) {
			$('.active-requests').hide();
		}
	};

	this.ajax = function(method, path, data, fn, errorFn) {
		if (typeof data === 'function') {
			errorFn = fn;
			fn = data;
			data = undefined;
		}
		var options = {
			type: method,
			url: '/api' + path,
			success: function(data) {
				stopRequest();
				if (fn) {
					fn(data);
				}
			},
			error: function() {
				stopRequest();
				$('.request-error').show();
				if (errorFn) {
					errorFn();
				}
			}
		};
		if (data !== undefined) {
			options.data = data;
		}
		startRequest();
		return $.ajax(options)
	};

	this.get = function(path, data, fn, errorFn) {
		return that.ajax('GET', path, data, fn, errorFn);
	};

	this.post = pageMode == 'full' ? function(path, data, fn) {
		return that.ajax('POST', path, data, fn);
	} : function (path, data, fn) {};
};

var state = new function() {
	var that = this;

	this.subscriptions = {};

	this.init = function(subscriptions) {
		for (var id in subscriptions) {
			var sub = subscriptions[id];
			that.subscriptions[sub.id] = {feedId: sub.id, title: sub.feed_title, siteUrl: sub.feed_link, folder: '', items: [], unread: sub.nt};
		}
		feedBox.init();
		queueManager.setQueue('river_stories');
		that.updateUnreadCounter();
		that.refresh();
	};

	this.refresh = function() {
		api.get('/reader/refresh_feeds', function(data) {
			for (var id in data.feeds) {
				that.subscriptions[id].unread = data.feeds[id].nt;
			}
		});
		that.updateUnreadCounter();
	};

	this.getUnreadCount = function() {
		var r = 0;
		for (var feedId in that.subscriptions) {
			var sub = that.subscriptions[feedId];
			r += sub.unread;
		}
		return r;
	}

	this.resetQueue = function() {
		for (var feedId in that.subscriptions) {
			var feed = that.subscriptions[feedId];
			feed.items = [];
		}
	};

	this.addSubscription = function(sub) {
		that.subscriptions[sub.feedId] = {feedId: sub.feedId, title: sub.title, siteUrl: sub.siteUrl, folder: sub.folder, items: []};
		feedBox.init(); // TODO Something better
	};

	this.addQueue = function(queue) {
		for (var i = 0; i < queue.length; i++) {
			var item = queue[i];
			item.time = Date.parse(item.time);
			if (that.subscriptions[item.feedId] == undefined) {
				var b = 1;
			}
			if (that.subscriptions[item.feedId].items.indexOf(item) < 0) {
				that.subscriptions[item.feedId].items.push(item);
			}
		}
		that.updateUnreadCounter();
	};

	this.updateUnreadCounter = function() {
		var count = this.getUnreadCount();
		$('#counter').text(count);
		document.title = (count > 0 ? '(' + count + ') ' : '') + 'Alt';
		feedBox.updateCounts();
	};
	this.updateUnreadCounter.bind(this);

	this.getQueue = function() {
		var queue = [];
		for (var feedId in that.subscriptions) {
			var sub = that.subscriptions[feedId];
			queue = queue.concat(sub.items)
		}
		queue.sort(function(a, b) { return b.time - a.time; }); // Is this ordered the right way?
		return queue;
	};

	var readQueue = [];
	var lastUpdateTime = 0;
	var currentTime = 0;
	var createDict = function() {
		var dict = {};
		readQueue.map(function(i) { dict[i.story_feed_id] = []; });
		readQueue.map(function(i) { dict[i.story_feed_id].push(i.id); });
		return {feeds_stories: JSON.stringify(dict)};
	};
	setInterval(function() {
		if (readQueue.length > 0) {
			api.post('/reader/mark_feed_stories_as_read', createDict());
			readQueue = [];
			lastUpdateTime = currentTime;
		}
		// This commented out code is the "correct" way to do it according to the instructions in the NewsBlur API, but it's too slow in updating, and too easy to finish reading feeds and close the page before they're actually marked as read.
		/*if (readQueue.length == 0) {
			return;
		} else if (readQueue.length >= 5) {
			api.post('/reader/mark_feed_stories_as_read', createDict());
			readQueue = [];
			lastUpdateTime = currentTime;
		} else if (readQueue.length > 0 && currentTime - 10 > lastUpdateTime) {
			api.post('/reader/mark_feed_stories_as_read', createDict());
			readQueue = [];
			lastUpdateTime = currentTime;
		}*/
		currentTime++;
	}, 1000);

	this.readItem = function(item) {
		that.subscriptions[item.story_feed_id].unread--;
		that.updateUnreadCounter();
		readQueue.push(item);
	};

	this.unreadItem = function(item) {
		that.subscriptions[item.story_feed_id].unread++;
		that.updateUnreadCounter();
		if (readQueue.filter(function(i) { return i.id == item.id; }).length > 0) {
			readQueue = readQueue.filter(function(i) { return i.id != item.id; });
		} else {
			api.post('/reader/mark_story_as_unread', {story_id: item.id, feed_id: item.story_feed_id});
		}
	};

	this.readFeed = function(feed) {
		api.post('/reader/mark_feed_as_read', {feed_id: feed.feedId});
		feed.unread = 0;
		that.updateUnreadCounter();
	};

	this.readFeeds = function(feeds) {
		var ids = $.param({feed_id: feeds}).replace(/%5B%5D/g, '');
		api.post('/reader/mark_feed_as_read', ids);
		feeds.map(function(f) { that.subscriptions[f].unread = 0; });
		that.updateUnreadCounter();
	};

	this.readAll = function() {
		api.post('/reader/mark_all_as_read');
		for (f in that.subscriptions) {
			that.subscriptions[f].unread = 0;
		}
		that.updateUnreadCounter();
	};

	this.getFeedTitle = function(feedId) {
		return that.subscriptions[feedId].title;
	}

	setInterval(this.refresh, 120000);
};

var queueManager = new function() {
	var that = this;

	this.queue;
	this.queueRenderer;
	this.queuePosition = 0;
	this.visible = 0;
	this.seen = 0;
	this.fetching = false;

	this.feedId;
	this.page = 1;
	this.showing = 0;
	this.moreStories = [];
	this.order = 'newest';
	this.readFilter = 'unread';
	this.viewMode = 'full';
	this.currentRequest;

	if (window.localStorage['order'] == 'oldest') {
		this.order = 'oldest';
		$('#header .newest-oldest-label').text('Oldest');
	}

	if (window.localStorage['readFilter'] == 'all') {
		this.readFilter = 'all';
		$('#header .unread-all-label').text('All');
	}

	if (window.localStorage['viewMode'] == 'headlines') {
		this.viewMode = 'headlines';
		$('#header .full-headlines-label').text('Headlines');
	}

	this.setQueue = function(feedId) {
		that.queueRenderer.clear();
		if (that.currentRequest) {
			that.currentRequest.abort();
		}
		that.feedId = feedId;
		that.page = 1;
		that.fetching = false;
		that.showing = 0;
		that.moreStories = [];
		that.atEnd = false;
		that.fetchItems();
	};

	this.fetchItems = function() {
		if (that.moreStories.length == 0) {
			that.fetching = true;
			that.queueRenderer.fetching();
			var f = (that.feedId == 'river_stories' || typeof that.feedId === 'object') ? 'river_stories' : 'feed/' + that.feedId;
			var options = {page: that.page, read_filter: that.readFilter, order: that.order};
			if (typeof that.feedId === 'object') {
				options.feeds = that.feedId;
				options = $.param(options).replace(/%5B%5D/g, '');
			}
			that.currentRequest = api.get('/reader/' + f, options, function(data) {
				that.currentRequest = undefined;
				that.page++;
				that.fetching = false;
				if (data.stories.length > 5 && that.viewMode == 'full') {
					var storiesToDisplay = data.stories.slice(0, Math.ceil(data.stories.length / 2));
					that.moreStories = data.stories.slice(Math.ceil(data.stories.length / 2), data.stories.length);
				} else {
					var storiesToDisplay = data.stories;
				}
				if (storiesToDisplay.length > 0) {
					that.showing += storiesToDisplay.length;
					that.queueRenderer.add(storiesToDisplay);
					$('#main-message').fadeOut(200);
				} else {
					that.atEnd = true;
					that.queueRenderer.noMoreItems();
				}
			});
		} else {
			that.showing += that.moreStories.length;
			that.queueRenderer.add(that.moreStories);
			that.moreStories = [];
		}
	};

	this.setQueueRenderer = function(queueRenderer) {
		that.queueRenderer = queueRenderer;
		that.queueRenderer.setMode(that.viewMode);
	};

	this.readItem = function(item, index, updateState) {
		if (updateState) {
			state.readItem(item);
		}
		that.seen++;
		if (that.showing - index < (that.viewMode == 'headlines' ? 20 : 5) && !that.fetching && !that.atEnd) {
			that.fetchItems();
		}
	};

	this.updateSettings = function(key, value) {
		that[key] = value;
		window.localStorage[key] = value;
		that.setQueue(that.feedId);
	};

	$('#header .show-unread').click(function(e) {
		if (that.readFilter != 'unread') {
			$('#header .unread-all-label').text('Unread');
			that.updateSettings('readFilter', 'unread');
		}
	});

	$('#header .show-all').click(function(e) {
		if (that.readFilter != 'all') {
			$('#header .unread-all-label').text('All');
			that.updateSettings('readFilter', 'all');
		}
	});

	$('#header .show-newest-first').click(function(e) {
		if (that.readFilter != 'newest') {
			$('#header .newest-oldest-label').text('Newest');
			that.updateSettings('order', 'newest');
		}
	});

	$('#header .show-oldest-first').click(function(e) {
		if (that.readFilter != 'oldest') {
			$('#header .newest-oldest-label').text('Oldest');
			that.updateSettings('order', 'oldest');
		}
	});

	$('#header .show-full-stories').click(function(e) {
		if (that.viewMode != 'full') {
			$('#header .full-headlines-label').text('Full');
			that.updateSettings('viewMode', 'full');
			that.queueRenderer.setMode('full');
		}
	});

	$('#header .show-headlines').click(function(e) {
		if (that.viewMode != 'headlines') {
			$('#header .full-headlines-label').text('Headlines');
			that.updateSettings('viewMode', 'headlines');
			that.queueRenderer.setMode('headlines');
		}
	});
};

// This is pretty dumb; it just handles the UI side of things.
var queueRenderer = new function() {
	var that = this;

	this.mode = 'full';
	this.itemCount = 0;

	this.queueManager;

	this.setQueueManager = function(queueManager) {
		that.queueManager = queueManager;
	};

	this.setMode = function(mode) {
		that.mode = mode;
	};

	this.lastBox = $('#last-box');

	this.clear = function() {
		$('#items').empty();
		that.itemCount = 0;
		that.active = null;
		window.scrollTo(0,0);
		that.lastBox.height(0);
	};

	this.createItemEl = function(item) {
		var showContent = function(item, el) {
			el.find('.item-content').html(item.story_content).find('a').attr('target', '_blank');
			el.find('.item-content').find('*').removeAttr('style class id'); // Inline styles can be evil.
			el.find('img, iframe').load(function() {
				var $this = $(this);
				// If the image is too wide.
				var containerWidth = $this.parents('.item').width() - 80;
				var imageWidth = this.naturalWidth; // If .width() is used, CSS scaling is applied if the image is cached, which causes this to give an incorrectly small value. No support for <=IE8. Note that if the image is scaled by the blog itself, then this will still use the real value, and give suboptimal results. Maybe check for a width attribute first, and use that if it exists.
				var parents = $this.parentsUntil('.item-content');
				var maxWidth = 0;
				// This isn't perfect: it's still gets confused by images inside lists.
				parents.each(function() { var w = $(this).outerWidth(true); if (w > maxWidth) { maxWidth = w; } })
				maxWidth = Math.max(imageWidth, maxWidth);
				if (maxWidth > containerWidth) {
					$this.parents('.item').data('widened', true).width(maxWidth + 80);
				}
				// If the image is a bit smaller, there aren't any significant images sized differently, and there's not much text.
				var otherImages = $(this).parents('.item-content').find('img, iframe');
				var thisSizedImages = otherImages.filter(function() { return $this.width() == $(this).width(); });
				var largishImages = otherImages.filter(function() { return $this.width() < $(this).width(); });
				var textLength = $this.parents('.item-content').text().length;
				var textImageRation = textLength / thisSizedImages.length;
				var imageSizeTextLimit = 75000 / (10 + containerWidth - imageWidth);
				if (imageWidth >= 540 && textLength / thisSizedImages.length < 75000 / (10 + containerWidth - imageWidth)) {
					var item = $this.parents('.item');
					if (!item.data('widened')) {
						$this.parents('.item').width($this.width() + 80);
					}
				}
				// On another note, if the image is fairly large, but being displayed inline, display it as a block. Blogs have a habit of doing this, causing the firstly line of next sentence to be awkwardly inline after the image.
				if ($this.height() > 80) {
					$this.addClass('block-image');
				}
			});
		};
		var el = $('' +
			'<div class="item">' +
				'<div class="top-row"><span class="feed-name">' + state.getFeedTitle(item.story_feed_id) + '</span> ' + (item.story_authors != '' ? '<span class="author">by ' + item.story_authors + '</span>' : '') + '<span class="right"><span class="read-status"><i class="icon-eye-open"></i></span><span class="time" title="' + item.story_date + '">' + item.story_date + '</span></span></div>' +
				'<div class="item-box">' +
					'<h2><a href="' + item.story_permalink + '" target="_blank">' + item.story_title + '</a></h2>' +
					'<div class="item-content"></div>' +
				'</div>' +
			'</div>');
		if (that.mode == 'headlines') {
			el.addClass('headline');
			el.find('.item-box').prepend(el.find('.top-row'));
			$('<div class="cover"></div>').click(function() {
				var el = $(this).parents('.item');
				el.removeClass('headline');
				el.prepend(el.find('.top-row'));
				showContent(el.data('item'), el);
			}).appendTo(el.find('.item-box'));
		} else {
			showContent(item, el);
		}
		el.data('item', item);
		el.data('index', that.itemCount);
		that.itemCount++;
		var now = Date.now();
		el.find('.time').each(function() {
			var d = parseIsoDate($(this).text());
			$(this).text(relativeTime(now, d));
		});
		if (item.read_status != 0) {
			el.addClass('seen');
			el.find('.read-status').addClass('read').attr('title', 'Click to keep this item unread').find('i').removeClass('icon-eye-close').addClass('icon-eye-open');
		}
		el.find('.read-status').click(function(e) {
			e.preventDefault();
			if ($(this).hasClass('read')) {
				$(this).removeClass('read').addClass('unread').attr('title', 'Click to mark this item as read').find('i').removeClass('icon-eye-open').addClass('icon-eye-close');
				state.unreadItem(el.data('item'));
			} else {
				$(this).removeClass('unread').addClass('read').attr('title', 'Click to keep this item unread').find('i').removeClass('icon-eye-close').addClass('icon-eye-open');
				state.readItem(el.data('item'));
			}
		});
		this.lastBox.height(Math.max(20, window.innerHeight - el.height() - 20 - 100 - 125)); // So the last item can be "seen". 20px for item padding, 100px for bottom, 125px for message
		return el;
	};

	this.changeMessage = function(m) {
		var fn = function() { $('#main-message').html(m).fadeIn(200); };
		if ($('#main-message').is(':visible')) {
			$('#main-message').fadeOut(200, fn);
		} else {
			fn();
		}
	};

	this.noMoreItems = function() {
		that.changeMessage('No more stories.');
	};

	this.noItems = function() {
		$('#items').html('<div class="main-status-message">No unread items.</div>');
		this.lastBox.height(0);
	};

	this.loadingSubscriptions = function() {
		that.changeMessage('<i class="icon-spinner icon-spin icon-large"></i> Loading subscriptions&hellip;');
		this.lastBox.height(0);
	};

	this.fetching = function() {
		that.changeMessage('<i class="icon-spinner icon-spin icon-large"></i> Loading stories&hellip;');
	};

	this.add = function(stories) {
		for (var i = 0; i < stories.length; i++) {
			$('#items').append(this.createItemEl(stories[i]));
		}
		$('.main-status-message').hide();
	};
	this.add.bind(this);

	this.active;

	this.checkInView = function() {
		var topOffset = window.pageYOffset || document.documentElement.scrollTop || document.body.scrollTop;
		$('.item').each(function(i) {
			if (($(this).offset().top <= topOffset + 100 && i > 0) || (i == 0 && topOffset > 10)) {
				var updateState = false;
				if (!$(this).hasClass('seen')) {
					if (!$(this).hasClass('headline')) {
						$(this).addClass('seen');
						$(this).find('.read-status').addClass('read');
						$(this).find('.read-status').attr('title', 'Click to keep this item unread');
						updateState = true;
					}
				}
				that.queueManager.readItem($(this).data('item'), $(this).data('index'), updateState); 
				that.active = $(this);
			}
		});
		$('.active').removeClass('active');
		if (that.active) {
			that.active.addClass('active');
		}
	};

	var intervalStarted = false;

	$(window).scroll(function() {
		that.checkInView();
		if (!intervalStarted) {
			setInterval(that.checkInView, 1000);
			intervalStarted = true;
		}
	});

	$(document).keypress(function(e) {
		var r = true;
		if (e.target.tagName.toLowerCase() == 'input') {
			return;
		}
		if (e.which == 106) { // j
			r = false;
			if (that.active) {
				if (that.active.next().length == 0) {
					return r; // already at end
				}
				$('.active').removeClass('active');
				that.active = that.active.next();
			} else {
				that.active = $('.item:first');
			}
		} else if (e.which == 107) { // k
			r = false;
			if (that.active) {
				if (that.active.prev().length == 0) {
					return r; // already at start
				}
				$('.active').removeClass('active');
				that.active = that.active.prev();
			} else {
				that.active = $('.item:first');
			}
		}
		if (e.which == 106 || e.which == 107) {
			that.active.addClass('active');
			that.active.find('.top-row')[0].scrollIntoView();
			return r;
		}
	});
};

var feedBox = new function() {

	var that = this;
	
	var getFavicon = function(siteUrl) {
		if (siteUrl === null) {
			return '';
		}
		var splitPos = siteUrl.indexOf('/', 8);
		var baseUrl = splitPos == -1 ? siteUrl : siteUrl.substring(0, splitPos)
		return 'http://g.etfv.co/' + baseUrl + '?defaulticon=lightpng';
	};

	// from http://stackoverflow.com/questions/986937/how-can-i-get-the-browsers-scrollbar-sizes
	var getScrollBarWidth = function() {
		var inner = document.createElement('p');
		inner.style.width = "100%";
		inner.style.height = "200px";
		
		var outer = document.createElement('div');
		outer.style.position = "absolute";
		outer.style.top = "0px";
		outer.style.left = "0px";
		outer.style.visibility = "hidden";
		outer.style.width = "200px";
		outer.style.height = "150px";
		outer.style.overflow = "hidden";
		outer.appendChild (inner);
		
		document.body.appendChild (outer);
		var w1 = inner.offsetWidth;
		outer.style.overflow = 'scroll';
		var w2 = inner.offsetWidth;
		if (w1 == w2) w2 = outer.clientWidth;
		
		document.body.removeChild (outer);
		
		return (w1 - w2);
	};
	
	this.tree = {name: 'All items', root: true, items: []};

	this.init = function() {
		that.tree = {name: 'All items', root: true, folders: [], feeds: []};
		for (var feedId in state.subscriptions) {
			var sub = state.subscriptions[feedId];
			if (sub.folder.length == 0) {
				that.tree.feeds.push(sub);
			} else {
				var path = sub.folder;
				var dir = that.tree;
				for (var i = 0; i < path.length; i++) {
					var folder = dir.folders.filter(function(x) { return path[i] == x.name; });
					if (folder.length == 0) {
						folder = {name: path[i], folders: [], feeds: []};
						dir.folders.push(folder);
						dir = folder;
					} else {
						dir = folder[0];
					}
				}
				dir.feeds.push(sub);
			}
		}
		that.tree = {name: 'All items', root: true, items: []};
		that.buildTree(that.tree, folders);
		$('#subscriptions').empty();
		that.renderTree(that.tree, $('#subscriptions'));
		that.updateCounts();
		//$('#feeds-box').css('width', $('#feeds-box').width() + getScrollBarWidth()); // Some magic because the scrollbars cause the box to be a bit too thin, causing the right-aligned dropdown arrow to overlap wide text. -- This is currently commented out because, now that this is not shown on top of everything, it can cause an overlap over items.
	};

	this.buildTree = function(tree, items) {
		for (var i = 0; i < items.length; i++) {
			if (typeof items[i] === 'number') {
				tree.items.push(state.subscriptions[items[i]]);
			} else {
				for (name in items[i]) {
					var newTree = {name: name, root: false, items: []};
					that.buildTree(newTree, items[i][name])
					tree.items.push(newTree);
				}
			}
		}
	};

	this.renderTree = function(tree, el) {
		tree.el = el;
		if (tree.root) {
			that.renderFolderLabel(tree, el);
		}
		for (var i = 0; i < tree.items.length; i++) {
			if (!('feedId' in tree.items[i])) {
				that.renderFolderLabel(tree.items[i], el);
				that.renderTree(tree.items[i], $('<div class="folder" style="display: none"></div>').appendTo(el));
			} else {
				that.renderLabel(tree.items[i], el);
			}
		}
	};

	this.buildItemList = function(tree, list) {
		for (var i = 0; i < tree.items.length; i++) {
			if (!('feedId' in tree.items[i])) {
				that.buildItemList(tree.items[i], list)
			} else {
				list.push(tree.items[i].feedId);
			}
		}
		return list;
	};

	this.renderFolderLabel = function(folder, el) {
		var row = $('' +
			'<div class="label folder-label">' +
				(folder.root ? '' : '<i class="icon-folder icon-folder-close" title="Click to expand/collapse folder"></i>') +
				'<span class="title folder-title ' + (folder.root ? 'root-folder-title' : '') + '">' + folder.name + '</span> <span class="unread-count"></span>' +
				'<span class="label-menu"><i class="icon-chevron-down"></i>' +
					'<div class="dropdown">' +
						'<div class="mark-all-as-read"><i class="icon-eye-open"></i>Mark all as read</div>' +
					'</div>' +
				'</span>' +
			'</div>').appendTo(el);
		row.data('folder', folder);
		folder.labelEl = row;
		row.click(function(e) {
			e.preventDefault();
			var folder = $(this).data('folder');
			if (folder.root) {
				queueManager.setQueue('river_stories');
			} else {
				queueManager.setQueue(that.buildItemList(folder, []));
			}
			return;
		});
		row.find('.mark-all-as-read').click(function(e) {
			e.preventDefault();
			e.stopPropagation();
			var folder = $(this).parents('.folder-label').data('folder');
			if (folder.root) {
				state.readAll();
			} else {
				var items = that.buildItemList(folder, []);
				state.readFeeds(items);
			}
		});
		row.find('.icon-folder').click(function(e) {
			e.preventDefault();
			e.stopPropagation();
			var row = $(this).parents('.folder-label').data('folder');
			if ($(this).hasClass('icon-folder-open')) {
				$(this).removeClass('icon-folder-open').addClass('icon-folder-close');
				row.el.hide();
			} else {
				$(this).removeClass('icon-folder-close').addClass('icon-folder-open');
				row.el.show();
			}
		});
	};

	this.renderLabel = function(feed, el) {
		var row = $('' +
			'<div id="label-' + feed.feedId + '" class="label">' +
				'<span class="title">' + feed.title + '</span> <span class="unread-count"></span>' +
				'<span class="label-menu"><i class="icon-chevron-down"></i>' +
					'<div class="dropdown">' +
						'<div class="mark-all-as-read"><i class="icon-eye-open"></i>Mark all as read</div>' +
						//'<div class="unsubscribe"><i class="icon-remove"></i>Unsubscribe</div>' +
					'</div>' +
				'</span>' +
			'</div>').appendTo(el);
		row.data('feed', feed);
		feed.el = row;
		if (feed.items.length > 0) {
			row.find('.unread-count').text('(' + feed.items.length + ')');
			row.addClass('has-unread');
		}
		row.click(function(e) {
			e.preventDefault();
			queueManager.setQueue($(this).data('feed').feedId);
			return;
			e.preventDefault();
			var items = $(this).data('feed').items;
			items.sort(function(a, b) { return b.time - a.time; });
			queueManager.setQueue(items);
		});
		row.find('.mark-all-as-read').click(function(e) {
			e.preventDefault();
			e.stopPropagation();
			state.readFeed($(this).parents('.label').data('feed'));
		});
		row.find('.unsubscribe').click(function(e) {
			e.preventDefault();
			e.stopPropagation();
			state.removeSubscription($(this).parents('.label').data('feed'));
		});
		var favicon = $('<img class="favicon" src="' + getFavicon(feed.siteUrl) + '" width=16 height=16>').prependTo(row);
		favicon.error(function() {
			favicon.replaceWith('<span class="favicon replacement"></span>');
		});
	};

	this.updateFolderCounts = function() {
		that.updateFolderCountsInner(that.tree);
	};

	this.updateCountsInner = function(tree) {
		var count = 0;
		for (var i = 0; i < tree.items.length; i++) {
			if (!('feedId' in tree.items[i])) {
				count += that.updateCountsInner(tree.items[i])
			} else {
				var feed = tree.items[i];
				var feedCount = feed.unread;
				if (feedCount > 0) {
					feed.el.addClass('has-unread').find('.unread-count').text('(' + feedCount + ')');
				} else {
					feed.el.removeClass('has-unread').find('.unread-count').text('');
				}
				count += feedCount;
			}
		}
		if ('labelEl' in tree) {
			tree.labelEl.find('.unread-count').text(count > 0 ? '(' + count + ')' : '');
		}
		return count;
	};

	this.updateCounts = function() {
		that.updateCountsInner(that.tree);
	};
};

state.addQueue(queue);
queueManager.setQueueRenderer(queueRenderer);
queueRenderer.setQueueManager(queueManager);
queueRenderer.loadingSubscriptions();
feedBox.init();

api.get('/reader/feeds', function(data) {
	folders = data.folders;
	state.init(data.feeds);
	if (window.localStorage['feedsBox'] == undefined || window.localStorage['feedsBox'] == 'show') {
		windowManager.show($('#feeds-box'));
	}
}, function() {
	queueRenderer.changeMessage('Unable to load subscriptions. Refresh page to try again.');
});

$('#show-contact').click(function(e) {
	if (!$('#contact-box').is(':visible')) {
		windowManager.show($('#contact-box'));
	} else {
		windowManager.hide($('#contact-box'));
	}
});

})();