#!/usr/bin/env python
# -*- coding: utf-8 -*-import sys

FACEBOOK_SCOPE = "offline_access,email,publish_stream,read_stream,read_friendlists,user_groups,manage_pages,user_photos"

import cgi
import logging
import os,sys,re
import urllib
import urllib2
import datetime
import mimetypes

from django.utils import simplejson
from django.conf import settings
from google.appengine.ext import db
from google.appengine.ext import webapp
from google.appengine.ext import blobstore
from google.appengine.ext.webapp import util
from controller.utils import template
from google.appengine.api import urlfetch

from controller import utils
from controller.utils import BaseHandler,need_login
from controller.model import Account,User
from controller.session import Session

class FacebookLoginHandler(BaseHandler):
    def get(self, action="", account="", param=""):
        verification_code = self.request.get("code")
        args = dict(client_id=settings.FACEBOOK_APP_ID, redirect_uri=self.request.path_url)
        if verification_code:
            args["client_secret"] = settings.FACEBOOK_APP_SECRET
            args["code"] = verification_code
            response = cgi.parse_qs(urllib.urlopen(
                "https://graph.facebook.com/oauth/access_token?" +
                urllib.urlencode(args)).read())
            access_token = response["access_token"][-1]
            
            profile_res = unicode(urllib.urlopen(
                "https://graph.facebook.com/me?" +
                urllib.urlencode(dict(access_token=access_token))).read(),'utf-8')
            profile = simplejson.loads(profile_res)
          
            user = None
            is_not_login = False
            try:
                self.check_login()
                user = self.session.get_user()
            except utils.NotLoginError:
                is_not_login = True
                user = User.gql("WHERE user_id=:1 and service=:2", str(profile["id"]), "facebook").get()
                if user is None:
                    user = User(
                        user_id=str(profile["id"]),
                        name=str(profile["name"]),
                        mail=str(profile["email"]),
                        service='facebook',
                        access_token=access_token,
                        post_key='control',
                        last_access_time=datetime.datetime.now()
                    )
                    user.put()
                session = Session(self.request, self.response)
                session.new(user)
            
            account = Account(
                user_ref=user,
                service="facebook",
                account_name=str(profile["id"]),
                display_name=str(profile["name"]),
                account_info=profile_res,
                scope=FACEBOOK_SCOPE,
                access_token=access_token
                )
            account.put()
            
            #既に同じアカウントが登録されていたら削除します
            saved_accounts = Account.gql(
                "WHERE service = :1 and user_ref = :2 and account_name = :3",
                "facebook",
                user.key(),
                account.account_name)
            for saved_account in saved_accounts:
                if saved_account.key() != account.key():
                    saved_account.delete()
            
            if is_not_login:
                if action == 'mlogin':
                    self.redirect('/mhome?xoauth_requestor_id='+user.user_id)
                    return
                self.redirect('/')
                return
            
            #ウィンドウを閉じます
            tmpl = os.path.join(os.path.dirname(__file__), "../view/oauth_callback.html")
            return self.response.out.write(template.render(tmpl, {'account':account}))
        else:
            args["scope"] = FACEBOOK_SCOPE
            if action == 'oauth':
                args["display"] = 'popup'
            self.redirect(
                "https://www.facebook.com/dialog/oauth?" +
                #"https://graph.facebook.com/oauth/authorize?" +
                urllib.urlencode(args))
            return

