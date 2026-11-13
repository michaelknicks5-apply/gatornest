# Screenshot helper for local testing. Usage: python3 scripts/shot.py <url> <out.png> [width] [height] [js-to-run] [wait-ms]
import sys, asyncio
from playwright.async_api import async_playwright

async def main():
    url, out = sys.argv[1], sys.argv[2]
    w = int(sys.argv[3]) if len(sys.argv) > 3 else 390
    h = int(sys.argv[4]) if len(sys.argv) > 4 else 844
    js = sys.argv[5] if len(sys.argv) > 5 else ''
    wait = int(sys.argv[6]) if len(sys.argv) > 6 else 2500
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
        ctx = await b.new_context(viewport={'width': w, 'height': h}, device_scale_factor=2, has_touch=w < 600, is_mobile=w < 600, color_scheme='dark' if 'dark' in out else 'light')
        page = await ctx.new_page()
        page.on('console', lambda m: print('[console]', m.type, m.text[:300]) if m.type in ('error', 'warning') else None)
        page.on('pageerror', lambda e: print('[pageerror]', str(e)[:300], (e.stack or '')[:900]))
        await page.goto(url, wait_until='load')
        await page.wait_for_timeout(wait)
        if js:
            r = await page.evaluate(js)
            if r is not None: print('[js]', r)
            await page.wait_for_timeout(1500)
        await page.screenshot(path=out)
        await b.close()
asyncio.run(main())
