#!/usr/bin/env python
# -*- coding: utf-8 -*-

__author__ = "Atsuhiko Kimura"

import sys
stdin = sys.stdin
stdout = sys.stdout
reload(sys)
#sys.setdefaultencoding('utf-8')
sys.stdin = stdin
sys.stdout = stdout

import logging
import os
import urllib
import datetime
import re
import random
import webapp2 as webapp
#from google.appengine.ext import webapp

from google.appengine.ext import blobstore
from google.appengine.ext.webapp import blobstore_handlers
from google.appengine.ext.webapp import template
from google.appengine.ext.webapp import util
from google.appengine.api import urlfetch
from google.appengine.ext import db
from google.appengine.runtime.apiproxy_errors import CapabilityDisabledError

from django.utils import simplejson

# For i18n
os.environ['DJANGO_SETTINGS_MODULE'] = 'conf.settings'
from django.conf import settings
from django.utils import translation
from lib.cookies import Cookies
# Force Django to reload settings
settings._target = None

import controller
from controller import oauth,twitter,youroom,yammer,facebook,chatter,cybozulive,linkedin,rss,model,googlelogin,googleplus
from controller.model import *
from controller.utils import *

class MainHandler(BaseHandler):
    @need_login
    def get(self, mode=""):
        if mode == "logout":
            self.session.destroy()
            
            logout_google = self.request.get('google')
            user = users.get_current_user()
            if logout_google == '1' and user is not None:
                self.redirect(users.create_logout_url('/'))
                return
            
            self.redirect('/')
            return
        
        user = self.session.get_user()
        if user is None:
            self.redirect('/logout')
            return
        
        self.session.update_cookie()
        
        # last_access_timeを記録
        user.last_access_time = datetime.datetime.now()
        try:
            user.put()
        except CapabilityDisabledError:
            logging.warn('Datastore writes are temporarily unavailable.')
        
        if user.lang:
            translation.activate(user.lang)
            Cookies(self).set_cookie('lang', user.lang)
        
        tabs = Tab.gql("WHERE user_ref = :1 ORDER BY order", user.key())
        if tabs.count() == 0:
            Tab(
                user_ref=user,
                name="Home",
                order=0).put()
            tabs = Tab.gql("WHERE user_ref = :1", user.key())
        
        formated_tabs = []
        for tab in tabs:
            formated_tab = {
                "key": str(tab.key()),
                "name": tab.name,
                "order":tab.order,
                "columns":[]
            }
            columns = Column.gql("WHERE tab =:1 ORDER BY order", tab.key())
            for column in columns:
                prefs = {}
                for prop_name in column.dynamic_properties():
                    prefs[prop_name] = getattr(column, prop_name)
                formated_tab["columns"].append({
                    "key": str(column.key()),
                    "name": column.name,
                    "service": column.service,
                    "account_name": column.account_name,
                    "account_label": column.account_label,
                    "type": column.type,
                    "order": column.order,
                    "href": column.href or None,
                    "prefs": prefs
                })
            formated_tabs.append(formated_tab)
        
        expand_url_num = 0 if controller.is_dev else random.randint(0, 5)
        logging.info(formated_tabs)
        template_values = {
            'user': user,
            'tabs': simplejson.dumps(formated_tabs),
            'version' : controller.version,
            'production' : not controller.is_dev,
            'expand_url' : settings.EXPAND_URL_SERVICE_URL % expand_url_num,
            'static_url' : "/static/" if controller.is_dev else settings.STATIC_FILE_SERVER_URL,
            'ad_html' : re.sub(r'\s', ' ', settings.AD_HTML).replace('"', '\'')
        }
        view = '../view/m_main.html' if self.is_mobile else '../view/main.html'
        tmpl = os.path.join(os.path.dirname(__file__), view)
        return self.response.out.write(template.render(tmpl, template_values))

