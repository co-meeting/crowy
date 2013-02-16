#!/bin/sh
CLASSPATH=
for name in `ls lib/*.jar`; do
  CLASSPATH="${CLASSPATH}:$name"
done
java -jar lib/yuicompressor-2.4.6.jar --charset utf-8 -o ../src/static/js/main.min.js ../src/static/js/main.js
java -jar lib/yuicompressor-2.4.6.jar --charset utf-8 -o ../src/static/js/index.min.js ../src/static/js/index.js
java -jar lib/yuicompressor-2.4.6.jar --charset utf-8 -o ../src/static/css/main.min.css ../src/static/css/main.css

java -jar lib/yuicompressor-2.4.6.jar --charset utf-8 -o ../src/static/js/tipTipv13/jquery.tipTip.min.js ../src/static/js/tipTipv13/jquery.tipTip.js