# -*- coding: utf-8 -*-
USE_I18N = True

# Valid languages
LANGUAGES = (
    # 'en', 'zh_TW' should match the directories in conf/locale/*
    ('en', 'English'),
    ('es', 'Español'),
    ('ja', '日本語'),
    ('zh_CN', '中文(简体)'),
    )

# This is a default language
LANGUAGE_CODE = 'en'

# 各アプリケーションキー
TWITTER_CONSUMER_KEY = 'XXXXXXXXXXXXXXXXXXXXXXXXXX'
TWITTER_CONSUMER_SECRET = 'XXXXXXXXXXXXXXXXXXXXXXXXXX'

YOUROOM_CONSUMER_KEY = 'XXXXXXXXXXXXXXXXXXXXXXXXXX'
YOUROOM_CONSUMER_SECRET = 'XXXXXXXXXXXXXXXXXXXXXXXXXX'

YAMMER_CONSUMER_KEY = 'XXXXXXXXXXXXXXXXXXXXXXXXXX'
YAMMER_CONSUMER_SECRET = 'XXXXXXXXXXXXXXXXXXXXXXXXXX'

CYBOZULIVE_CONSUMER_KEY = 'XXXXXXXXXXXXXXXXXXXXXXXXXX'
CYBOZULIVE_CONSUMER_SECRET = 'XXXXXXXXXXXXXXXXXXXXXXXXXX'

LINKEDIN_CONSUMER_KEY = 'XXXXXXXXXXXXXXXXXXXXXXXXXX'
LINKEDIN_CONSUMER_SECRET = 'XXXXXXXXXXXXXXXXXXXXXXXXXX'

FACEBOOK_APP_ID = "XXXXXXXXXXXXXXXXXXXXXXXXXX"
FACEBOOK_APP_SECRET = "XXXXXXXXXXXXXXXXXXXXXXXXXX"

GOOGLEPLUS_API_KEY = "XXXXXXXXXXXXXXXXXXXXXXXXXX"

CHATTER_CLIENT_ID = "XXXXXXXXXXXXXXXXXXXXXXXXXX"
CHATTER_CLIENT_SECRET = "XXXXXXXXXXXXXXXXXXXXXXXXXX"

# Twitter検索プロキシ（devでは使用しない）
TWITTER_SEARCH_PROXY_URL = "http://twitter-search-proxy%s.example.com/"

# 短縮URL展開サービスURL
EXPAND_URL_SERVICE_URL = "http://expand-url%s.example.com/"

# 静的ファイル配置サーバー（devでは使用しない）
STATIC_FILE_SERVER_URL = "http://static.example.com/"

# お知らせを表示する際のクッキーのキー（表示しないときは空文字を指定）
INFORMATION_COOKIE_KEY = ""

# フッターのメッセージ
FOOTER_MESSAGE = ""

# 広告HTML
AD_HTML = """
<div style='font-size:24px;padding-top:40px;font-style:italic;color:#999;'>This is an advertisement area.</div>
"""