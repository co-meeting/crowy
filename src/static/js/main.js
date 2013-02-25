var tabs, currentTab, currentMsgId, settingsPopup, addColumnPopup, focusedColumnInput,
	tipConf = {delay:100},
	maxMessageCount = 50,
	leftScrollSpeed = 150, onScrolling = false, scrollingTimer = -1,
	reloadTimer = -1, reloadBackTimer = -1, msgCommandTimer = -1,
	updateTimestampTimer = -1,
	adItems = null, adIndex = 0, stopAdTime = 0, AD_SPACE_NUM = 10, AD_STOPPING_SPAN = 60*60*1000,
	REPLY_PREFIX = 'RE:', REPLY_PREFIX_LENGTH = REPLY_PREFIX.length,
	POST_KEY_MSG = postKey == 'shift' ? $I.R017 : $I.R078,
	AMAZON_ASSOCIATES_ID = "cm032-22",
	minColumnWidth = displayDensity == 'compact' ? 240 : 300;

//短縮URLの展開
function expandUrl(url, callback){
	$.get(EXPAND_URL, {url:url}, function(url){
		callback(url);
	});
}

//配列のシャッフル
Array.prototype.shuffle = function() {
    var i = this.length;
    while(i){
        var j = Math.floor(Math.random()*i);
        var t = this[--i];
        this[i] = this[j];
        this[j] = t;
    }
    return this;
};

//プルダウンメニューを表示する
(function($){
	$.fn.smallMenu = function(options) {
		var _close = function($this){
			var opts = $this.data('smallMenuOpts');
			opts.target.hide();
			opts.onclose(opts.target);
		}
		var _open = function($this){
			var opts = $this.data('smallMenuOpts');
			opts.ondisplay(opts.target);
			if(opts.position){
				opts.target.css(opts.position).show();
				return;
			}
			var buttonOffset = $this.offset();
			var win_sl = parseInt($(window).width());
			var top = buttonOffset.top+$this.height();
			var left = buttonOffset.left;
			opts.target.css({top:top, left:buttonOffset.left, right:'auto'}).show();
			if(left+opts.target.width() > win_sl){
				opts.target.css({top:top, right:0, left:'auto'}).show();
			}
		}
		if(options && typeof options == 'string'){
			if(options == 'close'){
				$(this).each(function(){
					_close($(this));
				});
			} else if(options == 'open'){
				$(this).each(function(){
					_open($(this));
				});
			} else if(options == 'destroy'){
				$(this).each(function(){
					var $this = $(this).unbind('click.smallMenu');
					var opts = $this.data('smallMenuOpts');
					if(opts && opts.target)
						opts.target.remove();
				});
			}
			return this;
		}
		var defaults = {
			target: '',
			appended: false,
			position: false,
			ondisplay: function(){},
			onclose: function(){}
		};
		var opts = $.extend(defaults, options);
		var body = $(document.body);
		if(!body.data('init.smallMenu')){
			body.bind('click.smallMenu', function(){
					$('.smallMenuLink').smallMenu('close');
				})
				.data('init.smallMenu', true)
		}
		return this.each(function(){
			var $this = $(this).addClass('smallMenuLink').data('smallMenuOpts', opts);
			var menu = opts.target;
			$this.bind('click.smallMenu', function(event){
				if(!menu || !menu.data('init.smallMenu')){
					menu = $(opts.target)
						.addClass('smallMenu')
						.hide()
						.data('init.smallMenu', true)
						.bind('click.smallMenu', function(event){event.stopPropagation();});
					if(!opts.appended)
						menu.appendTo(document.body);
				}
				if(menu.css('display') == 'none'){
					$('.smallMenuLink').smallMenu('close');
					_open($this);
				} else {
					_close($this);
				}
				event.stopPropagation();
			});
			return this;
		});
	}
})(jQuery);

//service list
(function($){
	$.fn.serviceList = function(options) {
		return this.each(function(){
			var tabs = $(this).addClass('service-container');
			if(!tabs.data('init')){
				tabs.attr({'cellpadding':0, 'cellspacing':0, 'width':'100%'});
				$('td:first',tabs).width($('.service-list',tabs).width());
				var tabBody = $('<td class="service-body"/>').appendTo($('tr:first', tabs));
				$('a.button', tabs).blur().click(function(event){
					$('a.button', tabs).removeClass('selected');
					$(this).addClass('selected');
					tabBody.empty().text('Loading...').load(this.href);
					event.preventDefault();
					event.stopPropagation();
					return false;
				});
				$('a.button:first', tabs).click();
				tabs.data('init', true);
			}
			return this;
		});
	}
})(jQuery);

//uploader
(function($){
	$.fn.autoid = function(options){
		return this.each(function(){
			if(!this.id){
				this.id = 's_'+new Date().getTime()+'_'+Math.floor(Math.random()*1000);
			}
			return this;
		});
	}
	$.fn.uploader = function(options) {
		if(options && typeof options == 'string'){
			var uploader = $(this).first().data('uploader');
			if(options == 'cancel'){
				if(uploader) uploader.cancel();
			} else if(options == 'keys'){
				if(!uploader) return [];
				return $.map($(this).first().data('uploader').files, function(file){
					return file.key;
				});
			}
			return this;
		}
		return this.each(function(){
			if($(this).data('uploader')) return true;
			var container = $(this).addClass('uploader');
			var containerId = container.autoid().attr('id');
			var pickFileElm = $('<a class="pickfiles" href="#"/>').text('[Select files]').autoid().appendTo(container);
			var defaults = {
				runtimes : 'html5,flash,gears,silverlight,browserplus,html4',
				browse_button : pickFileElm.attr('id'),
				container : containerId,
				max_file_size : '10mb',
				url : '',
				flash_swf_url : STATIC_URL + 'plupload/js/plupload.flash.swf',
				silverlight_xap_url : STATIC_URL + 'plupload/js/plupload.silverlight.xap',
				filters : [
					{title : "Image files", extensions : "jpg,gif,png"}
				],
				required_features: 'dragdrop',
				//custom
				file_list_element:false
			};
			var opts = $.extend(defaults, options);

			var fileListElm = opts.file_list_element ? $(opts.file_list_element) : $('<div class="filelist"/>').appendTo(container);
			
			var _uploader = new plupload.Uploader(opts);
			
			_uploader.init();
	
			_uploader.bind('FilesAdded', function(up, files) {
				if(up.files.length > 1){
					return;
				}
				pickFileElm.hide();
				fileListElm.show();
				$.each(files, function(i, file) {
					fileListElm.append(
						$('<div/>').attr('id', file.id).append(
							$('<span class="file-name"/>').text(file.name + ' (' + plupload.formatSize(file.size) + ')'),
							$('<span class="progress"/>').text('0%'),
							$('<a class="delete-file" href="#"/>').text('[x]').click(function(e){
								up.cancel();
								e.stopPropagation();
							})
						)
					);
					$.ajax({ 
						url: '/file/createurl', 
						async: false, 
						success: function(url) {
							up.settings.url = url;
							up.start();
						}
					}); 
				});
	
				up.refresh(); // Reposition Flash/Silverlight
				
				if(opts.onFileAdded)
					opts.onFileAdded(up, files);
			});
	
			_uploader.bind('UploadProgress', function(up, file) {
				$('#' + file.id + " .progress").html(file.percent + "%");
			});
	
			_uploader.bind('Error', function(up, err) {
				fileListElm.show();
				fileListElm.append($("<div/>").text("Error: " + err.code +
					", Message: " + err.message +
					(err.file ? ", File: " + err.file.name : ""))
				);
	
				up.refresh(); // Reposition Flash/Silverlight
			});
	
			_uploader.bind('FileUploaded', function(up, file, info) {
				file.key = info.response;
				$('#' + file.id + " .progress").html("100%").addClass('complete');
				if(opts.onUploaded)
					opts.onUploaded();
			});
			
			_uploader.cancel = function(){
				var keys = [];
				$.each(_uploader.files, function(){
					keys.push(this.key);
					_uploader.removeFile(this);
				});
				fileListElm.empty().hide();
				pickFileElm.show();
				
				if(opts.onCancel)
					opts.onCancel();
				
				if(keys.length > 0)
					$.post("file/delete", {key:keys}, $.noop);
				_uploader.refresh();
			};
			
			container.data('uploader', _uploader);
			
			return container;
		});
	}
})(jQuery);

function isPostKey(e){
	if(postKey == "control" && e.ctrlKey && e.keyCode == 13)
		return true;
	if(postKey == "shift" && e.shiftKey && e.keyCode == 13)
		return true;
	return false;
}

