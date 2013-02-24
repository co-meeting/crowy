#!/usr/bin/env python
# -*- coding: utf-8 -*-import sys

import urllib
import oauth2 as oauth
import os
import logging
import mimetypes
import base64
import sys
from StringIO import StringIO

from cgi import parse_qsl

from lib import feedparser

from google.appengine.ext import webapp
from google.appengine.ext.webapp import template
from google.appengine.ext.webapp import util
from google.appengine.ext import db
from google.appengine.api import memcache
from google.appengine.api.urlfetch import DownloadError
from django.utils import simplejson
from django.conf import settings

from controller import utils
from controller.utils import BaseHandler,need_login
from controller.model import Account

ERROR_COUNT_LIMIT = 10 #連続10回でダウンと判定
ERROR_COUNT_RESET_TIME = 5*60 #5分

class OAuthHandler(BaseHandler):
    signature_method = oauth.SignatureMethod_HMAC_SHA1()
    @need_login
    def get(self, action=""):
        user = self.session.get_user()
        if action == "callback":
            #key_nameが来たらそれを使う（現在callbackできないYammer用）
            oauth_key = self.request.cookies.get('oauth_key', None)
            if oauth_key == "":
                self.error(400)
                return
            account_key = db.Key(oauth_key)
            account = Account.get(account_key)
            try:
                token = oauth.Token(account.request_token, account.secret)
                
                oauth_verifier = self.request.get("oauth_verifier")
                client = self.newOAuthClient(token)
                resp, content = client.request(self.access_token_url, "POST", body="oauth_verifier=%s" % oauth_verifier)
                if resp['status'] != '200':
                    raise Exception('Invalid response %s.' % resp['status'])
                
                access_token = dict(parse_qsl(content))
                
                account.access_token = access_token['oauth_token']
                account.secret = access_token['oauth_token_secret']
                account.put()
                
                self.account = account
                
                account_name, display_name, group_image_url, account_info = self.get_account_info()
                account.account_name = account_name
                account.display_name = display_name
                account.group_image_url = group_image_url
                account.account_info = account_info
                if account.account_name == None or account.account_info == None:
                    raise Exception('Cannot get account information.')
                account.put()
                
                #24時間アクセストークンをキャッシュ
                key = "oauth_token/"+user.user_id+"/"+self.service+"/"+account.account_name
                memcache.set(key, account, 24*60*60)
                
                #既に同じアカウントが登録されていたら削除します
                saved_accounts = Account.gql(
                    "WHERE service = :1 and user_ref = :2 and account_name = :3",
                    self.service,
                    user.key(),
                    account.account_name)
                for saved_account in saved_accounts:
                    if saved_account.key() != account.key():
                        saved_account.delete()
            except:
                #どこかでエラーが発生したらゴミが残らないように削除する
                account.delete()
                logging.exception(sys.exc_info())
                raise sys.exc_info()
            
            #ウィンドウを閉じます
            tmpl = os.path.join(os.path.dirname(__file__), "../view/oauth_callback.html")
            return self.response.out.write(template.render(tmpl, {'account':account}))
        if action == "request":
            client = self.newOAuthClient()
            
            account_key = Account(
                user_ref=user,
                service=self.service).put()
            
            params = {
                'oauth_callback': self.request.relative_url('callback')
            }
            resp, content = client.request(self.request_token_url, 'POST', body=urllib.urlencode(params, True))
            
            if resp['status'] != '200':
                raise Exception('Invalid response %s. : %s' % (resp['status'], content))
            
            request_token = dict(parse_qsl(content))
            
            account = Account.get(account_key)
            account.request_token = request_token['oauth_token']
            account.secret = request_token['oauth_token_secret']
            account.put()
            cookie_val  = str('oauth_key=%s;' % str(account_key))
            self.response.headers.add_header('Set-Cookie', cookie_val)
            self.redirect(self.authorize_url + "?oauth_token=" + request_token['oauth_token'])
            return
        self.error(400)
    
    @classmethod
    def newOAuthClient(cls, token = None):
        consumer = oauth.Consumer(key=cls.consumer_key, secret=cls.consumer_secret)
        client = oauth.Client(consumer, token, timeout=4)
        client.set_signature_method(cls.signature_method)
        return client
    
    @classmethod
    def request_with_account(cls, account, url, method="GET", params={}, deadline=2):
        mkey = "error_" + cls.service
        error_count = memcache.get(mkey) or 0
        if int(error_count) == ERROR_COUNT_LIMIT: #連続して規定回数のエラーが起きたらそのサービスはダウンしていると判断
            memcache.set(mkey, error_count+1, ERROR_COUNT_RESET_TIME) #５分間は停止
        if int(error_count) >= ERROR_COUNT_LIMIT: #連続して規定回数のエラーが起きたらそのサービスはダウンしていると判断
            logging.warn("Maybe %s is down now." % cls.service)
            return {"status":"999"}, ""
        for key,value in params.items():
            params[key] = value.encode('utf-8')
        params = urllib.urlencode(params)
        
        token = oauth.Token(account.access_token, account.secret)
        client = cls.newOAuthClient(token)
        try:
            resp, content = client.request(url, method, params, deadline=deadline)
            status = int(resp["status"])
            if status == 200:
                memcache.set(mkey, 0, ERROR_COUNT_RESET_TIME) #成功したらカウントリセット
            elif status >= 500:
                memcache.set(mkey, error_count+1, ERROR_COUNT_RESET_TIME) #エラー回数をカウント
                logging.warn('error count=%s, service=%s', error_count+1, cls.service)
            return resp, content
        except DownloadError, e:
            memcache.set(mkey, error_count+1, ERROR_COUNT_RESET_TIME) #１分間エラー回数をカウント
            logging.warn('error count=%s, service=%s', error_count+1, cls.service)
            raise e
    
    @classmethod
    def request(cls, user, account_name, url, method="GET", params={}, deadline=2):
        account = cls.get_current_account(user, account_name)
        return cls.request_with_account(account, url, method, params, deadline=deadline)
    
    @classmethod
    def requestBody(cls, user, account_name, url, body="", method="POST", content_type="application/atom+xml"):
        account = cls.get_current_account(user, account_name)
        token = oauth.Token(account.access_token, account.secret)
        client = cls.newOAuthClient(token)
        headers = {
            'Content-Type': content_type
#            'Content-Length': str(len(body))
        }
        return client.request(url, method, body, headers)
    
    @classmethod
    def multipartRequest(cls, user, account_name, url, params={}, files={}):
        account = Account.gql(
                "WHERE service = :1 and account_name = :2 and user_ref = :3",
                cls.service,
                account_name,
                user.key()).get()
        if account == None or account.access_token == None:
            raise Exception('Access token is not saved. : service = %s, account_name = %s' % (cls.service, account_name) )
        
        BOUNDARY = '----------ThIs_Is_tHe_bouNdaRY_$'
        body = utils.multipart_encode(params, files, BOUNDARY)
        
        headers = {
            'Content-Type': 'multipart/form-data; boundary=%s' % BOUNDARY
        }
        
        token = oauth.Token(account.access_token, account.secret)
        client = cls.newOAuthClient(token)
        return client.request(url, "POST", body, headers)
    
    @classmethod
    def get_current_account(cls, user, account_name):
        key = "oauth_token/"+user.user_id+"/"+cls.service+"/"+account_name
        account = memcache.get(key)
        if account is not None:
            return account
        account = Account.gql(
                "WHERE service = :1 and account_name = :2 and user_ref = :3",
                cls.service,
                account_name,
                user.key()).get()
        if account == None or account.access_token == None:
            raise Exception('Access token is not saved. : service = %s, account_name = %s' % (cls.service, account_name) )
        memcache.set(key, account, 24*60*60) #24時間キャッシュする
        return account
    
    def get_account_info(self):
        raise NotImplementedError
    
    def oauth_request(self, url, method="GET", params={}):
        user = self.session.get_user()
        params = urllib.urlencode(params)
        if self.account == None or self.account.access_token == None:
            raise Exception('Access token is not saved.')

        token = oauth.Token(self.account.access_token, self.account.secret)
        client = self.newOAuthClient(token)
        return client.request(url, method, params)


