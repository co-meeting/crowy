![Crowy Banner](https://raw.github.com/co-meeting/crowy/master/chrome-web-store/images/crowy-banner2-xl.png)

Crowy - Social Communication Dashboard
=======================================

Crowy is a communication dashboard supports multiple group communications services, incluging Twitter (with hashtag support), Facebook profile/page/group, Yammer, LinkedIn, Cybozu Live and youRoom.

Help us!
-------------
Now [Crowy.net](http://www.crowy.net/) is not able to continue its service. We make Crowy as an open-source, and looking for volunteers to make Crowy continue. ( for details :[English](https://github.com/co-meeting/crowy/wiki/Now-Crowy-is-not-able-to-continue-its-service) / [Japanese](http://crowyjp.wordpress.com/2013/02/18/crowy-oss/) ）


Support Services
-------------
- Twitter
- Facebook
- Yammer
- LinkedIn
- Cybozu Live
- youRoom
- RSS

Dependencies
-------------

- This app is designed to run in the [Google App Engine](https://developers.google.com/appengine/).
- It depends on **Python 2.5.x**.

Quick Start
-------------

### 1. Setup App Engine environment

Set up the development environment for Google App Engine/Python. ([Show here](https://developers.google.com/appengine/docs/python/gettingstarted/devenvironment))

### 2. Configuration
Edit src/conf/settings.py and configure TWITTER_CONSUMER_KEY and other properties.

### 3. Run the application 

    git clone git@github.com:co-meeting/crowy.git
    cd crowy
    dev_appserver.py src

Screen Shots
-------------

https://github.com/co-meeting/crowy/tree/master/chrome-web-store/images

Authors
-------------

- [@atskimura](http://github.com/atskimura)

Thanks for contributions:

- [@hrendoh](http://github.com/hrendoh)
- [@yanotaka](http://github.com/yanotaka)
- [@yuyalush](http://github.com/yuyalush)
- [@pfjk](https://twitter.com/pfjk) (UI/UX Design)

License
-------------

Copyright 2013 [co-meeting](http://www.co-meeting.com/), Inc and other contributors.

Licensed under the MIT License
