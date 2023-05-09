#!/bin/bash

# Update packages for local testing. Assumes that sdk-dtp and Node are in the same parent directory as sdk-js

export PKG2=dtp-$1.tgz

echo $PKG2

cd ../sdk-dtp
rm -f *dtp*.tgz
yarn
yarn build
yarn pack
cp *dtp*.tgz ../node/$PKG2

cd ../node
cat package.json | jq ".dependencies.\"@nevermined-io/sdk-dtp\"=\"./$PKG2\"" | sponge package.json
yarn
yarn run setup:dev
yarn build

