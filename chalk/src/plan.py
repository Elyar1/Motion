# Prints a GitHub-Actions matrix: frames split into N shards.   usage: python3 plan.py [shards]
import json, sys
FPS = 30
n_sh = int(sys.argv[1]) if len(sys.argv) > 1 else 6
total = int(json.load(open("timing_ep1.json"))["TOTAL"] * FPS)
step = -(-total // n_sh)
sh = [{"i": k, "s": k * step, "e": min(total, (k + 1) * step)} for k in range(n_sh) if k * step < total]
print(json.dumps({"include": sh}))
