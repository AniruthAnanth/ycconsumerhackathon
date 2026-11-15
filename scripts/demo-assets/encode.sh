#!/usr/bin/env bash
# Turns a generated or photographed image into the form every demo file has: a JPEG no larger
# than 1200 px on its long side, with no metadata. An avatar is a 256 px centre square instead:
# the largest circle the app draws is 72 pt, which is 216 px on a 3x screen.
#
#   scripts/demo-assets/encode.sh source.png assets/demo/proofs/gym.jpg
#   scripts/demo-assets/encode.sh source.png assets/demo/avatars/maya-chen.jpg avatar
#
# Needs ffmpeg. Quality 5 keeps a 1200 px photo near 120 KB, which matters because the seeded
# photos are also embedded in the Convex bundle (see embed-seed-photos.mjs).
set -euo pipefail

source_image="$1"
output="$2"
shape="${3:-photo}"

if [ "$shape" = "avatar" ]; then
  filter="crop='min(iw,ih)':'min(iw,ih)',scale=256:256:flags=lanczos"
else
  # Scale the long side down to 1200 px; -2 keeps the other side even, as JPEG chroma needs.
  filter="scale='if(gte(iw,ih),min(1200,iw),-2)':'if(gte(iw,ih),-2,min(1200,ih))':flags=lanczos"
fi

mkdir -p "$(dirname "$output")"
ffmpeg -y -loglevel error -i "$source_image" -vf "$filter" -map_metadata -1 -pix_fmt yuvj420p -q:v 5 "$output"
