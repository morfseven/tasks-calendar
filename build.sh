#!/bin/bash
# Build tasks-calendar: concat src modules into IIFE, concat CSS
set -e

DIR="$(cd "$(dirname "$0")" && pwd)"
SRC="$DIR/src"
STYLES="$DIR/styles"

# JS: wrap in IIFE, concat in dependency order
{
  echo ";(function() {"
  echo "'use strict';"
  echo ""
  cat "$SRC/config.js"
  echo ""
  cat "$SRC/store.js"
  echo ""
  cat "$SRC/dom.js"
  echo ""
  cat "$SRC/nav.js"
  echo ""
  cat "$SRC/month-view.js"
  echo ""
  cat "$SRC/week-view.js"
  echo ""
  cat "$SRC/app.js"
  echo ""
  echo "})();"
} > "$DIR/view.js"

# CSS: concat in order
{
  cat "$STYLES/base.css"
  echo ""
  cat "$STYLES/nav.css"
  echo ""
  cat "$STYLES/month.css"
  echo ""
  cat "$STYLES/week.css"
} > "$DIR/view.css"

echo "Built view.js ($(wc -c < "$DIR/view.js") bytes) and view.css ($(wc -c < "$DIR/view.css") bytes)"