class FacebookHandler(BaseHandler):
    @need_login
    def get(self, action="", account="", param=""):
        user = self.session.get_user()
        if action == "add_column":
            accounts = self.accounts()
            template_values = {}
            if accounts and accounts.get('accounts'):
                user_accounts = []
                for account in accounts['accounts']:
                    if not account.account_name.startswith('page_'):
                        user_accounts.append(account)
                template_values = {"accounts":user_accounts}
            tmpl = os.path.join(os.path.dirname(__file__), "../view/facebook_add_column.html")
            return self.response.out.write(template.render(tmpl, template_values))
        if action == "accounts":
            template_values = self.accounts()
            tmpl = os.path.join(os.path.dirname(__file__), "../view/facebook_accounts.html")
            return self.response.out.write(template.render(tmpl, template_values))
        if action == "messages":
            type = self.request.get("type")
            until = self.request.get("until")
            query = {}
            if until :
                query["until"] = until
            if type.startswith("page/") or type.startswith("app/") or type.startswith('group/') or type.startswith('list'):
                types = type.split("/")
                page = types[1].encode('utf-8')
                url = "https://graph.facebook.com/"+page+"/feed"
            elif type == "wall" and account.startswith('page_'):
                url = "https://graph.facebook.com/"+account.split('_',1)[1]+"/feed"
            elif type.startswith("search"):
                url = "https://graph.facebook.com/search"
                query["q"] = type.split('/',1)[1]
            else:
                url = "https://graph.facebook.com/"+type
            
            template_values, status = self.get_messages(account, url, query)
            
            if status == 400:#TODO 本当はレスポンスボディがOAuthExceptionだったら
                self.error(401)
                return
            elif status < 200 or status >= 300:
                logging.warn("%s : %s", url, status)
                raise Exception("failed to get messages from facebook")
            self.response.headers["Content-Type"] = "application/json"
            return self.response.out.write(simplejson.dumps(template_values))
        if action == "thread":
            message_id = self.request.get("id")
            url = "https://graph.facebook.com/"+message_id
            response = call(user, account, url)
            if response.status_code != 200:
                raise Exception(str(response.status_code) + " failed to get messages.")
            content = unicode(response.content, 'utf-8')
            m = simplejson.loads(content)
            if m.get("comments") and m["comments"].get("data"):
                for c in m["comments"]["data"]:
                    c = self.convert_message(c)
            self.response.headers["Content-Type"] = "application/json"
            return self.response.out.write(simplejson.dumps(m))
        if action == "api":
            api = self.request.get("path")
            url = "https://graph.facebook.com/" + api
            response = call(user, account, url)
            if response.status_code != 200:
                raise Exception(str(response.status_code) + " failed to execute " + api + " : " + response.content)
            self.response.headers["Content-Type"] = "application/json"
            return self.response.out.write(response.content)
        if action == "fql":
            query = self.request.get("query")
            url = "https://api.facebook.com/method/fql.query"
            params = {"query":query, "format":'JSON'}
            response = call(user, account, url, params=params)
            if response.status_code != 200:
                raise Exception(str(response.status_code) + " failed to get pages.")
            self.response.headers["Content-Type"] = "application/json"
            return self.response.out.write(response.content)
        self.error(400)
    
    @need_login
    def post(self, action="", account="", param=""):
        user = self.session.get_user()
        account = urllib.unquote_plus(account)
        param = urllib.unquote_plus(param)
        if action == "post":
            page_id = param
            message = self.request.get("message")
            params = {"message":message}
            reply_to = self.request.get("reply-to")
            files = []
            blob_info = None
            file_key = self.request.get("file-key[]")
            if file_key:
                blob_info = blobstore.BlobInfo.get(file_key)
                if blob_info:
                    files.append(["source", blob_info.filename, blob_info.open()])
            url = "https://graph.facebook.com/"
            if reply_to:
                url += reply_to + "/comments"
            elif len(files) > 0: 
                url += (page_id or account) + "/photos"
            elif page_id:
                url += page_id + "/feed"
            else:
                url += account + "/feed"
            
            link = re.search(r'(http[s]?://[\w|/|\.|%|&|\?|=|\-|#|!|:|;|~]+)', message)
            if link:
                params['link'] = str(link.group())
            
            if len(files) > 0:
                response = call_multipart(user, account, url, params, files)
            else:
                response = call(user, account, url, params, "post")
            if response.status_code != 200:
                raise Exception(str(response.status_code) + " failed to post message. : " + response.content)
            content = unicode(response.content, 'utf-8')
            result = simplejson.loads(content)
            if result.get("error"):
                raise Exception("failed to post message. : " + content)
            self.response.out.write("Message is posted.")
            return
        if action == "like":
            object_id = self.request.get("id")
            url = "https://graph.facebook.com/" + object_id + "/likes"
            response = call(user, account, url, method="post")
            if response.status_code != 200:
                raise Exception(str(response.status_code) + " failed to like message. : " + response.content)
            content = unicode(response.content, 'utf-8')
            result = simplejson.loads(content)
            if not result:
                raise Exception("failed to like message. : " + content)
            self.response.out.write("Message is liked.")
            return
        if action == "unlike":
            object_id = self.request.get("id")
            url = "https://graph.facebook.com/" + object_id + "/likes"
            response = call(user, account, url, method="delete")
            if response.status_code != 200:
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
            "facebook", user.key(), None)
        if accounts.count() == 0:
            return {}
        template_values = {
            'accounts': accounts
        }
        return template_values
    
    def get_messages(self, account, url, params={}):
        user = self.session.get_user()
        response = call(user, account, url, params)
        content = unicode(response.content, 'utf-8')
        if response.status_code < 200 or response.status_code >= 300:
            return response.content, response.status_code
        result = simplejson.loads(content)
        messages = result["data"]
        for m in messages:
            m = self.convert_message(m)
        template_values = {
            'service': 'facebook',
            'messages': messages
        }
        return template_values, response.status_code
    
    def convert_message(self, m):
        if m.get("message"):
            m["display_text"] = utils.escape_html(m.get("message"))
            m["display_text"] = utils.replace_link(m["display_text"], "http://www.facebook.com/")
        m["display_time"] = utils.get_display_time(m.get("created_time"), "%Y-%m-%dT%H:%M:%S+0000");
        if m.get("comments") and m["comments"].get("data"):
            for c in m["comments"]["data"]:
                c = self.convert_message(c)
        return m

