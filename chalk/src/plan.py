# Prints a GitHub-Actions matrix: frames split into N shards.
# usage: python3 plan.py [shards] [start_sec] [seconds]   (seconds=0 -> until the end)
import json, sys
FPS = 30
n_sh = int(sys.argv[1]) if len(sys.argv) > 1 else 6
start = float(sys.argv[2]) if len(sys.argv) > 2 else 0.0
secs = float(sys.argv[3]) if len(sys.argv) > 3 else 0.0
total = int(json.load(open("timing_ep1.json"))["TOTAL"] * FPS)
a = int(start * FPS)
b = total if secs <= 0 else min(total, a + int(secs * FPS))
n = max(1, b - a)
step = -(-n // n_sh)
sh = [{"i": k, "s": a + k * step, "e": min(b, a + (k + 1) * step)} for k in range(n_sh) if a + k * step < b]
print(json.dumps({"include": sh}))
