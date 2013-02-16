#!/bin/sh
i=`expr $1 - 1`
e=$2
while [ $i -ne $e ]
do
  i=`expr $i + 1`
  echo "======expand-url${i}======"
  heroku create "expand-url${i}"
  git push git@heroku.com:expand-url${i}.git master
done