class TwitterHandler(OAuthHandler):
    service = 'twitter'
    request_token_url = 'https://twitter.com/oauth/request_token'
    access_token_url = 'https://twitter.com/oauth/access_token'
    authorize_url = 'https://twitter.com/oauth/authorize'
    consumer_key = settings.TWITTER_CONSUMER_KEY
    consumer_secret = settings.TWITTER_CONSUMER_SECRET
    
    def get_account_info(self):
        resp, content = self.oauth_request("https://api.twitter.com/1.1/account/verify_credentials.json")
        if resp["status"] == "200":
            result = simplejson.loads(content)
            return result["screen_name"], None, result["profile_image_url"], content
        else:
            raise Exception("failed to verify credentials")


class YouRoomHandler(OAuthHandler):
    service = 'youroom'
    request_token_url = 'https://www.youroom.in/oauth/request_token'
    access_token_url = 'https://www.youroom.in/oauth/access_token'
    authorize_url = 'https://www.youroom.in/oauth/authorize'
    consumer_key = settings.YOUROOM_CONSUMER_KEY
    consumer_secret = settings.YOUROOM_CONSUMER_SECRET
    
    def get_account_info(self):
        resp, content = self.oauth_request("https://www.youroom.in/verify_credentials?format=json")
        if resp["status"] == "200":
            result = simplejson.loads(content)
            return result["user"]["email"], None, None, content
        else:
            raise Exception("failed to verify credentials")


