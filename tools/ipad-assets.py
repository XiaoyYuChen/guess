"""生成 iPad 自包含版所需的素材映射。

输出 离线版/.ipad-assets.json：资源相对路径 -> data URI。
图片重新压缩为 WebP，音频与字体直接转 base64，字体按用到的字符做子集化。
"""

import base64
import io
import json
import os
import subprocess
import tempfile

from PIL import Image
from fontTools import subset

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ASSETS = os.path.join(ROOT, 'assets')
OUT = os.path.join(ROOT, '离线版', '.ipad-assets.json')

IMAGE_EXTS = ('.jpg', '.jpeg', '.png', '.webp')
MAX_WIDTH = 760
WEBP_QUALITY = 64
AUDIO_BITRATE = '96k'


def data_uri(mime, raw):
    return 'data:%s;base64,%s' % (mime, base64.b64encode(raw).decode('ascii'))


def compress_image(path):
    ext = os.path.splitext(path)[1].lower()
    if ext == '.png':
        # 图标类 PNG 体积很小，保持原样以免丢透明通道质感
        with open(path, 'rb') as fh:
            return data_uri('image/png', fh.read())
    with Image.open(path) as img:
        img = img.convert('RGB')
        if img.width > MAX_WIDTH:
            height = round(img.height * MAX_WIDTH / img.width)
            img = img.resize((MAX_WIDTH, height), Image.LANCZOS)
        buf = io.BytesIO()
        img.save(buf, 'WEBP', quality=WEBP_QUALITY, method=5)
        return data_uri('image/webp', buf.getvalue())


def add_text(chars, value):
    for ch in str(value):
        if ord(ch) > 0x7f:
            chars.add(ch)


def collect_chars():
    chars = set(chr(i) for i in range(32, 127))
    for sub in ('js', 'css'):
        for dirpath, _, files in os.walk(os.path.join(ROOT, sub)):
            for name in files:
                if name.endswith(('.js', '.css')):
                    with open(os.path.join(dirpath, name), 'r', encoding='utf-8', errors='ignore') as fh:
                        add_text(chars, fh.read())

    rendered_fields = ('title', 'content', 'dynasty', 'author', 'story')
    for name in ('catalog_index.json', 'catalog_snippets.json', 'similar_chars.json'):
        add_text(chars, open(os.path.join(ROOT, 'data', name), encoding='utf-8').read())
    for kind in ('poetry', 'idiom'):
        folder = os.path.join(ROOT, 'data', 'detail', kind)
        for name in os.listdir(folder):
            if not name.endswith('.json'):
                continue
            with open(os.path.join(folder, name), encoding='utf-8') as fh:
                data = json.load(fh)
            item = data.get('item') or data
            for field in rendered_fields:
                add_text(chars, item.get(field) or '')
    return chars


def subset_font(path):
    font = subset.load_font(path, subset.Options())
    subsetter = subset.Subsetter(options=subset.Options())
    subsetter.populate(unicodes=[ord(ch) for ch in collect_chars()])
    subsetter.subset(font)
    buf = io.BytesIO()
    font.flavor = None
    font.save(buf)
    font.close()
    return data_uri('font/ttf', buf.getvalue())


def reencode_audio(path):
    """用内置 ffmpeg 把背景音乐压到 96kbps，减小单文件体积。"""
    try:
        import imageio_ffmpeg
    except ImportError:
        with open(path, 'rb') as fh:
            return fh.read()
    exe = imageio_ffmpeg.get_ffmpeg_exe()
    with tempfile.NamedTemporaryFile(suffix='.mp3', delete=False) as tmp:
        tmp_path = tmp.name
    try:
        subprocess.run(
            [exe, '-y', '-loglevel', 'error', '-i', path,
             '-codec:a', 'libmp3lame', '-b:a', AUDIO_BITRATE, tmp_path],
            check=True,
        )
        with open(tmp_path, 'rb') as fh:
            data = fh.read()
        return data if data else open(path, 'rb').read()
    except (subprocess.CalledProcessError, OSError):
        with open(path, 'rb') as fh:
            return fh.read()
    finally:
        if os.path.exists(tmp_path):
            os.remove(tmp_path)


def main():
    mapping = {}

    for dirpath, _, files in os.walk(os.path.join(ASSETS, 'images')):
        for name in files:
            if not name.lower().endswith(IMAGE_EXTS):
                continue
            full = os.path.join(dirpath, name)
            rel = os.path.relpath(full, ROOT).replace('\\', '/')
            mapping[rel] = compress_image(full)

    for sub in ('bgm', 'sfx'):
        folder = os.path.join(ASSETS, sub)
        for name in sorted(os.listdir(folder)):
            full = os.path.join(folder, name)
            if not os.path.isfile(full):
                continue
            rel = os.path.relpath(full, ROOT).replace('\\', '/')
            raw = reencode_audio(full) if sub == 'bgm' else open(full, 'rb').read()
            mapping[rel] = data_uri('audio/mpeg', raw)

    # 字体只在 CSS 里用到，单独输出，避免在 HTML 里重复内嵌一份
    font_uri = ''
    font_path = os.path.join(ASSETS, 'fonts', 'MaShanZheng-Regular.ttf')
    if os.path.exists(font_path):
        font_uri = subset_font(font_path)

    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, 'w', encoding='utf-8') as fh:
        json.dump({'assets': mapping, 'font': font_uri}, fh, ensure_ascii=False)

    total = sum(len(v) for v in mapping.values()) + len(font_uri)
    print('assets %d, size %.1f MB' % (len(mapping), total / 1048576))


if __name__ == '__main__':
    main()
