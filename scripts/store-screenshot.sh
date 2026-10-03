#!/usr/bin/env bash
# Capture clean Play Store screenshots from a connected phone/emulator.
#
#   npm run shot -- 01-dashboard      -> distribution/screenshots/raw/01-dashboard.png
#
# Turns on Android "demo mode" first so every shot has the same tidy status
# bar (9:41, full battery, full signal, no notification icons), then turns
# it off again. Use the DEV build with a demo account - never real users'
# names or amounts in public store images.
set -euo pipefail

name="${1:?usage: npm run shot -- <name>   e.g. 01-dashboard}"
out_dir="$(cd "$(dirname "$0")/.." && pwd)/distribution/screenshots/raw"
mkdir -p "$out_dir"

demo() { adb shell am broadcast -a com.android.systemui.demo -e command "$@" >/dev/null; }

adb shell settings put global sysui_demo_allowed 1
demo enter
demo clock -e hhmm 0941
demo battery -e level 100 -e plugged false
demo network -e wifi show -e level 4
demo network -e mobile show -e datatype none -e level 4
demo notifications -e visible false
sleep 0.5

adb exec-out screencap -p > "$out_dir/$name.png"

demo exit
echo "Saved $out_dir/$name.png"
