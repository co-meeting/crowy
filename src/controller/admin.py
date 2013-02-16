#!/usr/bin/env python
# -*- coding: utf-8 -*-

__author__ = "Atsuhiko Kimura"

import logging
import os
import urllib
import sys
import re

from google.appengine.ext import webapp
from google.appengine.ext.webapp import template
from google.appengine.ext.webapp import util
from google.appengine.api import users
from google.appengine.ext import db
from google.appengine.api import taskqueue
from django.utils import simplejson

from controller.model import *
from controller.utils import BaseHandler

class AdminHandler(BaseHandler):
    def get(self, mode=""):
        if mode == 'yammerusers':
            csv = self.get_yammer_users()
            self.response.headers["Content-Type"] = "text/plain;charset=utf-8"
            return self.response.out.write(csv)
        tmpl = os.path.join(os.path.dirname(__file__), '../view/admin.html')
        return self.response.out.write(template.render(tmpl, {}))
    
    def post(self, mode=""):
        taskqueue.add(url='/admin/tasks/'+mode)
        self.redirect("/admin/")
    
    def get_yammer_users(self):
        self.count = 0
        def get_temp_yammer_users(key=None):
            temp_users = []
            limit = 100
            if key is None:
                accounts = Account.gql("WHERE service='yammer' ORDER BY __key__").fetch(limit)
            else:
                accounts = Account.gql("WHERE service='yammer' and __key__ > :1 ORDER BY __key__", key).fetch(limit)
            last_account = None
            for account in accounts:
                last_account = account
                if account.account_info is None:
                    continue
                self.count = self.count + 1
                account_info = simplejson.loads(account.account_info)
                temp_user = []
                temp_user.append('"'+account_info["network_name"].encode('utf-8')+'"' or "")
                temp_user.append('"'+account_info["full_name"].encode('utf-8')+'"' if account_info["full_name"] else "")
                temp_user.append('"'+account_info["name"].encode('utf-8')+'"' if account_info["name"] else "")
                if len(account_info["contact"]["email_addresses"]) > 0:
                    temp_user.append((account_info["contact"]["email_addresses"][0]['address']).encode('utf-8') or "")
                temp_user.append(str(account_info["stats"]["updates"]) or "")
                temp_user.append(str(account_info["stats"]["following"]) or "")
                temp_user.append(str(account_info["stats"]["followers"]) or "")
                temp_users.append(','.join(temp_user))
            logging.info("%s accounts were done" % self.count)
            if last_account is not None:
                temp_users.extend(get_temp_yammer_users(last_account.key()))
            return temp_users
        users = get_temp_yammer_users()
        logging.info("GetYammerUsers succeeded.")
        return "¥n".join(users)

class RemoveParentFromColumnTask(BaseHandler):
    count = 0
    def post(self):
        def remove_parent_from_column(key=None):
            limit = 100
            if key is None:
                tabs = Tab.gql("ORDER BY __key__").fetch(limit)
            else:
                tabs = Tab.gql("WHERE __key__ > :1 ORDER BY __key__", key).fetch(limit)
            last_tab = None
            for tab in tabs:
                self.count = self.count + 1
                columns = Column.gql("WHERE tab = :1", tab.key())
                for column in columns:
                    Column(
                        user=column.user,
                        name=column.name,
                        order=column.order,
                        tab=column.tab.key(),
                        service=column.service,
                        account_name=column.account_name,
                        type=column.type).put()
                    column.delete()
                last_tab = tab
            logging.info("%s tabs were done" % self.count)
            if last_tab is not None:
                remove_parent_from_column(last_tab.key())
        try:
            remove_parent_from_column()
            logging.info("RemoveParentFromColumnTask succeeded. %s tabs were processed." % self.count)
        except:
            logging.warn("RemoveParentFromColumnTask failed. %s tabs were processed." % self.count)
            logging.exception(sys.exc_info())

class CreateUserFromTab0Task(BaseHandler):
    count = 0
    skip_count = 0
    def post(self):
        def create_user_from_tab0(key=None):
            limit = 100
            if key is None:
                tabs = Tab.gql("WHERE order=0 ORDER BY __key__").fetch(limit)
            else:
                tabs = Tab.gql("WHERE order=0 and __key__ > :1 ORDER BY __key__", key).fetch(limit)
            last_tab = None
            for tab in tabs:
                user = tab.user
                last_tab = tab
                if User.gql("WHERE google_user=:1", user).get() is not None:
                    self.skip_count = self.skip_count + 1
                    #logging.info("%s is skipped.", user.email())
                    continue
                User(
                    name=user.nickname(),
                    mail=user.email(),
                    service='google',
                    access_token=None,
                    google_user=user
                ).put()
                self.count = self.count + 1
            logging.info("%s tabs were done" % self.count)
            if last_tab is not None:
                create_user_from_tab0(last_tab.key())
        try:
            create_user_from_tab0()
            logging.info("CreateUserFromTab0Task succeeded. %s users were created. %s users were skipped." % (self.count, self.skip_count))
        except:
            logging.warn("CreateUserFromTab0Task failed.  %s users were created. %s users were skipped." % (self.count, self.skip_count))
            logging.exception(sys.exc_info())