function popup(url){
	window.open(url,'oauth','width=600, height=340, menubar=no, toolbar=no, location=no, scrollbars=yes');
}
//各ユーザ毎に指定回数だけ関数を実行する
function callOnlyInitial(options){
	if(!options.key) throw new Error('key is not set');
	var defaults = {
		key: '',
		count: 1,
		callback: function(){},
		expires: 100
	};
	var opts = $.extend(defaults, options);
	var readCount = parseInt($.cookie(opts.key)) || 0;
	if(readCount < opts.count){
		opts.callback();
		$.cookie(opts.key, readCount+1, {expires:opts.expires});
	}
}
THUMBNAIL_RESOLVER = [
                    // twitpic
                    [/http:\/\/twitpic[.]com\/(\w+)/,'<img src="http://twitpic.com/show/thumb/$1" width="150" height="150" />'],
                    // Amazon
                    [/http:\/\/www\.amazon\.co\.jp\/.*\/([0-9A-Z]{10,13})[\?\/]?.*/,'<img src="http://ws.assoc-amazon.jp/widgets/q?_encoding=UTF8&Format=_SL110_&ASIN=$1&MarketPlace=JP&ID=AsinImage&WS=1&ServiceVersion=20070822" />'],
                    // Amazon
                    [/http:\/\/amzn\.to\/.*/,
                      function(url, callback){
                        expandUrl(url, function(exurl){
                          getImageThumb(exurl, callback);
                        });
                      }
                     ],
                    // youtube
                    [/http:\/\/(?:www[.]youtube[.]com\/watch(?:\?|#!)v=|youtu[.]be\/)([\w\-]+)(?:[-_.!~*\'()a-zA-Z0-9;\/?:@&=+$,%#]*)/,'<img src="http://i.ytimg.com/vi/$1/hqdefault.jpg" width="240" height="180" />'],
                    // yFrog
                    [/http:\/\/yfrog[.]com\/(\w+)/,'<img src="http://yfrog.com/$1.th.jpg" />'],
                   // Instagram
                    [/http:\/\/instagr[.]am\/p\/([\w\-]+)\//,'<img src="http://instagr.am/p/$1/media/?size=t" width="150" height="150" />'],
                     // Mobypicture
                    [/http:\/\/moby[.]to\/(\w+)/,'<img src="http://moby.to/$1:small" width="150" />'],
                    // 携帯百景
                    [/http:\/\/movapic[.]com\/pic\/(\w+)/,'<img src="http://image.movapic.com/pic/s_$1.jpeg" />'],
                    // はてなフォトライフ
                    [/http:\/\/f[.]hatena[.]ne[.]jp\/(([\w\-])[\w\-]+)\/((\d{8})\d+)/,'<img src="http://img.f.hatena.ne.jp/images/fotolife/$2/$1/$4/$3_120.jpg" />'],
                    // PhotoShare
                    [/http:\/\/(?:www[.])?bcphotoshare[.]com\/photos\/\d+\/(\d+)/,'<img src="http://images.bcphotoshare.com/storages/$1/thumb180.jpg" width="180" height="180" />'],
                    // PhotoShare の短縮 URL
                    [/http:\/\/bctiny[.]com\/p(\w+)/, '\'<img src="http://images.bcphotoshare.com/storages/\' . base_convert("$1", 36, 10) . \'/thumb180.jpg" width="180" height="180" />\''],
                    // img.ly
                    [/http:\/\/img[.]ly\/(\w+)/,'<img src="http://img.ly/show/thumb/$1" width="150" height="150" />'],
                    // brightkite
                    [/http:\/\/brightkite[.]com\/objects\/((\w{2})(\w{2})\w+)/,'<img src="http://cdn.brightkite.com/$2/$3/$1-feed.jpg" />'],
                    // Twitgoo
                    [/http:\/\/twitgoo[.]com\/(\w+)/,'<img src="http://twitgoo.com/$1/mini" />'],
                    // pic.im
                    [/http:\/\/pic[.]im\/(\w+)/,'<img src="http://pic.im/website/thumbnail/$1" />'],
                    // imgur
                    [/http:\/\/imgur[.]com\/(\w+)[.]jpg/,'<img src="http://i.imgur.com/$1m.jpg" />'],
                    // TweetPhoto, Plixi, Lockerz
                    [/(http:\/\/tweetphoto[.]com\/\d+|http:\/\/plixi[.]com\/p\/\d+|http:\/\/lockerz[.]com\/s\/\d+)/,'<img src="http://api.plixi.com/api/TPAPI.svc/imagefromurl?size=mobile&url=$1" height="180" />'],
                    // Ow.ly
                    [/http:\/\/ow[.]ly\/i\/(\w+)/,'<img src="http://static.ow.ly/photos/thumb/$1.jpg" width="100" height="100" />']
                    ];
function getImageThumb(url, callback){
	var thumbUrl = "";
	$.each(THUMBNAIL_RESOLVER, function(){
		if(url.match(this[0])){
			if($.isFunction(this[1])){
				this[1](url, callback);
			} else {
				thumbUrl = this[1]
					.replace('$1', RegExp.$1)
					.replace('$2', RegExp.$2)
					.replace('$3', RegExp.$3)
					.replace('$4', RegExp.$4);
			}
			return false;
		}
	});
	if(thumbUrl) {
		callback({thumb: thumbUrl, original: url});
	}
}

function showInformation(){
	if($('#information').data('init')) return;
	$('#information a.reconnect-facebook').button();
	$('#information').dialog({
		modal:true,
		width:600
	}).data('init',true);
}

//カラムが0件のときの説明を必要なら表示する
function toggleNoColumnMsg(){
	var columns = currentTab.children(".column");
	$("#nocolumn").toggle(columns.length == 0);
	$("#tabs .tab-content").toggle(columns.length != 0);
}

function renderMessages(service, data, columnContent, columnInfo, refresh){
	var lastMessage, lastCreatedAt, isGap = false;
	var _getCreatedAt = service.getCreatedAt ? service.getCreatedAt : function(entry){ return Date.parse(entry.display_time); }
	if(refresh){
		if(refresh == true){
			//更新ボタン
			lastMessage = columnContent.children(".message:first");
			$(".new", columnContent).removeClass("new");
		} else if(refresh.hasClass && refresh.hasClass('gap')){
			//ギャップ取得ボタン
			lastMessage = refresh.nextAll('.message:first');
			$(".new", columnContent).removeClass("new");
			//ギャップ取得の場合ボタンを削除する
			refresh.next().remove();
			refresh.remove();
			isGap = true;
		}
	} else {
		lastMessage = columnContent.children(".message:last");
	}
	if(lastMessage.data("entry"))
		lastCreatedAt = _getCreatedAt(lastMessage.data("entry"));
	var count = 0, columnBody = columnContent.parents(".column-content"),
		preHeight = columnBody.prop('scrollHeight');
		preScrollTop = columnBody.scrollTop();
	var notifications = [];
	$.each(data.messages || [], function(){
		var entry = service.getEntry ? service.getEntry(this) : this;
		messageElm = service.renderMessage(entry, columnInfo, refresh, data);
		if(!messageElm) return true;
		if(refresh && lastMessage.length > 0){
			//既に表示しているメッセージより新しいメッセージのみ表示
			if(!lastCreatedAt || _getCreatedAt(entry) > lastCreatedAt){
				if(service.onBeforeInsertMessage){
					service.onBeforeInsertMessage(entry, columnInfo, messageElm);
					//onBeforeInsertMessageでlastMessageが削除される可能性がある
					if(lastMessage.parent().length == 0)
						lastMessage = columnContent.children(".message:first");
				}
				messageElm.addClass("new").insertBefore(lastMessage);
				count++;
				//デスクトップ通知用の情報を古い順にセットする
				//ギャップ取得時は見ているので、通知しない。
				if(!isGap && notificationStatus && columnInfo.prefs.notification){
					var notificationInfo = service.getNotificationInfo(entry, data, columnInfo, lastCreatedAt)
					if($.isArray(notificationInfo)){
						notifications = notificationInfo.concat(notifications);
					}else{
						notifications.unshift(notificationInfo);
					}
				}
			} else {
				return service.checkAllMessages ? true : false;
			}
		}else{
			//既に表示しているメッセージより古いメッセージのみ表示
			if(!lastCreatedAt || _getCreatedAt(entry) < lastCreatedAt)
				messageElm.appendTo(columnContent);
		}
	});
	var prevElm = null;
	columnContent.children('.message').each(function(idx, elm){
		var $this = $(this);
		$this.toggleClass('odd', !prevElm || !prevElm.hasClass('odd'));
		prevElm = $this;
	});
	if(refresh) {
		if(service.getGapMessages && count > 0 && data.messages.length == count){
			//取得件数と表示件数が同じだったらギャップがあると判断する
			lastMessage.before(
				$('<div class="gap">').text($I.R001).click(service.getGapMessages),
				$('<div class="gap-loading"><span>'+$I.R002+'</span></div>').hide()
			);
		}
		
		//デスクトップ通知する
		$.each(notifications, function(){
			showNotification(this.title, this.message, this.icon);
		});
		columnContent.parent().prevAll(".new-count").text(count > 30 ? "30+" : count).toggle(count > 0);
		
		//追加された要素分スクロールが元の位置からずれるので補正
		var changedHeight = columnBody.prop('scrollHeight') - preHeight;
		if(changedHeight != 0 && preScrollTop > 0)
			columnBody.scrollTop(columnBody.scrollTop() + changedHeight);
		
		showNotificationCount(columnInfo, count);
	}
	if(service.onAfterRenderMessages)
		service.onAfterRenderMessages(data, columnContent, columnInfo);
}
function loadColumn(column, refresh, scrollToTop){
	var init = column.data("init");
	column.data("init",true);
	$(".column-header .icon", column).addClass("loading");
	var conf = column.data("conf"),
		url = conf.service + "/messages/" + conf.account_name,
		columnContent = column.find(".message-list");
	$(".error", columnContent).remove();
	//TODO window[]は遅いらしいのでなんとかする
	var service = window[conf.service];
	$.ajax({
		url: url,
		data: {type:conf.type},
		success: function(data){
			//更新時は空にしない
			if(!refresh || $(".message", columnContent).length == 0)
				columnContent.empty();
			renderMessages(service, data, columnContent, conf, refresh);
			renderAccountImage(service, column, conf);
			if(service.moreMessages)
				column.find(".more-message").show();
			if (scrollToTop) {
				columnContent.parent().animate({ scrollTop: 0 });
			}
			//一番初めのカラムだったら広告を挿入
			if(column.parents('.tab').attr('id') == currentTab.attr('id') && column.prevAll('.column').length == 0 && stopAdTime < (new Date().getTime()-AD_STOPPING_SPAN)){
				function showAd(){
					if(!adItems) adItems = [];
					if(adItems.length == 0) return;
					var random = Math.floor(Math.random() * AD_SPACE_NUM+1);
					var adItem = 0;
					if(random < adItems.length){
						adIndex = !adIndex || adIndex > adItems.length - 1 ? 0 : adIndex;
						adItem = adItems[adIndex++];
					} else {
						adItem = {type:'default'};
					}
					$('#adMessage').remove();
					adMessage = $('<div id="adMessage"/>').hide();
					if(adItem.type && adItem.type == "default"){
						adMessage.addClass('banner');
						adMessage.append(
							$('<a class="adCloseIcon" href="#"/>'),
							$('<div class="adContents"/>').hover(
								function(){$(this).animate({height:200})},
								function(){$(this).animate({height:100})}
							).append($(AD_HTML))
						);
						$('<iframe src="'+STATIC_URL+'ad/impression.html?url='+encodeURIComponent('geniee.co.jp')+'"/>')
							.hide().appendTo(adMessage);
					} else if(adItem.type && adItem.type == "banner_only") {
						var adUrl = '/ad?url='+encodeURIComponent(adItem.url);
						adMessage.addClass('banner');
						adMessage.append(
							$('<a class="adCloseIcon" href="#"/>'),
							$('<div class="adContents"/>').hover(
								function(){$(this).animate({height:adItem.height})},
								function(){$(this).animate({height:100})}
							).append(
								$('<a target="_blank"/>').attr('href',adUrl)
									.append($('<img/>').attr('src', adItem.banner_url))
							)
						);
						$('<iframe src="'+STATIC_URL+'ad/impression.html?url='+encodeURIComponent(adItem.url)+'"/>')
							.hide().appendTo(adMessage);
					} else {
						var adUrl = '/ad?url='+encodeURIComponent(adItem.url);
						adMessage.append(
							$('<div class="adContents"/>')
								.append(
									$('<a class="adCloseIcon" href="#"/>'),
									$('<p class="adHead"/>')
										.append($('<a target="_blank"/>').attr('href',adUrl).text(adItem.title)),
									$('<table class="adTable"/>')
										.append(
											$('<tbody/>').append($('<tr/>')
												.append(
														$('<td class="adThumb"/>')
															.append($('<a target="_blank"/>').attr('href',adUrl)
																.append($('<img width="100" height="74"/>').attr('src', adItem.banner_url))),
														$('<td class="adBody"/>').text(adItem.body)
													)
												)
										)
								)
						);
						$('<iframe src="'+STATIC_URL+'ad/impression.html?url='+encodeURIComponent(adItem.url)+'"/>')
							.hide().appendTo(adMessage);
					}
					adMessage.prependTo(columnContent).fadeIn()
						.find('.adCloseIcon').click(function(){
							$('#adMessage').fadeOut();
							stopAdTime = new Date().getTime();
						});
				}
				if(adItems){
					showAd();
				} else {
					$.getJSON('/static/ad/ad.json', function(data){
						adItems = data.shuffle();
						showAd();
					});
				}
			}
		},
		error: function(resp){
			if(!refresh || $(".message", columnContent).length == 0)
				columnContent.empty();
			if(resp.status == 401 || resp.status == 403){
				$('<div class="error reauth"/>').text($I.R003).prependTo(columnContent).click(function(){
					//TODO 汎用化
					if(conf.service == 'yammer')
						popup("/yammer/authorize");
					else if(conf.service == 'facebook')
						popup("/facebook/oauth");
					else
						window.open("/oauth/"+conf.service+"/request");
				});
			} else {
				//TODO 条件分岐が微妙
				var errorMsg = $I.R004;
				if(service.name)
					errorMsg = $I.R076({service:service.name});
				$('<div class="error"/>').text(errorMsg).prependTo(columnContent).click(function(){
					loadColumn(column, true);
				});
			}
		},
		complete: function(){
			$(".column-header .icon", column).removeClass("loading");
			column.parents(".tab").dequeue();
			tabs.dequeue();
		}
	});
	//もっと読むにリスナーをつけるのは初回のみ
	if(service.moreMessages && !init){
		column.find(".more-message").click(service.moreMessages);
		//一番下までスクロールしたら自動で「もっと読む」
		column.find(".column-content").scrollTop(0).scroll(function(){
			var $this = $(this), moreTimer = $this.data('moreTimer');
			if(moreTimer) clearTimeout(moreTimer);
			if($this.scrollTop() == $this.prop('scrollHeight') - $this.height()){
				var moreTimer = setTimeout(function(){
					column.find(".more-message").click();
				}, 1000);
				$this.data('moreTimer', moreTimer);
			}
		});
	}
}
//データを読み込みます
function loadTabContent(){
	if(!currentTab) return;
	currentTab.data("init",true).find(".column").each(function(i, column){
		var $column = $(column);
		if(!$column.data("init"))
			loadColumn($column);
	});
}
var growingDummy = $('<div class="growing-dummy"/>'), minHeight = 32, closedHeight = 20;
/**
 * カラム内入力ボックスを開きます
 * @param parent
 * @param msg
 * @param replyTo
 * @param replyToMsg
 * @param toCaretTop
 */
function openColumnInput(parent, columnInfo, msg, replyTo, replyToMsg, toCaretTop){
	var column = $('#'+columnInfo.key);
	parent = parent || column;
	var columnInput = parent.children('.column-input').show(),
		textbox = columnInput.find(".message-input textarea"),
		service = window[columnInfo.service];
	focusedColumnInput = columnInput;
	if(service.canUploadImage){
		$('.uploader', columnInput).uploader({
			required_features: "",//D&Dはなぜかうまく動かないので、OFFに。
			file_list_element: columnInput.find('.filelist'),
			onFileAdded: function(up, files){
				columnInput.find('.fileadded').show();
			},
			onUploaded: function(){
				countMessage(window[columnInfo.service], columnInput.find('.message-input textarea'));
			},
			onCancel: function(){
				columnInput.find('.fileadded').hide();
				countMessage(window[columnInfo.service], columnInput.find('.message-input textarea'));
			}
		});
	}
	if(!!msg) textbox.val(msg);
	textbox.focus();
	try{
		if(toCaretTop)
			textbox.get()[0].setSelectionRange(0,0);
		else
			textbox.get()[0].setSelectionRange(msg.length, msg.length);
	}catch(e){
	}
	if(replyTo){
		textbox.siblings("input[name=reply-to]").val(replyTo);
		if(replyToMsg)
			$('.reply-to-message', parent).text(REPLY_PREFIX+replyToMsg).show();
	} else {
		if(columnInput.data('reply-to'))
			textbox.siblings("input[name=reply-to]").val(columnInput.data('reply-to'));
		if(columnInput.data('reply-to-message'))
			$('.reply-to-message', parent).text(REPLY_PREFIX+columnInput.data('reply-to-message')).show();
	}
	$("#message-command").hide();
	adjustColumnContentHeight(column);
	countMessage(service, textbox);
}
//カラム内入力ボックスの文字数を表示
function countMessage(service, textbox){
	textbox = textbox || $(this);
	var counter = textbox.siblings(".counter"), charCount = 0,
		uploader = textbox.parents('.column-input').find('.uploader');
	if(service.countMessage)
		charCount = service.countMessage(textbox.val().replace(/\s+$/g, ""), uploader);
	else
		charCount = service.messageLimit - textbox.val().replace(/\s+$/g, "").length;
	counter.text(charCount).toggleClass("over", charCount < 0);
}
//カラム内入力ボックスを作成
function createColumnInput(service, column, conf, targetElement, opts){
	var id = conf.key, opts = opts || {},
		messageElm = targetElement ? targetElement.parent() : false;
	function sendMessage(textbox){
		var url = service.getPostUrl(conf),
			message = textbox.val().replace(/\s+$/g, ""),
			messageInput = textbox.parent(),
			replyTo = messageInput.find("input[name=reply-to]"),
			uploader = messageInput.parent().find('.uploader');
		if(!message) return;
		if(service.countMessage){
			var count = service.countMessage(message, uploader);
			if(count < 0){
				message = message.substring(0, message.length + count);
			}
		}else if(service.messageLimit > 0){
			message = message.substring(0, service.messageLimit);
		}
		textbox.attr("disabled", true);
		messageInput.addClass("loading");
		$.ajax({
			type:"POST",
			url:url,
			data: {
				'message':message,
				'reply-to':replyTo.val(),
				'file-key[]':uploader.uploader('keys')
			},
			success: function(data){
				showNotice($I.R015);
				textbox.val("").height(minHeight);
				replyTo.val("");
				$('.reply-to-message', column).text('').hide();
				if(service.openColumnInput)
					service.openColumnInput(column, conf);
				uploader.uploader('cancel');
				countMessage(service, textbox);
				setTimeout(function(){
					if(column.data('reload'))
						column.data('reload')(data);
					else
						loadColumn($("#"+id), true);
				}, 2000);;
			},
			error: function(){
				showError($I.R016);
			},
			complete: function(){
				messageInput.removeClass("loading");
				textbox.removeAttr("disabled").focus();
			}
		});
	}
	function sendMessageIfShiftEnter(e){
		try{
			if(isPostKey(e)){
				sendMessage($(this));
				return false;
			}
		}catch(e){
			console.error(e);
		}
	}
	function _openColumnInput(event){
		if(columnInput.hasClass("focus")) return;
		closeColumnInput(focusedColumnInput, event);
		if(service.openColumnInput){
			service.openColumnInput(column, conf);
			countMessage(service, $("textarea", columnInput));
		} else {
			openColumnInput(messageElm, conf, false,"");
		}
		focusedColumnInput = columnInput;
	}
	var columnInput = $('<div class="column-input"/>')
		.append($('<div class="reply-to-message"/>'))
		.append($('<div class="message-input"/>')
			.append($('<div class="account-image-outer"/>')
					.append($('<img class="account-image"/>').attr('src', STATIC_URL + 'images/noprofileimage.gif'),
						$('<a class="profile-select" href="#"/>').text('▼')))
			.append($('<textarea />')
				.keydown(sendMessageIfShiftEnter)
				.focus(function(){
					var textbox = $(this);
					columnInput.addClass("focus");
					var replyToMsg = $('.reply-to-message', columnInput);
					if(replyToMsg.text()) replyToMsg.show();
					textbox.data("growing")(null, true);
				})
				.growing({
					minHeight:minHeight,
					maxHeight:160,
					lineHeight:16,
					buffer: 0,
					dummy:growingDummy
				})
			)
			.append($('<input type="hidden" name="reply-to"/>'))
			.append($('<div class="help"/>')
				.text(POST_KEY_MSG)
				.attr("title",POST_KEY_MSG)
			)
		)
		.append($('<div class="input-footer"/>')
			.append($('<div class="filelist"/>'))
			.append($('<div class="tool-bar"/>')
				.append(opts.noAttach ? "" : $('<div class="uploader"/>').append($('<div class="fileadded"/>')))
				.append($('<div class="help2"/>').text(POST_KEY_MSG))
				.append($('<div class="submit-btn"/>').append(
					$('<a href="#"/>').text($I.R019).click(function(){
						sendMessage($('textarea', columnInput));
					})
				))
				.append($('<div class="clear-btn"/>').append(
					$('<a href="#"/>').text($I.R020).click(function(){
						$('textarea', columnInput).val("").height(minHeight).focus();
						$('input[name=reply-to]', columnInput).val("");
						$('.reply-to-message', columnInput).text('').hide();
						$('.uploader', columnInput).uploader('cancel');
					})
				))
			)
		)
		.click(_openColumnInput)
		.insertAfter(targetElement || $(".column-header", column));
	if(opts.hideFirst) columnInput.hide();
	if(opts.replyTo) columnInput.data('reply-to', opts.replyTo);
	if(opts.replyToMsg) columnInput.data('reply-to-message', opts.replyToMsg);
	if(service.messageLimit > 0){
		$('<div class="counter"/>').text(service.messageLimit)
			.appendTo($('.message-input', columnInput));
		$("textarea", columnInput).keyup(function(e){countMessage(service, $(this))});
	}
}
//カラム内投稿ボックスを閉じます。
function closeColumnInput(columnInput, event){
	if(!columnInput || columnInput.length == 0) return;
	var textarea = $('textarea', columnInput);
	var replyToMsg = $('.reply-to-message', columnInput).hide();
	columnInput.removeClass("focus");
	textarea.height(closedHeight);
	adjustColumnContentHeight(textarea.closest(".column"));
	$("#message-command").hide();
	focusedColumnInput = null;
}
//カラムの要素を作ります
function createColumn(id, name, conf, container){
	var service = window[conf.service];
	var columnName = $('<span class="column-name"/>');
	var columnLink = service.getColumnLink && service.getColumnLink(conf);
	if(columnLink){
		$('<a target="_blank"/>').attr("href",service.getColumnLink(conf)).text(name).appendTo(columnName);
	} else {
		columnName.text(name);
	}
	var column = $('<div class="column"/>').attr('id', id).addClass(conf.prefs.bg_color || '')
		.append($('<div class="new-count"/>'))
		.append($('<div class="column-header">')
			.append($('<a href="https://twitter.com" target="_blank"><div class="icon icon-twitter"/></a>'))
			.append($('<img class="account-image"/>').attr('src', STATIC_URL + 'images/noprofileimage.gif'))
			//.append($('<span class="column-name"/>').text(name))
			.append(columnName)
			.append($('<div class="account-label"/>').text(conf.account_label))
			.append($('<div class="column-header-icon"/>')
				.append($('<a class="reloadButton"/>'))
				.append($('<a class="menuButton"/>'))
			)
		)
		.append($('<div class="column-content"/>')
			.append($('<div class="message-list"><p>Loading...</p></div>'))
			.append($('<div class="more-message" style="display:none">'+$I.R005+'</div>'))
			.append($('<div class="loading-message" style="display:none"><span>'+$I.R006+'</span></div>'))
		)
		.addClass(conf.service)
		.data("conf", conf)
		.appendTo(container);
	
	//カラム毎の設定
	var columnOpt = null;
	function _toggleColumnNotification(){
		columnOpt.hide();
		if(!window.webkitNotifications){
			alert($I.R007);
			return;
		}
		var column = columnOpt.data('column');
		var conf = column.data('conf');
		var columnId = column.attr("id");
		newnotification = !conf.prefs.notification;
		$(this).find('.column-notification-status').text(newnotification ? 'ON':'OFF');
		if(!notificationStatus){
			if(confirm($I.R008)){
				toggleNotification();
			}
		}
		$.ajax({
			type:"POST",
			url:"column/updateprefs",
			data:{
				id:columnId,
				notification:newnotification ? "true" : ""
			},
			success: function(e){
				showNotice($I.R009({name:conf.name}));
				conf.prefs.notification = newnotification;
			},
			error: function(){
				showError($I.R010({name:conf.name}));
			}
		});
	};
	function _deleteColumn(){
		var column = columnOpt.data('column');
		var conf = column.data('conf');
		columnOpt.hide();
		if(!confirm($I.R011({name:conf.name})))
			return;
		var columnId = column.attr("id");
		$.post("column/delete", {id:columnId}, function(){
			column.remove();
			$("#s-"+columnId).remove();
			toggleNoColumnMsg();
			calculateColumnSize();
			adjustTabs();
		});
	};
	columnOpt = $('<div id="column-opt"/>')
		.append(
			$('<div class="menu-item"/>').append(
				$('<a href="javascript:void(0)"/>').html(
					$I.R012({status: '<span class="column-notification-status">'+(conf.prefs.notification ? 'ON':'OFF')+'</span>'})
				).click(_toggleColumnNotification)
			)
		)
		.append($('<div class="menu-item"/>').append($('<span class="label"/>').text($I.R086)))
		.append($('<div class="menu-item"/>').html('<table class="color-table" cellspacing="0" cellpadding="0"><tbody><tr/></tbody></table>'))
		.append($('<div class="menu-item"/>').append($('<a href="javascript:void(0)"/>').text($I.R014).click(_deleteColumn)));
	$('tr', columnOpt).append(
			$('<td><div class="bg-default">a</div></td>'),
			$('<td><div class="bg-red">a</div></td>'),
			$('<td><div class="bg-orange">a</div></td>'),
			$('<td><div class="bg-yellow">a</div></td>'),
			$('<td><div class="bg-green">a</div></td>'),
			$('<td><div class="bg-blue">a</div></td>'),
			$('<td><div class="bg-purple">a</div></td>')
		);
	$(".color-table td div", columnOpt).click(function(event){
		columnOpt.hide();
		var $this = $(this),
			column = columnOpt.data('column'),
			conf = column.data('conf'),
			newColorClass = $this.attr('class');
		var classNames = column.attr('class').split(' ');
		classNames = $.grep(classNames, function(n){ return n.indexOf('bg-') != 0; });
		classNames.push(newColorClass);
		column.attr('class', classNames.join(' '));
		$.ajax({
			type:"POST",
			url:"column/updateprefs",
			data:{
				id:column.attr("id"),
				bg_color:newColorClass
			},
			success: function(e){
				showNotice($I.R087({name:conf.name}));
			},
			error: function(){
				showError($I.R088({name:conf.name}));
			}
		});
		event.stopPropagation();
	});
	$('.column-header .menuButton', column).smallMenu({
		target: columnOpt,
		ondisplay: function(){columnOpt.data('column', column);}
	});
	
	if(service.canPostInColumn && service.canPostInColumn(column, conf)){
		createColumnInput(service, column, conf);
	}
	if(accountsMap) {
		renderAccountImage(service, column, conf);
	}
	$("<div/>")
		.attr("id", "s-"+conf.key)
		.addClass("icon")
		.addClass(service.getIconClass(conf))
		.attr("title", conf.name + (conf.account_label ? (' / ' + conf.account_label) : ""))
		.tipTip(tipConf)
		.click(function(){
			var clickedTabId = $(this).removeClass("new").parents(".shortcuts").attr("id").substring(2);
			if(clickedTabId  != currentTab.attr("id")){
				$("#tabs-navi li:has(.tab-name[href=#"+clickedTabId+"])").click();
			}
			scrollToColumn(conf.key);
			return false;
		}).appendTo($("#s-"+container.attr("id")));
	//カラムヘッダー上でホイールスクロールで横スクロール
	$(".column-header", column).mousewheel(function(e, delta){
		var tabContent = $("#tabs .tab-content");
		var scrollOffset = tabContent.scrollLeft() - delta*leftScrollSpeed;
		tabContent.scrollLeft(scrollOffset);
	});
	return column;
}
function adjustColumnContentHeight(columns){
	var columnContents = columns.children(".column-content"),
		columnHeight = columns.height();
	columnContents.each(function(){
		var content = $(this);
		content.css("height", columnHeight - content.position().top);
	});
}
function scrollToColumn(columnId){
	var tabContent = $("#tabs .tab-content");
	var x = tabContent.scrollLeft() + $("#"+columnId).offset().left - 1;
	tabContent.animate({scrollLeft: x}, 500);
}
//カラムの幅と高さをウィンドウサイズに合わせて調整します
function calculateColumnSize(){
	if(!currentTab) return;
	var columns = currentTab.children(".column");
	var maxColumn = columns.length > 8 ? 8 : columns.length;//１画面の最大表示カラム数
	if(maxColumn == 1) maxColumn = 2;
	var tabWidth = $("#tabs .tab-content").width();
	var columnWidth = Math.floor(tabWidth/maxColumn-3);
	//1カラムが300px以下だったらカラム数を減らします。
	while(columnWidth < minColumnWidth){
		if(maxColumn == 1) {
			columnWidth = minColumnWidth;
			break;
		}
		columnWidth = Math.floor(tabWidth/--maxColumn-3);
	}
	var tabHeight = $("#tabs").height() - $("#tabs-navi").height() - $("#tab-tool-bar").height() - 8;
	//最大カラム数より実際のカラム数の方が多い場合は横スクロールが表示されるので、その分補正
	if(columns.length > maxColumn)
		tabHeight -= $.browser.webkit ? 10 : 15;
	//currentTab.css("height", tabHeight);
	var columnHeight = tabHeight-4;
	currentTab.css("width", columns.length > 0 ? (columnWidth+3)*columns.length : "100%");
	columns.css("width", columnWidth);
	if($.browser.msie)
		columns.children(".column-content").css("height", 100);
	columns.css("height", columnHeight);
	adjustColumnContentHeight(columns);
}
//カラム追加
//@columnInfo の例
// "name": "Home",
// "service": "twitter",
// "account_name": "crowy_jp",
// "account_label": "Crowy日本語公式アカウント",
// "type": "home_timeline",
// "notification": true
function addColumn(columnInfo, callback){
	if(!columnInfo) return;
	var columns = $(".column", currentTab);
	columnInfo.tabId = currentTab.attr("id");
	columnInfo.order = columns.length > 0 ? columns.last().data("conf").order + 1 : 0;
	$.post("column/add", columnInfo,
		function(conf){
			try{
				var newColumn = createColumn(conf.key, conf.name, conf, currentTab);
				toggleNoColumnMsg();
				calculateColumnSize();
				if(callback) callback();
				loadColumn(newColumn);
				scrollToColumn(conf.key);
				adjustTabs();
			}catch(e){
				console.error(e);
			}
		}
	)
}
//各サービスごとのデフォルトカラムを追加する
function addDefaultColumn(serviceName, accountName, displayName, skipConfirm){
	function _addDefaultColumn(){
		var service = window[serviceName];
		var columnInfos = service.getDefaultColumnInfo(accountName, displayName);
		$.each(columnInfos, function(){
			this.service = serviceName;
			addColumn(this);
		});
	}
	if(skipConfirm){
		_addDefaultColumn();
		return;
	}
	$('<div class="confirm"/>').text($I.R022).dialog({
		height:140,
		resizable:false,
		modal:true,
		buttons: [
			{
				text:$I.R026,
				click: function(){
					$(this).dialog("close");
				}
			},
			{
				text:$I.R075,
				click: function(){
					_addDefaultColumn();
					$(this).dialog("close");
				}
			}
		]
	});
}
function adjustTabs(golastTab){
	//タブの幅を再計算。必要ならスクロールボタンを表示。
	function getAllTabWidth(){
		var _allTabWidth = 4;//4は#tabs-naviのpadding
		$('#tabs-navi li').each(function(){_allTabWidth += $(this).width() + 8;});//8は各タブのmarginとborder
		return _allTabWidth;
	}
	var allTabWidth = getAllTabWidth(), tabsWidth = $('#tabs-background').width();
	var tabSpaceWidth = tabsWidth - 100 - ($('#right-header').width()+20) - 30;//100:左のロゴなど、10:右のメニューのmargin、30:タブ追加ボタン
	if(allTabWidth <= tabSpaceWidth){
		tabs.removeClass('scroll');
		$('#tabs-navi-cover-right').width(tabsWidth - allTabWidth - 100);//100:左のロゴ等
		$('#tabs-navi').css('left', 100);//100:#tabs-naviの初期位置
	} else {
		var scrollDefaultLeft = 130;
		tabSpaceWidth -= 60;//60:タブのスクロールボタン
		var tabsNavi = $('#tabs-navi');
		if(!tabs.hasClass('scroll')){
			$('#tabs-navi-cover-right').width(tabsWidth - tabSpaceWidth - scrollDefaultLeft);//130:左のロゴ等
			tabsNavi.css('left', tabsNavi.offset().left+30);//30:#tabs-prevの幅
			tabs.addClass('scroll');
		}
		var maxScrollValue = (tabSpaceWidth + scrollDefaultLeft) - allTabWidth;
		if(golastTab || tabsNavi.offset().left < maxScrollValue){
			tabsNavi.css('left', maxScrollValue);
		}
		if(!tabsNavi.data('initScrollHandler')){
			tabsNavi.data('initScrollHandler', true);
			var tabScrollTimer = -1, duration = 100;
			function tabScrollPrev(){
				var currentScrollLeft = tabsNavi.offset().left;
				if(currentScrollLeft == scrollDefaultLeft) return;
				var scrollValue = currentScrollLeft + 100;
				tabsNavi.animate({left: scrollValue > scrollDefaultLeft ? scrollDefaultLeft : scrollValue}, duration);
				tabScrollTimer = setTimeout(tabScrollPrev, duration);
			}
			function tabScrollNext(){
				var scrollValue = 0, currentScrollLeft = tabsNavi.offset().left;
				var allTabWidth = getAllTabWidth(),
					tabsWidth = $('#tabs-background').width(),
					tabSpaceWidth = tabsWidth - scrollDefaultLeft - $('#tabs-navi-cover-right').width(),
					maxScrollValue = (tabSpaceWidth + scrollDefaultLeft) - allTabWidth;
				if(currentScrollLeft < maxScrollValue){
					return;
				}else if(currentScrollLeft-100 < maxScrollValue){
					scrollValue = maxScrollValue;
				} else {
					scrollValue = currentScrollLeft-100;
				}
				tabsNavi.animate({left:scrollValue}, duration);
				tabScrollTimer = setTimeout(tabScrollNext, duration);
			}
			$('#tabs-prev').mousedown(tabScrollPrev);
			$('#tabs-next').mousedown(tabScrollNext);
			$('#tabs-prev, #tabs-next').mouseup(function(){
				clearInterval(tabScrollTimer);
			});
		}
	}
}
function renderTabs(){
	//タブ情報のJSONからHTMLを生成
	$.each(tabConfs, function(i, tab){
		$('<li/>').append(
			$('<a class="tab-name"/>').attr('href','#'+tab.key).text(tab.name),
			$('<input type="text" style="display:none;"/>').val(tab.name),
			$('<span class="ui-icon ui-icon-close"/>').attr('title', $I.R023),
			$('<div class="shortcuts"/>').attr('id','s-'+tab.key)
		).data("conf", tab).appendTo("#tabs-navi");
		var tabElm = $('<div id="'+tab.key+'" class="tab"></div>').appendTo($("#tabs .tab-content"));
		//createTabShortcut(tab.key, tab.name);
		//confのbindがあるので、サーバーでHTMLは作らずJSONを返す
		$.each(tab.columns, function(){
			createColumn(this.key, this.name, this, tabElm);
		});
		if(!currentTab)
			currentTab = tabElm;
	});
	
	toggleNoColumnMsg();
	
	//カラム内投稿ボックスを閉じるリスナーをつけます
	$(document.body).click(function(event){
		if($(event.target).closest('.column-input.focus').length > 0) return;
		var columnInput = $('.column-input.focus');
		closeColumnInput(columnInput, event);
	});
	
	//jQuery UIでタブを作成します
	tabs = $("#tabs").tabs({
		tabTemplate: '<li><a href="#{href}" class="tab-name">#{label}</a><input type="text" style="display:none;" value="#{label}"/><span class="ui-icon ui-icon-close" title="'+$I.R023+'"></span></li>',
		panelTemplate: '<div class="tab"></div>',
		select:function(event, ui){
			var firstColumn = $(ui.panel).find('.column:first .message-list');
			if(firstColumn.length > 0){
				$('#adMessage').detach().prependTo(firstColumn);
			}
		}
	});
	
	//タブをソート可能にする
	$("#tabs-navi").sortable({
		placeholder:'ui-state-highlight',
		forcePlaceholderSize: true,
		delay: 100,
		helper: 'clone', //なぜかこうしないと高さがおかしくなる
		update: function(event, ui){
			var tabIds = [];
			$("#tabs-navi li a").each(function(){
				tabIds.push(this.getAttribute("href").substring(1));
			});
			$.post("tab/sort", {tabs:tabIds.join(",")}, function(res){});
		}
	});
	
	var columnSortableOption = {
		//axis:'x',
		placeholder:'ui-state-highlight',
		forcePlaceholderSize: true,
		handle: ".column-header",
		update: function(event, ui){
			var columnElm = $(ui.item[0]);
			if(columnElm.prev().length > 0){
				$("#s-"+columnElm.attr("id")).detach().insertAfter($("#s-"+columnElm.prev().attr("id")));
			} else if(columnElm.next().length > 0){
				$("#s-"+columnElm.attr("id")).detach().insertBefore($("#s-"+columnElm.next().attr("id")));
			}
			var columnIds = [];
			$(".column", currentTab).each(function(){
				columnIds.push(this.id);
			});
			adjustTabs();
			$.post("column/sort", {columns:columnIds.join(",")}, function(res){
			});
		}
	};
	var shortcutSortableOption = {
		placeholder:'ui-state-highlight',
		//helper: 'clone',
		connectWith: "#tabs-navi .shortcuts",
		delay: 100,
		update: function(event, ui){//タブ間移動した場合に二回呼ばれる
			var target = $(event.target);
			var shortcutElm = $(ui.item[0]);
			if(target.find(".icon").index(shortcutElm) < 0) return;//タブ間移動した場合はドロップ先のタブのみ処理を行う
			var targetTab = $(target.closest("li").find("a.tab-name").attr("href"));
			var columnElm = $("#"+shortcutElm.attr("id").substring(2)).detach();
			if(shortcutElm.prev().length > 0){
				columnElm.insertAfter($("#"+shortcutElm.prev().attr("id").substring(2)));
			} else if(shortcutElm.next().length > 0){
				columnElm.insertBefore($("#"+shortcutElm.next().attr("id").substring(2)));
			} else {
				columnElm.appendTo(targetTab);
			}
			calculateColumnSize();
			var columnIds = [];
			$(".column", targetTab).each(function(){
				columnIds.push(this.id);
			});
			toggleNoColumnMsg();
			adjustTabs();
			$.post("column/sort", {tabId: targetTab.attr("id"), columns:columnIds.join(",")}, function(res){
			});
		}
	}
	
	//タブ追加処理
	$("#add-tab").click(function(){
		var name = "untitled",
			tabNavis = $("#tabs-navi li"),
			order = tabNavis.length > 0 ? tabNavis.last().data("conf").order + 1 : 0;
		var conf = {name: name, order: order};
		$.post("tab/add", conf,
			function(id){
				tabs.tabs("add", "#"+id, name);
				$("#tabs-navi li:last").data("conf", conf)
					.append(
						$('<div class="shortcuts"/>')
							.attr("id", "s-"+id)
							.sortable(shortcutSortableOption)
					);
				tabs.tabs('select', '#' + id);
				//jQuery UIのタブを使うとtab-contentの中に入れることができないので、移動する
				currentTab = $("#"+id).detach().appendTo($("#tabs .tab-content"));
				toggleNoColumnMsg();
				currentTab.sortable(columnSortableOption);
				adjustTabs(true);
			}
		)
	});
	
	//タブ削除処理
	$('#tabs-navi span.ui-icon-close').livequery('click', function() {
		if($("#tabs-navi li").length == 1){
			alert($I.R024);
			return;
		}
		if(!confirm($I.R025))
			return;
		var tabId = $(this).prevAll("a.tab-name").attr("href").substring(1);//hrefには#がついている
		var index = $('li', tabs).index($(this).parent());
		$.post("tab/delete", {id:tabId}, function(){
			var prevId = $("#"+tabId).prev().attr("id");
			if(!prevId) prevId = $("#"+tabId).next().attr("id");
			tabs.tabs('remove', index);
			$("#s-"+tabId).remove();
			$("#s-"+prevId).parent('li').click();
			currentTab = $("#"+prevId);
			toggleNoColumnMsg();
			if(!currentTab.data("init"))
				loadTabContent();
			calculateColumnSize();
			adjustTabs();
		});
	});
	
	//タブクリック時の処理
	$('#tabs-navi li').livequery('click', function(){
		var tabNameLink = $(".tab-name", this);
		var tabId = tabNameLink.attr("href").substring(1);
		$("#s-"+currentTab.attr('id')).prevAll("input").hide().prev().show();
		if(currentTab.attr("id") != tabId){
			//別タブがクリックされたら、タブ切り替え処理
			tabs.tabs('select', "#"+tabId);
			currentTab = $("#"+tabId);
			toggleNoColumnMsg();
			if(!currentTab.data("init"))
				loadTabContent();
			calculateColumnSize();
			return;
		}
	});
	$('#tabs-navi .tab-name').livequery('click', function(){
		var tabNameLink = $(this);
		var tabId = tabNameLink.attr("href").substring(1);
		if(currentTab.attr("id") == tabId){
			tabNameLink.next().show().focus().width(tabNameLink.width() + 15);
			tabNameLink.hide();
		} else {
			tabNameLink.parent().click();
		}
	});
	$('#tabs-navi .tab-name + input').livequery('click', function(){return false;});
	//blurまたはEnterで確定する
	$('#tabs-navi .tab-name + input').livequery('blur keydown', function(event){
		if(event.type == 'keydown' && event.keyCode != 13) return;
		var name = $(this).val();
		var titleElm = $(this).prev();
		$(this).hide();
		if(name == titleElm.text()) {
			titleElm.show();
			return;
		}
		titleElm.text(name).show();
		adjustTabs();
		$.post("tab/rename",
			{
				id:titleElm.attr("href").substring(1),
				name:name
			}
		);
	});
	
	//カラム追加処理
	$('#nocolumn button').button();
	$("#add-column, #nocolumn button").click(function(){
		addColumnPopup = $("#add-column-popup").dialog({
			modal:true,
			width:600,
			height:420,
			open:function(){
				$("#add-column-tabs").serviceList();
			},
			buttons: [
				{
					text:$I.R018,
					click: function(){
						$(this).dialog("close");
					}
				},
				{
					text:$I.R027,
					click: function(){
						var columnInfo = getColumnInfo(), dialog = $(this);
						addColumn(columnInfo, function(){
							//dialog.dialog("close");
							var service = window[columnInfo.service];
							if(service && service.getPostUrl){
								var postUrl = service.getPostUrl(columnInfo);
								if(postUrl && !accountsMap[postUrl])
									loadAccounts();
							}
						});
					}
				}
			]
		});
	});
	//カラム更新処理
	$('#tabs .column-header .reloadButton').livequery('click', function() {
		var column = $(this).parents(".column");
		loadColumn(column, true, true);
	});
	//新着表示クリア処理
	$('.column .new-count').livequery('click', function(){
		var $this = $(this), column = $this.parents(".column");
		$('.message.new', column).removeClass('new');
		$this.hide().text(0);
		$('#s-'+column.attr('id')).removeClass('new');
	});
	
	//タブパネル全体の高さをウィンドウサイズに合わせて調整します
	function resizeContainer(){
		var containerHeight = $(window).height() - $('#footer').height() - 5;//20はAdSenseの分
		$("#tabs").css("height", containerHeight);
		if($.browser.msie){
			$("#tabs .tab-content").css("width", $(window).width());
			$("#tabs .tab-content").css("height", containerHeight - $("#tabs-navi").height() - $('#tab-tool-bar').height());
		}
		adjustTabs();
	}
	$(window).bind("resize", resizeContainer);
	resizeContainer();
	$(window).bind("resize", calculateColumnSize);
	calculateColumnSize();
	
	loadTabContent();
	
	//カラムをソート可能にする
	$("#tabs .tab-content .tab").sortable(columnSortableOption);
	//ショートカットをソート可能にする
	$("#tabs-navi .shortcuts").sortable(shortcutSortableOption);
	
	//スクロール中に返信ボタンなどを非表示にするためにスクロール中かどうかのフラグを立てる
	$("#tabs .tab-content").mousewheel(function(){
		onScrolling = true;
		if(scrollingTimer > 0)
			clearTimeout(scrollingTimer);
		scrollingTimer = setTimeout(function(){
			onScrolling = false;
			scrollingTimer = -1;
		}, 100);
	});
}

function showSettings(){
	$('#settings-popup').toggleClass('firststep', accounts.length == 0);
	settingsPopup = $("#settings-popup").dialog({
		modal:true,
		width:700,
		height:420,
		open:function(){
			$('#user-menu').smallMenu("close");
			$("#settings-tabs").tabs();
			$("#account-tabs").serviceList();
		},
		buttons: [
			{
				text:$I.R018,
				click: function(){
					$(this).dialog("close");
				}
			}
		]
	});
}

function renderAccountImage(service, column, conf){
	if(!accountsMap || !service.getPostUrl) return;
	try{
		conf.currentAccount = null;
		var account = accountsMap[service.getPostUrl(conf)], groupImage, profileImage;
		if(service.getOtherAccount){
			otherAccounts = service.getOtherAccount(conf);
			if(otherAccounts.length > 0){
				if(account){
					otherAccounts.unshift(account);
				}else{
					account = otherAccounts[0];
				}
				if(otherAccounts.length > 1){
					var target = $('<div class="select-account"/>');
					$.each(otherAccounts, function(idx, account){
						target.append($('<a class="account" href="#"/>')
								.append($('<img/>').attr('src', account.profile_image_url))
								.append($('<span/>').text(account.name))
								.click(function(){
									$('.column-input .account-image', column).attr('src', account.profile_image_url);
									conf.currentAccount = account;
									$('.column-input .account-image-outer', column).smallMenu('close');
								})
							);
					});
					//TODO Facebookでコメントを個人アカウントで投稿できないAPIのバグが直れば、$('.column-input', column);にする
					column.children('.column-input').addClass('multi').find('.account-image-outer')
						.smallMenu('destroy')
						.smallMenu({
							target:target
						});
				}
			}
		}
		conf.currentAccount = account;
		if(account) {
			groupImage = account.group_image_url;
			profileImage = account.profile_image_url;
		}
		if(service.getGroupImageUrl){
			var _groupImage = service.getGroupImageUrl(conf);
			if(_groupImage) groupImage = _groupImage;
		}
		if(groupImage || profileImage){
			$('.column-header .account-image', column).attr('src', groupImage || profileImage)
				.error(function(){
					$(this).unbind('error');
					if(service.onErrorGroupImage){
						service.onErrorGroupImage(this, conf,  profileImage, groupImage);
					} else {
						this.src = STATIC_URL + 'images/noprofileimage.gif';
					}
					return true;
				});
			$('.column-input .account-image', column).attr('src', profileImage || groupImage)
				.error(function(){
					$(this).unbind('error');
					if(service.onErrorProfileImage){
						service.onErrorProfileImage(this, conf, profileImage, groupImage);
					} else {
						this.src = STATIC_URL + 'images/noprofileimage.gif';
					}
					return true;
				});
		}
	}catch(e){console.error(e)}
}

//メッセージ入力ボックスのアカウント選択プルダウン
var minMessageLimit = 140;//現在選択しているサービスの入力可能最大文字数
var accounts, accountsMap;
//アカウント情報を読み込みます。初期ロード時とアカウント追加時（oauth_callback.html）に呼ばれます。
function loadAccounts(callback){
	$.getJSON("account/", function(data){
		accounts = [], accountsMap = {};
		//TODO: サーバーサイドで
		$.each(data, function(key, value){
			$.each(value, function(){
				this.service = key;
				this.value = key+"/"+this.name;
				accountsMap[this.url] = this;
			});
			$.merge(accounts, value);
		});
		if(callback)
			callback();
		else
			$("#message-from").autocomplete( "option", "source", accounts);
		
		$('.column').each(function(){
			var column = $(this), conf = column.data("conf"), service = window[conf.service];
			renderAccountImage(service, column, conf);
		});
		
		var accountThumb = $('#account-info .account-thumb');
		if(!accountThumb.data('loaded')){
			var accountImageUrl = "", facebookImageUrl = "";
			$.each(accounts, function(){
				if(this.service == "facebook" && this.type =='user' && this.profile_image_url)
					facebookImageUrl = this.profile_image_url;
				if(this.profile_image_url && !accountImageUrl)
					accountImageUrl = this.profile_image_url;
				if(facebookImageUrl)
					return false;
			});
			if(accountImageUrl){
				accountThumb.data('loaded',true).error(function(){
					this.src = STATIC_URL + 'images/noprofileimage.gif';
				}).attr('src', facebookImageUrl || accountImageUrl);
			}
		}
	});
}
//宛先を追加する
function addMessageFrom(postUrl){
	var item = accountsMap[postUrl];
	var iconClass = window[item.service].getIconClass({service:item.service, postUrl:postUrl});
	$('<div class="message-from-added ui-state-default"/>')
		.append(
			$('<div class="icon"/>').addClass(iconClass),
			$('<span/>').text(item.name),
			$('<div class="ui-icon ui-icon-close"/>').click(function(){
				removeMessageFrom($(this).parent());
				return false;
			})
		)
		.data("item", item)
		.insertBefore($("#message-from"));
	$("#message-from").val("");
	onAfterUpdateMessageFrom();
}
//宛先を削除する
function removeMessageFrom(messageFromAddedElm){
	messageFromAddedElm.remove();
	$("#message-from").css("visibility","visible").focus();
	onAfterUpdateMessageFrom();
}

function onAfterUpdateMessageFrom(){
	var items = $("#message-post-dialog .message-from-added");
	minMessageLimit = -1;
	var notUploadImageServices = [];
	countInputMessage();
	$.each(items, function(){
		var item = $(this).data("item"),
			service = window[item.service];
		if(!service.canUploadImage)
			notUploadImageServices.push(service.name || item.service);
	});
	
	//画像アップロードに対応していないサービスで画像アップロードしようとしたときに警告を表示
	if(notUploadImageServices.length > 0){
		$('#upload-image-warning').text($I.R079({services:notUploadImageServices.join('/')})).show();
	} else {
		$('#upload-image-warning').text('').hide();
	}
}
//投稿欄に入力された文字数をカウントして表示します
function countInputMessage(){
	var counter = $("#message-counter"), message = $("#message-body").val();
	var charCount = message.replace(/\s+$/g, "").length;
	counter.text(charCount).show();
	
	$('#message-body-footer .icon').hide();
	var items = $("#message-post-dialog .message-from-added");
	$.each(items, function(){
		var item = $(this).data("item"),
			service = window[item.service];
		if(service.countMessage){
			var count = service.countMessage(message, $('#filecontainer'));
			if(count < 0)
				$('#message-over-'+item.service).show();
		}else if(charCount > service.messageLimit){
			$('#message-over-'+item.service).show();
		}
	});
}
//宛先ショートカット欄をクリア
function clearMessageFrom(){
	$("#message-from").val("").autocomplete("close")
		.siblings(".message-from-added").remove();
}
//メッセージ作成ダイアログに入力された内容を消します
function clearInputMessage(){
	clearMessageFrom();
	$("#message-body").val("");
	$("#message-url").val("");
	countInputMessage();
	$("#reply-to").val("");
	$("#reply-to-message").text("").hide();
	$("#address-shortcut-check:checked").removeAttr("checked");
	$("#upload-image-warning").text("").hide();
	$('#filecontainer').uploader('cancel');
}

//アカウント情報を取得後、メッセージ作成ダイアログを初期化します
function initMessagePost(){
	function sendMessage(){
		var items = $("#message-post-dialog .message-from-added"),
			message = $("#message-body").val().replace(/\s+$/g, "");
		if(items.length == 0 || !message) return;
		$('#message-post-loading').show();
		try{
			var shortcutInfo = [], postUrls = [], isFailed = false;
			$.each(items, function(){
				postUrls.push($(this).data("item").url);
			});
			$.each(items, function(){
				var item = $(this).data("item"),
					url = item.url, service = window[item.service];
				if(service.countMessage){
					var count = service.countMessage(message, $('#filecontainer'));
					if(count < 0){
						message = message.substring(0, message.length + count);
					}
				}else if(service.messageLimit > 0){
					message = message.substring(0, service.messageLimit);
				}
				
				shortcutInfo.push(item);
				
				$.ajax({
					type:"POST",
					url:url,
					data: {
						'message':message,
						'reply-to':$("#reply-to").val(),
						'file-key':$('#filecontainer').uploader('keys')
					},
					success: function(){
						showNotice($I.R028({name:item.name}));
					},
					error: function(){
						showError($I.R029({name:item.name}));
						isFailed = true;
					},
					complete: function(){
						for(var i = 0; i < postUrls.length; i++){
							if(postUrls[i] == url){
								postUrls.splice(i,1);
								break;
							}
						}
						if(postUrls.length == 0){
							$('#message-post-loading').hide();
							if(!isFailed){
								$("#message-body").val("");
								$("#reply-to").val("");
								$("#reply-to-message").text("").hide();
								$("#address-shortcut-check:checked").removeAttr("checked");
								$('#filecontainer').uploader('cancel');
							}
						}
					}
				});
			});
		}catch(e){
			console.error(e);
			$('#message-post-loading').hide();
		}
		if($("#address-shortcut-check:checked").val()){
			var name = prompt($I.R030) || "NO TITLE";
			$.ajax({
				type:"POST",
				url:"shortcut/add",
				data: {
					name: name,
					address_info: JSON.stringify(shortcutInfo)
				},
				success: function(){
					showNotice($I.R031({name:name}));
					renderAddressShortcuts();
				},
				error: function(){
					showError($I.R032({name:name}));
				}
			});
		}
	}
	function sendMessageIfShiftEnter(e){
		try{
			if(isPostKey(e)){
				sendMessage();
				return false;
			}
		}catch(e){
		}
	}
	$('#message-help').text(POST_KEY_MSG);
	loadAccounts(function(){
		if(accounts.length == 0){
			showSettings();
			//callOnlyInitial({key:'crowy-20111007vup'});
		} else {
			/*callOnlyInitial({
				key:'crowy-20111007vup',
				callback: function(){
					showInformation();
				}
			});*/
		}
		var facebookUser = null, hasNoFacebookAccount = false;
		$.each(accounts, function(){
			if(this.service != 'facebook')
				hasNoFacebookAccount = true;
			else if(this.type == 'user')
				facebookUser = this;
		});
		if(facebookUser){
			if(!hasNoFacebookAccount && loginService == 'facebook' && $('.column').length == 0)
				addDefaultColumn('facebook', facebookUser.account_name, facebookUser.name, true);
			if(!facebookUser.scope || facebookUser.scope.indexOf('manage_pages') < 0){
				showInformation();
			}
		}
		$("#message-from").autocomplete({
			minLength:0,
			delay:100,
			source: accounts,
			select:function(event, ui){
				addMessageFrom(ui.item.url);
				return false;
			},
			focus:function(event, ui){
				return false;
			},
			open:function(event, ui){
				$(this).data("open",true);
			},
			close:function(event, ui){
				$(this).data("open",false);
			}
		})
		.keydown(function(event){
			var $this = $(this),
				prev = $this.prev(".message-from-added");
			//Backspace
			if(event.keyCode == 8 && $this.val().length == 0){
				if(prev.length == 0) return false;
				if(prev.hasClass("ui-state-active")){
					removeMessageFrom(prev);
				} else {
					prev.addClass("ui-state-active");
					$this.css("visibility","hidden");
				}
				setTimeout(function(){$("#message-from").autocomplete("close")}, 200);
				return false;
			} else if(prev.hasClass("ui-state-active")){
				$this.css("visibility","visible");
				prev.removeClass("ui-state-active");
			}
		})
		.blur(function(){
			$(this).prev(".message-from-added.ui-state-active").removeClass("ui-state-active");
		})
		.data( "autocomplete" )._renderItem = function( ul, item ) {
			return $( "<li/>" )
				.data( "item.autocomplete", item )
				.append($('<a/>').addClass(window[item.service].getIconClass({service:item.service, postUrl:item.url})).text(item.name))
				.appendTo( ul );
		};
		$("#message-from").parent().click(function(){
			var $from = $("#message-from");
			$from.focus().css("visibility","visible")
			if($from.data("open"))
				$from.autocomplete("close");
			else
				$from.autocomplete("search","");
		});
		$("#message-post-dialog button").button();
		$("#message-post-ok").click(function(){
			sendMessage();
		});
		$("#message-post-clear").click(function(){
			clearInputMessage();
		});
		
		$('#filecontainer').uploader({
			drop_element:'message-post-dialog',
			file_list_element: $('#message-post-dialog .filelist')
		});
		//短縮URL
		/*$("#shorten-url").click(function(){
			var $this = $(this);
			if($this.hasClass("loading")) return;
			var longurl = $("#message-url").val();
			if(!longurl) return;
			$this.button("disable");
			$.ajax({
				type:"GET",
				url:"url",
				data: {url:longurl},
				success: function(shorturl){
					$("#message-body").val($("#message-body").val() + " " + shorturl).focus();
					$("#message-url").val("");
					countInputMessage();
				},
				error: function(){
					showError($I.R033);
				},
				complete: function(){
					$this.button("enable");
				}
			});
		});*/
		$("#message-body").keydown(sendMessageIfShiftEnter).keyup(countInputMessage);
		$("#multiPost").click(function(){showPostMessageDialog();});
	});
}

function showPostMessageDialog(message, postUrl, replyTo, replyToMsg){
	if(postUrl){
		clearInputMessage()
		if($.isArray(postUrl)){
			$.each(postUrl, function(){
				addMessageFrom(this);
			});
		} else {
			addMessageFrom(postUrl);
		}
	}
	if(message){
		$("#message-body").val(message);
		countInputMessage();
	}
	if(replyTo && replyToMsg){
		$("#reply-to").val(replyTo);
		$("#reply-to-message").text(REPLY_PREFIX+replyToMsg).show();
	}
	$("#message-post-dialog").dialog({
		modal:false,
		width:500,
		position:[0,0],
		open:function(){
			if($("#message-post-dialog .message-from-added").length > 0)
				$("#message-body").focus();
//			else
//				$("#message-from").autocomplete("search", "");
		},
		close:function(){
			$("#message-from").autocomplete("close");
			$(document.body).focus();
		}
	});
}

var colorTable = '<table class="color-table" cellspacing="0" cellpadding="0"><tbody><tr><td><div style="background-color: rgb(222, 229, 242); color: rgb(90, 105, 134); " title="RGB (222, 229, 242)">a</div></td><td><div style="background-color: rgb(224, 236, 255); color: rgb(32, 108, 255); " title="RGB (224, 236, 255)">a</div></td><td><div style="background-color: rgb(223, 226, 255); color: rgb(0, 0, 204); " title="RGB (223, 226, 255)">a</div></td><td><div style="background-color: rgb(224, 213, 249); color: rgb(82, 41, 163); " title="RGB (224, 213, 249)">a</div></td><td><div style="background-color: rgb(253, 233, 244); color: rgb(133, 79, 97); " title="RGB (253, 233, 244)">a</div></td><td><div style="background-color: rgb(255, 227, 227); color: rgb(204, 0, 0); " title="RGB (255, 227, 227)">a</div></td></tr><tr><td><div style="background-color: rgb(90, 105, 134); color: rgb(222, 229, 242); " title="RGB (90, 105, 134)">a</div></td><td><div style="background-color: rgb(32, 108, 255); color: rgb(224, 236, 255); " title="RGB (32, 108, 255)">a</div></td><td><div style="background-color: rgb(0, 0, 204); color: rgb(223, 226, 255); " title="RGB (0, 0, 204)">a</div></td><td><div style="background-color: rgb(82, 41, 163); color: rgb(224, 213, 249); " title="RGB (82, 41, 163)">a</div></td><td><div style="background-color: rgb(133, 79, 97); color: rgb(253, 233, 244); " title="RGB (133, 79, 97)">a</div></td><td><div style="background-color: rgb(204, 0, 0); color: rgb(255, 227, 227); " title="RGB (204, 0, 0)">a</div></td></tr><tr><td><div style="background-color: rgb(255, 240, 225); color: rgb(236, 112, 0); " title="RGB (255, 240, 225)">a</div></td><td><div style="background-color: rgb(250, 220, 179); color: rgb(179, 109, 0); " title="RGB (250, 220, 179)">a</div></td><td><div style="background-color: rgb(243, 231, 179); color: rgb(171, 139, 0); " title="RGB (243, 231, 179)">a</div></td><td><div style="background-color: rgb(255, 255, 212); color: rgb(99, 99, 48); " title="RGB (255, 255, 212)">a</div></td><td><div style="background-color: rgb(249, 255, 239); color: rgb(100, 153, 44); " title="RGB (249, 255, 239)">a</div></td><td><div style="background-color: rgb(241, 245, 236); color: rgb(0, 102, 51); " title="RGB (241, 245, 236)">a</div></td></tr><tr><td><div style="background-color: rgb(236, 112, 0); color: rgb(255, 240, 225); " title="RGB (236, 112, 0)">a</div></td><td><div style="background-color: rgb(179, 109, 0); color: rgb(250, 220, 179); " title="RGB (179, 109, 0)">a</div></td><td><div style="background-color: rgb(171, 139, 0); color: rgb(243, 231, 179); " title="RGB (171, 139, 0)">a</div></td><td><div style="background-color: rgb(99, 99, 48); color: rgb(255, 255, 212); " title="RGB (99, 99, 48)">a</div></td><td><div style="background-color: rgb(100, 153, 44); color: rgb(249, 255, 239); " title="RGB (100, 153, 44)">a</div></td><td><div style="background-color: rgb(0, 102, 51); color: rgb(241, 245, 236); " title="RGB (0, 102, 51)">a</div></td></tr></tbody></table>';
//宛先ショートカットを表示します
function renderAddressShortcuts(){
	var shortcutOpt = $('#address-shortcut-opt');
	if(shortcutOpt.length == 0){
		function renameShortcut(event){
			shortcut = shortcutOpt.data("shortcut");
			var newName = prompt($I.R030, shortcut.name);
			if(newName){
				$.ajax({
					type:"POST",
					url:"shortcut/rename",
					data: {
						id: shortcut.key,
						name: newName
					},
					success: function(){
						showNotice($I.R034({name:newName}));
						renderAddressShortcuts();
						shortcutOpt.hide();
					},
					error: function(){
						showError($I.R035({name:shortcut.name}));
					}
				});
			}
			event.stopPropagation();
		}
		function deleteShortcut(event){
			shortcut = shortcutOpt.data("shortcut");
			if(confirm($I.R036)){
				$.ajax({
					type:"POST",
					url:"shortcut/delete",
					data: {
						id: shortcut.key
					},
					success: function(){
						showNotice($I.R037({name:shortcut.name}));
						renderAddressShortcuts();
						shortcutOpt.hide();
					},
					error: function(){
						showError($I.R038({name:shortcut.name}));
					}
				});
			}
			event.stopPropagation();
		}
		shortcutOpt = $('<div id="address-shortcut-opt"/>')
			.append($('<div class="menu-item"/>').append($('<a href="javascript:void(0)"/>').text($I.R039).click(renameShortcut)))
			.append($('<div class="menu-item"/>').append($('<a href="javascript:void(0)"/>').text($I.R014).click(deleteShortcut)))
			.append($('<div class="menu-item"/>').append($('<span class="label"/>').text($I.R040)))
			.append($('<div class="menu-item"/>').html(colorTable));
		$(".color-table td div", shortcutOpt).click(function(event){
			shortcutOpt.hide();
			shortcut = shortcutOpt.data("shortcut");
			var $this = $(this);
			$.ajax({
				type:"POST",
				url:"shortcut/color",
				data: {
					id: shortcut.key,
					background: $this.css('background-color'),
					font: $this.css('color')
				},
				success: function(){
					showNotice($I.R041({name:shortcut.name}));
					renderAddressShortcuts();
				},
				error: function(){
					showError($I.R042({name:shortcut.name}));
				}
			});
			event.stopPropagation();
		});
	}
	$.getJSON("shortcut/", function(data){
		if(data.length == 0) return;
		$("#address-shortcut").empty();
		$.each(data, function(index, shortcut){
			var shortcutName = shortcut.name, postUrl = [];
			var boxDiv = $('<div class="box" />'),
				toolTipDiv = boxDiv.clone().append($('<div/>').text(shortcutName));
			$.each(shortcut.info, function(){
				postUrl.push(this.url);
				toolTipDiv.append(
					$('<span class="item"/>').append(
						$('<img />').attr('src', STATIC_URL + 'images/'+this.service+'.png'),
						$('<span class="name"/>').text(this.name)
					)
				);
			});
			boxDiv
				.append(
					$('<a class="item"/>').text(shortcutName)
						.tipTip({
							delay:100,
							maxWidth:'100%',
							content:toolTipDiv
						}),
					$('<div class="address-shortcut-opt-button"/>').text('▼')
						.css({'color':shortcut.fontColor, 'background-color':shortcut.backgroundColor})
						.smallMenu({
							target:shortcutOpt,
							ondisplay:function(){shortcutOpt.data('shortcut', shortcut);}
						})
				)
				.click(function(){
					showPostMessageDialog("", postUrl);
					$('#address-shortcut').hide();
				}).appendTo($("#address-shortcut"));
		});
		$(document).click(function(){shortcutOpt.hide();});
	});
}

//返信などのボタンを表示する
function renderMsgCommand(){
	var msgCmd = $("#message-command");
	msgCmd.find('.menu-item').click(function(event){
		var func = currentMsg.data($(this).attr('rel'));
		if(func)
			func();
		event.stopPropagation();
	});
	msgCmd.find('.menu-group').mouseover(function(){
		$(this).addClass('active');
		var menuGroupCover = $('.menu-group-cover', this);
		clearTimeout(menuGroupCover.data('timer'));
		menuGroupCover.show();
	}).mouseout(function(){
		$(this).removeClass('active');
		var menuGroupCover = $('.menu-group-cover', this);
		var menuGroupTimer = setTimeout(function(){
			menuGroupCover.hide();
		},　300);
		menuGroupCover.data('timer', menuGroupTimer);
	});
	msgCmd.mouseover(function(){
		$(this).show();
	}).mouseout(function(){
		$(this).hide();
	}).mousewheel(function(){
		$(this).hide();
	});
	$(".message").livequery("mouseover", function(event){
		var msgElm = $(this);
		if(msgElm.parents('.column').length == 0) return;//プロフィールと検索で動かないようにする（暫定）
		if(onScrolling) return;
		if(msgCommandTimer > 0) clearTimeout(msgCommandTimer);
		msgCommandTimer = setTimeout(function(){
			var service = msgElm.parents(".column").data("conf").service;
			var msgCmd = $("#message-command");
			var zindex = msgElm.parents(".ui-dialog").css("z-index") || 2;
			msgCmd.css({"z-index":parseInt(zindex)+1, "left":0});
			msgCmd.find('.menu-item, .menu-group').hide();
			//msgCmd.find('.menu-group').removeClass('active');
			msgCmd.find('.menu-item').each(function(){
				var iconDiv = $(this);
				var menuType = iconDiv.attr('rel');
				if(!!msgElm.data(menuType)){
					iconDiv.show();
					iconDiv.parents('.menu-group').show();
				}
			});
			var offset = msgElm.offset();
			msgCmd.show();
			var left = offset.left + msgElm.innerWidth() - msgCmd.outerWidth();
			if(service == 'twitter') {
				var top = offset.top + msgElm.innerHeight() - msgCmd.outerHeight();
				msgCmd.css({"top": top, "left": left});
			} else {
				msgCmd.css({"top":offset.top, "left":left});
			}
			currentMsg = msgElm;
		}, 200);
		event.stopPropagation();
	});
	$("#message-command").mouseover(function(){
		if(msgCommandTimer > 0) clearTimeout(msgCommandTimer);
	});
	$(".tab-content").mouseout(function(){
		if(msgCommandTimer > 0) clearTimeout(msgCommandTimer);
		msgCommandTimer = setTimeout(function(){
			$("#message-command").hide();
		}, 100);
	});
}

function buildSearch(){
	$('#search-form').submit(function(event){
		event.preventDefault();
		var keyword = $("#search-keyword").val();
		if(!$.trim(keyword)) return false;
		$("#search-keyword").val("");
		var loading = $('<p class="loading"/>').text("Loading...");
		var popup = $('<div class="twitter"/>').append(loading).appendTo(document.body);
		var type = "search/"+keyword;
		var account_name = "";
		var columnInfo = {
			"name": keyword+"/Search",
			"service": "twitter",
			account_name: "",
			"account_label": "Search",
			type:type
		};
		var twitterAccounts = twitter.getOtherAccount();
		if(twitterAccounts.length == 0){
			alert($I.R103);
			return;
		} else {
			account_name = twitterAccounts[0].account_name;
		}
		popup.dialog({
			title: $I.R071 + " / " + keyword,
			height: 400,
			width:400,
			dialogClass: "thread",
			open: function(){
				$.get("twitter/messages/"+account_name+"?type=" + encodeURIComponent(type),
					function(data){
						loading.remove();
						$.each(data.messages, function(idx, entry){
							twitter.renderMessage(entry, columnInfo).appendTo(popup);
						});
					}
				);
			},
			close: function(event, ui){
				popup.remove();
			},
			buttons: [
				{
					text:$I.R027,
					click: function(){
						if(twitterAccounts.length == 0){
							alert($I.R103);
						}else if(twitterAccounts.length == 1){
							columnInfo.account_name = twitterAccounts[0].account_name;
							columnInfo.account_label = twitterAccounts[0].account_name;
							addColumn(columnInfo, function(){
								popup.dialog("close");
							});
						}else{
							var accountImg = $('<img/>'),
								accountsSelect = $('<select/>'),
								accountsPopup = $('<div class="tw-select-accounts"/>').append(
									$('<div class="label"/>').text($I.R104),
									$('<div class="tw-accounts-pulldown"/>').append(
										accountImg,
										accountsSelect
									)
								);
							$.each(twitterAccounts, function(){
								$('<option/>')
									.text(this.account_name).val(this.account_name).data('account', this)
									.appendTo(accountsSelect);
							});
							accountImg.attr('src', twitterAccounts[0].profile_image_url);
							accountsSelect.change(function(){
								var _account = $('option:selected', accountsSelect).data('account');
								accountImg.attr('src', _account.profile_image_url);
							});
							accountsPopup.dialog({
								modal:true,
								buttons:[
									{
										text:$I.R027,
										click:function(){
											var selectedAccount = $('option:selected', accountsSelect).val();
											columnInfo.account_name = selectedAccount;
											columnInfo.account_label = selectedAccount;
											addColumn(columnInfo, function(){
												accountsPopup.dialog('close');
												popup.dialog("close");
											});
										}
									}
								]
							})
						}
					}
				}
			]
		});
	});
}

//フッターのメッセージを定期的に切り替えます。
var currentMessageIndex = 1;
function changeFooterMessage(){
	$("#message"+currentMessageIndex).fadeOut(function(){
		var nextMessage = $("#message"+(++currentMessageIndex));
		if(nextMessage.length == 0) {
			currentMessageIndex = 1;
			nextMessage = $("#message"+currentMessageIndex);
		}
		nextMessage.fadeIn();
	});
}
//デスクトップ通知を表示する
function showNotification(title, message, icon) {
	if(!window.webkitNotifications || !notificationStatus) return;
	if (window.webkitNotifications.checkPermission() == 0) {
		if(!icon) icon = STATIC_URL + 'images/crowy_75x75.png';
		var n = window.webkitNotifications.createNotification(icon, title, message);
		n.ondisplay = function() {
			var _n = this;
			setTimeout(function() {
				if(_n.cancel) _n.cancel();
			}, 7000);
		};
		n.show();
	}
}
function toggleNotification(){
	if(!window.webkitNotifications){
		alert($I.R007);
		return;
	}
	function _saveNotification(n){
		$.ajax({
			type:"POST",
			url:"settings/update",
			data:{
				'notification':n,
				'type_notification':'bool'
			},
			success: function(){
				showNotice($I.R043);
				notificationStatus = n;
				$('#desktop-notifier').attr('class', n ? 'notifier-on' : 'notifier-off');
			},
			error: function(){
				showError($I.R044);
			}
		});
	}
	if(!window.webkitNotifications){
		notificationStatus = false;
		return;
	}
	if(notificationStatus) {
		_saveNotification(false);
	} else if(window.webkitNotifications.checkPermission() != 0) {
		window.webkitNotifications.requestPermission(function(){
			if (window.webkitNotifications.checkPermission() == 0) {
				_saveNotification(true);
			}
		});
	} else {
		_saveNotification(true);
	}
}

//通知を表示する
function _showNotice(msg, isError){
	var noticeDiv = $("#notice").show();
	$('<div/>').toggleClass("error", isError).text(msg)
		.appendTo(noticeDiv)
		.fadeIn("slow").delay(1000).fadeOut("slow", function(){
			$(this).remove();
			if($("div", noticeDiv).length == 0) noticeDiv.hide();
		});
}
function showNotice(msg){
	_showNotice(msg, false);
}
function showError(msg){
	_showNotice(msg, true);
}

//新着通知を表示する
function showNotificationCount(columnConf, count){
	var columnName = columnConf.name + (columnConf.account_label ? (' / ' + columnConf.account_label) : "");
	if(count <= 0) {
		$("#s-"+columnConf.key).removeClass("new").attr("title",columnName).tipTip(tipConf);
		return;
	}
	$("#s-"+columnConf.key).addClass("new").attr("title","("+count+") "+columnName).tipTip(tipConf);
}

//UTCタイムをローカルタイムに変換します
var tzoffset = new Date().getTimezoneOffset() * 60000;
function to2(num){
	return num < 10 ? "0" + num : num;
}
function formatDate(date){
	yyyy = date.getFullYear();
	mm = to2(date.getMonth() + 1);
	dd = to2(date.getDate());
	hh = to2(date.getHours());
	MM = to2(date.getMinutes());
	ss = to2(date.getSeconds());
	return yyyy+"-"+mm+"-"+dd+" "+hh+":"+MM+":"+ss;
}
function toLocalTime(formattedDate){
	var localtime = new Date(Date.parse(formattedDate) - tzoffset);
	return formatDate(localtime);
}
function getTimeUTC(formattedLocalDateTime) {
// formattedLocalDateTime is like: "Thu Feb 21 23:27:07 2013"
	return Date.parse(formattedLocalDateTime) - tzoffset;
}
var monthNames = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
function toTweetTimestampStr(timeUTC) {
// timeUTC: msec since 1 January 1970 00:00:00 UTC
// return: [timestampStr, isRelativeTime]
	var now = new Date().getTime();
	var elapsed = now - timeUTC;
	elapsed /= 1000.0; // sec
	var sec = Math.round(elapsed);
	if (sec < 60) return [sec+"s", true];
	elapsed /= 60.0; // min
	var min = Math.round(elapsed);
	if (min < 60)  return [min+"m", true];
	elapsed /= 60.0; // hour
	var hour = Math.round(elapsed);
	if (hour < 24) return [hour+"h", true];
	var d = new Date(timeUTC);
	var date = d.getDate();
	var month = monthNames[d.getMonth()];
	return [date + " " + month, false];
}
var updateTimestampTimerInterval = 57*1000;
// about 1 min. make it 57 rather than 60 to avoid syncing with other updates.
function updateTimestamp() {
	$(".relative-time").each(function() {
		var time = $(this).data("time");
		var tts = toTweetTimestampStr(time);
		var timestampStr = tts[0], isRelativeTime = tts[1];
		$(this).find("a").text(timestampStr);
		if (!isRelativeTime) {
			$(this).removeClass("relative-time");
		}
	});
}
function createTimestampDiv(display_time, entryUrl, isDM) {
	var timeLinkOpt = {
		title: toLocalTime(display_time)
	};
	if(!isDM){
		timeLinkOpt = {
			href:entryUrl,
			target:"_blank",
			title: toLocalTime(display_time)
		}
	}
	var timeUTC = getTimeUTC(display_time);
	var tts = toTweetTimestampStr(timeUTC);
	var timestampStr = tts[0], isRelativeTime = tts[1];
	var div = $.DIV({className:"time"},
		$.A(
			timeLinkOpt,
			timestampStr
		)
	);
	div.data("time", timeUTC);
	if (isRelativeTime) {
		div.addClass("relative-time");
	}
	return div;
}
function buildURL(url, params){
	url += "?";
	var index = 0;
	$.each(params, function(key, value){
		if(index++ > 0) url += "&";
		url += encodeURIComponent(key) + "=" + encodeURIComponent(value);
	});
	return url;
}

function createAmazonLink(href, opts){
	if(href){
		if(!opts.redirect_off && href.match(/http:\/\/amzn.to\/.*/)){
			expandUrl(href, function(url){
				opts.redirect_off = true;
				opts.success(createAmazonLink(url, opts));
			});
			return;
		} else if(href.match(/http:\/\/www\.amazon\.co\.jp\/.*/)){
			href = href.replace(/(\?|&)tag=([^&]+)/, '');
			href = href.replace(/\/[\w]+-[0-9]+\//,'/');
			if(href.indexOf('?')>0)
				href+='&tag='+AMAZON_ASSOCIATES_ID;
			else
				href+='?tag='+AMAZON_ASSOCIATES_ID;
			opts.success(href, opts);
		}
	}
}

$(function(){
	//カレントタブの全カラムを更新します
	function reloadTabContent(){
		if(!currentTab) return;
		currentTab.find(".column").each(function(i, column){
			currentTab.queue(function(){
				loadColumn($(column), true);
			});
		});
	}
	//裏タブの全カラムを更新します
	function reloadBackTabContent(){
		$("#tabs .tab").each(function(i, tab){
			var tab = $(tab);
			if(tab.attr("id") != currentTab.attr("id")){
				$(".column", tab).each(function(j, column){
					tabs.queue(function(){
						loadColumn($(column), true);
					});
				});
			}
		});
	}
	
	if($.browser.webkit){
		$(document.body).addClass('webkit');
	}
	if(!navigator.userAgent.toLowerCase().indexOf('Mac OS X 10.7')){
		$(document.body).addClass('notlion');
	}
	
	initMessagePost();
	
	renderAddressShortcuts();
	$('#multiPost-bookmark').click(function(event){$('#address-shortcut').show();event.stopPropagation();});
	$('#address-shortcut').click(function(event){event.stopPropagation();});
	$(document).click(function(){$('#address-shortcut').hide();});
	
	renderTabs();
	
	renderMsgCommand();
	
	//右上メニュー
	$('#user-menu').smallMenu({
		target: $('#top-menu-more'),
		appended: true,
		position: {top:'36px', right:'10px'}, 
		ondisplay: function(){$('#user-menu').addClass('focus');},
		onclose: function(){$('#user-menu').removeClass('focus');}
	});
	
	//タブの手動更新
	$("#refresh-tab").click(reloadTabContent);
	//5分ごとにタブを更新
	reloadTimer = setInterval(reloadTabContent, 5*60*1000);
	//10秒後に裏タブ更新を開始
	setTimeout(reloadBackTabContent, 10*1000);
	//60分ごとに裏タブを更新
	reloadBackTimer = setInterval(reloadBackTabContent, 60*60*1000);
	// 経過時刻の更新
	updateTimestampTimer = setInterval(updateTimestamp, updateTimestampTimerInterval);
	
	//設定画面を開くハンドラーをつける
	$("#settings").click(showSettings);
	
	buildSearch();
	
	//フッターのメッセージを定期的に切り替える
	setInterval(changeFooterMessage, 5*60*1000);
	
	//300秒間フォーカスアウトしてたらカラム辺りの最大件数を超えている古いメッセージを削除する（メモリ解放）
	var cleanTimer = -1;
	$(window).blur(function(){
		if(cleanTimer) clearTimeout(cleanTimer);
		cleanTimer = setTimeout(function(){
			$("#tabs .message-list").each(function(){
				var oldMsgs = $(".message:gt("+(maxMessageCount-1)+")", this);
				oldMsgs.first().nextAll('.gap, .gap-loading').remove();
				oldMsgs.remove();
			});
		}, 300000);
	})
	.focus(function(){
		if(cleanTimer) clearTimeout(cleanTimer);
	})
	.unload(function(){
		//OAuth認証を途中でやめて残ったゴミの削除
		$.post("account/removecache");
		//添付ファイルの削除
		$.post("file/delete");
	});
	
	$('#logout').click(function(event){
		if(loginService == 'google'){
			event.preventDefault();
			$('<div id="logout-google"/>').text($I.R105).dialog({
				modal:true,
				minHeight:0,
				buttons:[
					{
						text:$I.R106,
						click: function(){
							$(this).dialog("close");
							location.href = 'logout';
						}
					},
					{
						text:$I.R107,
						click: function(){
							$(this).dialog("close");
							location.href = 'logout?google=1';
						}
					}
				]
			});
		}
	});
	
	//使えない場合は、デスクトップ通知切り替えボタンを消す
	//FireFox Add-on http://code.google.com/p/ff-html5notifications/ のためにsetTimeout
	setTimeout(function(){
		var notificationSwitch = $('#notification-switch');
		var notificationTip = $($I.R045);
		notificationSwitch.tipTip({
			maxWidth: '300px',
			content: notificationTip
		});
		/*callOnlyInitial({
			key: 'crowy-show-notification-help',
			callback: function(){
				notificationTip.prepend($('<div class="new">[New!]</div>')).append($('<div class="close">x</div>').click(function(){notificationSwitch.trigger('mouseout');}));
				notificationSwitch.trigger('mouseover');
			},
			count: 2
		});*/
		$('#desktop-notifier').attr('class', window.webkitNotifications && notificationStatus ? 'notifier-on' : 'notifier-off');
	}, 500);

	//Facebookページのフィードをフッターに表示。どうでもいい処理なので1秒後に実行。
	/*setTimeout(function(){
		function loadCrowyNews() {
			var feed = new google.feeds.Feed("http://www.facebook.com/feeds/page.php?id=183610931686318&format=atom10");
			feed.setNumEntries(5);
			feed.load(function(result) {
				if (!result.error) {
					var footer = $("#footer-message");
					$.each(result.feed.entries, function(idx){
						$('<a target="_blank"/>').attr('href', this.link).html(this.title).toggle(idx == 0).appendTo(footer);
					});
				}
			});
			setInterval(function(){
				var current = $("#footer-message a:visible").hide(), next = current.next();
				if(next.length == 0) next = $("#footer-message a:first");
				next.show();
			}, 30000);
		}
		loadCrowyNews();
	}, 5000);*/

});

function removeAccount(service, account, name){
	if(!confirm($I.R046({name:(name || account)}))) return;
	$.ajax({
		type:"POST",
		url:"account/remove",
		data:{service:service, name:account},
		success: function(){
			showNotice($I.R047);
			location.reload();
		},
		error: function(){
			showError($I.R048);
		}
	});
}

var youroom = {
	messageLimit: 280,
	canUploadImage: true,
	canPostInColumn: function(column, conf){
		return conf.type != "";
	},
	getPostUrl: function(conf){
		if(conf.type){
			return "youroom/post/"+conf.account_name+"/"+conf.type;
		}
		return "";
	},
	getDefaultColumnInfo: function(accountName, displayName){
		return [
			{
				"name": "Home",
				"account_label": accountName,
				"account_name": accountName,
				"type": "",
				"notification": false
			}
		];
	},
	getColumnLink: function(conf){
		var type = conf.type;
		if(type == ""){
			return "https://www.youroom.in/";
		}
		return "https://www.youroom.in/r/"+type;
	},
	getIconClass: function(conf){
		return 'icon-'+conf.service;
	},
	onErrorGroupImage: function(img, conf, profileImage, groupImage){
		img.src = "youroom/api/"+conf.account_name+"?url=" + encodeURIComponent(groupImage);
	},
	onErrorProfileImage: function(img, conf, profileImage, groupImage){
		img.src = "youroom/api/"+conf.account_name+"?url=" + encodeURIComponent(profileImage);
	},
	baseUrl: "https://www.youroom.in/r/",
	renderMessage: function(entry, columnInfo, refresh, data){
		var part = entry.participation,
			room_id = (part.group && part.group.to_param) || data.room_id;
		var messageElm = $.DIV({className:"message"},
			$.A({
					href:youroom.baseUrl+room_id+"/participations/"+part.id,
					className:"profile-image",
					target:"_blank"
				},
				$.IMG(
					{src:youroom.baseUrl+room_id+"/participations/"+part.id+"/picture"}
				).error(function(){
					$(this).unbind('error');
					var profileImageUrl = youroom.baseUrl+room_id+"/participations/"+part.id+"/picture";
					this.src = "youroom/api/"+columnInfo.account_name+"?url="+encodeURIComponent(profileImageUrl);
					$(this).error(function(){
						$(this).unbind('error');
						this.src="https://www.youroom.in/images/default_picture.png";
					});
				})
			),
			$.A({
					href:youroom.baseUrl+room_id+"/participations/"+part.id,
					className:"user-name",
					target:"_blank"
				},
				part.name
			),
			$.DIV({className:"time"},
				$.A({
						href:youroom.baseUrl+room_id+"/entries/"+entry.root_id,
						target:"_blank"
					},
					toLocalTime(entry.display_time)
				)
			),
			$.DIV({className:"message-text"}).html(entry.display_text)
		).data("reply", function(){
			if(youroom.canPostInColumn(null, columnInfo)){
				openColumnInput(false, columnInfo, "", entry.id, entry.content);
			} else {
				var account_name = columnInfo.account_name;
				showPostMessageDialog("", "youroom/post/"+account_name+"/"+room_id, entry.id, entry.content);
			}
		}).data("entry", entry);
		if(part.group){
			$(".user-name", messageElm).after($.A({
					href:youroom.baseUrl+room_id,
					target:"_blank"
				},
				part.group ? part.group.name : ""
			)).after(" in ");
		}
		if(entry.root_id){//TODO 会話の有無を判断したい
			messageElm.data("thread", function(){
				var popup = $.DIV().append($('<p class="loading"/>').text("Loading...")).appendTo(document.body);
				popup.dialog({
					title: $I.R049,
					height: 400,
					width:400,
					dialogClass: "thread",
					open: function(event, ui){
						$.get("youroom/thread/"+columnInfo.account_name+"/?room_id="+room_id+"&id="+entry.root_id,
						function(data){
							popup.empty();
							youroom.renderThread.apply(youroom, [data, popup, columnInfo]);
						});
					},
					close: function(event, ui){
						popup.remove();
					}
				});
			});
		}
		if(entry.attachment){
			if(entry.attachment.data){
				var data = entry.attachment.data;
				if(data.url){
					var url = data.url;
					messageElm.append($.A({href:url, target:"_blank"}, url.length > 40 ? url.substring(0,37)+"...":url));
				} else if(data.text){
					messageElm.append(
						$.DIV({className:"message-text"}).text(data.text).hide(),
						$.A({className:"more",href:"#"}, $I.R050).click(function(){
							var moreText = $(this).prev();
							if(moreText.css("display") == "none")
								$(this).text($I.R051);
							else
								$(this).text($I.R050);
							moreText.toggle();
						})
					);
				}
			} else {
				var attach = entry.attachment, type = attach.attachment_type,
					attach_params = {
						"id": entry.id,
						"room_id": room_id,
						"content-type": attach.content_type,
						"name": attach.filename
					}
				if(type == "Image"){
					$('<a target="_blank"/>')
						.attr("href", 'https://www.youroom.in/r/'+room_id+'/entries/'+entry.id+'/attachment')
						.attr("target", "_blank")
						//.attr("href", buildURL("youroom/attach/"+columnInfo.account_name, attach_params))
						.append($('<img height="20"/>')
							.attr("src", buildURL("youroom/attach/"+columnInfo.account_name, attach_params))
							.attr("alt", attach.filename)
						)
						.appendTo($('<div class="images"/>').appendTo(messageElm));
				} else if(type == "File"){
					$("<a/>").text(attach.filename)
						.attr("href", 'https://www.youroom.in/r/'+room_id+'/entries/'+entry.id+'/attachment')
						.attr("target", "_blank")
						//.attr("href", buildURL("youroom/attach/"+columnInfo.account_name, attach_params))
						.appendTo($('<div class="files"/>').appendTo(messageElm));
				}
			}
		}
		return messageElm;
	},
	getEntry: function(entry){
		return entry.entry;
	},
	getNotificationInfo: function(entry, data, columnInfo){
		var part = entry.participation,
		room_id = (part.group && part.group.to_param) || data.room_id;
		return {
			title: part.name + ' in ' + columnInfo.name,
			message: entry.content,
			icon: STATIC_URL + 'images/youroom.png'
		};
	},
	renderThread: function(data, popup, columnInfo){
		var entry = data.messages.entry;
		youroom.renderMessage(entry, columnInfo, false, false, data).appendTo(popup);
		youroom.renderChildren(entry.children, data, popup, columnInfo, 1);
	},
	renderChildren: function(children, data, popup, columnInfo, indent){
		if(!children) return;
		$.each(children, function(){
			youroom.renderMessage(this, columnInfo, false, false, data).css("margin-left", indent*5+"px").appendTo(popup);
			youroom.renderChildren(this.children, data, popup, columnInfo, indent+1);
		});
	},
	moreMessages: function(){
		var $this = $(this);
		var columnContent = $this.prev(".message-list");
		var conf = columnContent.parents(".column").data("conf");
		var url = conf.service + "/messages/" + conf.account_name;
		var msgCnt = $(".message", columnContent).length;
		var page = Math.floor(msgCnt/10)+1;
		$this.hide().next().show();
		$.getJSON(buildURL(url, {type:conf.type, page:page}), function(data){
			renderMessages(youroom, data, columnContent, conf);
			$this.show().next().hide();
		});
	}
}
var twitter = {
	name:'Twitter',
	messageLimit: 140,
	canUploadImage: true,
	countMessage: function(message, uploader){
		var messageLength = message.replace(/\s+$/g, "").length;
		var re = new RegExp("(http[s]?://[\\w|/|\.|%|&|\?|=|\\-|#|!|:|;|~]+)", 'g'),
			match = message.match(re);
		if(match){
			$.each(match, function(){
				if(this.length > 20){
					messageLength += 20 - this.length;//t.coは20文字に短縮される
				}
			});
		}
		if(uploader.uploader('keys').length > 0){
			messageLength += 21;//スペース＋URLになる
		}
		var charCount = twitter.messageLimit - messageLength;
		return charCount;
	},
	canPostInColumn: function(column, conf){
		return true;
	},
	typeToLink: {
		"home_timeline": "http://twitter.com/",
		"mentions": "http://twitter.com/#!/mentions",
		"retweeted_by_me": "http://twitter.com/#!/retweets",
		"retweeted_to_me": "http://twitter.com/#!/retweets_by_others",
		"retweets_of_me": "http://twitter.com/#!/retweeted_of_mine",
		"direct_messages": "http://twitter.com/#!/messages",
		"direct_messages/sent": "http://twitter.com/#!/messages"
	},
	getColumnLink: function(conf){
		try{
			var type = conf.type;
			if(type.indexOf("search/") == 0){
				return "http://twitter.com/#!/search/"+encodeURIComponent(type.substring(7));
			} else if(type.indexOf("list/") == 0){
				return "http://twitter.com/#!/"+type.substring(5);
			} else if(type == "user_timeline"){
				return "http://twitter.com/#!/"+encodeURIComponent(conf.account_name);
			} else if(type == "favorites"){
				return "http://twitter.com/#!/"+encodeURIComponent(conf.account_name)+"/favorites";
			}
			return twitter.typeToLink[type];
		}catch(e){
			return false;
		}
	},
	getIconClass: function(conf){
		return 'icon-twitter';
	},
	getPostUrl: function(conf){
		if(conf.currentAccount)
			return conf.currentAccount.url;
		return "twitter/post/"+conf.account_name;
	},
	getOtherAccount: function(conf){
		var _accounts = [];
		$.each(accounts, function(){
			if(this.url.match('^twitter/post/') && (!conf || twitter.getPostUrl(conf) != this.url)){
				_accounts.push(this);
			}
		});
		return _accounts;
	},
	getDefaultColumnInfo: function(accountName, displayName){
		return [
			{
				"name": "Home",
				"account_label": accountName,
				"account_name": accountName,
				"type": "home_timeline",
				"notification": false
			},
			{
				"name": "Mentions",
				"account_label": accountName,
				"account_name": accountName,
				"type": "mentions",
				"notification": true
			}
		];
	},
	openColumnInput: function(column, conf){
		var textbox = column.find(".message-input textarea");
		var msg = textbox.val();
		if(!msg && conf.type.match(/search\/(#[^\s]*)/))
			msg = " " + RegExp.$1;
		openColumnInput(column, conf, msg, "", "", true);
	},
	openProfile: function(user, columnInfo, event){
		if(!columnInfo.account_name) return;
		if(event && event.preventDefault) event.preventDefault();
		var tempId = "profile-" + new Date().getTime();
		var profileDialog = $('<div class="profile"/>').append(
			$('<div class="profile-tabs twitter"/>').append(
				$('<ul/>').append(
					$('<li class="profile-tab"><a href="#profile-tab-'+tempId+'"><span/></a></li>'),
					$('<li class="timeline-tab"><a href="#timeline-tab-'+tempId+'"><span/></a></li>'),
					$('<li class="mention-tab"><a href="#mention-tab-'+tempId+'"><span/></a></li>'),
					$('<li class="favorites-tab"><a href="#favorites-tab-'+tempId+'"><span/></a></li>'),
					$('<li class="list-tab"><a href="#list-tab-'+tempId+'"><span/></a></li>')
				),
				$('<div id="profile-tab-'+tempId+'" class="profile-tabbody"/>'),
				$('<div id="timeline-tab-'+tempId+'" class="timeline-tabbody"/>'),
				$('<div id="mention-tab-'+tempId+'" class="timeline-tabbody"/>'),
				$('<div id="favorites-tab-'+tempId+'" class="timeline-tabbody"/>'),
				$('<div id="list-tab-'+tempId+'" class="list-tabbody"/>')
			)
		).appendTo(document.body).dialog({
			title:user.name || user.screen_name,
			width:400,
			height:440,
			resizable:false,
			open:function(){
				$('.timeline-tabbody', this).append(
					$('<div class="panel"/>'),
					$('<div class="buttons"/>').append(
						$('<div class="button addcolumn-btn"/>').append(
							$('<a href="#"/>').text($I.R027).click(function(){
								var conf = $(this).parents('.timeline-tabbody').data('conf');
								if(conf)
									addColumn(conf);
							})
						)
					)
				);
				$(this).find('.profile-tabs').tabs({
					select:function(event, ui){
						var panel = $('.panel', ui.panel), panelId = ui.panel.id;
						function renderTimeline(newColumnInfo){
							$(ui.panel).data('conf', newColumnInfo);
							var loading = $('<p class="loading"/>').text("Loading...");
							panel.empty().append(loading);
							$.get("twitter/messages/"+columnInfo.account_name+"?type=" + encodeURIComponent(newColumnInfo.type),
								function(data){
									loading.remove();
									$.each(data.messages, function(idx, entry){
										twitter.renderMessage(entry, newColumnInfo).appendTo(panel);
									});
								}
							);
						}
						if(panelId.indexOf('timeline-tab-') == 0){
							var newColumnInfo = {
								"name": "From:"+user.screen_name,
								"service": "twitter",
								account_name: columnInfo.account_name,
								"account_label": columnInfo.account_name,
								type:"user/"+user.screen_name
							};
							renderTimeline(newColumnInfo);
						} else if(panelId.indexOf('mention-tab-') == 0){
							var newColumnInfo = {
								"name": "To:"+user.screen_name,
								"service": "twitter",
								account_name: columnInfo.account_name,
								"account_label": columnInfo.account_name,
								type:"mentions/"+user.screen_name
							};
							renderTimeline(newColumnInfo);
						} else if(panelId.indexOf('favorites-tab-') == 0){
							var newColumnInfo = {
								"name": "Fav:"+user.screen_name,
								"service": "twitter",
								account_name: columnInfo.account_name,
								"account_label": columnInfo.account_name,
								type:"favorites/"+user.screen_name
							};
							renderTimeline(newColumnInfo);
						}
					}
				});
			}
		});
		function renderProfileInfo(user){
			var otherAccounts = twitter.getOtherAccount();
			var profilePanel = $('<div class="profilePanel panel"/>').append(
					$('<div class="userInfo"/>').append(
						$('<a class="open-twitter"/>').append($('<img class="userIcon"/>').attr('src', user.profile_image_url)),
						$('<a class="userName open-twitter"/>').text(user.name),
						$('<p class="additionalInfo"/>').append(
							$('<a class="accountName open-twitter"/>').text('@'+user.screen_name),
							$('<span class="userLocation"/>').text(user.location)
						),
						$('<p class="userWeb"/>').append($('<a target="_blank"/>').attr('href',user.url).text(user.url))
					),
					user.description ? $('<div class="userDescription"/>').append($('<p/>').text(user.description)) : false,
					$('<table class="tweetNumbers"/>').append(
						$('<tbody/>').append(
							$('<tr/>').append(
								$('<td class="following"/>').append(
									$('<a class="tweetNum"/>').text(user.friends_count),
									$('<a class="tweetLabel"/>').text($I.R092)
								),
								$('<td class="followers"/>').append(
									$('<a class="tweetNum"/>').text(user.followers_count),
									$('<a class="tweetLabel"/>').text($I.R093)
								)
							),
							$('<tr/>').append(
								$('<td class="tweets"/>').append(
									$('<a class="tweetNum"/>').text(user.statuses_count),
									$('<a class="tweetLabel"/>').text($I.R094)
								).click(function(){$('.profile-tabs', profileDialog).tabs('select', 1);}),
								$('<td class="favorites"/>').append(
									$('<a class="tweetNum"/>').text(user.favourites_count),
									$('<a class="tweetLabel"/>').text($I.R095)
								).click(function(){$('.profile-tabs', profileDialog).tabs('select', 3);})
							)
						)
					)
				),
				profileBtns = $('<div class="profileBtns buttons"/>').append(
					$('<div class="button follow-manage"/>').append($('<a href="#"/>').text($I.R096).click(function(){
						profilePanel.toggleClass('open-friendships');
						var friendshipsPanel = $('.friendships', profilePanel);
						if(friendshipsPanel.length > 0){
							if(friendshipsPanel.is(':visible'))
								friendshipsPanel.animate({bottom:'hide'}, 'fast');
							else
								friendshipsPanel.animate({bottom:'show'}, 'fast');
							return;
						}
						
						function renderFriendships(tr){
							var sourceAccount = $('.friendships-account span', tr).text();
							$.getJSON(
								"twitter/api/"+sourceAccount,
								{path:"friendships/lookup.json?screen_name="+user.screen_name},
								function(data){
									var friendships = data[0].connections;
									var f1 = friendships.indexOf('following') >= 0,
										f2 = friendships.indexOf('followed_by') >= 0,
										f3 = friendships.indexOf('following_requested') >= 0;
									var status = $I.R097, followClass = 'friend';
									if(!f1 && f2) {
										status = $I.R098;
										followClass = 'fan';
									} else if(f1 && !f2) {
										status = $I.R099;
										followClass = 'following';
									} else if(!f1 && !f2) {
										status = '';
										followClass = 'norelation';
									}
									$('.friendships-status span', tr).text(status);
									$('.friendships-status-icon div', tr).attr('class',followClass);
									var buttonClass = f1 ? 'unfollow-btn' : (f3 ? 'following-requested' : 'follow-btn');
									$('.friendships-button > div', tr).hide();
									$('.friendships-button .'+buttonClass, tr).show();
								}
							);
						}
						var friendships = $('<table class="friendships-table"/>');
						$.each(otherAccounts, function(){
							if(user.screen_name == this.account_name) return true;
							var account = this;
							$('<tr/>')
								.append(
									$('<td class="friendships-img"/>').append($('<img/>').attr('src', this.profile_image_url)),
									$('<td class="friendships-account"/>').append($('<span/>').text(this.account_name)),
									$('<td class="friendships-status-icon"/>').append($('<div/>')),
									$('<td class="friendships-status"/>').append($('<span/>').text('Loading...')),
									$('<td class="friendships-button"/>').append(
										$('<div class="button follow-btn"/>').append($('<a href="#"/>').text($I.R090).click(function(){
											var path = "friendships/create.json",
												url = "twitter/api/"+account.account_name+"?path="+encodeURIComponent(path),
												data = {screen_name:user.screen_name},
												tr = $(this).parents('tr');
											$.ajax({
												type:"POST",
												url:url,
												data:data,
												success:function(){
													renderFriendships(tr);
												}
											});
										})),
										$('<div class="button unfollow-btn"/>').append($('<a href="#"/>').text($I.R091).click(function(){
											var path = "friendships/destroy.json",
												url = "twitter/api/"+account.account_name+"?path="+encodeURIComponent(path),
												data = {screen_name:user.screen_name},
												tr = $(this).parents('tr');
											$.ajax({
												type:"POST",
												url:url,
												data:data,
												success:function(){
													renderFriendships(tr);
												}
											});
										})),
										$('<div class="following-requested"/>').text($I.R100)
									)
								)
								.appendTo(friendships);
						});
						$('<div class="friendships"/>').append(friendships).hide().appendTo(profilePanel).animate({'bottom':'show'}, 'fast');
						$('tr', friendships).each(function(){
							renderFriendships($(this));
						});
					})),
					$('<div class="button dm-btn"/>').append($('<a href="#"/>').text($I.R101)),
					$('<div class="button reply-btn"/>').append($('<a href="#"/>').text($I.R102))
				);
			if(otherAccounts.length == 1 && otherAccounts[0].account_name == user.screen_name){
				$('.follow-manage', profileBtns).hide();
			}
			$('.userInfo a.open-twitter', profilePanel).attr({target:'_blank', href:'http://twitter.com/'+user.screen_name});
			$('.profile-tabbody', profileDialog).empty().append(profilePanel, profileBtns);
		}
		if(!user.friends_count){
			var path = "users/show.json?screen_name="+user.screen_name;
			var url = "twitter/api/"+columnInfo.account_name+"?path="+encodeURIComponent(path);
			$('<p class="loading"/>').text("Loading...").appendTo($('.profile-tabbody', profileDialog));
			$.getJSON(url, function(user){
				profileDialog.dialog( "option", "title", user.name);
				renderProfileInfo(user);
			});
		} else {
			renderProfileInfo(user);
		}
	},
	renderMessage: function(entry, columnInfo, refresh, data, opts){
		var baseUrl = "http://twitter.com/";
		var user = entry.user || entry.sender;
		var isDM = columnInfo.type.indexOf("direct_messages") == 0,
			isDMSent = columnInfo.type == "direct_messages/sent";
		if(isDMSent)
			user = entry.recipient || user;
		var entryUrl = baseUrl+user.screen_name+"/status/"+entry.id;
		var messageElm = $.DIV({className:"message"},
			$.A({
					href:baseUrl+user.screen_name,
					className:"profile-image open-profile",
					target:"_blank"
				},
				$.IMG(
					{src:user.profile_image_url}
				),
				user["protected"] ? $('<img/>').attr('src', STATIC_URL + 'images/protect.png').addClass('protect') : null
			),
			$.A({
					href:baseUrl+user.screen_name,
					className:"user-name open-profile",
					target:"_blank"
				},
				$.SPAN({className:'user-fullname'}, user.name || ''),
				(isDMSent? "To: " : "") + '@' + user.screen_name
			),
			createTimestampDiv(entry.display_time, entryUrl, isDM),
			$.DIV({className:"message-text"})
		).data("entry", entry).data('id', entry["id_str"]);

		var imageDiv = $('<div class="images"/>');
		messageElm.append(imageDiv);
		
		var displayText = "";
		//parse entities
		if(entry.entities){
			var sortedEntities = [];
			$.each(entry.entities, function(key, entities){
				sortedEntities = sortedEntities.concat(entities);
			});
			sortedEntities.sort(function(a, b){return a.indices[0] > b.indices[0];});
			var text = entry.text, lastIndex = 0;
			$.each(sortedEntities, function(){
				if(this.indices[0] > 0)
					displayText += text.substring(lastIndex, this.indices[0]);
				if(this.screen_name)
					displayText += '<a href="http://twitter.com/'+this.screen_name+'" target="_blank" class="open-profile" screen_name="'+this.screen_name+'">@'+this.screen_name+'</a>';
				if(this.text)
					displayText += '<a href="http://twitter.com/#!/search/%23'+encodeURIComponent(this.text)+'" target="_blank">#'+this.text+'</a>';
				if(this.url) {
					displayText += '<a href="'+this.url+'" target="_blank">'+(this.display_url || this.url)+'</a>';
					getImageThumb((this.expanded_url || this.url), function(thumbData){
						var thumb = $(thumbData.thumb).load(function(){
							createAmazonLink(thumbData.original, {
								type:'amazon',
								friend_name:user.full_name || user.screen_name,
								friend_url:baseUrl+'/'+user.screen_name,
								body:displayText,
								banner_url:this.src,
								success:function(url){
									imageLink.attr('href', url);
								}
							});
						});
						var imageLink = $('<a target="_blank"/>')
							.attr("href", thumbData.original)
							.append(thumb.error(function(){
								var img = $(this);
								if(!img.data('errorCount')){
									img.data('errorCount', 1);
									setTimeout(function(){
										img.attr('src', img.attr('src')).error(function(){
											$(this).parent().remove();
										});
									}, 1000);
								}
							}))
							.appendTo(imageDiv);
					});
				}
				lastIndex = this.indices[1];
			});
			displayText += text.substring(lastIndex);
		}
		if(entry.is_search || !entry.entities){
			if(!entry.entities || !entry.entities.urls){
				displayText = entry.text;
				displayText = displayText.replace(/(http[s]?:\/\/[\w|\/|\.|%|&|\?|=|\-|#|!|:|;|~]+)/g, '<a href="$1" target="_blank">$1</a>');
			}
			//mention
			displayText = displayText.replace(/@([\w|\/|\.|%|&|\?|=|\-|#]+)/g, '<a href="http://twitter.com/$1" target="_blank" class="open-profile" screen_name="$1">@$1</a>');
			//hashtag
			displayText = displayText.replace(/(?:#|\uFF03)([a-zA-Z0-9_\u3041-\u3094\u3099-\u309C\u30A1-\u30FA\u30FC\u3400-\uD7FF\uFF10-\uFF19\uFF20-\uFF3A\uFF41-\uFF5A\uFF66-\uFF9F]+)(?![^\<]*\")/g, '<a href="http://twitter.com/#!/search/%23$1" target="_blank">#$1</a>');
		}
		displayText = displayText.replace(/\n/g, '<br/>');
		messageElm.find('.message-text').html(displayText);
		
		$('.open-profile', messageElm)
			.click(function(event){
				var screen_name = $(this).attr('screen_name');
				var _user = user;
				if(screen_name) _user = {screen_name:screen_name};
				twitter.openProfile(_user, columnInfo, event);
			});
		
/*
		if(entry.source){
			var source = " from " + entry.source;
			$(".time", messageElm).append(source).find("a").attr("target","_blank");
		}
*/
		
		function sendDM(){
			var account_name = columnInfo.account_name;
			openColumnInput(messageElm.parents('.column'), columnInfo, "d "+user.screen_name+" ", "");
		}
		
		if(!isDM){
			if(entry.favorited){
				messageElm.addClass('favorited').data('unfavorite', function(){
					var url = "twitter/api/"+columnInfo.account_name + "?path="+encodeURIComponent("favorites/destroy.json");
					$.ajax({
						type:"POST",
						url:url,
						data: {id: entry.id},
						success: function(){
							entry.favorited = false;
							showNotice($I.R083);
							var newElm = twitter.renderMessage(entry, columnInfo);
							messageElm.replaceWith(newElm);
						},
						error: function(){
							showError($I.R084);
						}
					});
				});
			} else {
				messageElm.data("favorites", function(){
					$.ajax({
						type:"POST",
						url:"twitter/favorites/"+columnInfo.account_name+"?id="+entry.id,
						success: function(){
							entry.favorited = true;
							showNotice($I.R056);
							var newElm = twitter.renderMessage(entry, columnInfo);
							messageElm.replaceWith(newElm);
						},
						error: function(){
							showError($I.R057);
						}
					});
				});
			}
			messageElm.data("dm", sendDM)
			.data("reply", function(){
				var account_name = columnInfo.account_name;
				openColumnInput(messageElm.parents('.column'), columnInfo, "@"+user.screen_name+" ", entry.id, entry.text);
			}).data("rt", function(){
				var unescaped_text = $('<span/>').html(entry.text).text();
				var account_name = columnInfo.account_name;
				openColumnInput(messageElm.parents('.column'), columnInfo, " RT @"+user.screen_name+": "+unescaped_text, "", "", true);
			});
			if(!user["protected"]){
				messageElm.data("retweet", function(){
					var account = accountsMap[twitter.getPostUrl(columnInfo)];
					var otherAccounts = twitter.getOtherAccount();
					var accountsElm = $('<div class="retweet-accounts"/>');
					$.each(otherAccounts, function(){
						$('<label class="retweet-account"/>')
							.append(
								$('<input type="checkbox"/>').val(this.account_name).attr('checked',this.account_name == account.account_name),
								$('<img/>').attr('src', this.profile_image_url),
								$('<span class="account-name"/>').text(this.account_name)
							)
							.appendTo(accountsElm);
					});
					$('<div/>')
						.append(
							$('<div class="retweet-dialog"/>').append(
								$('<div class="label"/>').text($I.R053),
								$('<div class="tweet"/>').text(entry.text),
								accountsElm
							)
						)
						.dialog({
							title:$I.R089,
							width:300,
							buttons:[
								{
									text:$I.R026,
									click: function(){
										$(this).dialog("close");
									}
								},
								{
									text:$I.R089,
									click: function(){
										var retweetAccounts = accountsElm.find('input:checked');
										retweetAccounts.each(function(){
											var accountName = $(this).val();
											$.ajax({
												type:"POST",
												url:"twitter/retweet/"+accountName+"?id="+entry.id,
												success: function(){
													showNotice($I.R054({account:accountName}));
												},
												error: function(){
													showError($I.R055({account:accountName}));
												}
											});
										});
										if(retweetAccounts.length > 0)
											$(this).dialog("close");
									}
								}
							]
						});
				});
			}
			var match = entry.text.match(/@[a-zA-Z0-9_]+/g);
			if(match && match.length > 0){
				var account_name = columnInfo.account_name;
				if(match.length == 1 && match[0] == "@"+account_name){
				} else {
					messageElm.data("replyall", function(){
						var to = "";
						if(user.screen_name != account_name)
							to += "@"+user.screen_name+" ";
						for(var i=0;i<match.length;i++){
							if(match[i] != "@"+user.screen_name && match[i] != "@"+account_name)
								to += match[i]+" ";
						}
						openColumnInput(messageElm.parents('.column'), columnInfo, to, entry.id, entry.text);
					});
				}
			}
			if(user.screen_name == columnInfo.account_name){
				messageElm.data('delete', function(){
					if(!confirm($I.R082({tweet:entry.text}))) return false;
					var url = "twitter/api/"+columnInfo.account_name+"?path=statuses/destroy/"+entry.id+".json";
					$.ajax({
						type:"POST",
						url:url,
						data: {id: entry.id},
						success: function(){
							showNotice($I.R080);
							messageElm.remove();
						},
						error: function(){
							showError($I.R081);
						}
					});
				});
			}
		} else {
			messageElm.data("reply", sendDM);
			if((entry.user || entry.sender).screen_name == columnInfo.account_name){
				messageElm.data('delete', function(){
					if(!confirm($I.R082({tweet:entry.text}))) return false;
					var url = "twitter/api/"+columnInfo.account_name+"?path=direct_messages/destroy.json";
					$.ajax({
						type:"POST",
						url:url,
						data: {id: entry.id},
						success: function(){
							showNotice($I.R080);
							messageElm.remove();
						},
						error: function(){
							showError($I.R081);
						}
					});
				});
			}
		}
		if(entry.entities && entry.entities.media) {
			var imageGroupId = entry.id + "_" + new Date().getTime();
			if(entry.entities && entry.entities.media) {
				$.each(entry.entities.media, function(){
					$('<a target="_blank"/>')
						.attr("href", this.media_url)
						.append($("<img/>")
							.attr("src", this.media_url+":thumb")
							.error(function(){
								$(this).parent().remove();
							})
						)
						.colorbox({
							maxWidth:'100%',
							maxHeight:'100%',
							rel:imageGroupId
						})
						.appendTo(imageDiv);
				});
			}
		}
		if(entry.retweet_user){
			var rtUser = entry.retweet_user.screen_name;
			var rtUserText = null;
			if(entry.retweet_count > 1)
				rtUserText = $I.R073({account:rtUser, count:entry.retweet_count-1});
			else
				rtUserText = $I.R072({account:rtUser});
			messageElm.addClass('retweeted').append($('<a class="rt-user" href="#"/>').text(rtUserText).click(function(){
				var popup = $.DIV().append($('<p class="loading"/>').text("Loading...")).appendTo(document.body);
				popup.dialog({
					title: rtUserText,
					height: 400,
					width:400,
					dialogClass: "likes",
					open: function(event, ui){
						$.getJSON('/twitter/api/'+columnInfo.account_name, {path:'statuses/retweets/'+entry.rt_id+'.json'},function(data){
							popup.empty();
							if(!data || data.length == 0){
								popup.text($I.R085);
								return;
							}
							$.each(data, function(){
								var user = this.user;
								$('<div class="like-user"/>').append(
									$('<a/>')
										.attr({href:"http://twitter.com/"+user.screen_name, target:'_blank'})
										.text(user.screen_name + ' / ' + user.name)
										.click(function(event){twitter.openProfile(user, columnInfo, event);})
										.append($('<img/>').attr('src', user.profile_image_url))
								).appendTo(popup);
							});
						});
					},
					close: function(event, ui){
						popup.remove();
					},
					buttons: [
						{
							text:$I.R018,
							click: function(){
								$(this).dialog("close");
							}
						}
					]
				});
			}));
		}
		if((!opts || !opts.is_conversation) && (entry.in_reply_to_status_id || (entry.is_search && entry.text.indexOf('@')==0))){
			var convDiv = $('<a class="conversation" href="#"/>').text($I.R049).click(function(){
				var loading = $('<p class="loading"/>').text("Loading...");
				var popup = $('<div class="column twitter"/>').data('id', entry["id_str"])
					.append($('<div/>'), loading).appendTo(document.body);
				function loadReply(id){
					$.get("twitter/status/"+columnInfo.account_name+"/?id="+id,
						function(entry){
							var messageElm = twitter.renderMessage(entry, columnInfo, null, null, {is_conversation:true}).insertAfter(loading);
							if(entry.in_reply_to_status_id){
								loadReply(entry.in_reply_to_status_id);
							}else{
								popup.find('.message:last').data('reply')();
								closeColumnInput(focusedColumnInput);
								loading.hide();
							}
						}
					);
				}
				function startLoadReply(id){
					popup.find('.message').remove();
					loading.show();
					if(id){
						loadReply(id);
					}else{
						if(entry.in_reply_to_status_id){
							twitter.renderMessage(entry, columnInfo, null, null, {is_conversation:true}).insertAfter(loading);
							loadReply(entry.in_reply_to_status_id);
						}else{
							loadReply(entry.id);
						}
					}
				}
				popup.dialog({
					title: $I.R049,
					height: 400,
					width:400,
					dialogClass: "thread",
					open: function(){
						$('<a href="#" class="ui-dialog-titlebar-close ui-corner-all refresh"><span class="ui-icon ui-icon-refresh"/></a>')
							.hover(function(){$(this).toggleClass('ui-state-hover')})
							.click(function(){
								startLoadReply();
							}).appendTo(popup.parent().find('.ui-dialog-titlebar'));
						createColumnInput(twitter, popup, columnInfo, loading.prev());
						startLoadReply();
						renderAccountImage(twitter, popup, columnInfo);
					},
					close: function(event, ui){
						popup.remove();
					}
				}).data('reload',startLoadReply);
			}).appendTo(messageElm);
		}
		return messageElm;
	},
	getCreatedAt: function(entry){
		return Number(entry["id_str"]);//Twitterは多すぎて時間で判断すると重複してしまうのでIDで判断
	},
	getNotificationInfo: function(entry, data, columnInfo){
		var user = entry.user || entry.sender;
		var unescaped_text = $('<span/>').html(entry.text).text();
		return {
			title: (user.screen_name+(user.name ? ' ('+user.name+')' : '')) + ' in ' + columnInfo.name,
			message: unescaped_text,
			icon: user.profile_image_url
		}
	},
	getGapMessages: function(){
		var $this = $(this),
			columnContent = $this.parent(),
			column = columnContent.parents(".column"),
			conf = column.data("conf"),
			url = conf.service + "/messages/" + conf.account_name,
			lastMsg = $this.prev(),
			maxId = lastMsg.data("entry").id;
		$this.hide().next().show();
		$.getJSON(buildURL(url, {type:conf.type, "max_id":maxId}), function(data){
			var columnOffsetTopBeforeRender = columnContent.parent().offset().top - columnContent.offset().top;
			data.messages.shift();//Twitterでmax_idを指定した場合、最初のメッセージは表示済みの最後のメッセージと必ず重複するので削除
			renderMessages(twitter, data, columnContent, conf, $this);
			columnContent.parent().scrollTop(columnOffsetTopBeforeRender);
		});
	},
	moreMessages: function(){
		var $this = $(this),
			columnContent = $this.prev(".message-list"),
			column = columnContent.parents(".column"),
			conf = column.data("conf"),
			url = conf.service + "/messages/" + conf.account_name,
			lastMsg = columnContent.children(".message:last"),
			maxId = lastMsg.data("entry") ? lastMsg.data("entry").id : null;
		$this.hide().next().show();
		$.getJSON(buildURL(url, {type:conf.type, "max_id":maxId}), function(data){
			renderMessages(twitter, data, columnContent, conf);
			$this.show().next().hide();
		});
	}
}
var yammer = {
	name:'Yammer',
	messageLimit: -1,
	canUploadImage: true,
	canPostInColumn:function(){return true;},
	getColumnLink: function(conf){
		if(conf.href)
			return conf.href;
		if(conf.type.match(/^(in_group)\/([^\/]+)/)){
			return "https://www.yammer.com/"+conf.account_name+"/groups/"+RegExp.$2;
		}
		return "https://www.yammer.com/"+conf.account_name+"#/threads/index?type="+conf.type;
	},
	getIconClass: function(conf){
		return 'icon-'+conf.service;
	},
	getPostUrl: function(conf){
		var account = conf.account_name;
		if(conf.type.match(/^(in_group)\/([^\/]+)/)){
			groupid = RegExp.$2;
			return "yammer/post/"+account+"/"+groupid;
		}
		return "yammer/post/"+account;
	},
	getDefaultColumnInfo: function(accountName, displayName){
		return [
			{
				"name": "My Feed",
				"account_label": displayName,
				"account_name": accountName,
				"type": "following",
				"notification": false
			}
		];
	},
	renderAttachment: function(entry, columnInfo, messageElm){
		if(entry.attachments.length > 0){
			var imageDiv = $('<div class="images"/>'), fileDiv = $('<div class="files"/>'),
				linkDiv = $('<div class="links"/>'), moduleDiv = $('<div class="modules"/>'),
				imageGroupId = entry.id + "_" + new Date().getTime(),
				notLoggedInToYammer = false;
			$.each(entry.attachments, function(){
				var attach = this;
				if(this.image){
					var attachParams = {
						"url": this.image.url,
						//"content-type": this.content_type,
						"name": this.name
					};
					var thumbnailParams = {
						"url": this.image.thumbnail_url,
						//"content-type": this.content_type,
						"name": this.name
					};
					$('<a target="_blank"/>')
						.attr("href", this.image.url)//.attr("target", "_blank")
						.append($("<img/>").attr("alt", this.name)
							.attr("src", this.image.thumbnail_url)
							.error(function(){
								$(this).unbind('error');
								this.src = buildURL("yammer/attach/"+columnInfo.account_name, thumbnailParams);
								notLoggedInToYammer = true;
								return true;
							})
						)
						.colorbox({
							href:function(){
								if(notLoggedInToYammer)
									return buildURL("yammer/attach/"+columnInfo.account_name, attachParams);
								return attach.image.url;
							},
							maxWidth:'100%',
							maxHeight:'100%',
							rel:imageGroupId,
							onComplete:function(){
								var cbox = $("#cboxError");
								if(cbox.length > 0)
									$('<a target="_blank"/>').attr('href', this.href).text(attach.name)
										.appendTo(cbox);
							}
						})
						.appendTo(imageDiv);
				}
				if(this.file){
					$('<a target="_blank"/>').text(this.name)
						.attr("href", this.file.url)
						//.attr("href", buildURL("yammer/attach/"+columnInfo.account_name, attachParams))
						.appendTo(fileDiv);
				}
				if(this.ymodule){
					if(this.ymodule.app_id == 'blank'){
						$('<a target="_blank"/>').attr('href', this.web_url)
							.append(this.name)
							.appendTo(linkDiv);
					} else {
						$('<a target="_blank"/>').attr('href', this.web_url)
							.append($('<img class="module-icon"/>').attr('src',this.ymodule.icon_url))
							.append(this.name)
							.appendTo(moduleDiv);
					}
				}
				messageElm.append(moduleDiv).append(imageDiv).append(fileDiv).append(linkDiv);
			});
		}
	},
	renderMessageCommon: function(entry, columnInfo, parentElement){
		var messageElm = $.DIV({className:"message", id:columnInfo.key+"_"+entry.id},
			$.A({
					href:entry.sender.web_url,
					className:"profile-image",
					target:"_blank"
				},
				$.IMG(
					{src:entry.sender.mugshot_url}
				)
			),
			$.A({
					href:entry.sender.web_url,
					className:"user-name",
					target:"_blank"
				},
				entry.sender.full_name || entry.sender
			),
			$.DIV({className:"time"},
				$.A({
						href:entry.web_url,
						target:"_blank"
					},
					toLocalTime(entry.display_time)
				),
				" from ",
				$.A({
					href:entry.client_url,
					target:"_blank"
					}
					,entry.client_type
				)
			),
			$.DIV({className:"message-text"}).html(entry.display_text)
		).data("reply", function(){
			var account_name = columnInfo.account_name;
			openColumnInput(parentElement || messageElm, columnInfo, "", entry.id, entry.body.plain);
		}).data("like", function(){
			$.ajax({
				type:"POST",
				url:"yammer/like/"+columnInfo.account_name+"?id="+entry.id,
				success: function(){
					showNotice($I.R060);
					var likeCount = entry.liked_by ? entry.liked_by.count : 0;
					var likeCountElm = messageElm.find('.likes-count:first');
					if(!likeCountElm.data('liked'))
						likeCountElm.text((likeCount+1) + ' likes').data('liked', true);
				},
				error: function(){
					showError($I.R061);
				}
			});
		}).data("entry", entry);
		yammer.renderAttachment(entry, columnInfo, messageElm);
		
		$.A({className:"likes-count", href:"#"}, (entry.liked_by ? entry.liked_by.count : 0)+" likes")
			.click(function(){
				var popup = $.DIV().append($('<p class="loading"/>').text("Loading...")).appendTo(document.body);
				popup.dialog({
					title: $I.R064,
					height: 400,
					width:400,
					dialogClass: "likes yammer",
					open: function(event, ui){
						if(!entry.liked_by || entry.liked_by.count == 0){
							popup.text($I.R065);
							return;
						}
						popup.empty();
						var urlPrefix = entry.web_url.replace(/\/messages\/.*/, '');
						$.each(entry.liked_by.names ,function(){
							$('<div class="like-user"/>').append(
								$('<a/>').attr({href:urlPrefix+"/users/"+this.permalink, target:'_blank'}).text(this.full_name)
							).appendTo(popup);
						});
					},
					close: function(event, ui){
						popup.remove();
					},
					buttons: [
						{
							text:$I.R018,
							click: function(){
								$(this).dialog("close");
							}
						}
					]
				});
			})
			.appendTo(messageElm.children(".time"));
		return messageElm;
	},
	renderMessage: function(entry, columnInfo, refresh, data){
		var messageElm = yammer.renderMessageCommon(entry, columnInfo);

		if(entry.group_id){
			//TODO /accounts前でも動くようにする
			if(!yammer.groups){
				yammer.groups = {};
				$.each(accounts, function(){
					if(this.service == 'yammer' && this.type == 'group')
						yammer.groups[this.group_id] = {
							id:this.group_id,
							name:this.group_name,
							url:this.group_url
						};
				});
			}
			var group = yammer.groups[entry.group_id];
			if(group)
				$(".user-name", messageElm).after(" > ", $.A({
						className:"group-name",
						href:group.url,
						target:"_blank"
					}, group.name));
		}

		var commentElm = null, hasComment = entry.refs && entry.refs.stats && entry.refs.stats.updates > 1;
		if(hasComment){
			var commentCount = entry.refs.stats.updates-1;
			if(commentCount > 2){
				$('<a class="comment-count" href="#"/>').text('Show ' + (commentCount-2) + ' old comments').click(function(){
					var commentCountElm = $(this);
					if(commentCountElm.data('loading')) return;
					
					var commentElm = $(".comment", messageElm);
					function renderComments(messages){
						$.each(messages, function(){
							if(this.id == entry.thread_id) return;
							yammer.renderMessageCommon(this, columnInfo, messageElm).prependTo(commentElm);
						});
					}
					function renderCommentCount(){
						var leftComments = commentCount - $('.message', commentElm).length;
						if(leftComments > 0)
							commentCountElm.text('Show ' + leftComments + ' old comments').data('loading',false);
						else
							commentCountElm.remove();
					}
					commentCountElm.text('Loading...').data('loading',true);
					var lastId = $('.message', commentElm).first().data('entry').id;
					$.ajax({
						url: "yammer/thread/" + columnInfo.account_name,
						data: {id:entry.thread_id, older_than:lastId, limit:10},
						dataType: 'json',
						success: function(data){
							if(data && data.messages){
								renderComments(data.messages);
							} else {
								showError($I.R058);
							}
							renderCommentCount();
						},
						error: function(){
							showError($I.R058);
							renderCommentCount();
						}
					});
				}).appendTo(messageElm);
			}
			commentElm = $("<div class='comment'/>").appendTo(messageElm);
			var thread = data.threaded_extended && data.threaded_extended[entry.thread_id];
			if(thread){
				$.each(thread, function(idx, comment){
					yammer.renderMessageCommon(comment, columnInfo, messageElm).prependTo(commentElm);
				});
			}
		} else {
			commentElm = $("<div class='comment'/>").appendTo(messageElm);
		}
		createColumnInput(yammer, $('#'+columnInfo.key), columnInfo, commentElm,
			{hideFirst:!hasComment, replyTo:entry.id});
		
		return messageElm;
	},
	getCreatedAt: function(entry){
		try{
			return entry.refs.stats.latest_reply_at;
		}catch(e){
			return entry.created_at;
		}
	},
	onBeforeInsertMessage: function(entry, columnInfo, messageElm){
		//同じIDの要素が既にあったら消して追加（コメントがついたなど更新された場合）;
		$('#'+messageElm.attr('id')).remove();
	},
	getNotificationInfo: function(entry, data, columnInfo, lastCreatedAt){
		function createNotification(entry){
			return {
				title: (entry.sender.full_name || entry.sender) + ' in ' + columnInfo.name,
				message: entry.body.plain,
				icon: entry.sender.mugshot_url
			}
		}
		var notifications = [];
		var thread = data.threaded_extended[entry.id]
		if(thread){
			$.each(thread, function(){
				if(this.created_at > lastCreatedAt)
					notifications.unshift(createNotification(this));
			});
		}
		if(entry.created_at > lastCreatedAt)
			notifications.unshift(createNotification(entry));
		return notifications;
	},
	moreMessages: function(){
		var $this = $(this),
			columnContent = $this.prev(".message-list"),
			columnElm = columnContent.parents(".column"),
			conf = columnElm.data("conf"),
			url = conf.service + "/messages/" + conf.account_name,
			lastMsg = columnContent.children(".message:last"),
			older_than = lastMsg.data("entry").id;
		$this.hide().next().show();
		$.getJSON(buildURL(url, {type:conf.type, "older_than":older_than}), function(data){
			renderMessages(yammer, data, columnContent, conf);
			$this.show().next().hide();
		});
	}
}
var facebook = {
	name:'Facebook',
	messageLimit: -1,
	canUploadImage: true,
	canPostInColumn:function(){return true;},
	getColumnLink: function(conf){
		var type = conf.type;
		if(type == "me/home")
			return "http://www.facebook.com/home.php?sk=lf";
		if(type == "me/feed"){
			if(conf.account_name.indexOf('page_') == 0)
				return "http://www.facebook.com/profile.php?id="+conf.account_name.split('_')[1];
			return "http://www.facebook.com/profile.php?id=" + conf.account_name;
		}
		if(type.indexOf('page/')==0)
			return "http://www.facebook.com/profile.php?id="+type.split('/')[1];
		if(type.indexOf('app/')==0)
			return "http://apps.facebook.com/"+type.split('/')[1];
		if(type.indexOf('list/')==0)
			return "http://www.facebook.com/?sk=fl_"+type.split('/')[1];
		if(type.indexOf('group/')==0)
			return "http://www.facebook.com/groups/"+type.split('/')[1];
		if(type.indexOf('search/') == 0)
			return "http://www.facebook.com/search.php?type=eposts&q=" + encodeURIComponent(type.split('/')[1]);
		return false;
	},
	getIconClass: function(conf){
		var type = conf.type;
		if(type){
			if(type.indexOf("page/") == 0){
				return "icon-facebook-page";
			} else if(type.indexOf("group/") == 0){
				return "icon-facebook-group";
			} else if(type.indexOf("search/") == 0){
				return "icon-facebook-search";
			} else if(conf.account_name.indexOf("page_") == 0){
				return "icon-facebook-page";
			}
		} else if(conf.postUrl){
			var account = accountsMap[conf.postUrl];
			if(account.type){
				if(account.type == "group")
					return "icon-facebook-group";
				else if(account.type == "page")
					return "icon-facebook-page";
			}
		}
		return 'icon-'+conf.service;
	},
	getPostUrl: function(conf){
		var account = conf.account_name;
		if(conf.currentAccount){
			account = conf.currentAccount.account_name;
		}
		if(conf.account_name.indexOf('page_') == 0 && conf.type=='me/feed')
			return "facebook/post/"+account+"/"+conf.account_name.split('_')[1];
		if(conf.type.match(/^(page|group)\/([^\/]+)/)){
			page = RegExp.$2;
			return "facebook/post/"+account+"/"+page;
		}
		return "facebook/post/"+account;
	},
	getGroupImageUrl: function(conf){
		if(conf.type.match(/^page\/([^\/]+)$/)){
			return "https://graph.facebook.com/"+RegExp.$1+"/picture"
		}
	},
	getOtherAccount: function(conf){
		if(conf.type.indexOf('group/') == 0)
			return [];
		var _accounts = [];
		$.each(accounts, function(){
			if(this.url.match('^facebook/post/[^\/]+$') && facebook.getPostUrl(conf) != this.url){
				_accounts.push(this);
			}
		});
		return _accounts;
	},
	getDefaultColumnInfo: function(accountName, displayName){
		return [
			{
				"name": "News Feed",
				"account_label": displayName,
				"account_name": accountName,
				"type": "me/home",
				"notification": false
			}
		];
	},
	renderLikeCount: function(entry, columnInfo, messageElm){
		var likesCountElm = $.A({href:"#", className:"likes-count"}, (entry.likes ? (entry.likes.count || entry.likes) : 0)+" likes")
			.click(function(){
				var popup = $.DIV().append($('<p class="loading"/>').text("Loading...")).appendTo(document.body);
				popup.dialog({
					title: $I.R064,
					height: 400,
					width:400,
					dialogClass: "likes",
					open: function(event, ui){
						$.get('/facebook/api/'+columnInfo.account_name, {path:'/'+entry.id+'/likes'},function(data){
							popup.empty();
							if(!data.data || data.data.length == 0){
								popup.text($I.R065);
								return;
							}
							$.each(data.data, function(){
								$('<div class="like-user"/>').append(
									$('<a/>').attr({href:"http://www.facebook.com/profile.php?id="+this.id, target:'_blank'}).text(this.name).append($('<img/>').attr('src', "https://graph.facebook.com/"+this.id+"/picture"))
								).appendTo(popup);
							});
						});
					},
					close: function(event, ui){
						popup.remove();
					},
					buttons: [
						{
							text:$I.R018,
							click: function(){
								$(this).dialog("close");
							}
						}
					]
				});
			})
			.appendTo(messageElm.children(".time"));
	},
	renderComment: function(entry, columnInfo){
		var commentElm = $.DIV({className:"message"},
			$.A({
					href:"http://www.facebook.com/profile.php?id="+entry.from.id,
					className:"profile-image",
					target:"_blank"
				},
				$.IMG(
					{src:"https://graph.facebook.com/"+entry.from.id+"/picture"}
				)
			),
			$.A({
					href:"http://www.facebook.com/profile.php?id="+entry.from.id,
					className:"user-name",
					target:"_blank"
				},
				entry.from.name || entry.from.id
			),
			$.DIV({className:"time"},
				$.A({
						target:"_blank"
					},
					toLocalTime(entry.display_time)
				)
			),
			$.DIV({className:"message-text"}).html(entry.display_text)
		).data("like", function(){
			$.ajax({
				type:"POST",
				url:"facebook/like/"+columnInfo.account_name+"?id="+entry.id,
				success: function(){
					showNotice($I.R060);
					var likeCount = (entry.likes ? (entry.likes.count || entry.likes) : 0);
					var likeCountElm = commentElm.find('.likes-count:first');
					if(!likeCountElm.data('liked'))
						likeCountElm.text((likeCount+1) + ' likes').data('liked', true);
				},
				error: function(){
					showError($I.R061);
				}
			});
		});
		facebook.renderLikeCount(entry, columnInfo, commentElm);
		
		$('.message-text a', commentElm).each(function(){
			var $this = $(this);
			createAmazonLink($this.attr('href'), {
				type:'amazon',
				friend_name:entry.from.name || entry.from.id,
				friend_url:"http://www.facebook.com/profile.php?id="+entry.from.id,
				body:entry.display_text,
				success:function(url){
					$this.attr('href', url);
				}
			});
		});
		
		return commentElm;
	},
	renderMessage: function(entry, columnInfo, refresh){
		var entryLink;
		if(columnInfo.type.indexOf('group/') == 0){
			var ids = entry.id.split('_');
			entryLink = "http://www.facebook.com/groups/"+ids[0]+"/?view=permalink&id="+ids[1];
		}else{
			entryLink = entry.actions && entry.actions.length > 0 && entry.actions[0].link;
			if(!entryLink){
				var ids = entry.id.split('_');
				entryLink = "http://www.facebook.com/"+ids[0]+"/posts/"+ids[1];
			}
		}
		var messageElm = $.DIV({className:"message", id:columnInfo.key+"_"+entry.id},
			$.A({
					href:"http://www.facebook.com/profile.php?id="+entry.from.id,
					className:"profile-image",
					target:"_blank"
				},
				$.IMG(
					{src:"https://graph.facebook.com/"+entry.from.id+"/picture"}
				)
			),
			$.A({
					href:"http://www.facebook.com/profile.php?id="+entry.from.id,
					className:"user-name",
					target:"_blank"
				},
				entry.from.name || entry.from.id
			),
			$.DIV({className:"time"},
				$.A({
						href: entryLink,
						target:"_blank"
					},
					toLocalTime(entry.display_time)
				)
			),
			$.DIV({className:"message-text"}).html(entry.display_text)
		).data("comment", function(){
			openColumnInput(messageElm, columnInfo, "", entry.id);
		}).data("like", function(){
			$.ajax({
				type:"POST",
				url:"facebook/like/"+columnInfo.account_name+"?id="+entry.id,
				success: function(){
					showNotice($I.R060);
					var likeCount = (entry.likes ? (entry.likes.count || entry.likes) : 0);
					var likeCountElm = messageElm.find('.likes-count:first');
					if(!likeCountElm.data('liked'))
						likeCountElm.text((likeCount+1) + ' likes').data('liked', true);
				},
				error: function(){
					showError($I.R061);
				}
			});
		}).data("entry", entry);

		if((columnInfo.type =='me/feed' || columnInfo.type == 'me/home')
			&& entry.to && entry.to.data && entry.to.data.length > 0){
			var to = entry.to.data[0];
			if(to){
				var url = "#";
				if(to.version)
					url = 'http://www.facebook.com/groups/'+to.id;
				else
					url = 'http://www.facebook.com/profile.php?id='+to.id;
				$(".user-name", messageElm).after($.A({
						href:url,
						target:"_blank",
						className:'user-fullname'
					},
					' > '+to.name
				));
			}
		}
		
		if(entry.icon)
			$(".time", messageElm).prepend($.IMG({src:entry.icon}))
		if(entry.type != "status"){
			var entryLink = $.A({href:entry.link, target:"_blank"}, entry.name);
			var attach = $.DIV({className:"attachment"},
					$.DIV({}, entryLink),
					$.DIV({}, entry.caption),
					$.DIV({}, entry.description)
				).appendTo(messageElm);
			
			if(entry.picture){
				var attachLink = $.A({
						href:entry.source || entry.link,
						target:"_blank",
						className:"image-link"
					}, $.IMG({src:entry.picture}));
				attach.prepend(attachLink);
				
				createAmazonLink(entry.source || entry.link, {
					type:'amazon',
					friend_name:entry.from.name || entry.from.id,
					friend_url:"http://www.facebook.com/profile.php?id="+entry.from.id,
					body:entry.display_text,
					success:function(url){
						attachLink.attr('href', url);
					}
				});
			}
			
			createAmazonLink(entry.link, {
				type:'amazon',
				friend_name:entry.from.name || entry.from.id,
				friend_url:"http://www.facebook.com/profile.php?id="+entry.from.id,
				body:entry.display_text,
				success:function(url){
					entryLink.attr('href', url);
				}
			});
		}

		var commentElm = null;
		if(entry.comments && entry.comments.count > 0){
			var comments = entry.comments.data, shownCommentsLength = comments ? comments.length:0;
			var commentCount = entry.comments.count;
			var hiddenCommentsLength = commentCount-Math.min(2, shownCommentsLength);
			if(hiddenCommentsLength > 0){
				$('<a class="comment-count" href="#"/>').text('Show ' + hiddenCommentsLength + ' old comments').click(function(){
					var commentCountElm = $(this);
					if(commentCountElm.data('loading')) return;
					
					var comments = messageElm.data('comments');
					var commentElm = $(".comment", messageElm);
					function renderComments(){
						var start = $('.message', commentElm).length;
						var comments = messageElm.data('comments');
						for(var i=comments.length-1-start;i>=0 && i>comments.length-11-start;i--){
							facebook.renderComment(comments[i], columnInfo).prependTo(commentElm);
						}
					}
					function renderCommentCount(){
						var leftComments = commentCount - $('.message', commentElm).length;
						if(leftComments)
							commentCountElm.text('Show ' + leftComments + ' old comments').data('loading',false);
						else
							commentCountElm.remove();
					}
					if(!comments || comments.length < commentCount){
						commentCountElm.text('Loading...').data('loading',true);
						$.ajax({
							url: "facebook/thread/" + columnInfo.account_name,
							data: {id:entry.id},
							dataType: 'json',
							success: function(data){
								if(data && data.comments && data.comments.data){
									messageElm.data('comments', data.comments.data);
									renderComments();
								} else {
									showError($I.R058);
								}
								renderCommentCount();
							},
							error: function(){
								showError($I.R058);
								renderCommentCount();
							}
						});
					} else {
						renderComments();
						renderCommentCount();
					}
				}).appendTo(messageElm);
			}
			commentElm = $("<div class='comment'/>").appendTo(messageElm);
			if(shownCommentsLength > 0){
				for(var i=comments.length-1;i>=0&&i>comments.length-3;i--){
					facebook.renderComment(comments[i], columnInfo).prependTo(commentElm);
				}
			}
			messageElm.data('comments', comments);
		} else {
			commentElm = $("<div class='comment'/>").appendTo(messageElm);
		}
		createColumnInput(facebook, $('#'+columnInfo.key), columnInfo, commentElm,
			{noAttach:true, hideFirst:!entry.comments || entry.comments.count == 0, replyTo:entry.id});
		
		facebook.renderLikeCount(entry, columnInfo, messageElm);
		
		$('.message-text a', messageElm).each(function(){
			var $this = $(this);
			createAmazonLink($this.attr('href'), {
				type:'amazon',
				friend_name:entry.from.name || entry.from.id,
				friend_url:"http://www.facebook.com/profile.php?id="+entry.from.id,
				body:entry.display_text,
				success:function(url){
					$this.attr('href', url);
				}
			});
		});
		
		return messageElm;
	},
	checkAllMessages: true, //コメントがついた投稿は更新日が新しくなるが順番は作成日順のため全投稿をチェックする
	onBeforeInsertMessage: function(entry, columnInfo, messageElm){
		//同じIDの要素が既にあったら消して追加（コメントがついたなど更新された場合）
		$('#'+messageElm.attr('id')).remove();
	},
	getNotificationInfo: function(entry, data, columnInfo, lastCreatedAt){
		function createNotification(entry){
			return {
				title: (entry.from.name || entry.from.id) + ' in ' + columnInfo.name,
				message: entry.message,
				icon: "https://graph.facebook.com/"+entry.from.id+"/picture"
			}
		}
		var notifications = [];
		if(entry.comments && entry.comments.data) {
			$.each(entry.comments.data, function(){
				if(Date.parse(this.display_time) > lastCreatedAt)
					notifications.push(createNotification(this));
			});
		}
		if(Date.parse(entry.display_time) > lastCreatedAt)
			notifications.unshift(createNotification(entry));
		return notifications;
	},
	getCreatedAt: function(entry){
		if(entry.comments && entry.comments.data){
			var comments = entry.comments.data;
			return Date.parse(comments[comments.length-1].display_time);
		}
		return Date.parse(entry.display_time);
	},
	moreMessages: function(){
		var $this = $(this),
			columnContent = $this.prev(".message-list"),
			columnElm = columnContent.parents(".column");
			conf = columnElm.data("conf"),
			url = conf.service + "/messages/" + conf.account_name,
			lastMsg = columnContent.children(".message:last"),
			until = lastMsg.data("entry")["updated_time"];
		$this.hide().next().show();
		$.getJSON(buildURL(url, {type:conf.type, until:until}), function(data){
			renderMessages(facebook, data, columnContent, conf);
			$this.show().next().hide();
		});
	}
};
var linkedin = {
	name:'LinkedIn',
	messageLimit: 700,
	canPostInColumn:function(){return true;},
	getColumnLink: function(conf){
		if(conf.href)
			return conf.href;
		if(conf.type == 'my') return 'http://www.linkedin.com/updates?view=my';
		return "https://www.linkedin.com/";
	},
	getIconClass: function(conf){
		return 'icon-'+conf.service;
	},
	getPostUrl: function(conf){
		return "linkedin/post/"+conf.account_name;
	},
	getDefaultColumnInfo: function(accountName, displayName){
		return [
			{
				"name": "All Updates",
				"account_label": displayName,
				"account_name": accountName,
				"type": "updates",
				"notification": false
			}
		];
	},
	renderComment: function(entry, columnInfo){
		var person = entry.person;
		var commentElm = $.DIV({className:"message"},
			$.A({
					href:person.siteStandardProfileRequest.url,
					className:"profile-image",
					target:"_blank"
				},
				$.IMG(
					{src:person.pictureUrl || 'http://static01.linkedin.com/scds/common/u/img/icon/icon_no_photo_no_border_60x60.png'}
				)
			),
			$.A({
					href:person.siteStandardProfileRequest.url,
					className:"user-name",
					target:"_blank"
				},
				person.firstName + " " + person.lastName
			),
			$.DIV({className:"time"},
				$.A({},
					formatDate(new Date(entry.timestamp))
				)
			),
			$.DIV({className:"message-text"}).html(entry.display_text || entry.updateType)
		).data('id', entry.id);
		return commentElm;
	},
	renderMessage: function(entry, columnInfo, refresh){
		//TODO STAT以外の処理 http://developer.linkedin.com/docs/DOC-1131
		if(entry.updateType != 'SHAR' || !entry.display_text) return false;
		var person = entry.updateContent.person;
		var updateKeys = entry.updateKey.split('-');
		var messageElm = $.DIV({className:"message", id:entry.updateKey},
			$.A({
					href:person.siteStandardProfileRequest.url,
					className:"profile-image",
					target:"_blank"
				},
				$.IMG(
					{src:person.pictureUrl || 'http://static01.linkedin.com/scds/common/u/img/icon/icon_no_photo_no_border_60x60.png'}
				)
			),
			$.A({
					href:person.siteStandardProfileRequest.url,
					className:"user-name",
					target:"_blank"
				},
				person.firstName + " " + person.lastName
			),
			$.DIV({className:"time"},
				$.A({},
					formatDate(new Date(entry.timestamp))
				)
			),
			$.DIV({className:"message-text"}).html(entry.display_text || entry.updateType)
		).data("entry", entry);
		
		if(entry.isCommentable){
			messageElm.data("reply", function(){
				var account_name = columnInfo.account_name;
				//TODO group対応
				openColumnInput(messageElm, columnInfo, "", entry.updateKey);
			})
		}
		if(entry.isLikable){
			messageElm.data("like", function(){
				$.ajax({
					type:"POST",
					url:"linkedin/like/"+columnInfo.account_name+"?id="+entry.updateKey,
					success: function(){
						showNotice($I.R060);
						var likeCount = entry.likes ? entry.likes._total : 0;
						var likeCountElm = messageElm.find('.likes-count:first');
						if(!likeCountElm.data('liked'))
							likeCountElm.text((likeCount+1) + ' likes').data('liked', true);
					},
					error: function(){
						showError($I.R061);
					}
				});
			});
		}
		
		var offset = 10;
		function loadComments(commentCount){
			var olderCommentElm = $('.older-comment', messageElm);
			if(olderCommentElm.data('loading')) return;
			
			var comments = messageElm.data('comments');
			var commentsElm = $(".comment", messageElm);
			function renderCommentCount(commentCount){
				var leftComments = commentCount - $('.message', commentsElm).length;
				if(leftComments)
					olderCommentElm.text('Show ' + leftComments + ' old comments').data('loading',false);
				else
					olderCommentElm.remove();
			}
			olderCommentElm.text('Loading...').data('loading',true);
			var shownCommentCount = $('.message', commentsElm).length, start = 0;
			if(commentCount)
				start = commentCount-shownCommentCount-offset;
			$.ajax({
				url: "linkedin/comments/" + columnInfo.account_name,
				data: {id:entry.updateKey, start:start > 0 ? start : 0, count:offset},
				dataType: 'json',
				success: function(data){
					try{
					if(data && data.messages){
						var firstCommentElm = commentsElm.children('.message:first'),
							hasComment = firstCommentElm.length > 0;
						$.each(data.messages, function(){
							if(hasComment && this.id == firstCommentElm.data("id")) return false;
							var newCommentElm = linkedin.renderComment(this, columnInfo);
							if(hasComment)
								newCommentElm.insertBefore(firstCommentElm);
							else
								newCommentElm.appendTo(commentsElm);
						});
					} else {
						showError($I.R058);
					}
					renderCommentCount(data._total);
					}catch(e){console.error(e);}
				},
				error: function(){
					showError($I.R058);
					renderCommentCount();
				}
			});
		}
		var commentElm = $("<div class='comment'/>"), hasComment = entry.updateComments && entry.updateComments._total > 0;
		if(hasComment){
			var commentCount = entry.updateComments._total;
			if(commentCount > offset){
				$('<a class="older-comment" href="#"/>').text('Show ' + (commentCount-offset) + ' old comments').click(function(){
					loadComments(commentCount);
				}).appendTo(messageElm);
				$.A({href:"#", className:"refresh-comment"}, "Refresh").click(function(){
					$(".comment", messageElm).empty();
					loadComments();
				}).appendTo(messageElm);
			}
			commentElm.appendTo(messageElm);
			$.each(entry.updateComments.values, function(idx, comment){
				linkedin.renderComment(comment, columnInfo).appendTo(commentElm);
			});
		} else {
			commentElm.appendTo(messageElm);
		}
		createColumnInput(linkedin, $('#'+columnInfo.key), columnInfo, commentElm,
				{noAttach:true, hideFirst:!hasComment, replyTo:entry.updateKey});
		
		$.A({className:"likes-count"}, (entry.likes ? entry.likes._total : 0)+" likes")
			.appendTo(messageElm.children(".time"));
		
		return messageElm;
	},
	getNotificationInfo: function(entry, data, columnInfo){
		var person = entry.updateContent.person;
		return {
			title: (person.firstName + " " + person.lastName) + ' in ' + columnInfo.name,
			message: person.currentStatus,
			icon: person.pictureUrl
		}
	},
	getCreatedAt: function(entry){
		if(entry.updateComments && entry.updateComments.values){
			var comments = entry.updateComments.values;
			return comments[comments.length-1].timestamp;
		}
		return entry.timestamp;
	},
	checkAllMessages: true, //コメントがついた投稿は更新日が新しくなるが順番は作成日順のため全投稿をチェックする
	onBeforeInsertMessage: function(entry, columnInfo, messageElm){
		//同じIDの要素が既にあったら消して追加（コメントがついたなど更新された場合）
		$('#'+messageElm.attr('id')).remove();
	},
	moreMessages: function(){
		var $this = $(this),
			columnContent = $this.prev(".message-list"),
			columnElm = columnContent.parents(".column"),
			conf = columnElm.data("conf"),
			url = conf.service + "/messages/" + conf.account_name,
			lastMsg = columnContent.children(".message:last"),
			older_than = lastMsg.length > 0 ? lastMsg.data("entry").timestamp : "";
		$this.hide().next().show();
		$.getJSON(buildURL(url, {type:conf.type, "before":older_than}), function(data){
			renderMessages(linkedin, data, columnContent, conf);
			$this.show().next().hide();
		});
	}
};

var chatter = {
	name:'Chatter',
	messageLimit: -1,
	canPostInColumn:function(){return true;},
	getColumnLink: function(conf){
		return "https://na1.salesforce.com/_ui/core/chatter/ui/ChatterPage";
	},
	getIconClass: function(conf){
		return 'icon-'+conf.service;
	},
	getPostUrl: function(conf){
		return "chatter/post/"+conf.account_name;
	},
	getDefaultColumnInfo: function(accountName, displayName){
		return [
			{
				"name": "News Feed",
				"account_label": displayName,
				"account_name": accountName,
				"type": "news",
				"notification": false
			}
		];
	},
	renderComment: function(entry, columnInfo){
		var postUrl = chatter.getPostUrl(columnInfo);
		var entryLink = 'https://na1.salesforce.com/_ui/core/userprofile/UserProfilePage?ChatterFeedItemId='+entry.Id;
		var token = accountsMap ? accountsMap[postUrl].token : "";
		var photoUrl = "";
		try{
			photoUrl = entry.InsertedBy.Profile.CreatedBy.SmallPhotoUrl;
		}catch(e){}
		var commentElm = $.DIV({className:"message"},
			$.A({
					href:"https://na1.salesforce.com/"+entry.CreatedBy.Id,
					className:"profile-image",
					target:"_blank"
				},
				$.IMG(
					{src:photoUrl + "?oauth_token=" + encodeURIComponent(token)}
				)
			),
			$.A({
					href:"https://na1.salesforce.com/"+entry.CreatedBy.Id,
					className:"user-name",
					target:"_blank"
				},
				entry.CreatedBy.Name
			),
			$.DIV({className:"time"},
				$.A({
						href: entryLink,
						target:"_blank"
					},
					toLocalTime(entry.display_time)
				)
			),
			$.DIV({className:"message-text"}).html(entry.display_text)
		);
		return commentElm;
	},
	renderMessage: function(entry, columnInfo, refresh){
		var postUrl = chatter.getPostUrl(columnInfo);
		var entryLink = 'https://na1.salesforce.com/_ui/core/userprofile/UserProfilePage?ChatterFeedItemId='+entry.Id;
		var token = accountsMap ? accountsMap[postUrl].token : "";
		var photoUrl = "";
		try{
			photoUrl = entry.InsertedBy.Profile.CreatedBy.SmallPhotoUrl;
		}catch(e){}
		var messageElm = $.DIV({className:"message", id:columnInfo.key+"_"+entry.Id},
			$.A({
					href:"https://na1.salesforce.com/"+entry.CreatedBy.Id,
					className:"profile-image",
					target:"_blank"
				},
				$.IMG(
					{src:photoUrl + "?oauth_token=" + encodeURIComponent(token)}
				)
			),
			$.A({
					href:"https://na1.salesforce.com/"+entry.CreatedBy.Id,
					className:"user-name",
					target:"_blank"
				},
				entry.CreatedBy.Name
			),
			$.DIV({className:"time"},
				$.A({
						href: entryLink,
						target:"_blank"
					},
					toLocalTime(entry.display_time)
				)
			),
			$.DIV({className:"message-text"}).html(entry.display_text)
		).data("reply", function(){
			openColumnInput(messageElm, columnInfo, "", entry.Id, entry.Body);
		}).data("entry", entry);
		if(entry){
			messageElm.data("like", function(){
				$.ajax({
					type:"POST",
					url:"chatter/like/"+columnInfo.account_name+"?id="+entry.Id,
					success: function(){
						showNotice($I.R060);
					},
					error: function(){
						showError($I.R061);
					}
				});
			});
		}
		if(entry.ContentFileName || entry.LinkUrl){
			var fileDiv = $('<div class="files"/>'), linkDiv = $('<div class="links"/>');
			if(entry.Type == "ContentPost"){
				fileDiv.append(
					$('<a target="_blank"/>').text(entry.ContentFileName)
						.attr("href", "https://na1.salesforce.com/"+entry.RelatedRecordId),
					$('<div class="description"/>').text(entry.ContentDescription)
				);
			}else if(entry.Type == "LinkPost"){
				$('<a target="_blank"/>').attr('href', entry.LinkUrl)
					.append(entry.Title || entry.LinkUrl)
					.appendTo(linkDiv);
			}
			messageElm.append(fileDiv).append(linkDiv);
		}
		
		var commentElm = $("<div class='comment'/>"), hasComment = entry.FeedComments && entry.FeedComments.totalSize > 0;
		if(hasComment){
			var commentCount = entry.CommentCount;
			if(commentCount > 2){
				$('<a class="comment-count" href="#"/>').text('Show ' + (commentCount-2) + ' old comments').click(function(){
					var commentCountElm = $(this);
					if(commentCountElm.data('loading')) return;
					
					var comments = messageElm.data('comments');
					var commentElm = $(".comment", messageElm);
					function renderComments(){
						var start = $('.message', commentElm).length;
						var comments = messageElm.data('comments');
						for(var i=start;i<start+10 && i<comments.length;i++){
							chatter.renderComment(comments[i], columnInfo).prependTo(commentElm);
						}
					}
					function renderCommentCount(){
						var leftComments = commentCount - $('.message', commentElm).length;
						if(leftComments)
							commentCountElm.text('Show ' + leftComments + ' old comments').data('loading',false);
						else
							commentCountElm.remove();
					}
					if(!comments){
						commentCountElm.text('Loading...').data('loading',true);
						$.ajax({
							url: "chatter/comments/" + columnInfo.account_name,
							data: {id:entry.Id},
							dataType: 'json',
							success: function(data){
								if(data){
									messageElm.data('comments', data);
									renderComments();
								} else {
									showError($I.R058);
								}
								renderCommentCount();
							},
							error: function(){
								showError($I.R058);
								renderCommentCount();
							}
						});
					} else {
						renderComments();
						renderCommentCount();
					}
				}).appendTo(messageElm);
			}
			commentElm.appendTo(messageElm);
			$.each(entry.FeedComments.records, function(idx, comment){
				if(idx > 1) return false;
				chatter.renderComment(comment, columnInfo).prependTo(commentElm);
			});
		} else {
			commentElm.appendTo(messageElm);
		}
		createColumnInput(chatter, $('#'+columnInfo.key), columnInfo, commentElm,
				{noAttach:true, hideFirst:!hasComment, replyTo:entry.Id});
		
		$.A({href:entryLink, className:"likes-count", target:"_blank"}, (entry.FeedLikes ? entry.FeedLikes.totalSize : 0)+" likes")
			.appendTo(messageElm.children(".time"));
		
		return messageElm;
	},
	checkAllMessages: true, //コメントがついた投稿は更新日が新しくなるが順番は作成日順のため全投稿をチェックする
	onBeforeInsertMessage: function(entry, columnInfo, messageElm){
		//同じIDの要素が既にあったら消して追加（コメントがついたなど更新された場合）
		$('#'+messageElm.attr('id')).remove();
	},
	getNotificationInfo: function(entry, data, columnInfo){
		return {
			title: entry.user.name + ' in ' + columnInfo.name,
			message: entry.body.text,
			icon: entry.user.photo.smallPhotoUrl
		};
	},
	moreMessages: function(){
		var $this = $(this),
			columnContent = $this.prev(".message-list"),
			columnElm = columnContent.parents(".column");
			conf = columnElm.data("conf"),
			url = conf.service + "/messages/" + conf.account_name,
			lastMsg = columnContent.children(".message:last"),
			until = lastMsg.data("entry")["LastModifiedDate"];
		$this.hide().next().show();
		$.getJSON(buildURL(url, {type:conf.type, until:until}), function(data){
			renderMessages(chatter, data, columnContent, conf);
			$this.show().next().hide();
		});
	}
};
var cybozulive = {
	name: $I.R077,
	messageLimit: -1,
	getDefaultColumnInfo: function(accountName, displayName){
		return [
			{
				"name": $I.R059,
				"account_label": accountName,
				"account_name": accountName,
				"type": "",
				"notification": false
			}
		];
	},
	getIconClass: function(conf){
		return 'icon-'+conf.service;
	},
	renderMessage: function(entry, columnInfo, refresh){
		var messageElm = $.DIV({className:"message"},
			$.A({
					href:entry.link,
					className:"user-name",
					target:"_blank"
				},
				entry.title
			),
			$.DIV({className:"time"},
				$.A({
						href:entry.link,
						target:"_blank"
					},
					toLocalTime(entry.updated)
				),
				$.DIV({className:"author"}, entry.author)
			),
			$.DIV({className:"message-text short"}).append(entry.summary)
		).data("entry", entry);
		var ids = entry.id.split(",");
		if(ids.length > 3 && ids[0] == "GROUP" && ids[2] == "BOARD"){
			messageElm.data("reply", function(){
				var account_name = columnInfo.account_name;
				showPostMessageDialog("", "cybozulive/post/"+account_name+"/"+ids[1], entry.id, entry.summary);
			});
		}
		if(accounts && ids.length > 1 && ids[0] == "GROUP"){
			var groupName = cybozulive.getGroupName(ids[1]);
			if(groupName){
				$(".user-name", messageElm).after($.A({
						href:"https://cybozulive.com/"+ids[1].replace(":","_")+"/top/top",
						target:"_blank"
					},
					groupName
				)).after(" in ");
			}
		}
		return messageElm;
	},
	getGroupName: function(groupId){
		if(!cybozulive.groups){
			var groups = {};
			$.each(accounts, function(){
				var postUrl = this.url.split("/");
				groups[postUrl[postUrl.length -1]] = this.name.split("/")[0];
			});
			cybozulive.groups = groups;
		}
		return cybozulive.groups[groupId];
	},
	getCreatedAt: function(entry){
		return Date.parse(entry["updated"]);
	},
	getNotificationInfo: function(entry, data, columnInfo){
		return {
			title: entry.author + ' in ' + columnInfo.name,
			message: entry.summary,
			icon: STATIC_URL + 'images/cybozulive.png'
		};
	},
	onAfterRenderMessages: function(data, columnContent, columnInfo){
		$.each($('.message:not(:has(.more)) .message-text', columnContent), function(){
			var textElm = $(this);
			if(textElm.height() == 30){
				$.A({className:"more",href:"#"}, $I.R050).click(function(){
					var moreText = $(this).prev();
					if(moreText.hasClass("short")){
						$(this).text($I.R051);
						moreText.removeClass("short");
					}else{
						$(this).text($I.R050);
						moreText.addClass("short");
					}
				}).insertAfter(textElm);
			}
		});
	}
}
var googleplus = {
	getIconClass: function(conf){
		return 'icon-'+conf.service;
	},
	renderMessage: function(entry, columnInfo, refresh){
		var messageElm = $.DIV({className:"message"},
			$.A({
					href:entry.actor.url,
					className:"profile-image",
					target:"_blank"
				},
				$.IMG(
					{src:entry.actor.image.url}
				)
			),
			$.A({
					href:entry.actor.url,
					className:"user-name",
					target:"_blank"
				},
				entry.actor.displayName
			),
			$.DIV({className:"time"},
				$.A({
						href: entry.url,
						target:"_blank"
					},
					toLocalTime(Date.parse(entry.updated))
				)
			),
			$.DIV({className:"message-text"}).html(entry.object.content)
		).data("entry", entry);
		return messageElm;
	},
	getCreatedAt: function(entry){
		return Date.parse(entry["updated"]);
	},
	getNotificationInfo: function(entry, data, columnInfo){
		return {
			title: columnInfo.name,
			message: entry.object.content,
			icon: STATIC_URL + 'images/googleplus.png'
		};
	}
}
var rss = {
	getIconClass: function(conf){
		return 'icon-'+conf.service;
	},
	renderMessage: function(entry, columnInfo, refresh){
		var messageElm = $.DIV({className:"message"},
			$.A({
					href:entry.link,
					className:"user-name",
					target:"_blank"
				},
				entry.title
			),
			$.DIV({className:"time"},
				$.A({
						href:entry.link,
						target:"_blank"
					},
					toLocalTime(entry.updated)
				)
			)
		).data("entry", entry);
		return messageElm;
	},
	getCreatedAt: function(entry){
		return Date.parse(entry["updated"]);
	},
	getNotificationInfo: function(entry, data, columnInfo){
		return {
			title: columnInfo.name,
			message: entry.title,
			icon: STATIC_URL + 'images/rss.png'
		};
	},
	onAfterRenderMessages: function(data, columnContent, columnInfo){
		//タイトルを更新
		if(columnInfo.name != data.title){
			$.post('column/rename', {id:columnInfo.key, name:data.title}, function(){
				columnInfo.name = data.title;
			});
			$("#"+columnInfo.key+" .column-name").text(data.title);
		}
	}
}
