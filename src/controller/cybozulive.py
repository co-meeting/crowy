#!/usr/bin/env python
# -*- coding: utf-8 -*-import sys

import os
import urllib
import logging
import datetime
import re

from lib import feedparser
from xml.sax import saxutils

from google.appengine.ext import webapp
from google.appengine.ext.webapp import template
from google.appengine.ext.webapp import util
from google.appengine.ext import db
from django.utils import simplejson

from controller import oauth,utils,model
from controller.utils import BaseHandler,need_login

class CybozuliveHandler(BaseHandler):
    @need_login
    def get(self, action="", account="", param=""):
        account = urllib.unquote_plus(account)
        param = urllib.unquote_plus(param)
        if action == "add_column":
            template_values = self.add_column()
            tmpl = os.path.join(os.path.dirname(__file__), "../view/cybozulive_add_column.html")
            return self.response.out.write(template.render(tmpl, template_values))
        if action == "accounts":
            template_values = self.accounts()
            tmpl = os.path.join(os.path.dirname(__file__), "../view/cybozulive_accounts.html")
            return self.response.out.write(template.render(tmpl, template_values))
        if action == "messages":
            type = self.request.get("type")
            if type == "":
                url = "https://api.cybozulive.com/api/notification/V2"
                template_values = self.get_messages(account, url)
                self.response.headers["Content-Type"] = "application/json"
                return self.response.out.write(simplejson.dumps(template_values))
            if type.startswith("board/"):
                url = "https://api.cybozulive.com/api/board/V2?group="+type.split("/")[1]
                template_values = self.get_messages(account, url)
                self.response.headers["Content-Type"] = "application/json"
                return self.response.out.write(simplejson.dumps(template_values))
            else:
                url = "https://api.cybozulive.com/api/notification/V2?category="+type
                template_values = self.get_messages(account, url)
                template_values["room_id"] = type
                self.response.headers["Content-Type"] = "application/json"
                return self.response.out.write(simplejson.dumps(template_values))
        self.error(400)
    
    @need_login
    def post(self, action="", account="", param=""):
        user = self.session.get_user()
        account = urllib.unquote_plus(account)
        param = urllib.unquote_plus(param)
        if action == "post":
            message = self.request.get("message")
            parent_id = self.request.get("reply-to")
            url = "https://api.cybozulive.com/api/board/V2"
            xml = '<?xml version="1.0" encoding="UTF-8"?>'
            xml += '<feed xmlns="http://www.w3.org/2005/Atom" xmlns:cbl="http://schemas.cybozulive.com/common/2010">'
            if parent_id:
                xml += "<id>%s</id>" % parent_id
                xml += '<entry>'
                xml += "<summary type=\"text\">%s</summary>" % saxutils.escape(message)
                xml += "</entry>"
                url = "https://api.cybozulive.com/api/comment/V2"
            else:
                title = message[0:15]+"..." if len(message) > 15 else message
                xml += '<entry>'
                xml += "<cbl:group id=%s />" % saxutils.quoteattr(param)
                xml += "<title>%s</title>" % saxutils.escape(title)
                xml += "<summary type=\"text\">%s</summary>" % saxutils.escape(message)
                xml += "</entry>"
            xml += "</feed>"
            response, content = oauth.CybozuliveHandler.requestBody(
                user,
                account,
                url,
                body=xml.encode('utf-8'))
            status = int(response["status"])
            if status < 200 and status >= 300:
                raise Exception(response["status"] + " failed to post message. : " + content)
            self.response.out.write("Message is posted.")
            return
        self.error(400)
    
    def add_column(self):
        user = self.session.get_user()
        accounts = oauth.Account.gql(
            "WHERE service = :1 and user_ref = :2 and access_token != :3",
            "cybozulive", user.key(), None)
        if accounts.count() == 0:
            return {}
        template_values = {
            'accounts': accounts
        }
        return template_values
    
    def accounts(self):
        user = self.session.get_user()
        accounts = oauth.Account.gql(
            "WHERE service = :1 and user_ref = :2 and access_token != :3",
            "cybozulive",
            user.key(),
            None)
        if accounts.count() == 0:
            return {}
        template_values = {
            'accounts': accounts
        }
        return template_values
    
    def get_messages(self, account, url):
        user = self.session.get_user()
        response, content = oauth.CybozuliveHandler.request(user, account, url)
        if response["status"] != "200":
            raise Exception(response["status"] + " failed to get messages. : " + url)
        result = feedparser.parse(content)
        messages = []
        for entry in result.entries:
            messages.append({
                "id": entry.id,
                "title": entry.title,
                "link": entry.link,
                "author": entry.author,
                "summary": re.sub("\n", '<br/>', utils.escape_html(entry.summary)) if hasattr(entry, "summary") else "",
                "updated": datetime.datetime(*entry.updated_parsed[:6]).strftime("%a %b %d %H:%M:%S %Y")
            })
        template_values = {
            'service': 'cybozulive',
            "title": result.feed.title,
            "link": result.feed.link,
            "feed_url": url,
            'messages': messages
        }
        return template_values
    """
    private
    category_dict = {
        "MYPAGE":"マイページ",
        "GROUP":"グループ",
        "MP_SCHEDULE":"マイスケジュール",
        "G_SCHEDULE":"グループイベント",
        "MESSAGE":"メッセージ",
        "TASK":"ToDoリスト",
        "BOARD":"掲示板",
        "CABINET":"共有フォルダ",
        "MEMBER_LIST":"グループへの入退会"
    }
    def convert_category(category):
        result = ""
        category[0]
    """

def get_profiles(accounts):
    profiles = []
    max_results = 100
    for account in accounts:
        if account.service != "cybozulive" or account.access_token == None:
            continue
        # TODO 必ずプロフィール情報を更新するのはやめたい
        start_index = 0
        while True:
            response, content = oauth.CybozuliveHandler.request_with_account(account, "https://api.cybozulive.com/api/group/V2?max-results=%s&start-index=%s" % (str(max_results), str(start_index)))
            account.account_info = unicode(content,'utf-8')
            account.put()
            account_info = feedparser.parse(account.account_info)
            for group in account_info.entries:
                profiles.append({
                    "service":"cybozulive",
                    "account_name":account.account_name,
                    "url":"cybozulive/post/"+account.account_name+"/"+group.id.split(",")[1],
                    "name":group.title+"/"+account.account_name
                })
            if len(account_info.entries) < max_results:
                break
            start_index += max_results
    return profiles