class RepairYammerAccountTask(BaseHandler):
    count = 0
    skip_count = 0
    delete_count = 0
    column_count = 0
    def post(self):
        def get_href(account_info, type):
            network_name = account_info["network_name"]
            if network_name not in account_info["network_domains"]:
                network_name = re.sub("[^a-zA-Z0-9]","",account_info["network_name"]).lower()
            return "https://www.yammer.com/"+network_name+"#/threads/index?type="+type;
        def repair_yammer_account(key=None):
            limit = 100
            if key is None:
                accounts = Account.gql("WHERE service='yammer' ORDER BY __key__").fetch(limit)
            else:
                accounts = Account.gql("WHERE service='yammer' and __key__ > :1 ORDER BY __key__", key).fetch(limit)
            last_account = None
            for account in accounts:
                last_account = account
                if account.account_info is None:
                    account.delete()
                    self.delete_count += 1
                    continue
                account_info = simplejson.loads(account.account_info)
                account_name = str(account_info["id"])
                display_name = (account_info["full_name"] or account_info["name"])+'/'+account_info["network_name"]
                if account_name != account.account_name:
                    account.account_name = account_name
                    account.display_name = display_name
                    account.put()
                    self.count += 1
                columns = Column.gql("WHERE service='yammer' and account_name=:1 and user=:2", account_info["network_name"], account.user)
                for column in columns:
                    column.account_name = account_name
                    column.href = get_href(account_info, column.type)
                    column.put()
                    self.column_count += 1
            logging.info("%s accounts were done" % self.count)
            if last_account is not None:
                repair_yammer_account(last_account.key())
        try:
            repair_yammer_account()
            logging.info("RepairYammerAccountTask succeeded. %s accounts were updated. %s users were skipped. %s accounts were deleted. %s columns were updated." % (self.count, self.skip_count, self.delete_count, self.column_count))
        except:
            logging.warn("RepairYammerAccountTask failed. %s accounts were updated. %s users were skipped. %s accounts were deleted. %s columns were updated." % (self.count, self.skip_count, self.delete_count, self.column_count))
            logging.exception(sys.exc_info())

class EnableNotificationTwitterTask(BaseHandler):
    count = 0
    def post(self):
        def enable_notification_twitter(key=None):
            limit = 100
            gql = "WHERE service='twitter' and type in ('mentions', 'direct_messages')"
            if key is None:
                columns = Column.gql(gql+" ORDER BY __key__").fetch(limit)
            else:
                columns = Column.gql(gql+" and __key__ > :1 ORDER BY __key__", key).fetch(limit)
            last_column = None
            for column in columns:
                self.count = self.count + 1
                column.notification = "true"
                column.put()
                last_column = column
            logging.info("%s columns were done" % self.count)
            if last_column is not None:
                enable_notification_twitter(last_column.key())
        try:
            enable_notification_twitter()
            logging.info("EnableNotificationTwitterTask succeeded. %s columns were processed." % self.count)
        except:
            logging.warn("EnableNotificationTwitterTask failed. %s columns were processed." % self.count)
            logging.exception(sys.exc_info())

class UpdateUserRefTask(BaseHandler):
    count = 0
    def post(self):
        def add_userid_to_user(key=None):
            limit = 100
            if key is None:
                self.count = 0
                users = User.gql("ORDER BY __key__").fetch(limit)
            else:
                users = User.gql("WHERE __key__ > :1 ORDER BY __key__", key).fetch(limit)
            last_user = None
            for user in users:
                self.count = self.count + 1
                user.user_id = user.google_user.user_id()
                user.put()
                last_user = user
            logging.info("%s users were done" % self.count)
            if last_user is not None:
                add_userid_to_user(last_user.key())
        def update_userref(model, key=None):
            limit = 100
            gql = "SELECT * FROM " + model
            if key is None:
                self.count = 0
                entities = db.GqlQuery(gql+" ORDER BY __key__").fetch(limit)
            else:
                entities = db.GqlQuery(gql+" WHERE __key__ > :1 ORDER BY __key__", key).fetch(limit)
            last_entity = None
            for entity in entities:
                self.count = self.count + 1
                user = User.gql("WHERE google_user = :1", entity.user).get()
                entity.user_ref = user
                entity.put()
                last_entity = entity
            logging.info("%s entities were done" % self.count)
            if last_entity is not None:
                update_userref(model, last_entity.key())
        try:
            add_userid_to_user()
            logging.info("%s users were processed." % self.count)
            update_userref("Column")
            logging.info("%s columns were processed." % self.count)
            update_userref("Tab")
            logging.info("%s tabs were processed." % self.count)
            update_userref("Account")
            logging.info("%s accounts were processed." % self.count)
            update_userref("File")
            logging.info("%s files were processed." % self.count)
            update_userref("AddressShortcut")
            logging.info("%s address shortcuts were processed." % self.count)
            logging.info("UpdateUserRefTask succeeded.")
        except:
            logging.warn("UpdateUserRefTask failed.")
            logging.exception(sys.exc_info())

def main():
    application = webapp.WSGIApplication([
                                          #('/admin/tasks/create_user_from_tab0', CreateUserFromTab0Task),
                                          #('/admin/tasks/remove_parent_from_column', RemoveParentFromColumnTask),
                                          #('/admin/tasks/repair_yammer_account', RepairYammerAccountTask),
                                          #('/admin/tasks/enable_notification_twitter', EnableNotificationTwitterTask),
                                          #('/admin/tasks/update_userref', UpdateUserRefTask),
                                          ('/admin/(.*)', AdminHandler)
                                          ],
                                         debug=True)
    util.run_wsgi_app(application)


if __name__ == '__main__':
    main()
