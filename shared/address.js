// One normalized key per physical unit, so the same house from two sources (or two spellings) dedupes.
const WORDS = {
  street: 'st', avenue: 'ave', av: 'ave', road: 'rd', drive: 'dr', place: 'pl', terrace: 'ter', terr: 'ter', lane: 'ln',
  boulevard: 'blvd', court: 'ct', circle: 'cir', highway: 'hwy', way: 'way',
  northwest: 'nw', southwest: 'sw', northeast: 'ne', southeast: 'se', north: 'n', south: 's', east: 'e', west: 'w',
  apartment: 'unit', apt: 'unit', suite: 'unit', ste: 'unit', unit: 'unit', lot: 'unit',
};

export function addressKey(address, unit = '') {
  const raw = `${address || ''} ${unit ? 'unit ' + unit : ''}`.toLowerCase().replace(/#/g, ' unit ').replace(/[.,]/g, ' ');
  const out = [];
  for (const tok of raw.split(/\s+/).filter(Boolean)) {
    const t = WORDS[tok] || tok;
    if (t === 'unit' && out[out.length - 1] === 'unit') continue;
    out.push(t);
  }
  if (out[out.length - 1] === 'unit') out.pop();
  return out.join(' ');
}

export const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
