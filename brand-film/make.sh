#!/usr/bin/env bash
# One-click build of 贺去病商业咨询《一线破局》15s brand film.
#   ./make.sh            full build: score -> frames -> MP4 + poster + contact sheet -> QA
#   FORCE=1 ./make.sh    re-render every frame even if it exists
set -euo pipefail
cd "$(dirname "$0")/src"

python3 audio.py                     # out/score.wav (48 kHz / 24-bit / stereo)
python3 render.py                    # build/frames/0000.png .. 0899.png
python3 finish.py                    # out/*.mp4, out/poster_last_frame.png, out/contact_sheet.png
python3 qa.py                        # self-check, non-zero exit on failure
