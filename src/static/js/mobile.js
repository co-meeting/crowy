if(location.hash == '#messages'){
	location.href = '/';
}

$('#timelines').live('pagebeforecreate',function(event){
	var content = $("#timelines").find('[data-role="content"]');
	$.each(tabConfs, function(){
		var ul = $("<ul data-role='listview' data-inset='true' data-theme='c' data-dividertheme='b'/>");
		$("<li data-role='list-divider'/>").text(this.name).appendTo(ul);
		$.each(this.columns, function(){
			$("<li/>")
				.append($("<img class='ui-li-icon'/>").attr("src", "static/images/"+this.service+".png"))
				.append($("<a/>").text(this.name).data('column', this))
				.appendTo(ul);
		});
		content.append(ul);
	});
});

var currentTL;
$('#timelines ul li a').livequery('click', function(event){
	currentTL = $(event.target).data('column'),
	reloadMessages();
});

function reloadMessages(){
	var conf = currentTL;
		url = conf.service + "/messages/" + conf.account_name;
	var service = window[conf.service];
	var content = $("#messages").find('[data-role="content"]').empty();
	$("#messages h1").text(conf.name);
	$.mobile.changePage('#messages');
	$.mobile.pageLoading();
	$.ajax({
		url: url,
		data: {type:conf.type},
		success: function(data){
			service.renderMessages(data, content, conf, false);
		},
		error: function(){
		},
		complete: function(){
			$.mobile.pageLoading(true);
		}
	});
}

//以下、main.jsからコピー

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

function buildURL(url, params){
	url += "?";
	var index = 0;
	$.each(params, function(key, value){
		if(index++ > 0) url += "&";
		url += encodeURIComponent(key) + "=" + encodeURIComponent(value);
	});
	return url;
}