class MobileHandler(BaseHandler):
    @need_login
    def get(self, mode=""):
        user_id = self.request.get('xoauth_requestor_id')
        user = self.session.get_user()
        logging.info(user_id)
        logging.info(user.user_id)
        if user_id != user.user_id:
            self.error(403);
            return;
        tmpl = os.path.join(os.path.dirname(__file__), '../view/m_home.html')
        return self.response.out.write(template.render(tmpl, {'user':user}))

class TabHandler(BaseHandler):
    @need_login
    def post(self, mode=""):
        user = self.session.get_user()
        if mode == "add":
            name = self.request.get('name')
            order = int(self.request.get('order'))
            key =Tab(
                user_ref=user,
                name=name,
                order=order).put()
            self.response.out.write(key)
            return
        elif mode == "delete":
            key = db.Key(self.request.get('id'))
            tab = Tab.get(key)
            columns = Column.gql("WHERE tab = :1 and user_ref = :2", key, user.key())
            db.delete(columns)
            tab.delete()
            #db.run_in_transaction(self.delete_tab, tab)
            self.response.out.write("Tab is deleted.")
            return
        elif mode == "sort":
            tabs = self.request.get('tabs').split(",")
            #TODO トランザクション
            for order, key in enumerate(tabs):
                tab = Tab.get(db.Key(key))
                tab.order = order
                tab.put()
            self.response.out.write("The order of tabs is updated.")
            return
        elif mode == "rename":
            key = db.Key(self.request.get('id'))
            tab = Tab.get(key)
            tab.name = self.request.get('name')
            tab.put()
            self.response.out.write("Tab is renamed.")
            return
        self.error(400)
    def delete_tab(self, tab):
        columns = Column.gql("WHERE ANCESTOR IS :parent", parent=tab)
        db.delete(columns)
        tab.delete()

class ColumnHandler(BaseHandler):
    @need_login
    def post(self, mode=""):
        user = self.session.get_user()
        if mode == "add":
            name = self.request.get('name')
            order = int(self.request.get('order'))
            tab_key = db.Key(self.request.get('tabId'))
            service = self.request.get('service')
            original_account = self.request.get('original_account')
            account_name = self.request.get('account_name')
            account_label = self.request.get('account_label')
            type = self.request.get('type')
            notification = self.request.get('notification')
            get_href = None
            try:
                get_href = eval(service+".get_href")
            except:
                get_href = None
            href = get_href(user, account_name, type) if get_href is not None else None
            
            try:
                before_add_column = eval(service+".before_add_column")
                before_add_column(user, original_account, account_name)
            except:
                pass
            
            column = Column(
                user_ref=user,
                name=name,
                order=order,
                tab=tab_key,
                service=service,
                account_name=account_name,
                account_label=account_label,
                type=type)
            if href is not None:
                column.href = href
            if notification:
                column.notification = "true"
            column.put()
            prefs = {}
            for prop_name in column.dynamic_properties():
                prefs[prop_name] = getattr(column, prop_name)
            column_dict = {
                "key": str(column.key()),
                "name": column.name,
                "service": column.service,
                "account_name": column.account_name,
                "account_label": column.account_label,
                "type": column.type,
                "order": column.order,
                "href": column.href or None,
                "prefs": prefs
            }
            self.response.headers["Content-Type"] = "application/json"
            self.response.out.write(simplejson.dumps(column_dict))
            return
        elif mode == "delete":
            key = db.Key(self.request.get('id'))
            Column.get(key).delete()
            self.response.out.write("Column is deleted.")
            return
        elif mode == "sort":
            tab_key_str = self.request.get('tabId')
            tab_key = db.Key(tab_key_str) if tab_key_str != "" else None
            columns = self.request.get('columns').split(",")
            #TODO トランザクション
            for order, key in enumerate(columns):
                column = Column.get(db.Key(key))
                column.order = order
                if tab_key is not None and column.tab.key() != tab_key:
                    column.tab = tab_key
                column.put()
            self.response.out.write("The order of columns is updated.")
            return
        elif mode == "rename":
            key = db.Key(self.request.get('id'))
            name = self.request.get('name')
            column = Column.get(key)
            column.name = name
            column.put()
            self.response.out.write("Column is renamed.")
            return
        elif mode == "updateprefs":
            key = db.Key(self.request.get('id'))
            column = Column.get(key)
            for name, value in self.request.str_params.items():
                if name != 'id':
                    setattr(column, name, value)
            column.put()
            self.response.out.write("Preferences of column was updated.")
            return
        self.error(400)

