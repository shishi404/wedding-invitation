"""Build local WOFF2 subsets after changing study copy (no outbound text)."""
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT / 'output/font-tools'))
from fontTools.ttLib import TTFont
from fontTools import subset
from fontTools.varLib.instancer import instantiateVariableFont

text = ''.join((ROOT / name).read_text(encoding='utf-8') for name in
               ['index.html', 'study.js', 'study-rules.js', 'data.js', 'music.js', 'dice.js'])
for name, dest, weight in [('study-cn', 'study-cn-black', 900), ('study-latin', 'study-blackletter', 700)]:
    font = TTFont(ROOT / f'output/{name}-full.ttf')
    if 'fvar' in font:
        font = instantiateVariableFont(font, {'wght': weight}, inplace=True)
    if name == 'study-cn':
        sub = subset.Subsetter(options=subset.Options())
        sub.populate(text=text)
        sub.subset(font)
    font.flavor = 'woff2'
    path = ROOT / f'assets/fonts/{dest}.woff2'
    font.save(path)
    print(path.name, path.stat().st_size, 'bytes')