class YammerHandler(OAuthHandler):
    service = 'yammer'
    request_token_url = 'https://www.yammer.com/oauth/request_token'
    access_token_url = 'https://www.yammer.com/oauth/access_token'
    authorize_url = 'https://www.yammer.com/oauth/authorize'
    consumer_key = settings.YAMMER_CONSUMER_KEY
    consumer_secret = settings.YAMMER_CONSUMER_SECRET
    
    def get_account_info(self):
        resp, content = self.oauth_request("https://www.yammer.com/api/v1/users/current.json")
        if resp["status"] == "200":
            content = unicode(content,'utf-8')
            result = simplejson.loads(content)
            account_name = str(result["id"])
            display_name = (result["full_name"] or result["name"])+'/'+result["network_name"]
            return account_name, display_name, result["mugshot_url"], content
        else:
            raise Exception("failed to get current user.")


class CybozuliveHandler(OAuthHandler):
    service = 'cybozulive'
    request_token_url = 'https://api.cybozulive.com/oauth/initiate'
    access_token_url = 'https://api.cybozulive.com/oauth/token'
    authorize_url = 'https://api.cybozulive.com/oauth/authorize'
    consumer_key = settings.CYBOZULIVE_CONSUMER_KEY
    consumer_secret = settings.CYBOZULIVE_CONSUMER_SECRET
    
    def get_account_info(self):
        resp, content = self.oauth_request("https://api.cybozulive.com/api/group/V2")
        if resp["status"] == "200":
            content = unicode(content,'utf-8')
            d = feedparser.parse(content)
            return d.feed.author_detail.email, None, None, content
        else:
            raise Exception("failed to verify credentials")


class LinkedInHandler(OAuthHandler):
    service = 'linkedin'
    request_token_url = 'https://api.linkedin.com/uas/oauth/requestToken'
    access_token_url = 'https://api.linkedin.com/uas/oauth/accessToken'
    authorize_url = 'https://www.linkedin.com/uas/oauth/authorize'
    consumer_key = settings.LINKEDIN_CONSUMER_KEY
    consumer_secret = settings.LINKEDIN_CONSUMER_SECRET
    
    def get_account_info(self):
        resp, content = self.oauth_request("http://api.linkedin.com/v1/people/~:(id,first-name,last-name,public-profile-url,picture-url,main-address)?format=json")
        if resp["status"] == "200":
            content = unicode(content,'utf-8')
            result = simplejson.loads(content)
            account_name = str(result["id"])
            display_name = result["firstName"]+' '+result["lastName"]
            return account_name, display_name, None, content
        else:
            raise Exception("failed to get current user.")


