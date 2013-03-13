#!/usr/bin/env python
# -*- coding: utf-8 -*-import sys

import os
import urllib
import logging
import base64
import mimetypes

from google.appengine.ext import webapp
from google.appengine.ext import blobstore
from controller.utils import template
from google.appengine.ext.webapp import util
from google.appengine.ext import db
from google.appengine.api import urlfetch
from django.utils import simplejson

from controller import oauth,utils,model
from controller.utils import BaseHandler,need_login

class YouRoomHandler(BaseHandler):
    @need_login
    def get(self, action="", account="", param=""):
        user = self.session.get_user()
        account = urllib.unquote_plus(account)
        param = urllib.unquote_plus(param)
        if action == "add_column":
            template_values = self.add_column()
            tmpl = os.path.join(os.path.dirname(__file__), "../view/youroom_add_column.html")
            return self.response.out.write(template.render(tmpl, template_values))
        if action == "accounts":
            template_values = self.accounts()
            tmpl = os.path.join(os.path.dirname(__file__), "../view/youroom_accounts.html")
            return self.response.out.write(template.render(tmpl, template_values))
        if action == "messages":
            type = self.request.get("type")
            if type == "":
                url = "https://www.youroom.in/?flat=true&format=json"
                if self.request.get("page"):
                  url += "&page=" + self.request.get("page")
                template_values = self.get_messages(account, url)
                self.response.headers["Content-Type"] = "application/json"
                return self.response.out.write(simplejson.dumps(template_values))
            else:
                url = "https://www.youroom.in/r/"+type+"/?flat=true&format=json"
                if self.request.get("page"):
                  url += "&page=" + self.request.get("page")
                template_values = self.get_messages(account, url, type)
                template_values["room_id"] = type
                self.response.headers["Content-Type"] = "application/json"
                return self.response.out.write(simplejson.dumps(template_values))
        if action == "thread":
            room_id = self.request.get("room_id")
            url = "https://www.youroom.in/r/"+room_id+"/entries/"+self.request.get("id")+"?format=json"
            template_values = self.get_entries(account, url, room_id)
            template_values["room_id"] = room_id
            self.response.headers["Content-Type"] = "application/json"
            return self.response.out.write(simplejson.dumps(template_values))
        if action == "attach":
            id = self.request.get("id")
            room_id = self.request.get("room_id")
            content_type = self.request.get("content-type")
            name = self.request.get("name")
            url = 'https://www.youroom.in/r/'+room_id+'/entries/'+id+'/attachment'
            response, content = oauth.YouRoomHandler.request(user, account, url)
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
            url = self.request.get("url")
            response, content = oauth.YouRoomHandler.request(user, account, url)
            self.response.headers["Content-Disposition"] = 'inline;'
            return self.response.out.write(content)
        self.error(400)
    
    @need_login
    def post(self, action="", account="", param=""):
        user = self.session.get_user()
        account = urllib.unquote_plus(account)
        param = urllib.unquote_plus(param)
        if action == "post":
            params = {"entry[content]":self.request.get("message")}
            parent_id = self.request.get("reply-to")
            if parent_id:
                params["entry[parent_id]"] = parent_id
            files = []
            blob_info = None
            file_key = self.request.get("file-key[]")
            if file_key:
                blob_info = blobstore.BlobInfo.get(file_key)
                if blob_info:
                    params["entry[attachment_attributes][attachment_type]"] = "Image"
                    files.append(["entry[attachment_attributes][uploaded_data]", blob_info.filename, blob_info.open()])
            if len(files) > 0:
                response, content = oauth.YouRoomHandler.multipartRequest(
                    user,
                    account,
                    "https://www.youroom.in/r/"+param+"/entries.js",
                    params=params,
                    files=files)
            else:
                response, content = oauth.YouRoomHandler.request(
                    user,
                    account,
                    "https://www.youroom.in/r/"+param+"/entries?format=json",
                    method="POST",
                    params=params)
            if response and response["status"] not in ["200","201"]:
                raise Exception(response["status"] + " failed to post message. : " + content)
            if blob_info:
                blob_info.delete()
            self.response.out.write("Message is posted.")
            return
        self.error(400)
    
    def add_column(self):
        user = self.session.get_user()
        accounts = oauth.Account.gql(
            "WHERE service = :1 and user_ref = :2 and access_token != :3",
            "youroom",
            user.key(),
            None)
        account_groups = {}
        for account in accounts:
            account_info = simplejson.loads(account.account_info)
            account_groups[account.account_name] = []
            for group in account_info["user"]["participations"]:
                group = group["group"]
                account_groups[account.account_name].append({"id":group["to_param"], "name":group["name"]})
            
        template_values = {
            'accounts': account_groups,
            'accounts_json': simplejson.dumps(account_groups)
        }
        return template_values
    
    def accounts(self):
        user = self.session.get_user()
        accounts = oauth.Account.gql(
            "WHERE service = :1 and user_ref = :2 and access_token != :3",
            "youroom",
            user.key(),
            None)
        if accounts.count() == 0:
            return {}
        template_values = {
            'accounts': accounts
        }
        return template_values
    
    def get_messages(self, account, url, room_id=""):
        user = self.session.get_user()
        response, content = oauth.YouRoomHandler.request(user, account, url)
        if response["status"] != "200":
            raise Exception("%s failed to get messages.(%s) : %s" % (response["status"], url, content))
        result = simplejson.loads(content)
        for message in result :
            self.build_entry(message["entry"], room_id or message["entry"]["participation"]["group"]["to_param"])
        template_values = {
            'service': 'youroom',
            'messages': result
        }
        return template_values
    
    def get_entries(self, account, url, room_id=""):
        user = self.session.get_user()
        #room_id = room_id or message["entry"]["participation"]["group"]["to_param"]
        response, content = oauth.YouRoomHandler.request(user, account, url)
        if response["status"] != "200":
            raise Exception(response["status"] + " failed to get messages. : " + content)
        result = simplejson.loads(content)
        entry = self.build_entry(result["entry"], room_id)
        if entry.has_key("children"):
            self.build_children(entry["children"], room_id)
        template_values = {
            'service': 'youroom',
            'messages': result
        }
        return template_values
    
    def build_children(self, children, room_id):
        for child in children :
            self.build_entry(child, room_id)
            if child.has_key("children") :
                self.build_children(child["children"], room_id)
    
    def build_entry(self, entry, room_id):
        entry["display_text"] = utils.escape_html(entry["content"])
        entry["display_text"] = utils.replace_link(entry["display_text"], "https://www.youroom.in/r/%s/participations/" % room_id)
        displayTime = utils.get_display_time(entry["created_at"], "%Y-%m-%dT%H:%M:%SZ")
        entry["display_time"] = displayTime
        return entry

def get_profiles(accounts):
    profiles = []
    for account in accounts:
        if account.service != "youroom" or account.access_token == None:
            continue
        # TODO 必ずプロフィール情報を更新するのはやめたい
        response, content = oauth.YouRoomHandler.request_with_account(account, "https://www.youroom.in/verify_credentials?format=json")
        account.account_info = content
        account.put()
        account_info = simplejson.loads(account.account_info)
        for participation in account_info["user"]["participations"]:
            group = participation["group"]
            profiles.append({
                "service":"youroom",
                "account_name":account.account_name,
                "url":"youroom/post/"+account.account_name+"/"+group["to_param"],
                "name":group["name"]+"/"+account.account_name,
                "profile_image_url":"https://www.youroom.in/r/%s/participations/%s/picture" % (group["to_param"], participation["id"]),
                "group_image_url":"https://www.youroom.in/r/%s/picture" % group["to_param"]
            })
    return profiles