#!/usr/bin/env python
# -*- coding: utf-8 -*-

__author__ = "Atsuhiko Kimura"

from google.appengine.ext import db
from google.appengine.ext import blobstore

class User(db.Expando):
    user_id = db.StringProperty() #set required=True after data migration
    name = db.StringProperty(required=True)
    mail = db.EmailProperty(required=True)
    service = db.StringProperty(required=True)
    access_token = db.StringProperty()
    google_user = db.UserProperty()
    created_at = db.DateTimeProperty(auto_now_add=True)
    last_access_time = db.DateTimeProperty()
    notification = db.BooleanProperty()
    lang = db.StringProperty()
    post_key = db.StringProperty()
    display_density = db.StringProperty()

class SessionStore(db.Model):
    user_ref = db.ReferenceProperty(User)
    sid = db.StringProperty(required=True)
    last_access_time = db.DateTimeProperty(auto_now_add=True)
    temporary = db.BooleanProperty(default=False)

class Account(db.Model):
    user_ref = db.ReferenceProperty(User)
    user = db.UserProperty() #Deprecated
    service = db.StringProperty(required=True)
    account_name = db.StringProperty()
    display_name = db.StringProperty()
    group_image_url = db.StringProperty()
    profile_image_url = db.StringProperty()
    account_info = db.TextProperty()
    request_token = db.StringProperty()
    access_token = db.StringProperty()
    refresh_token = db.StringProperty()
    secret = db.StringProperty()
    created = db.DateTimeProperty(auto_now_add=True)
    scope = db.StringProperty()

class Tab(db.Model):
    user_ref = db.ReferenceProperty(User)
    user = db.UserProperty() #Deprecated
    name = db.StringProperty(required=True)
    order = db.IntegerProperty(default=0, required=True)

class Column(db.Expando):
    user_ref = db.ReferenceProperty(User)
    user = db.UserProperty() #Deprecated
    name = db.StringProperty(required=True)
    order = db.IntegerProperty(default=0, required=True)
    tab = db.ReferenceProperty(Tab)
    service = db.StringProperty(required=True)
    account_name = db.StringProperty()
    account_label = db.StringProperty()
    href = db.LinkProperty()
    type = db.StringProperty()

class File(db.Model):
    user_ref = db.ReferenceProperty(User)
    user = db.UserProperty() #Deprecated
    name = db.StringProperty(required=True)
    blob_key = blobstore.BlobReferenceProperty()
    created = db.DateTimeProperty(auto_now_add=True)

class AddressShortcut(db.Model):
    user_ref = db.ReferenceProperty(User)
    user = db.UserProperty() #Deprecated
    name = db.StringProperty(required=True)
    address_info = db.TextProperty(required=True)
    font_color = db.StringProperty()
    background_color = db.StringProperty()
    order = db.IntegerProperty(default=0, required=True)
    created_at = db.DateTimeProperty(auto_now_add=True)
