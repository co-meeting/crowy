#!/usr/bin/env python
# -*- coding: utf-8 -*-import sys

import urllib
import os
import datetime
import logging

from cgi import parse_qsl

from lib import feedparser

from google.appengine.ext import webapp
from controller.utils import template
from google.appengine.api import memcache
from django.utils import simplejson

from controller import utils
from controller.utils import BaseHandler,need_login

class RssHandler(BaseHandler):
    @need_login
    def get(self, action=""):
        if action == "messages":
            url = self.request.get('type')
            d = memcache.get(url)
            if d is None:
                result = urllib.urlopen(url)
                d = feedparser.parse(result)
                memcache.set(url, d, 2*60) #2分キャッシュ
                #RSSの形式が規格外の場合
                #if d.bozo == 1:
                #    raise Exception("Can not parse given URL.")
            response = {
                "title": d.feed.get("title"),
                "link": d.feed.get("link"),
                "feed_url": url,
                "messages": []
            }
            for entry in d.entries:
                response["messages"].append({
                    "title": entry.get("title"),
                    "link": entry.get("link"),
                    "updated": datetime.datetime(*entry.updated_parsed[:6]).strftime("%a %b %d %H:%M:%S %Y")
                })
            feed_json = simplejson.dumps(response)
            self.response.headers["Cache-Control"] = "public, max-age=120"
            self.response.headers["Content-Type"] = "application/json"
            return self.response.out.write(feed_json)
        elif action == "add_column":
            tmpl = os.path.join(os.path.dirname(__file__), "../view/rss_add_column.html")
            return self.response.out.write(template.render(tmpl, {}))
        self.error(400)