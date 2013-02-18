#!/usr/bin/env python
# -*- coding: utf-8 -*-import sys

import sys
import os
import urllib
import logging
import random
import re

from google.appengine.ext import webapp
from google.appengine.ext import blobstore
from google.appengine.ext.webapp import template
from google.appengine.ext.webapp import util
from google.appengine.ext import db
from google.appengine.api import urlfetch
from google.appengine.api import memcache
from django.utils import simplejson
from django.conf import settings
from xml.sax.saxutils import unescape

import controller
from controller import oauth,utils
from controller.utils import BaseHandler,need_login

class TwitterHandler(BaseHandler):
    @need_login
    def get(self, action="", account="", param=""):
        account = urllib.unquote_plus(account)
        if action == "add_column":
            template_values = self.add_column()
            tmpl = os.path.join(os.path.dirname(__file__), "../view/twitter_add_column.html")
            return self.response.out.write(template.render(tmpl, template_values))
        if action == "accounts":
            template_values = self.accounts()
            tmpl = os.path.join(os.path.dirname(__file__), "../view/twitter_accounts.html")
            return self.response.out.write(template.render(tmpl, template_values))
        if action == "messages":
            query = {'include_rts':'true', 'include_entities':'true'}
            type = self.request.get("type")
            #1.1で削除されたAPIにアクセスされた場合は空のリストを返却する
            if type in ("retweeted_by_me", "retweeted_to_me") :
                self.response.headers["Content-Type"] = "application/json"
                return self.response.out.write("[]")
            elif type.startswith("list/") :
                types = type.split("/")
                list_name = types[2].encode('utf-8')
                url = "https://api.twitter.com/1.1/lists/statuses.json"
                query["slug"] = list_name
                query["owner_screen_name"] = types[1]
            elif type.startswith("search/") :
                types = type.split("/", 1)
                url = "https://api.twitter.com/1.1/search/tweets.json"
                query["q"] = types[1].encode('utf-8')
            elif type.startswith("user/") :
                types = type.split("/", 1)
                url = "https://api.twitter.com/1.1/statuses/user_timeline.json"
                query["screen_name"] = types[1].encode('utf-8')
            elif type == "favorites" :
                url = "https://api.twitter.com/1.1/favorites/list.json"
            elif type.startswith("favorites/") :
                types = type.split("/", 1)
                url = "https://api.twitter.com/1.1/favorites/list.json"
                query["id"] = types[1].encode('utf-8')
            elif type == "mentions" :
                url = "https://api.twitter.com/1.1/statuses/mentions_timeline.json"
            elif type.startswith("mentions/") :
                types = type.split("/", 1)
                url = "https://api.twitter.com/1.1/search/tweets.json"
                query["q"] = "@"+types[1].encode('utf-8')
            elif type.startswith("direct_messages") :
                url = "https://api.twitter.com/1.1/"+type+".json"
            else:
                url = "https://api.twitter.com/1.1/statuses/"+type+".json"
                
            if self.request.get("max_id"):
                query["max_id"] = self.request.get("max_id")
            if self.request.get("page"):
                query["page"] = self.request.get("page")
            url += "?" + urllib.urlencode(query)
            template_values, status = self.get_messages(account, url)
            if status == "401" or status == "403":
                self.error(int(status))
                return
            elif status != "200":
                logging.warn("url=%s, status=%s, content=%s", url, status, template_values)
                raise Exception("failed to get messages from twitter")
            self.response.headers["Content-Type"] = "application/json"
            return self.response.out.write(simplejson.dumps(template_values))
        if action == "lists":
            url = "https://api.twitter.com/1.1/lists/list.json?screen_name=%s" % account
            result = self.call_method(account, url)
            self.response.headers["Content-Type"] = "application/json"
            return self.response.out.write(result)
        if action == "status":
            id = self.request.get("id")
            if id == None:
                self.error(400)
            url = "https://api.twitter.com/1.1/statuses/show.json?id=%s&include_entities=true" % id
            result = self.call_method(account, url)
            status = simplejson.loads(result)
            status = self.convert_message(status)
            self.response.headers["Content-Type"] = "application/json"
            return self.response.out.write(simplejson.dumps(status))
        if action == "api":
            path = self.request.get("path")
            if path == "":
                self.error(400)
                return
            response, content = oauth.TwitterHandler.request(
                self.session.get_user(),
                account,
                "https://api.twitter.com/1.1/%s" % path,
                method="GET")
            if response["status"] != "200":
                raise Exception(response["status"] + ", path=" + path + ", content=" + content)
            return self.response.out.write(content)
        self.error(400)
    
    @need_login
    def post(self, action="", account="", param=""):
        user = self.session.get_user()
        account = urllib.unquote_plus(account)
        param = urllib.unquote_plus(param)
        if action == "post":
            message = self.request.get("message")
            re_dm = re.compile(r'^d ([\w|/|\.|%|&|\?|=|\-|#]+) (.*)$', re.DOTALL)
            m_dm = re_dm.match(message)
            if m_dm:
                params = {
                          "text":m_dm.group(2),
                          'screen_name':m_dm.group(1)
                          }
                response, content = oauth.TwitterHandler.request(
                    user,
                    account,
                    "https://api.twitter.com/1.1/direct_messages/new.json",
                    method="POST",
                    params=params,
                    deadline=10)
                if response["status"] != "200":
                    raise Exception(response["status"] + " failed to send direct message. : " + content)
                message = simplejson.loads(content)
                return self.response.out.write(message["id"])
            params = {"status":message}
            reply_to = self.request.get("reply-to")
            if reply_to:
                params["in_reply_to_status_id"] = reply_to
            
            files = []
            blob_info = None
            file_key = self.request.get("file-key[]")
            if file_key:
                blob_info = blobstore.BlobInfo.get(file_key)
                if blob_info:
                    files.append(["media[]", blob_info.filename, blob_info.open()])
            
            if len(files) > 0:
                response, content = oauth.TwitterHandler.multipartRequest(
                    user,
                    account,
                    "https://api.twitter.com/1.1/statuses/update_with_media.json",
                    params=params,
                    files=files)
            else:
                try:
                    response, content = oauth.TwitterHandler.request(
                        user,
                        account,
                        "https://api.twitter.com/1.1/statuses/update.json",
                        method="POST",
                        params=params,
                        deadline=6)
                except (urlfetch.DeadlineExceededError, urlfetch.DownloadError), e:
                    logging.warn('failed to post message and retry, account=%s, message=%s', account, params["status"])
                    oauth.TwitterHandler.request(
                        user,
                        account,
                        "https://api.twitter.com/1.1/statuses/update.json",
                        method="POST",
                        params=params,
                        deadline=3)
            if response["status"] != "200":
                raise Exception(response["status"] + " failed to post message. : " + content)
            message = simplejson.loads(content)
            return self.response.out.write(message["id_str"])
        if action == "retweet":
            status_id = self.request.get("id")
            if status_id == "":
                self.error(400)
                return
            response, content = oauth.TwitterHandler.request(
                user,
                account,
                "https://api.twitter.com/1.1/statuses/retweet/%s.json" % status_id,
                method="POST")
            if response["status"] != "200":
                raise Exception(response["status"] + " failed to retweet message. : " + content)
            return self.response.out.write("Message is retweeted.")
        if action == "favorites":
            status_id = self.request.get("id")
            if status_id == "":
                self.error(400)
                return
            response, content = oauth.TwitterHandler.request(
                user,
                account,
                "https://api.twitter.com/1.1/favorites/create.json",
                params = {"id":status_id},
                method="POST")
            if response["status"] != "200":
                raise Exception(response["status"] + " failed to favorite message. : " + content)
            return self.response.out.write("Message is favorited.")
        if action == "api":
            path = self.request.get("path")
            if path == "":
                self.error(400)
                return
            response, content = oauth.TwitterHandler.request(
                user,
                account,
                "https://api.twitter.com/1.1/%s" % path,
                params = self.request.POST,
                method="POST")
            if response["status"] != "200":
                raise Exception(response["status"] + ", path=" + path + ", content=" + content)
            return self.response.out.write(content)
        self.error(400)
    
    def add_column(self):
        user = self.session.get_user()
        accounts = oauth.Account.gql(
            "WHERE service = :1 and user_ref = :2 and access_token != :3",
            "twitter", user.key(), None)
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
            "twitter", user.key(), None)
        if accounts.count() == 0:
            return {}
        template_values = {
            'accounts': accounts
        }
        return template_values
    
    def convert_message(self, m, isSearch=False):
        if m.get("retweeted_status") is not None:
            retweet_user = m.get("user")
            retweet_count = m.get("retweet_count")
            id = m.get("id_str")
            m = m["retweeted_status"]
            #m["favorited"] = False #なぞだが、RTされたツイートのfavoritedはどうもRTしたユーザのfavoritedが表示されているっぽい。
            m["retweet_user"] = retweet_user
            m["retweet_count"] = retweet_count or 0
            m["rt_id"] = m["id_str"]
            m["id_str"] = id #RTされたツイートのIDは古いため付け替えないと新着チェックロジックでおかしくなる
        
        m["id"] = m["id_str"]
        m["in_reply_to_status_id"] = m.get("in_reply_to_status_id_str")
        displayTime = utils.get_display_time(m["created_at"], "%a %b %d %H:%M:%S +0000 %Y");
        m["display_time"] = displayTime
        return m
    
    def get_messages(self, account, url, retry_count=0) :
        user = self.session.get_user()
        try:
            response, content = oauth.TwitterHandler.request(user, account, url, deadline=1)
            status = response["status"]
            if status == "200":
                messages = simplejson.loads(content)
                if isinstance(messages, dict) and "statuses" in messages:
                    messages = messages["statuses"]
                messages = map(self.convert_message, messages)
                template_values = {
                    'service': 'twitter',
                    'messages': messages
                }
                return template_values, status
            else:
                return content, status
        except (urlfetch.DeadlineExceededError, urlfetch.DownloadError), e:
            if retry_count > 2:
                raise e
            logging.warn('failed to fetch url=%s, retry_count=%s', url, retry_count+1)
            return self.get_messages(account, url, retry_count=retry_count+1) 

    def call_method(self, account, url, retry_count=0) :
        user = self.session.get_user()
        try:
            response, content = oauth.TwitterHandler.request(user, account, url, deadline=3)
            
            if response["status"] == "200":
                return content
            else:
                logging.warn(url + " : " + response["status"])
                raise Exception("failed to request %s", url)
        except (urlfetch.DeadlineExceededError, urlfetch.DownloadError), e:
            if retry_count > 2:
                raise e
            logging.warn('failed to fetch url=%s, retry_count=%s', url, retry_count+1)
            return self.call_method(account, url, retry_count=retry_count+1)

def get_profiles(accounts):
    profiles = []
    for account in accounts:
        if account.service == "twitter" and account.access_token != None:
            try:
                if not account.profile_image_url:
                    account_info = simplejson.loads(account.account_info)
                    account.profile_image_url = account_info["profile_image_url"]
                    account.put()
            except:
                pass
            profiles.append({
                            "service":"twitter",
                            "account_name":account.account_name,
                            "url":"twitter/post/"+account.account_name,
                            "name":account.account_name,
                            "profile_image_url":account.profile_image_url})
    return profiles
