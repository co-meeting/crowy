#!/usr/bin/env python
# -*- coding: utf-8 -*-import sys

import cgi
import logging
import os
import urllib
import urllib2

from django.utils import simplejson
from django.conf import settings
from google.appengine.ext import db
from google.appengine.ext import webapp
from google.appengine.ext.webapp import util
from controller.utils import template
from google.appengine.api import urlfetch

from controller import utils
from controller.utils import BaseHandler,need_login
from controller.model import Account

class ChatterHandler(BaseHandler):
    @need_login
    def get(self, action="", account="", param=""):
        user = self.session.get_user()
        if action == "oauth":
            verification_code = self.request.get("code")
            args = dict(client_id=settings.CHATTER_CLIENT_ID, redirect_uri=self.request.path_url)
            if verification_code:
                args["client_secret"] = settings.CHATTER_CLIENT_SECRET
                args["code"] = verification_code
                args["grant_type"] = "authorization_code"
                account = self.get_token(args)
                
                #既に同じアカウントが登録されていたら削除します
                saved_accounts = Account.gql(
                    "WHERE service = :1 and user_ref = :2 and account_name = :3",
                    "chatter",
                    user.key(),
                    account.account_name)
                for saved_account in saved_accounts:
                    if saved_account.key() != account.key():
                        saved_account.delete()
            
                #ウィンドウを閉じます
                tmpl = os.path.join(os.path.dirname(__file__), "../view/oauth_callback.html")
                return self.response.out.write(template.render(tmpl, {'account':account}))
            else:
                args["response_type"] = "code"
                self.redirect(
                    "https://login.salesforce.com/services/oauth2/authorize?" +
                    urllib.urlencode(args))
                return
        if action == "add_column":
            template_values = self.accounts()
            tmpl = os.path.join(os.path.dirname(__file__), "../view/chatter_add_column.html")
            return self.response.out.write(template.render(tmpl, template_values))
        if action == "accounts":
            template_values = self.accounts()
            tmpl = os.path.join(os.path.dirname(__file__), "../view/chatter_accounts.html")
            return self.response.out.write(template.render(tmpl, template_values))
        if action == "messages":
            type = self.request.get("type")
            until = self.request.get("until")
            query = {}
            url = "query"
            query["q"] = '''SELECT Id, Type, 
                         CreatedById, CreatedBy.Name,
                         InsertedBy.Profile.CreatedBy.SmallPhotoUrl,
                         CreatedDate, LastModifiedDate,
                         ParentId, Parent.Name, Parent.Type, 
                         RelatedRecordId, CommentCount,
                         Body, Title, LinkUrl, ContentData, ContentFileName,
                             (SELECT Id, FieldName, OldValue, NewValue 
                              FROM FeedTrackedChanges ORDER BY Id DESC),
                             (SELECT Id, CommentBody, CreatedDate, 
                              CreatedBy.Name, InsertedBy.Profile.CreatedBy.SmallPhotoUrl
                              FROM FeedComments ORDER BY CreatedDate DESC LIMIT 2),
                             (SELECT CreatedBy.Name
                              FROM FeedLikes)
                         FROM NewsFeed'''
            if until :
                query["q"] += " WHERE LastModifiedDate <= %s " % until.replace('+0000','z')
            query["q"] += ''' ORDER BY LastModifiedDate DESC, Id DESC
                         LIMIT 20'''
            template_values = self.get_messages(account, url, query)
            self.response.headers["Content-Type"] = "application/json"
            return self.response.out.write(simplejson.dumps(template_values))
        if action == "comments":
            id = self.request.get("id")
            query = {}
            url = "query"
            query["q"] = '''SELECT Id,
                             (SELECT Id, CommentBody, CreatedDate, 
                              CreatedBy.Name, InsertedBy.Profile.CreatedBy.SmallPhotoUrl
                              FROM FeedComments ORDER BY CreatedDate DESC LIMIT 200)
                         FROM NewsFeed
                         WHERE Id = '%s'
                         LIMIT 20''' % id
            messages = self.get_messages(account, url, query).get('messages')
            try:
                template_values = messages[0]["FeedComments"]["records"]
            except:
                logging.error(simplejson.dumps(messages))
                self.error(500)
                return
            self.response.headers["Content-Type"] = "application/json"
            return self.response.out.write(simplejson.dumps(template_values))
        return self.error(400)
    
    @need_login
    def post(self, action="", account="", param=""):
        account = urllib.unquote_plus(account)
        param = urllib.unquote_plus(param)
        if action == "post":
            params = {}
            message = self.request.get("message")
            reply_to = self.request.get("reply-to")
            url = "sobjects/"
            if reply_to:
                params["CommentBody"] = message
                params["FeedItemId"] = reply_to
                url += "FeedComment/"
            else:
                params["ParentId"] = account
                params["Body"] = message
                url += "FeedItem/"
            body = simplejson.dumps(params)
            response = self.call(url, account, body=body, method="post", content_type="application/json; charset=utf-8")
            if response.status_code != 201:
                raise Exception(str(response.status_code) + " failed to post message. : " + response.content)
            content = unicode(response.content, 'utf-8')
            result = simplejson.loads(content)
            if result.get("error"):
                raise Exception("failed to post message. : " + content)
            self.response.out.write("Message is posted.")
            return
        if action == "like":
            object_id = self.request.get("id")
            url = "sobjects/FeedLike/"
            params = {"FeedItemId":object_id}
            body = simplejson.dumps(params)
            response = self.call(url, account, body=body, method="post", content_type="application/json; charset=utf-8")
            if response.status_code != 201:
                raise Exception(str(response.status_code) + " failed to like message. : " + response.content)
            content = unicode(response.content, 'utf-8')
            result = simplejson.loads(content)
            if not result:
                raise Exception("failed to like message. : " + content)
            self.response.out.write("Message is liked.")
            return
        if action == "unlike":
            object_id = self.request.get("id")
            url = "chatter/feed-items/" + object_id + "/likes"
            response = self.call(url, account, method="delete")
            if response.status_code != 201:
                raise Exception(str(response.status_code) + " failed to unlike message. : " + response.content)
            content = unicode(response.content, 'utf-8')
            result = simplejson.loads(content)
            if not result:
                raise Exception("failed to unlike message. : " + content)
            self.response.out.write("Message is unliked.")
            return
        self.error(400)
    
    def accounts(self):
        user = self.session.get_user()
        accounts = Account.gql(
            "WHERE service = :1 and user_ref = :2 and access_token != :3",
            "chatter", user.key(), None)
        if accounts.count() == 0:
            return {}
        template_values = {
            'accounts': accounts
        }
        return template_values
    
    def get_token(self, args):
        user = self.session.get_user()
        response = unicode(urllib.urlopen(
                    "https://login.salesforce.com/services/oauth2/token?",
                    urllib.urlencode(args)).read(), 'utf-8')
        logging.info(response)
        tokens = simplejson.loads(response)
        access_token = tokens["access_token"]
        profile_url = tokens["id"]
        
        profile_res = self.call(profile_url, access_token=access_token)
        profile_body = unicode(profile_res.content, 'utf-8')
        profile = simplejson.loads(profile_body)
        account_name = str(profile["user_id"])
        account = Account.gql(
                        "WHERE service = :1 and account_name = :2 and user_ref = :3",
                        "chatter",
                        account_name,
                        user.key()).get()
        if not account :
            account = Account(
                user_ref=user,
                service="chatter",
                account_name=str(profile["user_id"]),
                display_name=str(profile["display_name"]),
                account_info=profile_body,
                access_token=access_token
                )
        else:
            account.access_token = access_token
            account.display_name = str(profile["display_name"])
            account.account_info = profile_body
        if tokens.get("refresh_token") :
            account.refresh_token = tokens["refresh_token"]
        account.put()
        
        return account
    
    def call(self, url, account_name=None, params={}, method="get", body=None, content_type=None, access_token=None, account=None):
        user = self.session.get_user()
        is_retry = account is not None
        if access_token is None:
            if account is None:
                account = Account.gql(
                        "WHERE service = :1 and account_name = :2 and user_ref = :3",
                        "chatter",
                        account_name,
                        user.key()).get()
            access_token = account.access_token
            account_info = simplejson.loads(account.account_info)
            if not url.startswith("http") :
                url = account_info["urls"]["rest"].replace("{version}", "22.0") + url
        headers = {"Authorization": "OAuth " + access_token}
        
        #query = urllib.urlencode(params) 念のためコメントアウト
        query  = utils.encoded_urlencode(params)
        response = None
        
        if method == "get":
            response = urlfetch.fetch(url+"?"+query, headers=headers)
        elif method == "post":
            if body:
                query = body
            headers['Content-Type'] = content_type or 'application/x-www-form-urlencoded; charset=utf-8'
            response = urlfetch.fetch(url, payload=query, method=urlfetch.POST, headers=headers)
        elif method == "delete":
            response = urlfetch.fetch(url+"?"+query, method=urlfetch.DELETE, headers=headers)
        logging.info(url)
        logging.info(query)
        logging.info(str(response.status_code))
        logging.info(response.content)
        if response.status_code == 401 and not is_retry:
            args = dict(
                        client_id=settings.CHATTER_CLIENT_ID,
                        client_secret=settings.CHATTER_CLIENT_SECRET,
                        grant_type='refresh_token',
                        refresh_token=account.refresh_token)
            account = self.get_token(args)
            response = self.call(url, account=account, params=params, method=method)
        return response
    
    def get_messages(self, account, url, params={}):
        response = self.call(url, account, params)
        content = unicode(response.content, 'utf-8')
        result = simplejson.loads(content)
        messages = result["records"]
        for m in messages:
            m = self.convert_message(m)
        template_values = {
            'service': 'chatter',
            'messages': messages
        }
        return template_values
    
    def convert_message(self, m):
        body = m.get("Body") or m.get("CommentBody")
        if body:
            m["display_text"] = utils.escape_html(body)
            m["display_text"] = utils.replace_link(m["display_text"], "http://www.facebook.com/")
        time = m.get("LastModifiedDate") if m.get("LastModifiedDate") else m.get("CreatedDate")
        if time:
            try:
                m["display_time"] = utils.get_display_time(time, "%Y-%m-%dT%H:%M:%S.000Z");
            except:
                m["display_time"] = utils.get_display_time(time, "%Y-%m-%dT%H:%M:%S.000+0000");
        if m.get("FeedComments") and m["FeedComments"].get("totalSize") > 0:
            for c in m["FeedComments"].get("records"):
                self.convert_message(c)
        #if m.get("comments") and m["comments"].get("data"):
        #    for c in m["comments"]["data"]:
        #        c = self.convert_message(c)
        return m

def get_profiles(accounts):
    profiles = []
    for account in accounts:
        if account.service == "chatter" and account.access_token != None:
            profiles.append({
                             "service":"chatter",
                             "account_name":account.acount_name,
                             "url":"chatter/post/"+account.account_name,
                             "name":account.display_name,
                             "token":account.access_token
                             })
    return profiles
