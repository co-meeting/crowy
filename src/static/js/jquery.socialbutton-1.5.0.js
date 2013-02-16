/**
 * jquery.socialbutton - jQuery plugin for social networking websites
 * http://itra.jp/jquery_socialbutton_plugin/
 * 
 * Copyright 2010, Itrans, Inc. http://itra.jp/
 * 
 * Dual licensed under the MIT or GPL Version 2 licenses.
 * http://jquery.org/license
 * 
 * Version: 1.5.0
 */

/**
 * SYNOPSIS
 * 
 * 
 * mixi_check: 
 * http://developer.mixi.co.jp/connect/mixi_plugin/mixi_check/spec_mixi_check
 * 
 * $('#mixi_check').socialbutton('mixi_check', {
 *     key: 'mixi-check-key'
 * });
 * 
 * $('#mixi_check').socialbutton('mixi_check', {
 *     key: 'mixi-check-key',
 *     button: 'button-1',
 *     url: 'http://itra.jp/',
 *     encoded: true
 * });
 * 
 * 
 * facebook_like:
 * http://developers.facebook.com/docs/reference/plugins/like
 * 
 * $('#facebook_like').socialbutton('facebook_like');
 * 
 * $('#facebook_like').socialbutton('facebook_like', {
 *     button: 'standard', // synonym 'layout'
 *     url: 'http://itra.jp',
 *     encoded: true,
 *     show_faces: true,
 *     width: 450,
 *     height: 80,
 *     action: 'like',
 *     font: 'arial',
 *     colorscheme: 'light'
 * });
 * 
 * 
 * Twitter:
 * http://twitter.com/goodies/tweetbutton
 * 
 * $('#twitter').socialbutton('twitter');
 * 
 * $('#twitter').socialbutton('twitter', {
 *     button: 'vertical', // synonym 'count'
 *     url: 'http://itra.jp/',
 *     encoded: true,
 *     text: 'tweet text',
 *     lang: 'ja',
 *     via: 'ishiiyoshinori',
 *     related: 'twitter'
 * });
 * 
 * 
 * GREE Social Feedback:
 * http://developer.gree.co.jp/connect/plugins/sf
 * 
 * $('#gree_sf').socialbutton('gree_sf');
 * 
 * $('#gree_sf').socialbutton('gree_sf', {
 *     button: 0, // synonym 'type'
 *     url: 'http://itra.jp/',
 *     encoded: true,
 *     width: 0, // auto
 *     height: 20
 * });
 * 
 * 
 * Evernote Site Memory
 * http://www.evernote.com/about/developer/sitememory/
 * 
 * $('#evernote').socialbutton('evernote');
 * 
 * $('#evernote').socialbutton('evernote', {
 *     button: 'article-clipper',
 *     url: 'http://itra.jp/',
 *     encoded: true,
 *     provider_name: 'itra.jp',
 *     suggest_notebook: 'webclip',
 *     content_id: 'element-id-to-clip',
 *     code: 'your-affiliate-code',
 *     title: 'note-title',
 *     suggest_tags: 'comma-separated-tags,up-to-three-tags',
 *     styling: 'full'
 * });
 * 
 * 
 * Hatena Bookmark
 * http://b.hatena.ne.jp/
 * 
 * $('#hatena').socialbutton('hatena');
 * 
 * $('#hatena').socialbutton('hatena', {
 *     button: 'standard',
 *     url: 'http://itra.jp/',
 *     encoded: true,
 *     title: 'page-title'
 * });
 * 
 * 
 * Hatena Bookmark (Old Style)
 * http://b.hatena.ne.jp/
 * 
 * $('#hatena').socialbutton('hatena_oldstyle');
 * 
 * $('#hatena').socialbutton('hatena_oldstyle', {
 *     button: '/path/to/your-icon.png',
 *     url: 'http://itra.jp/',
 *     encoded: true,
 *     padding: 10,
 *     height: 15
 * });

 * 
 */
