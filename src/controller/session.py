#!/usr/bin/env python
# -*- coding: utf-8 -*-import sys

import os
import time
import random
import hashlib
from datetime import datetime, timedelta

from google.appengine.ext import db
from google.appengine.api import memcache
from controller.model import SessionStore

DEFAULT_SID_NAME = '__sid'
TEMPORARY_NAME = '__t'

class Session():

    def __init__(self, req, res, sid_name=DEFAULT_SID_NAME):
        self.sid_name = sid_name
        self.req = req
        self.res = res
        if sid_name in req.cookies:
            self.sid_value = req.cookies[sid_name]
        else:
            self.sid_value = ''
        self.temporary = True if req.cookies.get(TEMPORARY_NAME) else False

    def new(self, user, ssl=False):
        random.seed()
        random_str = str(random.random()) + str(random.random())
        random_str = random_str + str(time.time())
        random_str = random_str + os.environ['REMOTE_ADDR']

        self.sid_value = hashlib.sha256(random_str).hexdigest()

        self.set_cookie(ssl)

        old_ssn = SessionStore.gql('WHERE user_ref=:1 and last_access_time < :2', user.key(), datetime.now() - timedelta(days=7))
        db.delete(old_ssn)
        
        ssn_db = SessionStore(sid=self.sid_value, user_ref=user, temporary=self.temporary)
        ssn_db.put()
        
        self.set_cache(ssn_db)

        return self.sid_value

    def destroy(self):
        ssn = SessionStore.gql('WHERE sid=:1', self.sid_value)
        db.delete(ssn)
        
        self.delete_cache()

        expires = time.strftime("%a, %d-%b-%Y %H:%M:%S GMT", time.gmtime(0))
        cookie_val = str(self.sid_name + '=null' + ';expires=' + expires)
        self.res.headers.add_header('Set-Cookie', cookie_val)
    
    def set_cookie(self, ssl=False):
        cookie_val = self.sid_name + '=' + self.sid_value + ";path=/"
        
        if not self.temporary:
            one_week = datetime.now() + timedelta(days=7)
            expires = one_week.strftime("%a, %d-%b-%Y %H:%M:%S GMT")
            cookie_val += ';expires=' + expires
        
        if ssl:
            cookie_val += ';secure'
        cookie_val = str(cookie_val)
        self.res.headers.add_header('Set-Cookie', cookie_val)
        self.res.headers.add_header(
            "P3P",
            "CP=CAO PSA OUR"
        )

        return self.sid_value
    
    def update_cookie(self, ssl=False):
        if not self.temporary:
            self.set_cookie(ssl)
    
    def get_cache_key(self):
        return "session_" + self.sid_value
    
    def get_user_cache_key(self):
        return "session_user_" + self.sid_value
    
    def set_cache(self, session):
        memcache.set(self.get_cache_key(), session, 5*60) # 5 minutes
        memcache.set(self.get_user_cache_key(), session.user_ref, 5*60)
    
    def delete_cache(self):
        memcache.delete(self.get_cache_key())
        memcache.delete(self.get_user_cache_key())
    
    def get_session(self):
        cache_key = self.get_cache_key()
        ssn = memcache.get(cache_key)
        if ssn is not None:
            return ssn
        ssn = SessionStore.gql('WHERE sid=:1', self.sid_value).get()
        if ssn:
            self.set_cache(ssn)
            now = datetime.now()
            if not ssn.last_access_time or ssn.last_access_time < now - timedelta(days=1):
                ssn.last_access_time = now
                ssn.put()
        return ssn

    def get_data(self, k):
        ssn = self.get_session()
        return ssn._dynamic_properties[k]

    def set_data(self, k, v):
        ssn = self.get_session()
        ssn._dynamic_properties[k] = v

        ssn.put()
    
    def get_user(self):
        cache_key = self.get_user_cache_key()
        user = memcache.get(cache_key)
        if user:
            return user
        ssn = self.get_session()
        self.set_cache(ssn)
        return ssn.user_ref

    def is_login(self):
        ssn = self.get_session()
        if ssn:
            return True
        else:
            return False

class TempSession():
    def __init__(self, req, res):
        return

    def new(self, user, ssl=False):
        self.user = user

    def destroy(self):
        return
    
    def set_cookie(self, ssl=False):
        return
    
    def update_cookie(self, ssl=False):
        return
    
    def get_session(self):
        return

    def get_data(self, k):
        return

    def set_data(self, k, v):
        return;
    
    def get_user(self):
        return self.user

    def is_login(self):
        if self.user:
            return True
        else:
            return False