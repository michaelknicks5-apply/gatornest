# Walks through the main screens and saves screenshots. Usage: python3 scripts/shots.py <base-url> <outdir> [phone|desktop] [light|dark]
import sys, asyncio
from playwright.async_api import async_playwright

BASE, OUT = sys.argv[1], sys.argv[2]
DEVICE = sys.argv[3] if len(sys.argv) > 3 else 'phone'
SCHEME = sys.argv[4] if len(sys.argv) > 4 else 'light'
W, H = (390, 844) if DEVICE == 'phone' else (1280, 800)
click = lambda sel: f"document.querySelector({sel!r}).click()"
STEPS = [
    ('01-map', None),
    ('02-sheet-half', click('.pin--normal')),
    ('03-route', "[...document.querySelectorAll('.tcell')][0].click()"),
    ('04-sheet-full', click('.sheet__exp') if DEVICE == 'phone' else "document.querySelector('.sheet__scroll').scrollTo(0, 420)"),
    ('05-sheet-scrolled', "document.querySelector('.sheet__scroll').scrollTo(0, 900)"),
    ('06-sheet-bottom', "document.querySelector('.sheet__scroll').scrollTo(0, 5000)"),
    ('07-filters', click('.sheet__x') + ";" + click('[aria-label=Filters]')),
    ('08-filters-mid', "document.querySelector('.modal__body').scrollTo(0, 760)"),
    ('09-filters-low', "document.querySelector('.modal__body').scrollTo(0, 1700)"),
    ('10-preset-new', "[...document.querySelectorAll('.modal__foot .btn')][0].click()"),
    ('11-widenet', click('.modal__head .iconbtn') + ";[...document.querySelectorAll('.pchip')][2].click()"),
    ('12-list', click('[aria-label="List view"]')),
    ('13-settings', click('[aria-label=Settings]')),
    ('14-add', click('.modal__head .iconbtn') + ";" + click('[aria-label="Add a listing by link"]')),
]

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
        ctx = await b.new_context(viewport={'width': W, 'height': H}, device_scale_factor=2, has_touch=DEVICE == 'phone', is_mobile=DEVICE == 'phone', color_scheme=SCHEME)
        page = await ctx.new_page()
        page.on('console', lambda m: print('[console]', m.type, m.text[:300]) if m.type == 'error' or (m.type == 'warning' and 'GPU stall' not in m.text and 'GL Driver' not in m.text) else None)
        page.on('pageerror', lambda e: print('[pageerror]', str(e)[:300], (e.stack or '')[:600]))
        await page.goto(BASE, wait_until='load')
        await page.wait_for_timeout(4500)
        only = sys.argv[5].split(',') if len(sys.argv) > 5 else None
        for name, js in STEPS:
            if js:
                try:
                    await page.evaluate(js)
                except Exception as e:
                    print(f'[step {name}] FAILED:', str(e)[:300])
                await page.wait_for_timeout(1700)
            if not only or name[:2] in only:
                await page.screenshot(path=f'{OUT}/{DEVICE}-{SCHEME}-{name}.png')
        await b.close()
asyncio.run(main())