class AccountHandler(BaseHandler):
    @need_login
    def get(self, action=""):
        user = self.session.get_user()
        accounts = oauth.Account.gql("WHERE user_ref = :1", user.key())
        profiles = {}
        service_names = ["youroom", "yammer", "twitter", "facebook", "linkedin", "chatter", "cybozulive"]
        for service_name in service_names:
            try:
                profiles[service_name] = eval(service_name+".get_profiles(accounts)")
            except:
                logging.exception(sys.exc_info())
        self.response.headers["Content-Type"] = "application/json"
        self.response.out.write(simplejson.dumps(profiles))
        return
    
    @need_login
    def post(self, action=""):
        user = self.session.get_user()
        if action == "remove":
            service = self.request.get('service')
            name = self.request.get('name')
            accounts = oauth.Account.gql("WHERE user_ref = :1 and service = :2 and account_name = :3",
                user.key(), service, name)
            db.delete(accounts)
            columns = Column.gql("WHERE user_ref = :1 and service = :2 and account_name = :3",
                user.key(), service, name)
            db.delete(columns)
            self.response.out.write("account "+service+"/"+name+" was deleted.")
            return
        if action == "removecache":
            accounts = oauth.Account.gql("WHERE user_ref = :1 and access_token = :2",
                user.key(), None)
            db.delete(accounts)
            self.response.out.write("All invalid accounts are deleted.")
            return
        self.error(400)

class UploadHandler(blobstore_handlers.BlobstoreUploadHandler, BaseHandler):
    @need_login
    def get(self, action=""):
        if action == "createurl":
            self.response.out.write(blobstore.create_upload_url('/file/upload'))
            return
        if action == "complete":
#            result = {
#                'success': True,
#                'name': self.request.get('name'),
#                'key': self.request.get('key')
#            }
#            self.response.out.write(simplejson.dumps(result))
            self.response.out.write(self.request.get('key'))
            return
        self.error(400)
    
    @need_login
    def post(self, action=""):
        user = self.session.get_user()
        if action == "upload":
            upload = self.get_uploads()[0]
            file = model.File(
                user_ref=user,
                name=upload.filename,
                blob_key=upload.key())
            db.put(file)
            self.redirect('/file/complete?key=%s&name=%s' % (upload.key(), file.name))
            return
        elif action == "delete":
            keys = self.request.get_all('key[]')
            files = model.File.gql("WHERE user_ref = :1", user.key())
            for f in files:
                if f.blob_key:
                    if not str(f.blob_key.key()) in keys:
                        continue
                    f.blob_key.delete()
                f.delete()
            self.response.out.write("All temporary files are deleted.")
            return
        self.error(400)

class DownloadHandler(blobstore_handlers.BlobstoreDownloadHandler):
    def get(self, resource):
        resource = str(urllib.unquote(resource))
        blob_info = blobstore.BlobInfo.get(resource)
        self.send_blob(blob_info)

class UrlHandler(BaseHandler):
    @need_login
    def get(self, action=""):
        url = self.request.get("url")
        try: #bit.ly
            result = urllib.urlopen("http://api.bit.ly/v3/shorten?login=crowy&apiKey=R_57bab6c0fb01da4e1e0a5e22f73c3a4a&format=json&longUrl=%s" % urllib.quote(url)).read()
            json = simplejson.loads(result)
            if json['status_code'] == 200:
                self.response.out.write(json['data']['url'])
                return
            else:
                logging.warn(result)
        except:
            logging.warn("Unexpected error.")
        try: #goo.gl
            api_url = 'https://www.googleapis.com/urlshortener/v1/url?key=AIzaSyBRoz9ItBIQgHwWbZbmkF45dFiRKub2XzI&userip='+self.request.remote_addr
            post_data = simplejson.dumps({'longUrl':url})
            result = urlfetch.fetch(url=api_url,
                        payload=post_data,
                        method=urlfetch.POST,
                        headers={'Content-Type': 'application/json'})
            if result.status_code == 200:
                result = simplejson.loads(result.content)
                self.response.out.write(result['id'])
                return
            else:
                logging.warn(result.content)
        except:
            logging.warn("Unexpected error.")
        try:#tinyurl
            short_url = urllib.urlopen("http://tinyurl.com/api-create.php?url=%s" % urllib.quote(url))
            self.response.out.write(short_url.read())
            return
        except:
            logging.warn("Unexpected error.")
        self.error(400)

