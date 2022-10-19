#!/bin/bash

RETRY_COUNT=0
HTTP_CODE=0
MARKETPLACE_API=http://localhost:3100/api/v1/metadata/assets

until [ $HTTP_CODE -eq 200 ] || [ $RETRY_COUNT -eq 12 ]; do
  HTTP_CODE=$(curl -s -o /dev/null -w ''%{http_code}'' $MARKETPLACE_API)
  if [ $HTTP_CODE -eq 200 ]; then
    break
  fi
  printf "Waiting for compute api to be running at $MARKETPLACE_API\n"
  sleep 10
  let RETRY_COUNT=RETRY_COUNT+1
done

if [ $HTTP_CODE -ne 200 ]; then
  echo "Waited for more than two minutes, but the marketplace api is still not running"
  exit 1
fi
