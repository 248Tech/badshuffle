#!/bin/sh
set -e

# Ensure data directories exist
mkdir -p /data/uploads

exec "$@"
