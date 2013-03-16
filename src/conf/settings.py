# -*- coding: utf-8 -*-
import os



# Valid languages
LANGUAGES = (
    # 'en', 'zh_TW' should match the directories in conf/locale/*
    ('en', 'English'),
    ('es', 'Espanol'),
    ('ja', '日本語'),
    ('zh_CN', '中文(?体)'),
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

#Django関連設定

#デバッグﾓｰﾄﾞ。環境変数をベースに自動的にモード変更。controller/main.pyも参考
DEBUG = os.environ.get('SERVER_SOFTWARE', '').startswith('Development')
TEMPLATE_DEBUG = DEBUG

#テンプレート
TEMPLATE_LOADERS = (
    'django.template.loaders.filesystem.Loader',
    #'django.template.loaders.app_directories.Loader',
#     'django.template.loaders.eggs.Loader',
)

TEMPLATE_DIRS = (
    # Put strings here, like "/home/html/django_templates" or "C:/www/django/templates".
    # Always use forward slashes, even on Windows.
    # Don't forget to use absolute paths, not relative paths.
    os.path.abspath(os.path.dirname(__file__)) + '/../view',
)


#国際化

USE_I18N = True
USE_L10N = True
LOCALE_PATHS = (
     os.path.abspath(os.path.dirname(__file__)) + '/locale',
)
