var windowManager = new function() {
	this.windows = []; // A stack of windows that are visible. This exists so that escape can close the most recently opened window.
	that = this;
	
	$(document).keyup(function(e) {
		if (e.which == 27) {
			if (that.windows.length > 0) {
				that.hide($(that.windows.pop()));
			}
		}
	});

	this.show = function(w) {
		// Store the actual element in here, because comparing jQuery elements doesn't always work.
		this.windows.push(w.get(0));
		w.fadeIn(200);
		if (w.data('showFn')) {
			w.data('showFn')();
		}
	};

	this.hide = function(w) {
		var el = w.get(0);
		if (w) {
			w.fadeOut(200);
			that.windows.splice(that.windows.indexOf(el), 1);
		} else {
			$(that.windows.pop()).fadeOut(200);
		}
		if (w.data('hideFn')) {
			w.data('hideFn')();
		}
	};

	this.add = function(w) {
		this.windows.push(w.get(0));
	};

	this.remove = function(w) {
		var el = w.get(0);
		this.windows.splice(this.windows.indexOf(el), 1);
	};
};

(function (Date, undefined) {
    var origParse = Date.parse, numericKeys = [ 1, 4, 5, 6, 7, 10, 11 ];
    Date.parse = function (date) {
        var timestamp, struct, minutesOffset = 0;

        // ES5 §15.9.4.2 states that the string should attempt to be parsed as a Date Time String Format string
        // before falling back to any implementation-specific date parsing, so that’s what we do, even if native
        // implementations could be faster
        // 1 YYYY 2 MM 3 DD 4 HH 5 mm 6 ss 7 msec 8 Z 9 ± 10 tzHH 11 tzmm
        if ((struct = /^(\d{4}|[+\-]\d{6})(?:-(\d{2})(?:-(\d{2}))?)?(?:T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{3}))?)?(?:(Z)|([+\-])(\d{2})(?::(\d{2}))?)?)?$/.exec(date))) {
            // avoid NaN timestamps caused by “undefined” values being passed to Date.UTC
            for (var i = 0, k; (k = numericKeys[i]); ++i) {
                struct[k] = +struct[k] || 0;
            }

            // allow undefined days and months
            struct[2] = (+struct[2] || 1) - 1;
            struct[3] = +struct[3] || 1;

            if (struct[8] !== 'Z' && struct[9] !== undefined) {
                minutesOffset = struct[10] * 60 + struct[11];

                if (struct[9] === '+') {
                    minutesOffset = 0 - minutesOffset;
                }
            }

            timestamp = Date.UTC(struct[1], struct[2], struct[3], struct[4], struct[5] + minutesOffset, struct[6], struct[7]);
        }
        else {
            timestamp = origParse ? origParse(date) : NaN;
        }

        return timestamp;
    };
}(Date));

// http://stackoverflow.com/questions/6108819/javascript-timestamp-to-relative-time-eg-2-seconds-ago-one-week-ago-etc-best
function relativeTime(current, previous) {

	var msPerMinute = 60 * 1000;
	var msPerHour = msPerMinute * 60;
	var msPerDay = msPerHour * 24;
	var msPerMonth = msPerDay * 30;
	var msPerYear = msPerDay * 365;

	var elapsed = current - previous;
	var future = elapsed < 0;
	var prefix = future ? 'in ' : '';
	var suffix = future ? '' : ' ago';
	elapsed = Math.abs(elapsed);

	if (Math.round(elapsed/1000) * 1000 < msPerMinute) {
		var v = Math.round(elapsed/1000);
		if (v == 0) {
			return 'now';
		} else if (v == 1) {
			return prefix + '1 second' + suffix;
		} else {
			return prefix + v + ' seconds' + suffix;
		}
	}
	else if (Math.round(elapsed/msPerMinute) * msPerMinute < msPerHour) {
		var v = Math.round(elapsed/msPerMinute);
		if (v == 1) {
			return prefix + '1 minute' + suffix;
		} else {
			return prefix + v + ' minutes' + suffix;
		}
	}
	else if (Math.round(elapsed/msPerHour) * msPerHour < msPerDay ) {
		var v = Math.round(elapsed/msPerHour);
		if (v == 1) {
			return prefix + '1 hour' + suffix;
		} else {
			return prefix + v + ' hours' + suffix;
		}
	}
	else if (Math.round(elapsed/msPerDay) * msPerDay < msPerMonth) {
		var v = Math.round(elapsed/msPerDay);
		if (v == 1) {
			if (future) {
				return 'tomorrow';
			} else {
				return 'yesterday';
			}
		} else {
			return prefix + v + ' days' + suffix;
		}
	}
	else if (Math.round(elapsed/msPerMonth) * msPerMonth < msPerYear) {
		var v = Math.round(elapsed/msPerMonth);
		if (v == 1) {
			if (future) {
				return 'next month';
			} else {
				return 'last month';
			}
		} else {
			return prefix + v + ' months' + suffix;
		}
	}
	else {
		var v = Math.round(elapsed/msPerYear);
		if (v == 1) {
			if (future) {
				return 'next year';
			} else {
				return 'last year';
			}
		} else {
			return prefix + v + ' years' + suffix;
		}
	}
}

$(document).ready(function() {
	$('.close-button').click(function() {
		windowManager.hide($(this).parent());
	});
	
	if ($('#flash').length) {
		windowManager.add($('#flash'));
	}
});
