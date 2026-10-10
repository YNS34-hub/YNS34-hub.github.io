from pathlib import Path
import concurrent.futures
import requests
from PIL import Image

REVISION = '0943055db6ec570bcef9f2c8b41c9e5467c808f9'
CACHE = Path('E:/Temp/palace-sport-source')
OUTPUT = Path('public/media/presence')
ROOT = 'https://raw.githubusercontent.com/microsoft/Microsoft-Rocketbox/' + REVISION + '/'

def fetch(source, name):
    target = CACHE / name
    if not target.exists():
        for attempt in range(3):
            try:
                response = requests.get(ROOT + source, timeout=60)
                response.raise_for_status()
                target.write_bytes(response.content)
                break
            except requests.RequestException:
                if attempt == 2: raise
    return target

if __name__ == '__main__':
    CACHE.mkdir(parents=True, exist_ok=True)
    OUTPUT.mkdir(parents=True, exist_ok=True)
    jobs = [('Assets/Avatars/Professions/Sports_Male_04/Export/Sports_Male_04.fbx', 'athlete.fbx')]
    for name, folder in [('m_idle_neutral_01.max.fbx', 'static'), ('m_walk_neutral_01.max.fbx', 'xy'), ('m_run_neutral_01.max.fbx', 'xy')]:
        jobs.append(('Assets/Animations/all_animations_max_motextr_' + folder + '/' + name, name))
    for channel in ['body_color', 'head_color', 'body_normal', 'head_normal']:
        name = 'm026_' + channel + '.tga'
        jobs.append(('Source/Avatars/Professions/Sports_Male_04/Textures/' + name, name))
    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
        list(pool.map(lambda j: fetch(*j), jobs))
    for file in CACHE.glob('m026_*.tga'):
        image = Image.open(file).convert('RGB')
        image.thumbnail((1024, 1024))
        image.save(OUTPUT / (file.stem.replace('m026_', '').replace('_', '-') + '.webp'), quality=92)
    print('MIT sports avatar and walking/running sources ready', REVISION)
