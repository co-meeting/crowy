#!/usr/bin/env python
# -*- coding: utf-8 -*-import sys

import sys
import os
import urllib
import logging
import mimetypes
import re

from google.appengine.ext import webapp
from google.appengine.ext import blobstore
from google.appengine.ext.webapp import template
from google.appengine.ext.webapp import util
from google.appengine.ext import db
from google.appengine.api import urlfetch
from google.appengine.api import memcache
from django.utils import simplejson

from controller import oauth,utils,model
from controller.utils import BaseHandler,need_login

class YammerHandler(BaseHandler):
    @need_login
    def get(self, action="", account="", param=""):
        user = self.session.get_user()
        account = urllib.unquote_plus(account)
        if action == "authorize":
            tmpl = os.path.join(os.path.dirname(__file__), "../view/yammer_authorize.html")
            return self.response.out.write(template.render(tmpl, {}))
        if action == "add_column":
            template_values = self.add_column()
            tmpl = os.path.join(os.path.dirname(__file__), "../view/yammer_add_column.html")
            return self.response.out.write(template.render(tmpl, template_values))
        if action == "accounts":
            template_values = self.accounts()
            tmpl = os.path.join(os.path.dirname(__file__), "../view/yammer_accounts.html")
            return self.response.out.write(template.render(tmpl, template_values))
        if action == "messages":
            query = {"threaded":"extended"}
            type = self.request.get("type")
            if type == "all":
                url = "https://www.yammer.com/api/v1/messages.json"
            elif type == "favorites_of":
                url = "https://www.yammer.com/api/v1/messages/favorites_of/current.json"
            else:
                url = "https://www.yammer.com/api/v1/messages/"+type+".json"
            if self.request.get("older_than"):
                query['older_than'] = self.request.get("older_than")
            url += "?" + urllib.urlencode(query)
            template_values = self.get_messages(account, url)
            self.response.headers["Content-Type"] = "application/json"
            return self.response.out.write(simplejson.dumps(template_values))
        if action == "thread":
            id = self.request.get("id")
            url = "https://www.yammer.com/api/v1/messages/in_thread/%s.json" % id
            query = {"limit":self.request.get("limit") or 20}
            if self.request.get("older_than"):
                query["older_than"] = self.request.get("older_than")
            url += "?" + urllib.urlencode(query)
            template_values = self.get_messages(account, url)
            self.response.headers["Content-Type"] = "application/json"
            return self.response.out.write(simplejson.dumps(template_values))
        if action == "attach":
            url = self.request.get("url")
            content_type = self.request.get("content-type")
            name = self.request.get("name")
            response, content = oauth.YammerHandler.request(user, account, url)
            if response["status"] != "200":
                raise Exception(response["status"] + " failed to get attachement. : " + content)
            content_type = content_type or mimetypes.guess_type(name)[0] or "application/octet-stream"
            self.response.headers["Content-Type"] = content_type
            if content_type.startswith("image/"):
                self.response.headers["Content-Disposition"] = 'inline; filename="%s"' % name
            else:
                self.response.headers["Content-Disposition"] = 'attachment; filename="%s"' % name
            return self.response.out.write(content)
        if action == "api":
            path = self.request.get('path')
            url = "https://www.yammer.com/api/%s" % path
            response, content = oauth.YammerHandler.request(user, account, url)
            if response["status"] != "200":
                raise Exception(response["status"] + " failed to call %s. : %s" % (url,content))
            return self.response.out.write(content)
        self.error(400)
    
    @need_login
    def post(self, action="", account="", param=""):
        user = self.session.get_user()
        account = urllib.unquote_plus(account)
        param = urllib.unquote_plus(param)
        if action == "post":
            group_id = param
            params = {"body":self.request.get("message")}
            parent_id = self.request.get("reply-to")
            if parent_id:
                params["replied_to_id"] = parent_id
            if group_id:
                params["group_id"] = group_id
            files = []
            blob_info = None
            file_key = self.request.get("file-key[]") #TODO 複数ファイル添付
            if file_key:
                blob_info = blobstore.BlobInfo.get(file_key)
                if blob_info:
                    files.append(["attachment1", blob_info.filename, blob_info.open()])
            if len(files) > 0:
                response, content = oauth.YammerHandler.multipartRequest(
                    user,
                    account,
                    "https://www.yammer.com/api/v1/messages.json",
                    params=params,
                    files=files)
            else:
                response, content = oauth.YammerHandler.request(
                    user,
                    account,
                    "https://www.yammer.com/api/v1/messages.json",
                    method="POST",
                    params=params)
            if response and response["status"] != "201":
                raise Exception(response["status"] + " failed to post message. : " + content)
            if blob_info:
                blob_info.delete()
            self.response.out.write("Message is posted.")
            return
        if action == "like":
            id = self.request.get("id")
            if id == "":
                self.error(400)
                return
            url = "https://www.yammer.com/api/v1/messages/liked_by/current.json"
            response, content = oauth.YammerHandler.request(
                user,
                account,
                url,
                method="POST",
                params={'message_id':id})
            status = int(response["status"])
            if status < 200 or status >= 300:
                raise Exception(response["status"] + " failed to like message. : " + content)
            return self.response.out.write("Message is liked.")
        self.error(400)
    
    def add_column(self):
        user = self.session.get_user()
        accounts = oauth.Account.gql(
            "WHERE service = :1 and user_ref = :2 and access_token != :3",
            "yammer", user.key(), None)
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
            "yammer", user.key(), None)
        if accounts.count() == 0:
            return {}
        template_values = {
            'accounts': accounts
        }
        return template_values

    def get_messages(self, account, url) :
        user = self.session.get_user()
        response, content = oauth.YammerHandler.request(user, account, url)
        
        if response["status"] == "200":
            result = simplejson.loads(content)
            messages = result["messages"]
            users = {}
            threads = {}
            for r in result["references"]:
                if r['type'] == 'user':
                    users[r['id']] = r
                elif r['type'] == 'thread':
                    threads[r['id']] = r
            messages = self.convert_messages(messages, users, threads, account)
            
            threaded_extended = result["threaded_extended"]
            for t in threaded_extended.values():
                self.convert_messages(t, users, threads, account)
            
            template_values = {
                'service': 'yammer',
                'messages': messages,
                'threaded_extended': threaded_extended
            }
            return template_values
        else:
            logging.warn(response["status"] + " : " + url)
            raise Exception("failed to get messages from yammer")

    def convert_messages(self, messages, users, threads, account):
        for m in messages :
            m["display_text"] = utils.escape_html(m["body"]["plain"])
            m["display_text"] = utils.replace_link(m["display_text"], "https://www.yammer.com/%s/users/" % account)
            displayTime = utils.get_display_time(m["created_at"], "%Y/%m/%d %H:%M:%S +0000")
            m["display_time"] = displayTime
            #m["sender"] = self.get_user(account, m["sender_id"]) or m["sender_id"]
            m["sender"] = users.get(m["sender_id"]) or m["sender_id"]
            m["refs"] = threads.get(m["id"])
        return messages