var youroom = {
	messageLimit: 140,
	canPostInColumn: function(column, conf){
		return conf.type != "";
	},
	getPostUrl: function(conf){
		var types = conf.type.split("/"),
			room_id = types[types.length-1];
		return "youroom/post/"+conf.account_name+"/"+room_id;
	},
	getColumnLink: function(conf){
		var type = conf.type;
		if(type == ""){
			return "https://www.youroom.in/";
		}
		return "https://www.youroom.in/r/"+type;
	},
	getProfileLogo: function(type){
		var types = type.split("/"),
			room_id = types[types.length-1];
		return $.DIV({className:"second-logo"}, $.IMG({src:"https://www.youroom.in/r/"+room_id+"/picture"}));
	},
	baseUrl: "https://www.youroom.in/r/",
	renderMessage: function(entry, data, columnInfo, refresh, openMessageInput){
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
					this.src="https://www.youroom.in/images/default_picture.png";
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
				openMessageInput("", entry.id);
			} else {
				var account_name = columnInfo.account_name;
				readyReply("", entry.id, "youroom/post/"+account_name+"/"+room_id);
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
					title: "スレッド表示",
					height: 400,
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
						$.DIV({className:"message-text"}).html(data.text.replace(/\n/g, "<br/>")).hide(),
						$.A({className:"more",href:"#"}, "もっと読む>>").click(function(){
							var moreText = $(this).prev();
							if(moreText.css("display") == "none")
								$(this).text("<<閉じる");
							else
								$(this).text("もっと読む>>");
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
	renderMessages: function(data, columnContent, columnInfo, refresh){
		var lastMessage, lastCreatedAt;
		if(refresh){
			lastMessage = columnContent.children(".message:first");
			lastCreatedAt = lastMessage.data("entry") ? lastMessage.data("entry")["created_at"] : false;
			$(".new", columnContent).removeClass("new");
		} else {
			lastMessage = columnContent.children(".message:last");
			lastCreatedAt = lastMessage.data("entry") ? lastMessage.data("entry")["created_at"] : false;
		}
		var count = 0;
		var openMessageInput = columnContent.parents(".column").data("openMessageInput");
		$.each(data.messages, function(){
			messageElm = youroom.renderMessage(this.entry, data, columnInfo, refresh, openMessageInput);
			if(refresh && lastMessage.length > 0){
				//既に表示しているメッセージより新しいメッセージのみ表示
				if(!lastCreatedAt || this.entry.created_at > lastCreatedAt){
					messageElm.addClass("new").insertBefore(lastMessage);
					count++;
				} else {
					return false;
				}
			}else{
				//既に表示しているメッセージより古いメッセージのみ表示
				if(!lastCreatedAt || this.entry.created_at < lastCreatedAt)
					messageElm.appendTo(columnContent);
			}
		});
		if(refresh) {
			columnContent.parent().prevAll(".new-count").text(count > 30 ? "30+" : count).toggle(count > 0);
			showNotification(columnInfo, count);
		}
	},
	renderThread: function(data, popup, columnInfo){
		var entry = data.messages.entry;
		youroom.renderMessage(entry, data, columnInfo).appendTo(popup);
		youroom.renderChildren(entry.children, data, popup, columnInfo, 1);
	},
	renderChildren: function(children, data, popup, columnInfo, indent){
		if(!children) return;
		$.each(children, function(){
			youroom.renderMessage(this, data, columnInfo).css("margin-left", indent*5+"px").appendTo(popup);
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
			youroom.renderMessages(data, columnContent, conf);
			$this.show().next().hide();
		});
	}
}
var twitter = {
	messageLimit: 140,
	canPostInColumn: function(){return true},
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
				return "http://twitter.com/#!/list/"+type.substring(5);
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
	getPostUrl: function(conf){
		return "twitter/post/"+conf.account_name;
	},
	openMessageInput: function(column, conf){
		var textbox = column.find(".message-input textarea");
		var msg = textbox.val();
		if(!msg && conf.type.match(/search\/(#[^\s]*)/))
			msg = " " + RegExp.$1;
		column.data("openMessageInput")(msg, "", true);
	},
	renderMessage: function(entry, columnInfo, refresh, openMessageInput){
		var baseUrl = "http://twitter.com/";
		var user = entry.user || entry.sender;
		var isDM = columnInfo.type.indexOf("direct_messages") == 0;
		var timeLinkOpt = {};
		if(!isDM){
			timeLinkOpt = {
				href:baseUrl+user.screen_name+"/status/"+entry.id,
				target:"_blank"
			}
		}
		var messageElm = $.DIV({className:"message"},
			$.A({
					href:baseUrl+user.screen_name,
					className:"profile-image",
					target:"_blank"
				},
				$.IMG(
					{src:user.profile_image_url}
				)
			),
			$.A({
					href:baseUrl+user.screen_name,
					className:"user-name",
					target:"_blank"
				},
				user.screen_name+(user.name ? ' ('+user.name+')' : '')
			),
			$.DIV({className:"time"},
				$.A(
					timeLinkOpt,
					toLocalTime(entry.display_time)
				)
			),
			$.DIV({className:"message-text"}).html(entry.display_text)
		).data("rt", function(){
			var account_name = columnInfo.account_name;
			openMessageInput(" RT @"+user.screen_name+": "+entry.text, "", true);
		}).data("dm", function(){
			var account_name = columnInfo.account_name;
			openMessageInput("d "+user.screen_name+" ", "");
		}).data("entry", entry);
		if(entry.source){
			var source = " from " + entry.source;
			$(".time", messageElm).append(source).find("a").attr("target","_blank");
		}
		if(!isDM){
			messageElm.data("reply", function(){
				var account_name = columnInfo.account_name;
				openMessageInput("@"+user.screen_name+" ", entry.id);
			}).data("retweet", function(){
				$.ajax({
					type:"POST",
					url:"twitter/retweet/"+columnInfo.account_name+"?id="+entry.id,
					success: function(){
						showNotice("リツイートしました。");
					},
					error: function(){
						showError("リツイートに失敗しました。");
					}
				});
			}).data("favorites", function(){
				$.ajax({
					type:"POST",
					url:"twitter/favorites/"+columnInfo.account_name+"?id="+entry.id,
					success: function(){
						showNotice("お気に入りに追加しました。");
					},
					error: function(){
						showError("お気に入りへの追加に失敗しました。");
					}
				});
			});
		}
		if(entry.in_reply_to_status_id){
			messageElm.data("thread", function(){
				var loading = $('<p class="loading"/>').text("Loading...");
				var popup = $("<div/>").append(loading).appendTo(document.body);
				function loadReply(id){
					$.get("twitter/status/"+columnInfo.account_name+"/?id="+id,
						function(entry){
							twitter.renderMessage(entry, columnInfo).insertAfter(loading);
							if(entry.in_reply_to_status_id){
								loadReply(entry.in_reply_to_status_id);
							}else{
								loading.remove();
							}
						}
					);
				}
				popup.dialog({
					title: "会話",
					height: 400,
					dialogClass: "thread",
					open: function(){
						twitter.renderMessage(entry, columnInfo).insertAfter(loading);
						loadReply(entry.in_reply_to_status_id);
					},
					close: function(event, ui){
						popup.remove();
					}
				});
			});
		}
		return messageElm;
	},
	renderMessages: function(data, columnContent, columnInfo, refresh){//TODO youRoomとコードが重複
		var lastMessage, lastCreatedAt;
		if(refresh){
			lastMessage = columnContent.children(".message:first");
			lastCreatedAt = lastMessage.data("entry") ? Date.parse(lastMessage.data("entry")["created_at"]) : false;
			$(".new", columnContent).removeClass("new");
		} else {
			lastMessage = columnContent.children(".message:last");
			lastCreatedAt = lastMessage.data("entry") ? Date.parse(lastMessage.data("entry")["created_at"]) : false;
		}
		var openMessageInput = columnContent.parents(".column").data("openMessageInput");
		var count = 0;
		$.each(data.messages, function(){
			messageElm = twitter.renderMessage(this, columnInfo, refresh, openMessageInput);
			if(refresh && lastMessage.length > 0){
				//既に表示しているメッセージより新しいメッセージのみ表示
				if(!lastCreatedAt || Date.parse(this.created_at) > lastCreatedAt){
					messageElm.addClass("new").insertBefore(lastMessage);
					count++
				} else {
					return false;
				}
			}else{
				//既に表示しているメッセージより古いメッセージのみ表示
				if(!lastCreatedAt || Date.parse(this.created_at) < lastCreatedAt)
					messageElm.appendTo(columnContent);
			}
		});
		if(refresh){
			columnContent.parent().prevAll(".new-count").text(count > 30 ? "30+" : count).toggle(count > 0);
			showNotification(columnInfo, count);
		}
	},
	moreMessages: function(){
		var $this = $(this),
			columnContent = $this.prev(".message-list"),
			column = columnContent.parents(".column"),
			conf = column.data("conf"),
			url = conf.service + "/messages/" + conf.account_name,
			lastMsg = $(".message:last", columnContent),
			maxId = lastMsg.data("entry").id;
		$this.hide().next().show();
		$.getJSON(buildURL(url, {type:conf.type, "max_id":maxId}), function(data){
			twitter.renderMessages(data, columnContent, conf);
			$this.show().next().hide();
		});
	}
}
var yammer = {
	messageLimit: -1,
	canPostInColumn:function(){return true;},
	getColumnLink: function(conf){
		if(conf.href)
			return conf.href;
		return "https://www.yammer.com/"+conf.account_name+"#/threads/index?type="+conf.type;
	},
	getPostUrl: function(conf){
		return "yammer/post/"+conf.account_name;
	},
	renderMessage: function(entry, columnInfo, refresh, openMessageInput){
		var messageElm = $.DIV({className:"message"},
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
				" from " + entry.client_type
			),
			$.DIV({className:"message-text"}).html(entry.display_text)
		).data("reply", function(){
			var account_name = columnInfo.account_name;
			//TODO group対応
			openMessageInput("", entry.id);
		}).data("entry", entry);
		if(entry.thread_id){//TODO 会話の有無を判断したい
			messageElm.data("thread", function(){
				var popup = $.DIV().append($('<p class="loading"/>').text("Loading...")).appendTo(document.body);
				popup.dialog({
					title: "スレッド表示",
					height: 400,
					dialogClass: "thread",
					open: function(event, ui){
						$.get("yammer/thread/"+columnInfo.account_name+"/?id="+entry.thread_id,
						function(data){
							popup.empty();
							$.each(data.messages, function(){
								yammer.renderMessage(this, columnInfo, openMessageInput).prependTo(popup);
							});
						});
					},
					close: function(event, ui){
						popup.remove();
					}
				});
			});
		}
		if(entry.attachments.length > 0){
			var imageDiv = $('<div class="images"/>'), fileDiv = $('<div class="files"/>'),
				linkDiv = $('<div class="link"/>');
			$.each(entry.attachments, function(){
				if(this.image){
					var attachParams = {
						"url": this.image.url,
						"content-type": this.content_type,
						"name": this.name
					};
					$('<a target="_blank"/>')
						.attr("href", this.image.url).attr("target", "_blank")
						//.attr("href", buildURL("yammer/attach/"+columnInfo.account_name, attachParams))
						.append($("<img height='20'/>").attr("alt", this.name)
							.attr("src", buildURL("yammer/attach/"+columnInfo.account_name, attachParams))
						)
						.appendTo(imageDiv);
				}
				if(this.file){
					$("<a/>").text(this.name)
						.attr("href", this.file.url).attr("target", "_blank")
						//.attr("href", buildURL("yammer/attach/"+columnInfo.account_name, attachParams))
						.appendTo(fileDiv);
				}
				messageElm.append(fileDiv).append(imageDiv).append(linkDiv);
			});
		}
		return messageElm;
	},
	renderMessages: function(data, columnContent, columnInfo, refresh){//TODO youRoomとコードが重複
		var lastMessage, lastCreatedAt;
		if(refresh){
			lastMessage = columnContent.children(".message:first");
			lastCreatedAt = lastMessage.data("entry") ? lastMessage.data("entry")["created_at"] : false;
			$(".new", columnContent).removeClass("new");
		} else {
			lastMessage = columnContent.children(".message:last");
			lastCreatedAt = lastMessage.data("entry") ? lastMessage.data("entry")["created_at"] : false;
		}
		var openMessageInput = columnContent.parents(".column").data("openMessageInput");
		var count = 0;
		$.each(data.messages, function(){
			messageElm = yammer.renderMessage(this, columnInfo, refresh, openMessageInput);
			if(refresh && lastMessage.length > 0){
				//既に表示しているメッセージより新しいメッセージのみ表示
				if(!lastCreatedAt || this.created_at > lastCreatedAt){
					messageElm.addClass("new").insertBefore(lastMessage);
					count++;
				} else {
					return false;
				}
			}else{
				//既に表示しているメッセージより古いメッセージのみ表示
				if(!lastCreatedAt || this.created_at < lastCreatedAt)
					messageElm.appendTo(columnContent);
			}
		});
		if(refresh){
			columnContent.parent().prevAll(".new-count").text(count > 30 ? "30+" : count).toggle(count > 0);
			showNotification(columnInfo, count);
		}
	},
	moreMessages: function(){
		var $this = $(this),
			columnContent = $this.prev(".message-list"),
			columnElm = columnContent.parents(".column"),
			conf = columnElm.data("conf"),
			url = conf.service + "/messages/" + conf.account_name,
			lastMsg = $(".message:last", columnContent),
			older_than = lastMsg.data("entry").id;
		$this.hide().next().show();
		$.getJSON(buildURL(url, {type:conf.type, "older_than":older_than}), function(data){
			yammer.renderMessages(data, columnContent, conf);
			$this.show().next().hide();
		});
	}
}
var facebook = {
	messageLimit: -1,
	canPostInColumn:function(){return true;},
	getColumnLink: function(conf){
		var type = conf.type;
		if(type == "me/home")
			return "http://www.facebook.com/home.php?sk=lf";
		return false;
	},
	getPostUrl: function(conf){
		return "facebook/post/"+conf.account_name;
	},
	renderComment: function(entry){
		var commentElm = $.DIV({className:"message"},
			$.A({
					href:"https://graph.facebook.com/"+entry.from.id+"/picture",
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
		);
		return commentElm;
	},
	renderMessage: function(entry, columnInfo, refresh, openMessageInput){
		var messageElm = $.DIV({className:"message"},
			$.A({
					href:"https://graph.facebook.com/"+entry.from.id+"/picture",
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
						href:entry.actions[0].link,
						target:"_blank"
					},
					toLocalTime(entry.display_time)
				)
			),
			$.DIV({className:"message-text"}).html(entry.display_text)
		).data("reply", function(){
			openMessageInput("", entry.id);
		}).data("entry", entry);
		if(entry.icon)
			$(".time", messageElm).prepend($.IMG({src:entry.icon}))
		if(entry.type != "status"){
			var attach = $.DIV({className:"attachment"},
				$.DIV({}, $.A({href:entry.link, target:"_blank"}, entry.name)),
				$.DIV({}, entry.caption),
				$.DIV({}, entry.description)
			).appendTo(messageElm);
			if(entry.picture)
				attach.prepend(
					$.A({
						href:(entry.source || entry.link),
						target:"_blank",
						className:"image-link"
					},
					$.IMG({src:entry.picture})
				));
		}
		$.A({href:"#", className:"comment-count"}, (entry.comments ? entry.comments.count : 0)+" comments")
			.click(function(){
				var commentElm = $(".comment", messageElm);
				if(commentElm.length > 0){
					commentElm.remove();
					return;
				}
				commentElm = $("<div class='comment'/>").appendTo(messageElm);
				commentElm.append('<div class="message">Loading...</div>');
				$.ajax({
					url: "facebook/thread/" + columnInfo.account_name,
					data: {id:entry.id},
					dataType: 'json',
					success: function(data){
						if(data.comments){
							commentElm.empty();
							$.each(data.comments.data, function(){
								facebook.renderComment(this).appendTo(commentElm);
							});
							$(".comment-count", messageElm).text(data.comments.count+" comments");
						} else {
							commentElm.remove();
						}
					},
					error: function(){
						$(".message", commentElm).text('取得に失敗しました。');
					}
				});
			})
			.appendTo($(".time", messageElm));
		
		return messageElm;
	},
	renderMessages: function(data, columnContent, columnInfo, refresh){//TODO youRoomとコードが重複
		var lastMessage, lastCreatedAt;
		if(refresh){
			lastMessage = columnContent.children(".message:first");
			lastCreatedAt = lastMessage.data("entry") ? lastMessage.data("entry")["updated_time"] : false;
			$(".new", columnContent).removeClass("new");
		} else {
			lastMessage = columnContent.children(".message:last");
			lastCreatedAt = lastMessage.data("entry") ? lastMessage.data("entry")["updated_time"] : false;
		}
		var openMessageInput = columnContent.parents(".column").data("openMessageInput");
		var count = 0;
		$.each(data.messages, function(){
			messageElm = facebook.renderMessage(this, columnInfo, refresh, openMessageInput);
			if(refresh && lastMessage.length > 0){
				//既に表示しているメッセージより新しいメッセージのみ表示
				if(!lastCreatedAt || this.updated_time > lastCreatedAt){
					messageElm.addClass("new").insertBefore(lastMessage);
					count++;
				} else {
					return false;
				}
			}else{
				//既に表示しているメッセージより古いメッセージのみ表示
				if(!lastCreatedAt || this.updated_time < lastCreatedAt)
					messageElm.appendTo(columnContent);
			}
		});
		if(refresh){
			columnContent.parent().prevAll(".new-count").text(count > 30 ? "30+" : count).toggle(count > 0);
			showNotification(columnInfo, count);
		}
	},
	moreMessages: function(){
		var $this = $(this),
			columnContent = $this.prev(".message-list"),
			columnElm = columnContent.parents(".column");
			conf = columnElm.data("conf"),
			url = conf.service + "/messages/" + conf.account_name,
			lastMsg = $(".message-list > .message:last", columnContent.parent()),
			until = lastMsg.data("entry")["updated_time"];
		$this.hide().next().show();
		$.getJSON(buildURL(url, {type:conf.type, until:until}), function(data){
			facebook.renderMessages(data, columnContent, conf);
			$this.show().next().hide();
		});
	}
}
var cybozulive = {
	messageLimit: -1,
	renderMessage: function(entry, data, columnInfo, refresh){
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
				readyReply("", entry.id, "cybozulive/post/"+account_name+"/"+ids[1]);
			});
		}
		if(ids.length > 1 && ids[0] == "GROUP"){
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
			$("#select-profile select .cybozulive option").each(function(){
				var postUrl = $(this).val().split("/");
				groups[postUrl[postUrl.length -1]] = $(this).text().split("/")[0];
			});
			cybozulive.groups = groups;
		}
		return cybozulive.groups[groupId];
	},
	addMoreText: function(messageElm){
		var textElm = $(".message-text", messageElm);
		if(textElm.height() == 30){
			$.A({className:"more",href:"#"}, "もっと読む>>").click(function(){
				var moreText = $(this).prev();
				if(moreText.hasClass("short")){
					$(this).text("<<閉じる");
					moreText.removeClass("short");
				}else{
					$(this).text("もっと読む>>");
					moreText.addClass("short");
				}
			}).insertAfter(textElm);
		}
	},
	renderMessages: function(data, columnContent, columnInfo, refresh){//TODO youRoomとコードが重複
		var lastMessage, lastCreatedAt;
		if(refresh){
			lastMessage = columnContent.children(".message:first");
			lastCreatedAt = lastMessage.data("entry") ? lastMessage.data("entry")["updated"] : false;
			$(".new", columnContent).removeClass("new");
		} else {
			lastMessage = columnContent.children(".message:last");
			lastCreatedAt = lastMessage.data("entry") ? lastMessage.data("entry")["updated"] : false;
		}
		var count = 0;
		$.each(data.messages.messages, function(){
			var messageElm = cybozulive.renderMessage(this, data, columnInfo, refresh);
			if(refresh && lastMessage.length > 0){
				//既に表示しているメッセージより新しいメッセージのみ表示
				if(!lastCreatedAt || this.updated > lastCreatedAt){
					messageElm.addClass("new").insertBefore(lastMessage);
					count++;
				} else {
					return false;
				}
			}else{
				//既に表示しているメッセージより古いメッセージのみ表示
				if(!lastCreatedAt || this.created_at < lastCreatedAt)
					messageElm.appendTo(columnContent);
			}
			cybozulive.addMoreText(messageElm);
		});
		if(refresh){
			columnContent.parent().prevAll(".new-count").text(count > 30 ? "30+" : count).toggle(count > 0);
			showNotification(columnInfo, count);
		}
	}
}
var rss = {
	renderMessage: function(entry, data, columnInfo, refresh){
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
	renderMessages: function(data, columnContent, columnInfo, refresh){//TODO youRoomとコードが重複
		var lastMessage, lastCreatedAt;
		if(refresh){
			lastMessage = columnContent.children(".message:first");
			lastCreatedAt = lastMessage.data("entry") ? lastMessage.data("entry")["updated"] : false;
			$(".new", columnContent).removeClass("new");
		} else {
			lastMessage = columnContent.children(".message:last");
			lastCreatedAt = lastMessage.data("entry") ? lastMessage.data("entry")["updated"] : false;
		}
		var count = 0;
		$.each(data.messages, function(){
			messageElm = rss.renderMessage(this, data, columnInfo, refresh);
			if(refresh && lastMessage.length > 0){
				//既に表示しているメッセージより新しいメッセージのみ表示
				if(!lastCreatedAt || this.updated > lastCreatedAt){
					messageElm.addClass("new").insertBefore(lastMessage);
					count++;
				} else {
					return false;
				}
			}else{
				//既に表示しているメッセージより古いメッセージのみ表示
				if(!lastCreatedAt || this.created_at < lastCreatedAt)
					messageElm.appendTo(columnContent);
			}
		});
		if(refresh){
			columnContent.parent().prevAll(".new-count").text(count > 30 ? "30+" : count).toggle(count > 0);
			showNotification(columnInfo, count);
		}
		//タイトルを更新
		if(columnInfo.name != data.title){
			$.post('column/rename', {id:columnInfo.key, name:data.title}, function(){
				columnInfo.name = data.title;
			});
			$("#"+columnInfo.key+" .column-name").text(data.title);
		}
	}
}