class AdHandler(BaseHandler):
    @need_login
    def get(self, action=""):
        url = self.request.get("url")
        if url:
            tmpl = os.path.join(os.path.dirname(__file__), '../view/ad.html')
            template_values = {'url':url}
            return self.response.out.write(template.render(tmpl, template_values))
        self.error(400)

class RakutenHandler(BaseHandler):
    @need_login
    def get(self, action=""):
        params = dict(self.request.GET.items())
        params["developerId"] = "ce1bef834c994393a744eb2a442ad1d3"
        params["version"] = "2010-08-05"
        query = urllib.urlencode(params)
        logging.info(query)
        rakuten_url = "http://api.rakuten.co.jp/rws/3.0/json?"+query
        result = urlfetch.fetch(url=rakuten_url)
        return self.response.out.write(result.content)

class AddressShortcutHandler(BaseHandler):
    @need_login
    def get(self, action=""):
        user = self.session.get_user()
        shortcuts = AddressShortcut.gql("WHERE user_ref = :1 ORDER BY order", user.key())
        shortcut_array = []
        for s in shortcuts:
            shortcut_array.append({
                                   "key": str(s.key()),
                                   "name": s.name,
                                   "info": simplejson.loads(s.address_info),
                                   "fontColor": s.font_color,
                                   "backgroundColor": s.background_color
                                   })
        self.response.headers["Content-Type"] = "application/json"
        self.response.out.write(simplejson.dumps(shortcut_array))
    
    @need_login
    def post(self, action=""):
        user = self.session.get_user()
        if action == 'add':
            name = self.request.get("name")
            address_info = self.request.get("address_info")
            shortcut = AddressShortcut(
                user_ref=user,
                name=name,
                address_info=address_info)
            shortcut.put()
            self.response.out.write("AddressShortcut was added.")
            return
        if action == 'delete':
            key = db.Key(self.request.get('id'))
            AddressShortcut.get(key).delete()
            self.response.out.write("AddressShortcut is deleted.")
            return
        if action == 'rename':
            key = db.Key(self.request.get('id'))
            shortcut = AddressShortcut.get(key)
            shortcut.name = self.request.get('name')
            shortcut.put()
            self.response.out.write("AddressShortcut is renamed.")
            return
        if action == 'color':
            key = db.Key(self.request.get('id'))
            shortcut = AddressShortcut.get(key)
            shortcut.background_color = self.request.get('background')
            shortcut.font_color = self.request.get('font')
            shortcut.put()
            self.response.out.write("AddressShortcut is renamed.")
            return
        self.error(400)

class UserSettingsHandler(BaseHandler):
    @need_login
    def get(self, action=""):
        user = self.session.get_user()
        if action == 'basic':
            tmpl = os.path.join(os.path.dirname(__file__), '../view/settings_basic.html')
            template_values = {
                               'user': user,
                               'lang': user.lang or translation.get_language(),
                               'post_key': user.post_key or 'shift',
                               'display_density': user.display_density or 'normal'
                               }
            return self.response.out.write(template.render(tmpl, template_values))
        self.error(400)
    
    @need_login
    def post(self, action=""):
        user = self.session.get_user()
        if user is None:
            self.error(400)
            return
        if action == "update":
            for name, value in self.request.str_params.items():
                if not name.startswith('type_'):
                    type = self.request.get('type_'+name)
                    if type is not None:
                        if type == 'bool':
                            value = value == 'true'
                    setattr(user, name, value)
            user.put();
            self.session.delete_cache()
            self.response.out.write("update user settings")
            return
        self.error(400)