def get_profiles(accounts):
    profiles = []
    for account in accounts:
        if account.service == "facebook" and account.access_token != None:
            account_name = account.account_name
            if account_name.startswith('page_'):
                page_id = account_name.split('_', 1)[1]
                profiles.append({"service":"facebook",
                                 "type":"page",
                                 "account_name":account_name,
                                 "url":"facebook/post/"+account_name+"/"+page_id,
                                 "name":account.display_name,
                                 "profile_image_url":account.group_image_url or "https://graph.facebook.com/%s/picture" % page_id,
                                 "group_image_url":account.group_image_url or "https://graph.facebook.com/%s/picture" % page_id}),
            else:
                profiles.append({"service":"facebook",
                                 "type":"user",
                                 "account_name":account_name,
                                 "url":"facebook/post/"+account_name,
                                 "name":account.display_name,
                                 "scope":account.scope,
                                 "profile_image_url":account.profile_image_url or "https://graph.facebook.com/%s/picture" % account_name})
                try:
                    params = {"access_token": account.access_token}
                    query = urllib.urlencode(params)
                    response = urlfetch.fetch("https://graph.facebook.com/me/groups?"+query)
                    groups = simplejson.loads(response.content)
                    for group in groups.get('data'):
                        profiles.append({"service":"facebook",
                                         "type":"group",
                                         "account_name":account_name,
                                         "url":"facebook/post/"+account_name+"/"+group["id"],
                                         "name":group["name"] + "/" + account.display_name,
                                         "profile_image_url":"https://graph.facebook.com/%s/picture" % account_name,
                                         "group_image_url":"/facebook/api/%s?path=/%s/picture" % (account_name, group["id"])})
                except:
                    logging.exception(sys.exc_info())
    return profiles

def before_add_column(user, account, page_account):
    add_page_account(user, account, page_account)

def add_page_account(user, account, page_account):
    if not page_account.startswith('page_'):
        return
    
    page_id = page_account.split('_', 1)[1]
    
    url = "https://graph.facebook.com/" + page_id
    params = {"fields":"access_token"}
    response = call(user, account, url, params=params)
    if response.status_code != 200:
        raise Exception(str(response.status_code) + " failed to get page's access token. : " + response.content)
    content = unicode(response.content, 'utf-8')
    token_res = simplejson.loads(content)
    
    response = call(user, account, url)
    content = unicode(response.content, 'utf-8')
    profile_res = simplejson.loads(content)
    
    account = Account(
        user_ref=user,
        service="facebook",
        account_name=page_account,
        display_name=str(profile_res["name"]),
        group_image_url="https://graph.facebook.com/%s/picture" % profile_res["id"],
        account_info=content,
        access_token=token_res["access_token"]
        )
    account.put()
    
    #既に同じアカウントが登録されていたら削除します
    saved_accounts = Account.gql(
        "WHERE service = :1 and user_ref = :2 and account_name = :3",
        "facebook",
        user.key(),
        account.account_name)
    for saved_account in saved_accounts:
        if saved_account.key() != account.key():
            saved_account.delete()

def call(user, account, url, params={}, method="get"):
    account = Account.gql(
            "WHERE service = :1 and account_name = :2 and user_ref = :3",
            "facebook",
            account,
            user.key()).get()
    params["access_token"] = account.access_token
    
    query = utils.encoded_urlencode(params)
    response = None
    
    if method == "get":
        response = urlfetch.fetch(url+"?"+query, deadline=3)
    elif method == "post":
        response = urlfetch.fetch(url, payload=query, method=urlfetch.POST, deadline=10)
    elif method == "delete":
        response = urlfetch.fetch(url+"?"+query, method=urlfetch.DELETE, deadline=10)
    return response

def call_multipart(user, account_name, url, params={}, files={}):
    account = Account.gql(
            "WHERE service = :1 and account_name = :2 and user_ref = :3",
            "facebook",
            account_name,
            user.key()).get()
    if account == None or account.access_token == None:
        raise Exception('Access token is not saved. : service = facebook, account_name = %s' % (account_name) )
    
    params["access_token"] = account.access_token
    
    BOUNDARY = u'----------ThIs_Is_tHe_bouNdaRY_$'
    body = utils.multipart_encode(params, files, BOUNDARY)
    
    headers = {
        'Content-Type': 'multipart/form-data; boundary=%s' % BOUNDARY
    }
    
    response = urlfetch.fetch(url, method=urlfetch.POST, payload=body, headers=headers, deadline=10)
    return response