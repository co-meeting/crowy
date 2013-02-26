#!/usr/bin/env python
# -*- coding: utf-8 -*-import sys

import re
import os
import time,datetime
from decimal import *
import mimetypes
from cStringIO import StringIO

import oauth2

import logging

from xml.sax import saxutils

from google.appengine.ext import webapp
from google.appengine.ext.webapp import template
from django.utils import translation
from django.conf import settings
from google.appengine.api import users
from lib.cookies import Cookies

import controller
from controller.model import User
from controller.session import Session, TempSession

class BaseHandler(webapp.RequestHandler):
    def initialize(self, request, response):
        webapp.RequestHandler.initialize(self, request, response)
        
        lang = request.get('lang')
        if lang:
            translation.activate(lang)
            return
        #main.pyでDBに保存された言語設定をクッキーに入れている。それを取得。Ajaxリクエスト時に使用
        lang = Cookies(self).get('lang')
        if not lang:
            #なければリクエストヘッダーから取得する
            self.request.COOKIES = Cookies(self)
            self.request.META = os.environ
            lang = translation.get_language_from_request(self.request)
        translation.activate(lang)
        
        self.is_ajax = self.request.headers.get("X-Requested-With") == "XMLHttpRequest"
        self.is_mobile = False
#        if not self.is_ajax:
#            mobile_useragents = r'iPhone|iPod|Android|dream|CUPCAKE|BlackBerry|webOS|incognito|webmate'
#            user_agent = self.request.headers["user-agent"]
#            self.is_mobile = re.search(mobile_useragents, user_agent) is not None
    
    def handle_exception(self, exception, debug_mode):
        if isinstance(exception, NotLoginError):
            if self.is_ajax:
                self.error(403)
                return self.response.out.write("notlogin")
            #
            self.request.COOKIES = Cookies(self)
            self.request.META = os.environ
            lang = translation.get_language_from_request(self.request)
            if self.is_mobile:
                view = '../view/m_index.html'
            elif lang == "ja":
                view = '../view/index.html'
            else:
                view = '../view/index-en.html'
            template_values = {
                'version' : controller.version,
                'production' : not controller.is_dev,
                'settings' : settings,
            }
            tmpl = os.path.join(os.path.dirname(__file__), view)
            return self.response.out.write(template.render(tmpl, template_values))
        logging.exception(exception)
        self.error(500)
        if self.is_ajax:
            return self.response.out.write("error")
        tmpl = os.path.join(os.path.dirname(__file__), '../view/500.html')
        return self.response.out.write(template.render(tmpl, {}))
    
    def check_login(self):
#        if self.check_2lo_oauth():
#            return
        self.session = Session(self.request, self.response)
        if not self.session.is_login():
            raise NotLoginError()
    
    def check_2lo_oauth(self):
        auth_header = self.request.headers.get("Authorization")
        if not auth_header:
            return False
        
        self.is_ajax = True
        
        user_id = self.request.get('xoauth_requestor_id')
        if not user_id:
            raise NotLoginError()
        
        try:
            # Builder our request object.
            request = oauth2.Request.from_request(
                self.request.method, self.request.path_url, self.request.headers, None,
                self.request.query)
        except Exception, e:
            logging.warn("Could not parse request from method = %s,"
                "uri = %s, headers = %s, query = %s, exception = %s" % (
                self.request.method, self.request.path_url, self.request.headers,
                self.request.query, e))
            raise NotLoginError()
        
        # Fetch the token from Cassandra and build our Consumer object.
        if request is None or 'oauth_consumer_key' not in request:
            logging.warn("Request is missing oauth_consumer_key.")
            raise NotLoginError()
        
        try:
            # Verify the two-legged request.
            server = oauth2.Server()
            server.add_signature_method(oauth2.SignatureMethod_HMAC_SHA1())
            server.verify_request(request, _get_consumer(request["oauth_consumer_key"]), None)
        except Exception, e:
            logging.warn("Could not verify signature (%s)." % e)
            raise NotLoginError()
        
        user = User.gql("WHERE user_id=:1", user_id).get()
        if not user:
            logging.warn("Specified user is not found. (%s)" % user_id)
            raise NotLoginError()
        session = TempSession(self.request, self.response)
        session.new(user)
        self.session = session
        
        return True

