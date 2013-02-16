#!/usr/bin/env python
# -*- coding: utf-8 -*-import sys

import os
import urllib
import logging

from xml.sax import saxutils

from google.appengine.ext import webapp
from google.appengine.ext.webapp import template
from google.appengine.ext.webapp import util
from google.appengine.ext import db
from google.appengine.api import urlfetch
from google.appengine.api import memcache
from django.utils import simplejson
from xml.sax.saxutils import unescape

from controller import oauth,utils
from controller.utils import BaseHandler,need_login


class LinkedInHandler(BaseHandler):
    @need_login
    def get(self, action="", account="", param=""):
        account = urllib.unquote_plus(account)
        if action == "add_column":
            template_values = self.add_column()
            tmpl = os.path.join(os.path.dirname(__file__), "../view/linkedin_add_column.html")
            return self.response.out.write(template.render(tmpl, template_values))
        if action == "accounts":
            template_values = self.accounts()
            tmpl = os.path.join(os.path.dirname(__file__), "../view/linkedin_accounts.html")
            return self.response.out.write(template.render(tmpl, template_values))
        if action == "messages":
            #TODO STAT以外の対応
            query = {"format":"json", "count":"20", "type":"SHAR"}
            type = self.request.get("type")
            if type == "updates" :
                url = "http://api.linkedin.com/v1/people/~/network/updates"
            if type == "my":
                url = "http://api.linkedin.com/v1/people/~/network/updates"
                query["scope"] = "self"
            if self.request.get("before"):
                query["before"] = self.request.get("before")
            #if self.request.get("page"):
            #    query["page"] = self.request.get("page")
            url += "?" + urllib.urlencode(query)
            template_values = self.get_messages(account, url)
            self.response.headers["Content-Type"] = "application/json"
            return self.response.out.write(simplejson.dumps(template_values))
        if action == "comments":
            id = self.request.get("id")
            start = self.request.get("start")
            count = self.request.get("count")
            query = {"format":"json", "start":start, "count":count}
            url = "http://api.linkedin.com/v1/people/~/network/updates/key=%s/update-comments" % urllib.quote(id)
            url += "?" + urllib.urlencode(query)
            template_values = self.get_messages(account, url)
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
            reply_to = self.request.get("reply-to")
            xml = '<?xml version="1.0" encoding="UTF-8"?>'
            if reply_to :
                url = "http://api.linkedin.com/v1/people/~/network/updates/key=%s/update-comments" % urllib.quote(reply_to)
                xml += '<update-comment>'
                xml += '<comment>%s</comment>' % saxutils.escape(message)
                xml += '</update-comment>'
            else:
                url = "http://api.linkedin.com/v1/people/~/shares"
                xml += '<share>'
                xml += '<comment>%s</comment>' % saxutils.escape(message)
                xml += '<visibility><code>anyone</code></visibility>'
                xml += "</share>"
            
            response, content = oauth.LinkedInHandler.requestBody(
                user,
                account,
                url,
                body=xml.encode('utf-8'),
                method="POST",
                content_type="text/xml")
            status = int(response["status"])
            if status < 200 or status >= 300:
                raise Exception(response["status"] + " failed to post message. : " + content)
            return self.response.out.write("Message is posted.")
        if action == "like":
            id = self.request.get("id")
            if id == "":
                self.error(400)
                return
            url = "http://api.linkedin.com/v1/people/~/network/updates/key=%s/is-liked" % urllib.quote(id)
            xml = '<?xml version="1.0" encoding="UTF-8"?>'
            xml += '<is-liked>true</is-liked>'
            response, content = oauth.LinkedInHandler.requestBody(
                user,
                account,
                url,
                body=xml.encode('utf-8'),
                method="PUT",
                content_type="text/xml")
            status = int(response["status"])
            if status < 200 or status >= 300:
                raise Exception(response["status"] + " failed to like message. : " + content)
            return self.response.out.write("Message is liked.")
    
    def add_column(self):
        user = self.session.get_user()
        accounts = oauth.Account.gql(
            "WHERE service = :1 and user_ref = :2 and access_token != :3",
            "linkedin", user.key(), None)
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
            "linkedin", user.key(), None)
        if accounts.count() == 0:
            return {}
        template_values = {
            'accounts': accounts
        }
        return template_values
    
    def convert_message(self, m):
        if m.get("updateContent") and m["updateContent"]["person"].get('currentShare') and m["updateContent"]["person"]["currentShare"].get('comment'):
            m["display_text"] = utils.escape_html(m["updateContent"]["person"]["currentShare"]["comment"])
            m["display_text"] = utils.replace_link(m["display_text"], "http://twitter.com/")
        if m.get('comment'):
            m["display_text"] = utils.escape_html(m["comment"])
            m["display_text"] = utils.replace_link(m["display_text"], "http://twitter.com/")
        if m.get("updateComments") and m["updateComments"].get("_total") > 0:
            for c in m["updateComments"].get("values"):
                self.convert_message(c)
        return m

    def get_messages(self, account, url) :
        user = self.session.get_user()
        response, content = oauth.LinkedInHandler.request(user, account, url)
        if response["status"] == "200":
            messages = simplejson.loads(content)
            messages_values = []
            if messages.get('values'):
                for m in messages["values"] :
                    m = self.convert_message(m)
                messages_values = messages["values"]
            template_values = {
                'service': 'linkedin',
                'messages': messages_values
            }
            if messages.get('_total'):
                template_values['_total'] = messages['_total']
            return template_values
        else:
            logging.warn(url + " : " + response["status"])
            raise Exception("failed to get messages from LinkeIn. %s - %s" % (response, content))

def get_profiles(accounts):
    profiles = []
    for account in accounts:
        if account.service == "linkedin" and account.access_token != None:
            if not account.profile_image_url:
                response, content = oauth.LinkedInHandler.request_with_account(account, "http://api.linkedin.com/v1/people/~:(id,first-name,last-name,public-profile-url,picture-url,main-address)?format=json")
                account.account_info = content
                account_info = simplejson.loads(account.account_info)
                account.profile_image_url = account_info.get("pictureUrl")
                account.put()
            profiles.append({
                            "service":"linkedin",
                            "account_name":account.account_name,
                            "url":"linkedin/post/"+account.account_name,
                             "name":account.display_name,
                             "profile_image_url":account.profile_image_url})
    return profiles