class I18nResourcesHandler(BaseHandler):
    def get(self, action=""):
        self.response.headers["Content-Type"] = "text/javascript"
        view = '../view/i18n_js.html'
        tmpl = os.path.join(os.path.dirname(__file__), view)
        return self.response.out.write(template.render(tmpl, {}))


application = webapp.WSGIApplication([
                                      ('/twitter/(.*)/(.*)/(.*)', twitter.TwitterHandler),
                                      ('/twitter/(.*)/(.*)', twitter.TwitterHandler),
                                      ('/twitter/(.*)', twitter.TwitterHandler),
                                      ('/youroom/(.*)/(.*)/(.*)', youroom.YouRoomHandler),
                                      ('/youroom/(.*)/(.*)', youroom.YouRoomHandler),
                                      ('/youroom/(.*)', youroom.YouRoomHandler),
                                      ('/yammer/(.*)/(.*)/(.*)', yammer.YammerHandler),
                                      ('/yammer/(.*)/(.*)', yammer.YammerHandler),
                                      ('/yammer/(.*)', yammer.YammerHandler),
                                      ('/facebook/(login|oauth|mlogin)', facebook.FacebookLoginHandler),
                                      ('/facebook/(.*)/(.*)/(.*)', facebook.FacebookHandler),
                                      ('/facebook/(.*)/(.*)', facebook.FacebookHandler),
                                      ('/facebook/(.*)', facebook.FacebookHandler),
                                      ('/chatter/(.*)/(.*)/(.*)', chatter.ChatterHandler),
                                      ('/chatter/(.*)/(.*)', chatter.ChatterHandler),
                                      ('/chatter/(.*)', chatter.ChatterHandler),
                                      ('/cybozulive/(.*)/(.*)/(.*)', cybozulive.CybozuliveHandler),
                                      ('/cybozulive/(.*)/(.*)', cybozulive.CybozuliveHandler),
                                      ('/cybozulive/(.*)', cybozulive.CybozuliveHandler),
                                      ('/linkedin/(.*)/(.*)/(.*)', linkedin.LinkedInHandler),
                                      ('/linkedin/(.*)/(.*)', linkedin.LinkedInHandler),
                                      ('/linkedin/(.*)', linkedin.LinkedInHandler),
                                      ('/rss/([^/]*)/?', rss.RssHandler),
                                      ('/googleplus/([^/]*)/?', googleplus.GooglePlusHandler),
                                      ('/oauth/twitter/(\w*)', oauth.TwitterHandler),
                                      ('/oauth/youroom/(\w*)', oauth.YouRoomHandler),
                                      ('/oauth/yammer/(\w*)', oauth.YammerHandler),
                                      ('/oauth/cybozulive/(\w*)', oauth.CybozuliveHandler),
                                      ('/oauth/linkedin/(\w*)', oauth.LinkedInHandler),
                                      ('/tab/(\w*)', TabHandler),
                                      ('/column/(\w*)', ColumnHandler),
                                      ('/account/(\w*)', AccountHandler),
                                      ('/file/(\w*)', UploadHandler),
                                      #('/download/(.*)', DownloadHandler),
                                      ('/url', UrlHandler),
                                      ('/url/([\w\.]*)', UrlHandler),
                                      ('/ad', AdHandler),
                                      ('/shortcut/([\w\.]*)', AddressShortcutHandler),
                                      ('/settings/([\w\.]*)', UserSettingsHandler),
                                      ('/i18n.js', I18nResourcesHandler),
                                      ('/login', googlelogin.GoogleLoginHandler),
                                      ('/google/(mlogin)', googlelogin.GoogleLoginHandler),
                                      ('/rakuten', RakutenHandler),
                                      ('/mhome', MobileHandler),
                                      ('/(home|logout|top)', MainHandler),
                                      ('/', MainHandler)
                                      ],
                                     debug=False)
  



