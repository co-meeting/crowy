#!/usr/bin/env python
# -*- coding: utf-8 -*-import sys

import urllib
import os
import logging

from google.appengine.ext import webapp
from controller.utils import template
from google.appengine.api import memcache
from google.appengine.api import urlfetch
from django.utils import simplejson
from django.conf import settings

from controller import utils
from controller.utils import BaseHandler,need_login

class GooglePlusHandler(BaseHandler):
    @need_login
    def get(self, action=""):
        if action == "messages":
            type = self.request.get('type')
            query = {"key":settings.GOOGLEPLUS_API_KEY}
            pageToken = self.request.get('pageToken')
            if pageToken:
                query["pageToken"] = pageToken
            if type.startswith("search/"):
                url = "https://www.googleapis.com/plus/v1/activities"
                query["query"] = type.split('/',1)[1]
                #url += "?" + urllib.urlencode(query)念のためコメントアウト
                url += "?" + utils.encoded_urlencode(query)
                json = memcache.get(url)
                if json is None:
                    response = urlfetch.fetch(url)
                    logging.info(response.content)
                    json = simplejson.loads(response.content)
#                    memcache.set(url, json, 2*60) #2分キャッシュ
                result_json = {
                    'service': 'googleplus',
                    'nextPageToken': json.get('nextPageToken'),
                    'messages': json.get("items")
                }
                self.response.headers["Cache-Control"] = "public, max-age=120"
                self.response.headers["Content-Type"] = "application/json"
                return self.response.out.write(simplejson.dumps(result_json))
            self.error(400)
        elif action == "add_column":
            tmpl = os.path.join(os.path.dirname(__file__), "../view/googleplus_add_column.html")
            return self.response.out.write(template.render(tmpl, {}))
        self.error(400)