#!/bin/sh
# Spec section 1.1 / section 6: the engine package must have ZERO rendering imports.
# `grep -r three engine/` must return nothing. This guard is wired into CI.
set -e

ENGINE_SRC="packages/engine/src"

# Search source only (not dist/, not node_modules/). The spec's literal check is
# `grep -r three engine/` returning nothing; we also catch a few other renderer tokens.
if grep -rniE "three|webgl" "$ENGINE_SRC" ; then
  echo "ERROR: rendering reference found in engine source (spec section 1.1)." >&2
  exit 1
fi

echo "OK: engine source is rendering-free."