(function($) {

$.fn.socialbutton = function(service, options) {

	options = options || {};

	var defaults = {
		mixi_check: {
			key: '',
			button: 'button-1', // button-1,button-2,button-3,button-4,button-5
			url: '', // document.URL
			encoded: true
		},
		facebook_like: {
			button: 'standard', // standard / button_count / box_count
			url: document.URL,
			encoded: true,

			show_faces: true,
			width: 0, // auto
			height: 0, // auto

			width_standard_default: 450, // orig: 450
			width_standard_minimum: 225,
			height_standard_without_photo: 35,
			height_standard_with_photo: 80,

			width_button_count_default: 120, // orig: 90, jp_min: 114
			width_button_count_minimum: 90,
			height_button_count: 25, // orig:20, jp_min: 21

			width_box_count_default: 80, // orig:55, jp_min: 75
			width_box_count_minimum: 55,
			height_box_count: 70, // orig: 65, jp_min: 66

			action: 'like', // like / recommend
			font: '',
			colorscheme: 'light' // light / dark
		},
		twitter: {
			button: 'vertical', // vertical / horizontal / none
			url: '', // document.URL
			encoded: true,
			text: '',
			lang: 'ja', // ja / en /de / fr / es
			via: '',
			related: ''
		},
		gree_sf: {
			button: 0, // 0,1,2,3,4
			url: document.URL,
			encoded: true,
			width: 0, // auto
			height: 20,

			widths: {
				type0_16: 58, type0_20: 70, type0_23: 76,
				type1_16: 58, type1_20: 73, type1_23: 78,
				type2_16: 58, type2_20: 73, type2_23: 78,
				type3_16: 49, type3_20: 61, type3_23: 64,
				type4_16: 16, type4_22: 21, type4_32: 32
			}
		},
		evernote: {
			button: 'article-clipper', // article-clipper, article-clipper-remember, article-clipper-jp, article-clipper-rus, article-clipper-fr, article-clipper-es, article-clipper-de, article-clipper-vert, site-mem-32, site-mem-36, site-mem-22, site-mem-16
			url: '', // document.URL
			encoded: true,
			provider_name: '', // domain name
			suggest_notebook: '', // notebook name
			content_id: '', // element id for clip
			code: '', // affiliate code
			title: '',
			suggest_tags: '',
			styling: '' // none(text-only), full
		},
		hatena: {
			button: 'standard', // standard, vertical, simple
			url: document.URL,
			encoded: true,
			title: document.title
		},
		hatena_oldstyle: {
			button: 'http://d.hatena.ne.jp/images/b_append.gif',
			url: document.URL,
			encoded: true,
			height: 13,
			padding: 7
		}
	};

	var max_index = this.size() - 1;

	return this.each(function(index) {

		switch (service) {
			case 'mixi_check':
				socialbutton_mixi_check(this, options, defaults.mixi_check, index, max_index);
				break;

			case 'facebook_like':
				socialbutton_facebook_like(this, options, defaults.facebook_like, index, max_index);
				break;

			case 'twitter':
				socialbutton_twitter(this, options, defaults.twitter, index, max_index);
				break;

			case 'gree_sf':
				socialbutton_gree_sf(this, options, defaults.gree_sf, index, max_index);
				break;

			case 'evernote':
				socialbutton_evernote(this, options, defaults.evernote, index, max_index);
				break;

			case 'hatena':
				socialbutton_hatena(this, options, defaults.hatena, index, max_index);
				break;

			case 'hatena_oldstyle':
				socialbutton_hatena_oldstyle(this, options, defaults.hatena_oldstyle, index, max_index);
				break;

			default:
				break;
		}

		return true;
	});
}

function socialbutton_mixi_check(target, options, defaults, index, max_index)
{
	var key = options.key || defaults.key;
	var button = options.button || defaults.button;
	var url = options.url || defaults.url;
	var encoded = options.encoded != undefined ? options.encoded : defaults.encoded;

	if (key == '') {
		return;
	}

	var attr = merge_attributes({
		'data-key': key,
		'data-url': encoded ? url : url_encode(url),
		'data-button': button
	});

	var tag = '<a href="http://mixi.jp/share.pl" class="mixi-check-button"' + attr + '>Check</a>';

	$(target).html(tag);

	if (index == max_index) {
		$('body').append('<script type="text/javascript" src="http://static.mixi.jp/js/share.js"></script>');
	}
}

function socialbutton_facebook_like(target, options, defaults, index, max_index)
{
	var layout = options.layout || options.button || defaults.button;
	var url = options.url || defaults.url;
	var encoded = options.encoded != undefined ? options.encoded : defaults.encoded;

	var show_faces = options.show_faces != undefined ? options.show_faces : defaults.show_faces;
	var width = options.width != undefined ? options.width : defaults.width;
	var height = options.height != undefined ? options.height : defaults.height;
	var action = options.action || defaults.action;
	var font = options.font || defaults.font;
	var colorscheme = options.colorscheme || defaults.colorscheme;

	switch (layout) {
		case 'standard':
			if (width == 0) {
				width = defaults.width_standard_default;
			} else if (width < defaults.width_standard_minimum) {
				width = defaults.width_standard_minimum;
			}
			if (height == 0) {
				height = show_faces ? defaults.height_standard_with_photo : defaults.height_standard_without_photo;
			} else if (height < defaults.height_standard_without_photo) {
				height = defaults.height_standard_without_photo;
			}
			break;
		case 'button_count':
			if (width == 0) {
				width = defaults.width_button_count_default;
			} else if (width < defaults.width_button_count_minimum) {
				width = defaults.width_button_count_minimum;
			}
			if (height == 0) {
				height = defaults.height_button_count;
			} else if (height < defaults.height_button_count) {
				height = defaults.height_button_count;
			}
			break;
		case 'box_count':
			if (width == 0) {
				width = defaults.width_box_count_default;
			} else if (width < defaults.width_box_count_minimum) {
				width = defaults.width_box_count_minimum;
			}
			if (height == 0) {
				height = defaults.height_box_count;
			} else if (height < defaults.height_box_count) {
				height = defaults.height_box_count;
			}
			break;
	}

	var params = merge_parameters({
		'href': encoded ? url : url_encode_rfc3986(url),
		'layout': layout,
		'show_faces': show_faces ? 'true' : 'false',
		'width': width,
		'action': action,
		'font': font,
		'colorscheme': colorscheme,
		'height': height
	});

	var tag = '<iframe src="http://www.facebook.com/plugins/like.php?' + params + '"scrolling="no" frameborder="0" style="border:none; overflow:hidden; width:' + width + 'px; height:' + height + 'px;" allowTransparency="true"></iframe>';

	$(target).html(tag);
}

function socialbutton_twitter(target, options, defaults, index, max_index)
{
	var count = options.count || options.button || defaults.button;
	var url = options.url || defaults.url;
	var encoded = options.encoded != undefined ? options.encoded : defaults.encoded;

	var text = options.text || defaults.text;
	var lang = options.lang || defaults.lang;
	var via = options.via || defaults.via;
	var related = options.related || defaults.related;

	var attr = merge_attributes({
		'data-count': count,
		'data-url': encoded ? url : url_encode(url),
		'data-text': text,
		'data-lang': lang,
		'data-via': via,
		'data-related': related
	});

	var tag = '<a href="http://twitter.com/share" class="twitter-share-button"' + attr + '>Tweet</a>';

	$(target).html(tag);

	if (index == max_index) {
		$('body').append('<script type="text/javascript" src="http://platform.twitter.com/widgets.js"></script>');
	}
}

function socialbutton_gree_sf(target, options, defaults, index, max_index)
{
	var type = options.type || options.button || defaults.button;
	var url = options.url || defaults.url;
	var encoded = options.encoded != undefined ? options.encoded : defaults.encoded;

	var width = options.width != undefined ? options.width : defaults.width;
	var height = options.height != undefined ? options.height : defaults.height;

	switch (type) {
		case 0:
		case 1:
		case 2:
		case 3:
			if (height != 16 && height != 20 && height != 23) {
				height = 20;
			}
			break;

		case 4:
			if (height != 16 && height != 22 && height != 32) {
				height = 22;
			}
			break;

		default:
			type = 0;
			width = 0;
			height = 20;
			break;
	}

	if (width == 0) {
		width = defaults.widths['type' + type + '_' + height];
	}

	var params = merge_parameters({
		'url': encoded ? url : url_encode_rfc3986(url),
		'type': String(type),
		'height': height
	});

	var tag = '<iframe src="http://share.gree.jp/share?' + params + '" scrolling="no" frameborder="0" marginwidth="0" marginheight="0" style="border:none; overflow:hidden; width:' + width + 'px; height:' + height + 'px;" allowTransparency="true"></iframe>';

	$(target).html(tag);
}

function socialbutton_evernote(target, options, defaults, index, max_index)
{
	var button = options.button || defaults.button;
	var url = options.url || defaults.url;
	var encoded = options.encoded != undefined ? options.encoded : defaults.encoded;

	var provider_name = options.provider_name || defaults.provider_name;
	var suggest_notebook = options.suggest_notebook || defaults.suggest_notebook;
	var content_id = options.content_id || defaults.content_id;
	var code = options.code || defaults.code;
	var title = options.title || defaults.title;
	var suggest_tags = options.suggest_tags || defaults.suggest_tags;
	var styling = options.styling || defaults.styling;

	if (button == 'article-clipper' ||
		button == 'article-clipper-remember' ||
		button == 'article-clipper-jp' ||
		button == 'article-clipper-rus' ||
		button == 'article-clipper-fr' ||
		button == 'article-clipper-es' ||
		button == 'article-clipper-de' ||
		button == 'article-clipper-vert' ||
		button == 'site-mem-32' ||
		button == 'site-mem-36' ||
		button == 'site-mem-22' ||
		button == 'site-mem-16'
		) {
			button = 'http://static.evernote.com/' + button + '.png';
	}

	var clipoptions = build_object_string({
		'url': encoded ? url : url_encode(url),
		'providerName': provider_name,
		'suggestNotebook': suggest_notebook,
		'contentId': content_id,
		'code': code,
		'title': title,
		'suggestTags': suggest_tags,
		'styling': styling
	});

	if (index == 0) {
		$('body').append('<script type="text/javascript" src="http://static.evernote.com/noteit.js"></script>');
	}

	var tag = '<a href="#" onclick="Evernote.doClip(' + clipoptions + '); return false;"><img src="' + button + '" alt="Clip to Evernote" style="border: none" /></a>';

	$(target).html(tag);
}

function socialbutton_hatena(target, options, defaults, index, max_index)
{
	var layout = options.layout || options.button || defaults.button;
	var url = options.url || defaults.url;
	var encoded = options.encoded != undefined ? options.encoded : defaults.encoded;
	var title = options.title || defaults.title;

	url = encoded ? url : url_encode(url);

	var attr = merge_attributes({
		'href': 'http://b.hatena.ne.jp/entry/' + url,
		'class': 'hatena-bookmark-button',
		'data-hatena-bookmark-title': title,
		'data-hatena-bookmark-layout': layout,
		'title': 'このエントリーをはてなブックマークに追加'
	});
	
	var tag = '<a' + attr + '><img src="http://b.st-hatena.com/images/entry-button/button-only.gif" alt="このエントリーをはてなブックマークに追加" width="20" height="20" style="border: none;" /></a>'
			+ '<script type="text/javascript" src="http://b.st-hatena.com/js/bookmark_button.js" charset="utf-8" async="async"></script>';

	$(target).html(tag);
}

function socialbutton_hatena_oldstyle(target, options, defaults, index, max_index)
{
	var button = options.button || defaults.button;
	var url = options.url || defaults.url;
	var encoded = options.encoded != undefined ? options.encoded : defaults.encoded;

	var height = options.height != undefined ? options.height : defaults.height;
	var padding = options.padding != undefined ? options.padding : defaults.padding;

	url = encoded ? url : url_encode(url);

	var tag = '<span style="font-size: ' + height + 'px; line-height: 100%; ">'
			+ '<span style="padding-right: ' + padding + 'px"><a href="http://b.hatena.ne.jp/entry/add/' + url + '" target="_blank"><img src="' + button + '" style="border: none; vertical-align: text-bottom" /></a></span>'
			+ '<a href="http://b.hatena.ne.jp/entry/' + url + '" target="_blank"><img src="http://b.hatena.ne.jp/entry/image/' + url + '" style="border: none; vertical-align: text-bottom" /></a>'
			+ '</span>';

	$(target).html(tag);
}

function build_object_string(options)
{
	var object = '';

	for (var i in options) {
		if (options[i] == '') {
			continue;
		}
		object += object != '' ? ', ' : '';
		object += i + ": '" + options[i].replace("'", "\\'") + "'";
	}

	return '{' + object + '}';
}

function merge_attributes(attr)
{
	var merged = '';

	for (var i in attr) {
		if (attr[i] == '') {
			continue;
		}
		merged += ' ';
		merged += i + '="' + attr[i].replace('"', '\"') + '"';
	}

	return merged;
}

function merge_parameters(params)
{
	var merged = '';

	for (var i in params) {
		if (params[i] == '') {
			continue;
		}
		merged += merged != '' ? '&amp;' : '';
		merged += i + '=' + params[i] + '';
	}

	return merged;
}

function url_encode(url)
{
	return encodeURI(url);
}

function url_encode_rfc2396(url)
{
	return encodeURIComponent(url);
}

function url_encode_rfc3986(url)
{
	return encodeURIComponent(url).replace(/[!*'()]/g, function(p) {
		return "%" + p.charCodeAt(0).toString(16);
	});
}

})(jQuery);
