#!/bin/bash
SERVICE_URL=$1

RETRY_COUNT=0
HTTP_CODE=0

until [ $HTTP_CODE -eq 200 ] || [ $RETRY_COUNT -eq 12 ]; do
  HTTP_CODE=$(curl -s -o /dev/null -w ''%{http_code}'' $SERVICE_URL)
  if [ $HTTP_CODE -eq 200 ]; then
    break
  fi
  printf "Waiting for service to be running at $SERVICE_URL\n"
  sleep 10
  let RETRY_COUNT=RETRY_COUNT+1
done

if [ $HTTP_CODE -ne 200 ]; then
  echo "Waited for more than two minutes, but the service is still not running"
  exit 1
fi
