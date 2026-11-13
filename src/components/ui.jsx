import { Icon } from '../icons.jsx';

export function Chip({ on, onClick, children, icon, color, class: cls = '', ...rest }) {
  return (
    <button type="button" class={`chip ${on ? 'is-on' : ''} ${cls}`} aria-pressed={!!on} onClick={onClick} style={on && color ? { background: color, borderColor: color } : null} {...rest}>
      {icon && <Icon name={icon} size={16} />}
      {children}
    </button>
  );
}

// Segmented control. options: [[value, label], ...]
export function Seg({ value, options, onChange, small }) {
  return (
    <div class={'seg' + (small ? ' seg--sm' : '')} role="radiogroup">
      {options.map(([v, label]) => (
        <button type="button" role="radio" aria-checked={value === v} class={value === v ? 'is-on' : ''} onClick={() => onChange(v)}>{label}</button>
      ))}
    </div>
  );
}

// Slider where the far end means "no limit" (null).
export function Range({ label, value, min, max, step = 1, fmt = (v) => v, anyLabel = 'Any', anyAt = 'max', onChange, hint }) {
  const anyVal = anyAt === 'max' ? max : min;
  const v = value == null ? anyVal : Math.min(max, Math.max(min, value));
  return (
    <label class="range">
      <span class="range__top"><span>{label}</span><b class={value == null ? 'is-any' : ''}>{value == null ? anyLabel : fmt(value)}</b></span>
      <input type="range" min={min} max={max} step={step} value={v} onInput={(e) => { const n = +e.currentTarget.value; onChange(n === anyVal ? null : n); }} />
      {hint && <span class="range__hint">{hint}</span>}
    </label>
  );
}

export function Switch({ on, onChange, label, hint }) {
  return (
    <button type="button" class={'switch' + (on ? ' is-on' : '')} role="switch" aria-checked={!!on} onClick={() => onChange(!on)}>
      <span class="switch__text"><b>{label}</b>{hint && <small>{hint}</small>}</span>
      <span class="switch__track"><span class="switch__dot" /></span>
    </button>
  );
}

export function Modal({ title, sub, onClose, children, footer, wide, class: cls = '' }) {
  return (
    <div class="modalwrap" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <section class={`modal ${wide ? 'modal--wide' : ''} ${cls}`} role="dialog" aria-label={title}>
        <header class="modal__head">
          <div><h2>{title}</h2>{sub && <p>{sub}</p>}</div>
          <button type="button" class="iconbtn" aria-label="Close" onClick={onClose}><Icon name="close" /></button>
        </header>
        <div class="modal__body">{children}</div>
        {footer && <footer class="modal__foot">{footer}</footer>}
      </section>
    </div>
  );
}

export function Section({ title, children, aside }) {
  return (
    <section class="sec">
      <h3>{title}{aside && <span class="sec__aside">{aside}</span>}</h3>
      {children}
    </section>
  );
}

export function Num({ label, value, onChange, placeholder = 'Any', prefix, step = 1, min = 0 }) {
  return (
    <label class="num">
      <span>{label}</span>
      <span class="num__box">{prefix && <i>{prefix}</i>}
        <input type="number" inputMode="decimal" min={min} step={step} placeholder={placeholder} value={value ?? ''} onInput={(e) => { const t = e.currentTarget.value; onChange(t === '' ? null : +t); }} />
      </span>
    </label>
  );
}

export async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true; } catch { /* fall through */ }
  try {
    const ta = document.createElement('textarea');
    ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  } catch { return false; }
}
