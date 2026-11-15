#!/bin/sh
# تبدیل صوت‌های ورودی به wav مونو ۴۸k (نام فایل‌ها رو با فایل‌های خودت یکی کن)
ffmpeg -y -i main.mp3    -ac 1 -ar 48000 -c:a pcm_s16le main.wav      # روایت (بدون علی)
ffmpeg -y -i ali.mp3     -ac 1 -ar 48000 -c:a pcm_s16le ali.wav       # علی با افکت تلفن
ffmpeg -y -i whisper.mp3 -ac 1 -ar 48000 -c:a pcm_s16le whisper.wav   # «مرد گچی… مرد گچی…»
ffmpeg -y -i hook.mp3    -ac 1 -ar 48000 -c:a pcm_s16le hook.wav      # هوک ۶ ثانیه‌ای
ffmpeg -y -i the_anatomy_of_dread.mp3 -ac 2 -ar 48000 -c:a pcm_s16le music48.wav
# بعد:  python3 audio_ep1.py   ->  mix.wav + timing_ep1.json
# بعد:  python3 build_html.py ; python3 shot.py 3 9 20 ; python3 render.py
# انکود:
# ffmpeg -framerate 30 -i frames/%05d.jpg -i mix.wav -c:v libx264 -preset veryfast -crf 24 -maxrate 9M -bufsize 18M -pix_fmt yuv420p -c:a aac -b:a 192k -movflags +faststart out.mp4
