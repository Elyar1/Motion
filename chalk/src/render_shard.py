# Render frames [START, END) of the episode and encode them straight into a chunk mp4 (no frame files on disk).
# usage: python3 render_shard.py START END OUT.mp4 [crf]
import sys, os, json, subprocess
from playwright.sync_api import sync_playwright

FPS = 30
here = os.path.dirname(os.path.abspath(__file__))
start, end, out = int(sys.argv[1]), int(sys.argv[2]), sys.argv[3]
crf = sys.argv[4] if len(sys.argv) > 4 else "24"

ff = subprocess.Popen(
    ["ffmpeg", "-y", "-loglevel", "error", "-f", "image2pipe", "-c:v", "mjpeg",
     "-framerate", str(FPS), "-i", "-",
     "-c:v", "libx264", "-preset", "veryfast", "-crf", crf, "-maxrate", "9M", "-bufsize", "18M",
     "-pix_fmt", "yuv420p", "-an", out],
    stdin=subprocess.PIPE)

with sync_playwright() as p:
    b = p.chromium.launch(args=["--disable-gpu"])
    pg = b.new_page(viewport={"width": 1080, "height": 1920})
    pg.goto("file://" + here + "/ep.html?render=1")
    pg.wait_for_function("window.READY===true")
    for i in range(start, end):
        pg.evaluate("t=>window.seek(t)", i / FPS)
        ff.stdin.write(pg.screenshot(type="jpeg", quality=93))
        if (i - start) % 50 == 0:
            print(f"shard {start}-{end}: {i - start}/{end - start}", flush=True)
    b.close()
ff.stdin.close()
if ff.wait() != 0:
    sys.exit("ffmpeg failed")
print("SHARD_DONE", start, end, flush=True)
