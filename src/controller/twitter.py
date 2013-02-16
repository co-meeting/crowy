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
            is_search = False
            query = {'include_rts':'true', 'include_entities':'true'}
            type = self.request.get("type")
            if type.startswith("list/") :
                types = type.split("/")
                list_name = types[2].encode('utf-8')
                url = "http://api.twitter.com/1/"+types[1]+"/lists/"+urllib.quote(list_name)+"/statuses.json"
                #url = "https://api.twitter.com/1.1/lists/statuses.json"
                #query["slug"] = list_name
                #query["owner_screen_name"] = types[1]
            elif type.startswith("search/") :
                types = type.split("/", 1)
                url = "http://search.twitter.com/search.json"
                query["q"] = types[1].encode('utf-8')
                is_search = True
            elif type.startswith("user/") :
                types = type.split("/", 1)
                url = "http://api.twitter.com/1/statuses/user_timeline.json"
                query["screen_name"] = types[1].encode('utf-8')
            elif type.startswith("favorites/") :
                types = type.split("/", 1)
                url = "https://api.twitter.com/1/favorites.json"
                query["id"] = types[1].encode('utf-8')
            elif type.startswith("mentions/") :
                types = type.split("/", 1)
                url = "http://search.twitter.com/search.json"
                query["q"] = "@"+types[1].encode('utf-8')
                is_search = True
            elif type.startswith("direct_messages") or type == "favorites" :
                url = "http://api.twitter.com/1/"+type+".json"
            else:
                url = "http://api.twitter.com/1/statuses/"+type+".json"
            if self.request.get("max_id"):
                query["max_id"] = self.request.get("max_id")
            if self.request.get("page"):
                query["page"] = self.request.get("page")
            url += "?" + urllib.urlencode(query)
            if is_search:
                self.response.headers["Cache-Control"] = "public, max-age=60" #Frontendで1分キャッシュ
                template_values = self.search(url, query["q"])
            else:
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
            url = "http://api.twitter.com/1/"+account+"/lists.json?cursor=-1"
            mylists = self.call_method(account, url)
            url = "http://api.twitter.com/1/"+account+"/lists/subscriptions.json?cursor=-1"
            subscriptions = self.call_method(account, url)
            result = "["+mylists+","+subscriptions+"]"
            self.response.headers["Content-Type"] = "application/json"
            return self.response.out.write(result)
        if action == "status":
            id = self.request.get("id")
            if id == None:
                self.error(400)
            url = "http://api.twitter.com/1/statuses/show/%s.json?include_entities=true" % id
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
                "http://api.twitter.com/1/%s" % path,
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
                    "http://api.twitter.com/1/direct_messages/new.json",
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
                    "https://upload.twitter.com/1/statuses/update_with_media.json",
                    params=params,
                    files=files)
            else:
                try:
                    response, content = oauth.TwitterHandler.request(
                        user,
                        account,
                        "http://api.twitter.com/1/statuses/update.json",
                        method="POST",
                        params=params,
                        deadline=6)
                except (urlfetch.DeadlineExceededError, urlfetch.DownloadError), e:
                    logging.warn('failed to post message and retry, account=%s, message=%s', account, params["status"])
                    oauth.TwitterHandler.request(
                        user,
                        account,
                        "http://api.twitter.com/1/statuses/update.json",
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
                "http://api.twitter.com/1/statuses/retweet/%s.json" % status_id,
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
                "http://api.twitter.com/1/favorites/create/%s.json" % status_id,
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
                "http://api.twitter.com/1/%s" % path,
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
        if isSearch:
            m["is_search"] = True
            m["user"] = {
                'screen_name':m["from_user"],
                'profile_image_url':m["profile_image_url"]
            }
            m["source"] = unescape(m["source"], {'&quot;':'"'})
            m["display_time"] = utils.get_display_time(m["created_at"], "%a, %d %b %Y %H:%M:%S +0000");
        else:
            displayTime = utils.get_display_time(m["created_at"], "%a %b %d %H:%M:%S +0000 %Y");
            m["display_time"] = displayTime
        return m
    
    #AppEngineでの検索が420が頻発するのでプロキシを経由する
    def search_proxy(self, url, q):
        if controller.is_dev:
            response = urlfetch.fetch(url)
            if response.status_code == 200:
                return response
        
        proxy_nums = range(15) #range内はプロキシの台数
        random.shuffle(proxy_nums)
        for i in proxy_nums[0:3]:
            proxy_url = (settings.TWITTER_SEARCH_PROXY_URL + "?url=%s") % (str(i+1), urllib.quote(url))
            mkey = "error_twitter_proxy%s" % str(i+1)
            error_count = memcache.get(mkey) or 0
            if int(error_count) == oauth.ERROR_COUNT_LIMIT: #１分間に連続10回のエラーが起きたらそのサービスはダウンしていると判断
                memcache.set(mkey, error_count+1, oauth.ERROR_COUNT_RESET_TIME) #５分間は停止
            if int(error_count) >= oauth.ERROR_COUNT_LIMIT: #１分間に連続10回のエラーが起きたらそのサービスはダウンしていると判断
                logging.warn("Maybe crowy-proxy%s is down now." % str(i+1))
                continue
            try:
                response = urlfetch.fetch(proxy_url, deadline=1)
                if response.status_code == 200:
                    memcache.set(mkey, 0, oauth.ERROR_COUNT_RESET_TIME) #成功したらカウントリセット
                    return response
                memcache.set(mkey, error_count+1, oauth.ERROR_COUNT_RESET_TIME) #１分間エラー回数をカウント
                logging.warn('error count=%s, url=%s', error_count+1, proxy_url)
                logging.warn(response.content)
            except urlfetch.DownloadError:
                memcache.set(mkey, error_count+1, oauth.ERROR_COUNT_RESET_TIME) #１分間エラー回数をカウント
                logging.warn(proxy_url)
                logging.warn('error count=%s, Unexpected Error:%s', error_count+1, sys.exc_info())
            except:
                logging.warn(proxy_url)
                logging.warn('Unexpected Error:%s', sys.exc_info())
        
        raise Exception("%s is failed in all proxy" % url)
    
    def search(self, url, q) :
        messages = memcache.get(url)
        #messages = None #disable memcache for test
        if messages is None:
            response = self.search_proxy(url, q)
            if response.status_code == 200:
                messages = simplejson.loads(response.content)["results"]
                for m in messages :
                    m = self.convert_message(m, True)
                memcache.set(url, messages, 60) #1分キャッシュする
            else:
                logging.warn(url + " : " + str(response.status_code))
                raise Exception("failed to search twitter")
        template_values = {
            'service': 'twitter',
            'messages': messages
        }
        return template_values

    def get_messages(self, account, url, retry_count=0) :
        user = self.session.get_user()
        try:
            response, content = oauth.TwitterHandler.request(user, account, url, deadline=1)
            status = response["status"]
            if status == "200":
                messages = simplejson.loads(content)
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