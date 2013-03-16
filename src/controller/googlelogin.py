#!/usr/bin/env python
# -*- coding: utf-8 -*-

__author__ = "Atsuhiko Kimura"

import logging
import datetime

from webapp2_extras.appengine.users import login_required
from google.appengine.api import users

from controller.model import User
from controller.utils import BaseHandler
from controller.session import Session

class GoogleLoginHandler(BaseHandler):
    @login_required
    def get(self, mode=""):
        google_user = users.get_current_user()
        
        if google_user is None:
            self.redirect(users.create_login_url('/login'))
        
        # last_access_timeを記録
        user = User.gql("WHERE user_id=:1 and service=:2", google_user.user_id(), "google").get()
        if user is None:
            user = User(
                user_id=google_user.user_id(),
                name=google_user.nickname(),
                mail=google_user.email(),
                service='google',
                access_token=None,
                google_user=google_user,
                post_key='control',
                last_access_time=datetime.datetime.now()
            )
            user.put()
        
        session = Session(self.request, self.response)
        session.new(user)
        if mode == 'mlogin':
            self.redirect('/mhome?xoauth_requestor_id='+user.user_id)
            return
        self.redirect('/')
