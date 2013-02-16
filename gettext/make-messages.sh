#!/bin/sh
pushd ../src
PYTHON=/opt/local/bin/python2.5
PYTHONPATH=/Applications/GoogleAppEngineLauncher.app/Contents/Resources/GoogleAppEngine-default.bundle/Contents/Resources/google_appengine/lib/django_0_96/
PYTHONPATH=$PYTHONPATH $PYTHON $PYTHONPATH/django/bin/make-messages.py -l en
PYTHONPATH=$PYTHONPATH $PYTHON $PYTHONPATH/django/bin/make-messages.py -l es
PYTHONPATH=$PYTHONPATH $PYTHON $PYTHONPATH/django/bin/make-messages.py -l ja
PYTHONPATH=$PYTHONPATH $PYTHON $PYTHONPATH/django/bin/make-messages.py -l zh_CN
popd