def get_profiles(accounts):
    profiles = []
    for account in accounts:
        if account.service == "yammer" and account.access_token != None:
            try:
                if not account.profile_image_url:
                    account_info = simplejson.loads(account.account_info)
                    account.profile_image_url = account_info["mugshot_url"]
                    account.put()
            except:
                pass
            account_name = account.account_name
            profiles.append({
                            "service":"yammer",
                            "type":"user",
                            "account_name":account_name,
                            "url":"yammer/post/"+account.account_name,
                            "name":account.display_name,
                            "profile_image_url":account.profile_image_url})
            try:
                response, content = oauth.YammerHandler.request_with_account(
                    account,
                    "https://www.yammer.com/api/v1/groups.json")
                groups = simplejson.loads(content)
                for group in groups:
                    profiles.append({"service":"yammer",
                                     "type":"group",
                                     "account_name":account_name,
                                     "group_id":str(group["id"]),
                                     "group_name":group["full_name"],
                                     "group_url":group["web_url"],
                                     "url":"yammer/post/"+account_name+"/"+str(group["id"]),
                                     "name":group["full_name"] + "/" + account.display_name,
                                     "profile_image_url":account.profile_image_url,
                                     "group_image_url":group["mugshot_url"]})
            except:
                logging.exception(sys.exc_info())
    return profiles

def get_href(user, account_name, type):
    account = oauth.YammerHandler.get_current_account(user, account_name)
    account_info = simplejson.loads(account.account_info)
    network_name = account_info["network_name"]
    if network_name not in account_info["network_domains"]:
        network_name = re.sub("[^a-zA-Z0-9]","",account_info["network_name"]).lower()
    if type.startswith('in_group/'):
        types = type.split("/")
        groupid = types[1].encode('utf-8')
        return "https://www.yammer.com/"+network_name+"/groups/"+groupid
    return "https://www.yammer.com/"+network_name+"#/threads/index?type="+type