def need_login(fn):
    def check_login(_self, *args, **kw):
        _self.check_login()
        return fn(_self, *args, **kw)
    return check_login

class NotLoginError(Exception):
    pass

class MockConsumer(object):
    key = 'nc-3b0shbl19gm:e^w/xbtspng7e'
    secret = '/n@g93nc-.f]h^4hf1gs8cnvlg04.lz/g_n9573ffd0-b.ukwpq-a,f;-nt2vd91,dng'
#    key = 'key'
#    secret = 'secret'
 
def _get_consumer(key):
    return MockConsumer()

#-----------------------------------------------------------
#URL,ユーザー名のリンク化
#-----------------------------------------------------------
def escape_html(str):
    return saxutils.escape(str)

def replace_link(str, url="") :
    #URL
    str = re.sub("(http[s]?://[\w|/|\.|%|&|\?|=|\-|#|!|:|;|~]+)", r'<a href="\1" target="_blank">\1</a>', str)
    
    return replace_mention(str, url)

def replace_mention(str, url=""):
    #ユーザー名
    str = re.sub("@([\w|/|\.|%|&|\?|=|\-|#]+)", r'@<a href="%s\1" target="_blank">\1</a>' % url, str)
    #改行
    str = re.sub("\n", '<br/>', str)
    return str

# ハッシュタグのリンク化
def replace_hashtag(str, url="") :
    str = " "+str+" "
    #str = re.sub("([^\w|/|\.|%|&|\?|=|\-|\_])\#([\w|/|\.|%|&|\?|=|\-|\_]+)", r'\1<a href="%s%%23\2" target="_blank">#\2</a>' % url, str)
    str = re.sub(u"(?:#|\uFF03)([a-zA-Z0-9_\u3041-\u3094\u3099-\u309C\u30A1-\u30FA\u30FC\u3400-\uD7FF\uFF10-\uFF19\uFF20-\uFF3A\uFF41-\uFF5A\uFF66-\uFF9F]+)", r'<a href="%s%%23\1" target="_blank">#\1</a>' % url, str)
    return str

#-----------------------------------------------------------
#時間差を計算して時刻の文字列を生成
#-----------------------------------------------------------
def get_display_time(datetimeStr, format) :
    dtTarget = datetime.datetime.strptime(datetimeStr, format)
    return dtTarget.strftime("%a %b %d %H:%M:%S %Y")

def multipart_encode(params, files, boundary):
    CRLF = '\r\n'
    
    encode_string = StringIO()
    for (key, value) in params.items():
        encode_string.write('--' + boundary)
        encode_string.write(CRLF)
        encode_string.write('Content-Disposition: form-data; name="%s"' % key)
        encode_string.write(CRLF)
        encode_string.write(CRLF)
        encode_string.write(value.decode('utf-8'))
        encode_string.write(CRLF)
    for (key, filename, value) in files:
        encode_string.write('--' + boundary)
        encode_string.write(CRLF)
        encode_string.write('Content-Disposition: form-data; name="%s"; filename="%s"' % (key, filename))
        encode_string.write(CRLF)
        encode_string.write('Content-Type: %s' % (mimetypes.guess_type(filename)[0] or 'application/octet-stream'))
        encode_string.write(CRLF)
        encode_string.write(CRLF)
        encode_string.write(value.read())
        encode_string.write(CRLF)
    encode_string.write('--' + boundary + '--')
    encode_string.write(CRLF)
    encode_string.write(CRLF)
    body = encode_string.getvalue()
    return body
