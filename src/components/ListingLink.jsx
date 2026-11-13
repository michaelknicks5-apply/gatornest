// Getting to the original listing. RentCast doesn't publish listing URLs, so when we don't have one
// we search for the exact address and offer the likely sites, plus a way to save the link once found.
import { useState } from 'preact/hooks';
import { setOverride, toast } from '../store.js';
import { Icon } from '../icons.jsx';

export const domainOf = (u) => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return null; } };
const withScheme = (u) => (u && !/^https?:\/\//i.test(u) ? 'https://' + u : u);

export function fullAddress(l) {
  return [l.address, l.city || 'Gainesville', `${l.state || 'FL'}${l.zip ? ' ' + l.zip : ''}`].join(', ');
}
export function searchUrl(l) {
  return `https://www.google.com/search?q=${encodeURIComponent(`"${l.address.replace(/\s+#.*/, '')}" ${l.city || 'Gainesville'} ${l.state || 'FL'} for rent`)}`;
}
export function zillowUrl(l) {
  return `https://www.zillow.com/homes/${encodeURIComponent(fullAddress(l).replace(/#/g, 'Unit ').replace(/\s+/g, '-'))}_rb/`;
}
// The one link a card or button should open: the saved listing if we have it, otherwise a search.
export const bestLink = (l) => (l.url ? { href: l.url, label: domainOf(l.url) || 'listing', saved: true } : { href: searchUrl(l), label: 'search', saved: false });

export function ListingLinkBlock({ l }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState('');
  const site = withScheme(l.contact?.website);
  const siteDomain = domainOf(site);
  const save = (raw) => {
    const m = String(raw || '').match(/https?:\/\/[^\s"'<>]+/i);
    if (!m) { toast("That doesn't look like a link"); return; }
    setOverride(l.id, { url: m[0] });
    setEditing(false); setText('');
    toast('Link saved. Tap Sync in Settings to share it.');
  };
  const paste = async () => {
    try { const t = await navigator.clipboard.readText(); if (t) { save(t); return; } } catch { /* fall back to typing */ }
    setEditing(true);
  };

  return (
    <div class="llink">
      {l.url ? (
        <a class="btn btn--primary btn--block btn--big" href={l.url} target="_blank" rel="noopener"><Icon name="external" size={19} />View listing on {domainOf(l.url) || 'its site'}</a>
      ) : (
        <a class="btn btn--primary btn--block btn--big" href={searchUrl(l)} target="_blank" rel="noopener"><Icon name="external" size={19} />Find the listing</a>
      )}
      <div class="llink__row">
        {!l.url && <a class="btn btn--sm" href={zillowUrl(l)} target="_blank" rel="noopener">Zillow</a>}
        {site && <a class="btn btn--sm" href={site} target="_blank" rel="noopener">{/facebook\.com/.test(siteDomain || '') ? "Agent's Facebook" : `Agent's site`}</a>}
        {l.url && <a class="btn btn--sm" href={searchUrl(l)} target="_blank" rel="noopener">Search address</a>}
        <button type="button" class="btn btn--sm btn--ghost" onClick={paste}><Icon name="link" size={15} />{l.url ? 'Change link' : 'Paste link'}</button>
      </div>
      {!l.url && <p class="muted small">The listing site isn't known, so this searches for the exact address. When you find it, copy the link and tap Paste link to save it here.</p>}
      {editing && (
        <form class="llink__form" noValidate onSubmit={(e) => { e.preventDefault(); save(text); }}>
          <span class="num__box"><input type="text" inputMode="url" autoCapitalize="off" autoCorrect="off" autoFocus placeholder="Paste the listing link" value={text} onInput={(e) => setText(e.currentTarget.value)} /></span>
          <button type="submit" class="btn btn--sm btn--primary">Save</button>
        </form>
      )}
    </div>
  );
}
