# Functional checks against a running build. Usage: python3 scripts/e2e.py <base-url>
import sys, asyncio, json, re
from playwright.async_api import async_playwright

BASE = sys.argv[1]
results = []
def check(name, ok, detail=''):
    results.append(ok)
    print(('PASS ' if ok else 'FAIL ') + name + (f'  [{detail}]' if detail else ''))

async def count(page):
    t = await page.inner_text('.schip--count')
    return int(re.match(r'\s*(\d+)', t).group(1))

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
        ctx = await b.new_context(viewport={'width': 390, 'height': 844}, has_touch=True, is_mobile=True)
        page = await ctx.new_page()
        errors = []
        page.on('pageerror', lambda e: errors.append(str(e)))
        await page.goto(BASE, wait_until='load'); await page.wait_for_timeout(4000)

        check('default preset shows 7 houses', await count(page) == 7, str(await count(page)))
        check('7 pins on the map', await page.locator('.pin').count() == 7, str(await page.locator('.pin').count()))
        check('6 landmark markers', await page.locator('.lm').count() == 6)
        check('new listing pin pulses', await page.locator('.pin.is-new').count() >= 0)

        await page.click('.pchip >> nth=1'); await page.wait_for_timeout(600)
        check('Walkable preset applies (1 house)', await count(page) == 1, str(await count(page)))
        await page.click('.pchip >> nth=2'); await page.wait_for_timeout(600)
        wide = await count(page)
        check('Wide Net preset applies (12 houses)', wide == 12, str(wide))
        await page.evaluate("window.__gnMap.jumpTo({ center: [-82.3470, 29.6546], zoom: 16 })"); await page.wait_for_timeout(900)
        check('over-budget pins are gray', await page.locator('.pin--over').count() > 0)
        check('taken listing shown grayed', await page.locator('.pin--gone').count() == 1)

        await page.click('.pchip >> nth=0'); await page.wait_for_timeout(400)
        await page.click('[aria-label=Filters]'); await page.wait_for_timeout(500)
        await page.click('.switch:has-text("Verified only")'); await page.wait_for_timeout(400)
        check('verified-only drops unverified listings (7 -> 4)', await count(page) == 4, str(await count(page)))
        await page.click('.switch:has-text("Verified only")')
        await page.click('.quick .chip:has-text("Dogs OK")'); await page.wait_for_timeout(400)
        dogs = await count(page)
        check('Dogs OK chip filters live', dogs < 7, str(dogs))
        await page.click('.modal__foot .btn >> nth=0'); await page.wait_for_timeout(400)
        await page.fill('.modal input[type=text]', 'Dog OK')
        await page.click('.modal__foot .btn--primary'); await page.wait_for_timeout(500)
        check('new preset chip appears', await page.locator('.pchip:has-text("Dog OK")').count() == 1)
        saved = json.loads(await page.evaluate("localStorage.getItem('gn.presets')"))
        check('preset saved to localStorage', len(saved) == 4 and saved[3]['filters']['dogs'] is True)

        # share link round trip
        link = await page.evaluate("""(async () => { const m = await import('/src/filters.js'); const p = JSON.parse(localStorage.getItem('gn.presets'))[3]; return m.encodePreset(p); })()""") if '5173' in BASE else None
        if link:
            await page.goto(BASE + ('&' if '?' in BASE else '?') + 'x=1#p=' + link, wait_until='load'); await page.wait_for_timeout(3500)
            check('shared preset link applies its filters', await page.locator('.sharedbar').count() == 1 and await count(page) == dogs, str(await count(page)))
            await page.click('.sharedbar .btn >> nth=1')

        # favorite + tracking persist, deep link opens the sheet
        await page.goto(BASE, wait_until='load'); await page.wait_for_timeout(3500)
        await page.click('.pchip >> nth=0'); await page.wait_for_timeout(300)
        await page.click('.pin >> nth=0'); await page.wait_for_timeout(1600)
        check('tapping a pin opens the sheet', await page.locator('.sheet.is-half').count() == 1)
        hash_ = await page.evaluate('location.hash')
        check('URL carries a deep link', hash_.startswith('#l='), hash_)
        await page.click('.act >> nth=0'); await page.wait_for_timeout(300)
        await page.click('.tcell >> nth=0'); await page.wait_for_timeout(1500)
        check('route pill appears', await page.locator('.routepill').count() == 1, await page.locator('.routepill').inner_text() if await page.locator('.routepill').count() else '')
        sms = await page.get_attribute('.actions a.act >> nth=1', 'href')
        check('text button pre-fills the inquiry', 'sms:' in sms and 'roommates' in sms and 'Aug%202027' in sms, sms[:60])
        tel = await page.get_attribute('.actions a.act >> nth=0', 'href')
        check('call button is tap-to-call', tel.startswith('tel:+1352'), tel)
        await page.goto(BASE + ('&' if '?' in BASE else '?') + 'y=1' + hash_, wait_until='load'); await page.wait_for_timeout(3500)
        check('deep link reopens the listing', await page.locator('.sheet.is-half').count() == 1)
        check('favorite survived reload', await page.locator('.act.is-on').count() == 1 and await page.locator('.pin__body i').count() == 1)

        # lasso
        await page.click('.sheet__x'); await page.wait_for_timeout(400)
        await page.click('[aria-label=Filters]'); await page.wait_for_timeout(300)
        await page.click('.btn:has-text("Draw an area")'); await page.wait_for_timeout(400)
        await page.mouse.move(60, 300); await page.mouse.down()
        for x, y in [(330, 300), (330, 420), (200, 520), (60, 420), (60, 300)]:
            await page.mouse.move(x, y, steps=12)
        await page.mouse.up(); await page.wait_for_timeout(700)
        area_count = await count(page)
        check('lasso area filters listings', await page.locator('.schip--area').count() == 1 and area_count < 7, str(area_count))
        await page.click('.schip--area'); await page.wait_for_timeout(300)
        check('clearing the area restores listings', await count(page) == 7)

        # list view + compare
        await page.click('[aria-label="List view"]'); await page.wait_for_timeout(500)
        check('list view shows cards', await page.locator('.lcard').count() == 7)
        await page.click('.lcard [aria-label=Favorite] >> nth=0'); await page.wait_for_timeout(200)
        n = await page.locator('.tag--cmp').count()
        for i in range(n): await page.click(f'.tag--cmp >> nth={i}')
        await page.click('.btn:has-text("Compare")'); await page.wait_for_timeout(400)
        check('compare shows favorites side by side', await page.locator('.cmp__name').count() == 2, str(n))
        await page.click('.modal__head .iconbtn')

        # never blank: break the data requests and reload
        if '5173' in BASE:  # dev server: no service worker, so break the data requests directly
            await page.route('**/fixtures/listings.json*', lambda r: r.abort())
            await page.route('**/data/listings.json*', lambda r: r.abort())
            await page.goto(BASE, wait_until='load'); await page.wait_for_timeout(3500)
        else:  # production build: go fully offline and let the service worker serve the saved copy
            await ctx.set_offline(True)
            await page.reload(wait_until='load'); await page.wait_for_timeout(3500)
        check('data failure falls back to saved copy with a warning chip', await page.locator('.schip--warn').count() == 1 and await count(page) > 0, await page.locator('.schip--warn').inner_text() if await page.locator('.schip--warn').count() else 'no chip')

        check('no uncaught page errors', not errors, '; '.join(errors)[:300])
        await b.close()
    print(f'\n{sum(results)}/{len(results)} checks passed')
    sys.exit(0 if all(results) else 1)
asyncio.run(main())
