#!/bin/sh
set -eu

if [ "${APP_ENV:-development}" = "production" ]; then
  exec npm run start -- -H 0.0.0.0
fi

exec npm run dev -- -H 0.0.0.0
