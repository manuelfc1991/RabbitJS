/*!
 * RabbitJS v1.0.0
 * A modern, jQuery-surpassing DOM manipulation library
 * Features: Full jQuery API + Reactive data, CSS vars, IntersectionObserver,
 *           MutationObserver, Promise-based AJAX, template engine, event delegation,
 *           animation timeline, plugin system, lazy loading, drag & drop, and more.
 * License: MIT
 */

(function (global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined'
    ? (module.exports = factory())
    : typeof define === 'function' && define.amd
    ? define(factory)
    : (global.RabbitJS = global.$ = factory());
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : this, function () {
  'use strict';

  // ─── Internal Utilities ──────────────────────────────────────────────────────

  const isFunction  = v => typeof v === 'function';
  const isString    = v => typeof v === 'string';
  const isObject    = v => v !== null && typeof v === 'object';
  const isArray     = Array.isArray;
  const isNodeList  = v => v instanceof NodeList || v instanceof HTMLCollection;
  const isElement   = v => v instanceof Element || v instanceof Document || v instanceof Window;
  const toArray     = v => Array.from(v);
  const noop        = () => {};

  let _idCounter = 0;
  const uid = () => `rb-${++_idCounter}-${Date.now().toString(36)}`;

  const _dataStore  = new WeakMap();
  const _evStore    = new WeakMap();
  const _reactStore = new WeakMap();

  function getData(el) {
    if (!_dataStore.has(el)) _dataStore.set(el, {});
    return _dataStore.get(el);
  }

  function getEvents(el) {
    if (!_evStore.has(el)) _evStore.set(el, {});
    return _evStore.get(el);
  }

  // ─── RabbitJS Collection Class ───────────────────────────────────────────────

  class RabbitCollection {
    constructor(elements) {
      this._els = elements ? toArray(isNodeList(elements) ? elements : isArray(elements) ? elements : [elements].filter(Boolean)) : [];
      this.length = this._els.length;
      this._els.forEach((el, i) => { this[i] = el; });
    }

    // ── Iteration ────────────────────────────────────────────────────────────

    each(fn) {
      this._els.forEach((el, i) => fn.call(el, i, el));
      return this;
    }

    map(fn) {
      return rb(this._els.map((el, i) => fn.call(el, i, el)));
    }

    filter(selector) {
      const fn = isFunction(selector)
        ? selector
        : el => el.matches && el.matches(selector);
      return rb(this._els.filter(fn));
    }

    not(selector) {
      const fn = isFunction(selector)
        ? selector
        : el => !(el.matches && el.matches(selector));
      return rb(this._els.filter(fn));
    }

    eq(index) {
      const i = index < 0 ? this._els.length + index : index;
      return rb(this._els[i]);
    }

    first() { return this.eq(0); }
    last()  { return this.eq(-1); }

    get(index) {
      return index === undefined ? [...this._els] : this._els[index < 0 ? this._els.length + index : index];
    }

    toArray() { return [...this._els]; }

    slice(start, end) { return rb(this._els.slice(start, end)); }

    // ── Selection ────────────────────────────────────────────────────────────

    find(selector) {
      const found = [];
      this._els.forEach(el => found.push(...toArray(el.querySelectorAll(selector))));
      return rb([...new Set(found)]);
    }

    closest(selector) {
      const found = new Set();
      this._els.forEach(el => {
        const c = el.closest(selector);
        if (c) found.add(c);
      });
      return rb([...found]);
    }

    parent(selector) {
      const parents = new Set(this._els.map(el => el.parentElement).filter(Boolean));
      return selector ? rb([...parents].filter(el => el.matches(selector))) : rb([...parents]);
    }

    parents(selector) {
      const result = new Set();
      this._els.forEach(el => {
        let p = el.parentElement;
        while (p) { if (!selector || p.matches(selector)) result.add(p); p = p.parentElement; }
      });
      return rb([...result]);
    }

    children(selector) {
      const result = [];
      this._els.forEach(el => {
        const kids = toArray(el.children);
        result.push(...(selector ? kids.filter(c => c.matches(selector)) : kids));
      });
      return rb(result);
    }

    siblings(selector) {
      const result = new Set();
      this._els.forEach(el => {
        toArray(el.parentElement?.children || []).forEach(sib => {
          if (sib !== el && (!selector || sib.matches(selector))) result.add(sib);
        });
      });
      return rb([...result]);
    }

    next(selector) {
      return rb(this._els.map(el => {
        let s = el.nextElementSibling;
        while (s && selector && !s.matches(selector)) s = s.nextElementSibling;
        return s;
      }).filter(Boolean));
    }

    prev(selector) {
      return rb(this._els.map(el => {
        let s = el.previousElementSibling;
        while (s && selector && !s.matches(selector)) s = s.previousElementSibling;
        return s;
      }).filter(Boolean));
    }

    nextAll(selector) {
      const result = [];
      this._els.forEach(el => {
        let s = el.nextElementSibling;
        while (s) { if (!selector || s.matches(selector)) result.push(s); s = s.nextElementSibling; }
      });
      return rb(result);
    }

    prevAll(selector) {
      const result = [];
      this._els.forEach(el => {
        let s = el.previousElementSibling;
        while (s) { if (!selector || s.matches(selector)) result.push(s); s = s.previousElementSibling; }
      });
      return rb(result);
    }

    is(selector) {
      if (isFunction(selector)) return this._els.some((el, i) => selector.call(el, i, el));
      if (isElement(selector))  return this._els.includes(selector);
      return this._els.some(el => el.matches && el.matches(selector));
    }

    has(selector) {
      return rb(this._els.filter(el =>
        isElement(selector) ? el.contains(selector) : el.querySelector(selector)
      ));
    }

    index(target) {
      if (target === undefined) {
        const el = this._els[0];
        return el ? toArray(el.parentElement?.children || []).indexOf(el) : -1;
      }
      const t = rb(target).get(0);
      return this._els.indexOf(t);
    }

    // ── DOM Manipulation ──────────────────────────────────────────────────────

    html(value) {
      if (value === undefined) return this._els[0]?.innerHTML ?? '';
      return this.each(el => { el.innerHTML = isFunction(value) ? value.call(el, 0, el.innerHTML) : value; });
    }

    text(value) {
      if (value === undefined) return this._els.map(el => el.textContent).join('');
      return this.each(el => { el.textContent = isFunction(value) ? value.call(el, 0, el.textContent) : value; });
    }

    val(value) {
      if (value === undefined) {
        const el = this._els[0];
        if (!el) return undefined;
        if (el.type === 'checkbox' || el.type === 'radio') return el.checked ? el.value : null;
        if (el.tagName === 'SELECT' && el.multiple)
          return toArray(el.selectedOptions).map(o => o.value);
        return el.value;
      }
      return this.each(el => {
        const v = isFunction(value) ? value.call(el, 0, el.value) : value;
        if (el.type === 'checkbox' || el.type === 'radio') el.checked = isArray(v) ? v.includes(el.value) : String(v) === el.value;
        else el.value = v;
      });
    }

    append(...args) {
      return this.each(el => args.forEach(a => el.append(_makeNode(a))));
    }

    prepend(...args) {
      return this.each(el => args.forEach(a => el.prepend(_makeNode(a))));
    }

    appendTo(target) {
      rb(target).append(this._els);
      return this;
    }

    prependTo(target) {
      rb(target).prepend(this._els);
      return this;
    }

    after(...args) {
      return this.each(el => args.forEach(a => el.after(_makeNode(a))));
    }

    before(...args) {
      return this.each(el => args.forEach(a => el.before(_makeNode(a))));
    }

    insertAfter(target) {
      rb(target).after(this._els);
      return this;
    }

    insertBefore(target) {
      rb(target).before(this._els);
      return this;
    }

    wrap(wrapper) {
      return this.each(el => {
        const w = _makeNode(isFunction(wrapper) ? wrapper.call(el) : wrapper);
        el.replaceWith(w);
        w.append(el);
      });
    }

    wrapAll(wrapper) {
      const first = this._els[0];
      if (!first) return this;
      const w = _makeNode(wrapper);
      first.before(w);
      this._els.forEach(el => w.append(el));
      return this;
    }

    wrapInner(wrapper) {
      return this.each(el => {
        const w = _makeNode(isFunction(wrapper) ? wrapper.call(el) : wrapper);
        const kids = toArray(el.childNodes);
        el.append(w);
        kids.forEach(k => w.append(k));
      });
    }

    unwrap(selector) {
      return this.each(el => {
        const p = el.parentElement;
        if (!p || (selector && !p.matches(selector))) return;
        p.replaceWith(...toArray(p.childNodes));
      });
    }

    remove(selector) {
      return this.each(el => {
        if (!selector || el.matches(selector)) el.remove();
      });
    }

    detach(selector) {
      return this.remove(selector);
    }

    empty() {
      return this.each(el => { el.innerHTML = ''; });
    }

    clone(withEvents) {
      return rb(this._els.map(el => {
        const c = el.cloneNode(true);
        if (withEvents) {
          const evs = getEvents(el);
          Object.keys(evs).forEach(type => evs[type].forEach(({ fn, opts }) => c.addEventListener(type, fn, opts)));
        }
        return c;
      }));
    }

    replaceWith(newContent) {
      return this.each(el => el.replaceWith(_makeNode(isFunction(newContent) ? newContent.call(el) : newContent)));
    }

    replaceAll(target) {
      rb(target).replaceWith(this._els[0]);
      return this;
    }

    // ── Attributes ────────────────────────────────────────────────────────────

    attr(name, value) {
      if (isObject(name)) {
        return this.each(el => Object.entries(name).forEach(([k, v]) => v === null ? el.removeAttribute(k) : el.setAttribute(k, v)));
      }
      if (value === undefined) return this._els[0]?.getAttribute(name) ?? null;
      if (value === null) return this.removeAttr(name);
      return this.each(el => el.setAttribute(name, isFunction(value) ? value.call(el, 0, el.getAttribute(name)) : value));
    }

    removeAttr(name) {
      return this.each(el => name.split(' ').forEach(n => el.removeAttribute(n)));
    }

    prop(name, value) {
      if (isObject(name)) {
        return this.each(el => Object.assign(el, name));
      }
      if (value === undefined) return this._els[0]?.[name];
      return this.each(el => { el[name] = isFunction(value) ? value.call(el, 0, el[name]) : value; });
    }

    removeProp(name) {
      return this.each(el => { delete el[name]; });
    }

    data(key, value) {
      if (key === undefined) {
        const el = this._els[0];
        if (!el) return {};
        const d = getData(el);
        const ds = {};
        if (el.dataset) Object.assign(ds, el.dataset);
        return Object.assign(ds, d);
      }
      if (isObject(key)) {
        return this.each(el => Object.assign(getData(el), key));
      }
      if (value === undefined) {
        const el = this._els[0];
        if (!el) return undefined;
        const d = getData(el);
        return d[key] !== undefined ? d[key] : el.dataset?.[key];
      }
      return this.each(el => { getData(el)[key] = value; });
    }

    removeData(key) {
      return this.each(el => {
        const d = getData(el);
        if (key) delete d[key]; else Object.keys(d).forEach(k => delete d[k]);
      });
    }

    // ── Classes ───────────────────────────────────────────────────────────────

    addClass(names) {
      return this.each(el => {
        const list = isFunction(names) ? names.call(el, 0, el.className).split(' ') : names.split(' ');
        el.classList.add(...list.filter(Boolean));
      });
    }

    removeClass(names) {
      if (names === undefined) return this.each(el => { el.className = ''; });
      return this.each(el => {
        const list = isFunction(names) ? names.call(el, 0, el.className).split(' ') : names.split(' ');
        el.classList.remove(...list.filter(Boolean));
      });
    }

    toggleClass(names, state) {
      return this.each(el => {
        const list = isFunction(names) ? names.call(el, 0, el.className).split(' ') : names.split(' ');
        list.filter(Boolean).forEach(c => el.classList.toggle(c, state));
      });
    }

    hasClass(name) {
      return this._els.some(el => el.classList.contains(name));
    }

    // ── CSS / Styles ──────────────────────────────────────────────────────────

    css(prop, value) {
      if (isObject(prop)) {
        return this.each(el => {
          Object.entries(prop).forEach(([k, v]) => {
            k.startsWith('--') ? el.style.setProperty(k, v) : (el.style[k] = v);
          });
        });
      }
      if (value === undefined) {
        const el = this._els[0];
        if (!el) return '';
        if (prop.startsWith('--')) return getComputedStyle(el).getPropertyValue(prop).trim();
        return getComputedStyle(el)[prop];
      }
      const v = isFunction(value) ? value.call(this._els[0], 0, getComputedStyle(this._els[0])[prop]) : value;
      return this.each(el => {
        prop.startsWith('--') ? el.style.setProperty(prop, v) : (el.style[prop] = v);
      });
    }

    cssVar(name, value) {
      if (value === undefined) {
        const el = this._els[0] || document.documentElement;
        return getComputedStyle(el).getPropertyValue(name).trim();
      }
      return this.each(el => el.style.setProperty(name, value));
    }

    show(display) {
      return this.each(el => { el.style.display = display || (el._rbDisplay || 'block'); });
    }

    hide() {
      return this.each(el => {
        const d = getComputedStyle(el).display;
        if (d !== 'none') el._rbDisplay = d;
        el.style.display = 'none';
      });
    }

    toggle(show) {
      return this.each(el => {
        const hidden = getComputedStyle(el).display === 'none';
        const shouldShow = show === undefined ? hidden : show;
        shouldShow ? rb(el).show() : rb(el).hide();
      });
    }

    // ── Dimensions ────────────────────────────────────────────────────────────

    width(value) {
      if (value === undefined) return this._els[0]?.getBoundingClientRect().width ?? 0;
      return this.css('width', isString(value) ? value : `${value}px`);
    }

    height(value) {
      if (value === undefined) return this._els[0]?.getBoundingClientRect().height ?? 0;
      return this.css('height', isString(value) ? value : `${value}px`);
    }

    innerWidth()  { const el = this._els[0]; return el ? el.clientWidth : 0; }
    innerHeight() { const el = this._els[0]; return el ? el.clientHeight : 0; }
    outerWidth(margin)  {
      const el = this._els[0]; if (!el) return 0;
      const r = el.getBoundingClientRect();
      if (!margin) return r.width;
      const s = getComputedStyle(el);
      return r.width + parseFloat(s.marginLeft) + parseFloat(s.marginRight);
    }
    outerHeight(margin) {
      const el = this._els[0]; if (!el) return 0;
      const r = el.getBoundingClientRect();
      if (!margin) return r.height;
      const s = getComputedStyle(el);
      return r.height + parseFloat(s.marginTop) + parseFloat(s.marginBottom);
    }

    offset() {
      const el = this._els[0];
      if (!el) return { top: 0, left: 0 };
      const r = el.getBoundingClientRect();
      return { top: r.top + window.scrollY, left: r.left + window.scrollX };
    }

    position() {
      const el = this._els[0];
      if (!el) return { top: 0, left: 0 };
      return { top: el.offsetTop, left: el.offsetLeft };
    }

    scrollTop(value) {
      if (value === undefined) return this._els[0]?.scrollTop ?? window.scrollY;
      return this.each(el => { el.scrollTop = value; });
    }

    scrollLeft(value) {
      if (value === undefined) return this._els[0]?.scrollLeft ?? window.scrollX;
      return this.each(el => { el.scrollLeft = value; });
    }

    // ── Events ────────────────────────────────────────────────────────────────

    on(types, selectorOrFn, fnOrOpts, opts) {
      let selector, fn, options;
      if (isFunction(selectorOrFn)) { fn = selectorOrFn; options = fnOrOpts; }
      else { selector = selectorOrFn; fn = fnOrOpts; options = opts; }

      types.trim().split(/\s+/).forEach(typeNs => {
        const [type, ns] = typeNs.split('.');
        this._els.forEach(el => {
          const handler = selector
            ? function (e) {
                const target = e.target.closest(selector);
                if (target && el.contains(target)) fn.call(target, e);
              }
            : fn;
          el.addEventListener(type, handler, options);
          const evs = getEvents(el);
          if (!evs[type]) evs[type] = [];
          evs[type].push({ fn, handler, ns, selector, opts: options });
        });
      });
      return this;
    }

    off(types, selectorOrFn, fn) {
      if (!types) {
        return this.each(el => {
          const evs = getEvents(el);
          Object.keys(evs).forEach(type => {
            evs[type].forEach(e => el.removeEventListener(type, e.handler));
            delete evs[type];
          });
        });
      }

      let selector, handler;
      if (isFunction(selectorOrFn)) handler = selectorOrFn;
      else { selector = selectorOrFn; handler = fn; }

      types.trim().split(/\s+/).forEach(typeNs => {
        const [type, ns] = typeNs.split('.');
        this._els.forEach(el => {
          const evs = getEvents(el);
          if (!evs[type]) return;
          evs[type] = evs[type].filter(e => {
            const matchNs = !ns || e.ns === ns;
            const matchFn = !handler || e.fn === handler;
            const matchSel = !selector || e.selector === selector;
            if (matchNs && matchFn && matchSel) {
              el.removeEventListener(type, e.handler);
              return false;
            }
            return true;
          });
        });
      });
      return this;
    }

    one(types, selectorOrFn, fn) {
      const actualFn = isFunction(selectorOrFn) ? selectorOrFn : fn;
      const wrapped = function (e) {
        actualFn.call(this, e);
        rb(this).off(types, wrapped);
      };
      return isFunction(selectorOrFn)
        ? this.on(types, wrapped)
        : this.on(types, selectorOrFn, wrapped);
    }

    trigger(type, data) {
      const event = type instanceof Event ? type : new CustomEvent(type, { bubbles: true, cancelable: true, detail: data });
      return this.each(el => el.dispatchEvent(event));
    }

    triggerHandler(type, data) {
      const el = this._els[0];
      if (!el) return;
      const evs = getEvents(el)[isString(type) ? type : type.type];
      if (evs?.length) evs[0].fn.call(el, new CustomEvent(type, { detail: data }));
    }

    // ── Animation ─────────────────────────────────────────────────────────────

    animate(props, duration, easing, callback) {
      if (isObject(duration)) {
        callback = duration.complete;
        easing   = duration.easing;
        duration = duration.duration;
      }
      if (isFunction(easing)) { callback = easing; easing = 'ease'; }
      duration = duration ?? 400;
      easing   = easing   ?? 'ease';

      const promises = this._els.map(el => new Promise(resolve => {
        el.style.transition = `all ${duration}ms ${easing}`;
        Object.entries(props).forEach(([k, v]) => {
          el.style[k] = isString(v) ? v : `${v}${_guessUnit(k)}`;
        });

        const done = () => {
          el.style.transition = '';
          resolve(el);
          callback?.call(el);
        };
        el.addEventListener('transitionend', done, { once: true });
        setTimeout(done, duration + 50);
      }));

      this._animPromise = Promise.all(promises);
      return this;
    }

    stop(clearQueue, jumpToEnd) {
      return this.each(el => { el.style.transition = 'none'; });
    }

    fadeIn(duration, easing, cb)  { return this.css('opacity', '0').show().animate({ opacity: 1 }, duration, easing, cb); }
    fadeOut(duration, easing, cb) { return this.animate({ opacity: 0 }, duration, easing, () => { rb(this).hide(); cb?.(); }); }
    fadeTo(duration, opacity, easing, cb) { return this.animate({ opacity }, duration, easing, cb); }
    fadeToggle(duration, easing, cb) {
      return this.each(el => getComputedStyle(el).opacity == 0 ? rb(el).fadeIn(duration, easing, cb) : rb(el).fadeOut(duration, easing, cb));
    }

    slideDown(duration, easing, cb) {
      return this.each(el => {
        el.style.overflow = 'hidden';
        el.style.height = '0';
        el.style.display = el._rbDisplay || 'block';
        const h = el.scrollHeight;
        rb(el).animate({ height: h }, duration, easing, () => {
          el.style.overflow = ''; el.style.height = ''; cb?.call(el);
        });
      });
    }

    slideUp(duration, easing, cb) {
      return this.each(el => {
        const h = el.scrollHeight;
        el.style.overflow = 'hidden';
        el.style.height = `${h}px`;
        rb(el).animate({ height: 0 }, duration, easing, () => {
          el.style.display = 'none'; el.style.overflow = ''; el.style.height = ''; cb?.call(el);
        });
      });
    }

    slideToggle(duration, easing, cb) {
      return this.each(el => {
        const hidden = getComputedStyle(el).display === 'none' || el.style.height === '0px';
        hidden ? rb(el).slideDown(duration, easing, cb) : rb(el).slideUp(duration, easing, cb);
      });
    }

    // ─── Animation Timeline ───────────────────────────────────────────────────

    timeline(steps) {
      let delay = 0;
      steps.forEach(step => {
        const { target, props, duration = 400, easing = 'ease', offset = 0 } = step;
        delay += offset;
        setTimeout(() => rb(target).animate(props, duration, easing), delay);
        delay += duration;
      });
      return this;
    }

    // ── Form Utilities ────────────────────────────────────────────────────────

    serialize() {
      const parts = [];
      this._els.forEach(el => {
        const form = el.tagName === 'FORM' ? el : el.closest('form') || el;
        toArray(form.elements).forEach(f => {
          if (!f.name || f.disabled) return;
          if ((f.type === 'checkbox' || f.type === 'radio') && !f.checked) return;
          parts.push(`${encodeURIComponent(f.name)}=${encodeURIComponent(f.value)}`);
        });
      });
      return parts.join('&');
    }

    serializeArray() {
      return this.serialize().split('&').map(s => {
        const [n, v] = s.split('=');
        return { name: decodeURIComponent(n), value: decodeURIComponent(v) };
      });
    }

    serializeJSON() {
      const obj = {};
      this.serializeArray().forEach(({ name, value }) => {
        if (obj[name]) {
          obj[name] = [].concat(obj[name], value);
        } else {
          obj[name] = value;
        }
      });
      return obj;
    }

    submit(fn) { return fn ? this.on('submit', fn) : this.trigger('submit'); }
    reset()    { return this.each(el => el.reset && el.reset()); }

    // ── Utilities ─────────────────────────────────────────────────────────────

    ready(fn) {
      if (document.readyState !== 'loading') fn();
      else document.addEventListener('DOMContentLoaded', fn);
      return this;
    }

    focus(fn)   { return fn ? this.on('focus', fn) : this.each(el => el.focus()); }
    blur(fn)    { return fn ? this.on('blur', fn) : this.each(el => el.blur()); }
    select(fn)  { return fn ? this.on('select', fn) : this.each(el => el.select()); }
    click(fn)   { return fn ? this.on('click', fn) : this.each(el => el.click()); }
    dblclick(fn){ return fn ? this.on('dblclick', fn) : this.trigger('dblclick'); }
    change(fn)  { return fn ? this.on('change', fn) : this.trigger('change'); }
    input(fn)   { return fn ? this.on('input', fn) : this.trigger('input'); }
    keydown(fn) { return fn ? this.on('keydown', fn) : this.trigger('keydown'); }
    keyup(fn)   { return fn ? this.on('keyup', fn) : this.trigger('keyup'); }
    keypress(fn){ return fn ? this.on('keypress', fn) : this.trigger('keypress'); }
    mouseenter(fn) { return fn ? this.on('mouseenter', fn) : this.trigger('mouseenter'); }
    mouseleave(fn) { return fn ? this.on('mouseleave', fn) : this.trigger('mouseleave'); }
    mouseover(fn)  { return fn ? this.on('mouseover', fn) : this.trigger('mouseover'); }
    mouseout(fn)   { return fn ? this.on('mouseout', fn) : this.trigger('mouseout'); }
    mousemove(fn)  { return fn ? this.on('mousemove', fn) : this.trigger('mousemove'); }
    mousedown(fn)  { return fn ? this.on('mousedown', fn) : this.trigger('mousedown'); }
    mouseup(fn)    { return fn ? this.on('mouseup', fn) : this.trigger('mouseup'); }
    contextmenu(fn){ return fn ? this.on('contextmenu', fn) : this.trigger('contextmenu'); }

    hover(inFn, outFn) {
      return this.on('mouseenter', inFn).on('mouseleave', outFn || inFn);
    }

    resize(fn) { return fn ? this.on('resize', fn) : this.trigger('resize'); }
    scroll(fn) { return fn ? this.on('scroll', fn) : this.trigger('scroll'); }
    load(fn)   { return fn ? this.on('load', fn) : this.trigger('load'); }
    error(fn)  { return fn ? this.on('error', fn) : this.trigger('error'); }

    // ─── Reactive data binding ────────────────────────────────────────────────

    bind(key, render) {
      return this.each(el => {
        let value;
        const store = _reactStore.has(el) ? _reactStore.get(el) : {};
        Object.defineProperty(store, key, {
          get: () => value,
          set: v => { value = v; render.call(el, v, rb(el)); },
          configurable: true, enumerable: true
        });
        _reactStore.set(el, store);
        el._rbReactive = store;
      });
    }

    reactive(key) {
      const el = this._els[0];
      return el?._rbReactive?.[key];
    }

    setReactive(key, value) {
      return this.each(el => {
        if (el._rbReactive) el._rbReactive[key] = value;
      });
    }

    // IntersectionObserver
    observe(fn, options) {
      const obs = new IntersectionObserver((entries) => {
        entries.forEach(e => fn.call(e.target, e, rb(e.target)));
      }, options);
      return this.each(el => obs.observe(el));
    }

    inView(fn, threshold = 0.1) {
      return this.observe(fn, { threshold });
    }

    // MutationObserver
    watch(fn, options = { childList: true, subtree: true, attributes: true, characterData: true }) {
      return this.each(el => {
        const obs = new MutationObserver(mutations => fn.call(el, mutations, rb(el)));
        obs.observe(el, options);
        getData(el)._rbObserver = obs;
      });
    }

    unwatch() {
      return this.each(el => { getData(el)._rbObserver?.disconnect(); });
    }

    // ResizeObserver
    onResize(fn) {
      const obs = new ResizeObserver(entries => {
        entries.forEach(e => fn.call(e.target, e, rb(e.target)));
      });
      return this.each(el => obs.observe(el));
    }

    // Drag & Drop
    draggable(options = {}) {
      return this.each(el => {
        el.setAttribute('draggable', true);
        let startX, startY, initLeft, initTop;
        el.addEventListener('mousedown', e => {
          if (options.handle && !e.target.closest(options.handle)) return;
          startX = e.clientX; startY = e.clientY;
          initLeft = el.offsetLeft; initTop = el.offsetTop;
          const move = ev => {
            el.style.left = `${initLeft + ev.clientX - startX}px`;
            el.style.top  = `${initTop + ev.clientY - startY}px`;
            options.drag?.call(el, ev);
          };
          const up = ev => {
            document.removeEventListener('mousemove', move);
            document.removeEventListener('mouseup', up);
            options.stop?.call(el, ev);
          };
          document.addEventListener('mousemove', move);
          document.addEventListener('mouseup', up);
          options.start?.call(el, e);
        });
      });
    }

    droppable(options = {}) {
      return this.each(el => {
        el.addEventListener('dragover', e => { e.preventDefault(); options.over?.call(el, e); });
        el.addEventListener('drop', e => { e.preventDefault(); options.drop?.call(el, e); });
        el.addEventListener('dragenter', e => options.enter?.call(el, e));
        el.addEventListener('dragleave', e => options.leave?.call(el, e));
      });
    }

    // Lazy load images
    lazyLoad(options = {}) {
      const { threshold = 0.1, src = 'data-src', placeholder = '' } = options;
      return this.each(el => {
        if (placeholder && !el.src) el.src = placeholder;
        const obs = new IntersectionObserver(([entry]) => {
          if (entry.isIntersecting) {
            const s = el.getAttribute(src);
            if (s) el.src = s;
            obs.disconnect();
          }
        }, { threshold });
        obs.observe(el);
      });
    }

    // Template rendering
    render(template, data) {
      return this.each(el => {
        el.innerHTML = rb.template(template, data);
      });
    }

    // Clipboard
    copy() {
      const text = this._els[0]?.value || this._els[0]?.textContent || '';
      return Promise.resolve(navigator.clipboard?.writeText(text) || (
        (() => {
          const t = document.createElement('textarea');
          t.value = text; document.body.appendChild(t); t.select();
          document.execCommand('copy'); document.body.removeChild(t);
        })()
      ));
    }

    // Throttled / debounced event
    onThrottle(event, fn, wait = 200) {
      let last = 0;
      return this.on(event, function (e) {
        const now = Date.now();
        if (now - last >= wait) { last = now; fn.call(this, e); }
      });
    }

    onDebounce(event, fn, wait = 300) {
      let timer;
      return this.on(event, function (e) {
        clearTimeout(timer);
        timer = setTimeout(() => fn.call(this, e), wait);
      });
    }

    // Smooth scroll into view
    scrollIntoView(options = { behavior: 'smooth', block: 'start' }) {
      return this.each(el => el.scrollIntoView(options));
    }

    // CSS custom properties at root level
    rootVar(name, value) {
      if (value === undefined) return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
      document.documentElement.style.setProperty(name, value);
      return this;
    }

    // Wait for animation promise
    then(fn) {
      (this._animPromise || Promise.resolve()).then(fn);
      return this;
    }

    end() { return this; }

    add(selector) {
      return rb([...new Set([...this._els, ...rb(selector)._els])]);
    }

    addBack(selector) {
      return this;
    }

    contents() {
      const result = [];
      this._els.forEach(el => result.push(...toArray(el.childNodes)));
      return rb(result.filter(n => n instanceof Element));
    }

    plugin(name, fn) {
      RabbitCollection.prototype[name] = fn;
      return this;
    }
  }

  // ─── Private Helpers ─────────────────────────────────────────────────────────

  function _makeNode(value) {
    if (isElement(value)) return value;
    if (value instanceof RabbitCollection) return value._els[0];
    if (isArray(value)) { const f = document.createDocumentFragment(); value.forEach(v => f.append(_makeNode(v))); return f; }
    if (isString(value)) {
      const tmp = document.createElement('div');
      tmp.innerHTML = value;
      return tmp.children.length === 1 ? tmp.children[0] : (() => { const f = document.createDocumentFragment(); [...tmp.childNodes].forEach(n => f.append(n)); return f; })();
    }
    return document.createTextNode(String(value));
  }

  function _guessUnit(prop) {
    const unitless = ['opacity', 'zIndex', 'zoom', 'order', 'flexGrow', 'flexShrink', 'lineHeight'];
    return unitless.includes(prop) ? '' : 'px';
  }

  // ─── Static / Global API ─────────────────────────────────────────────────────

  function rb(selector, context) {
    if (!selector) return new RabbitCollection([]);

    if (selector instanceof RabbitCollection) return selector;

    if (isFunction(selector)) {
      if (document.readyState !== 'loading') selector(rb);
      else document.addEventListener('DOMContentLoaded', () => selector(rb));
      return rb(document);
    }

    if (selector === window || selector === document) return new RabbitCollection([selector]);
    if (isElement(selector)) return new RabbitCollection([selector]);

    if (isArray(selector) || isNodeList(selector)) return new RabbitCollection([...selector]);

    if (isString(selector)) {
      if (/^</.test(selector.trim())) {
        const el = _makeNode(selector);
        return new RabbitCollection(el instanceof DocumentFragment ? toArray(el.children) : [el]);
      }
      const root = context ? rb(context).get(0) : document;
      return new RabbitCollection(root ? toArray(root.querySelectorAll(selector)) : []);
    }

    return new RabbitCollection([]);
  }

  // ─── Static Methods ───────────────────────────────────────────────────────────

  rb.fn = RabbitCollection.prototype;

  rb.extend = function (target, ...sources) {
    if (sources.length === 0) { Object.assign(rb.fn, target); return rb; }
    return Object.assign(target, ...sources);
  };

  rb.plugin = function (name, fn) {
    RabbitCollection.prototype[name] = fn;
    return rb;
  };

  rb.noConflict = function () {
    if (global.$ === rb) global.$ = undefined;
    return rb;
  };

  rb.isFunction  = isFunction;
  rb.isArray     = isArray;
  rb.isString    = isString;
  rb.isObject    = isObject;
  rb.isNumeric   = v => !isNaN(parseFloat(v)) && isFinite(v);
  rb.isPlainObject = v => Object.prototype.toString.call(v) === '[object Object]';
  rb.isEmptyObject = v => isObject(v) && Object.keys(v).length === 0;
  rb.isWindow    = v => v === window;

  rb.type = v => Object.prototype.toString.call(v).slice(8, -1).toLowerCase();

  rb.noop = noop;
  rb.now  = Date.now;

  rb.each = function (obj, fn) {
    if (isArray(obj)) obj.forEach((v, i) => fn.call(v, i, v));
    else Object.entries(obj).forEach(([k, v]) => fn.call(v, k, v));
    return obj;
  };

  rb.map = function (obj, fn) {
    if (isArray(obj)) return obj.map((v, i) => fn.call(v, v, i)).filter(v => v != null);
    return Object.entries(obj).map(([k, v]) => fn.call(v, v, k)).filter(v => v != null);
  };

  rb.grep = function (arr, fn, invert) {
    return arr.filter((v, i) => invert ? !fn(v, i) : fn(v, i));
  };

  rb.inArray = function (val, arr, from) { return arr.indexOf(val, from); };

  rb.merge = function (first, second) {
    toArray(second).forEach(v => first.push ? first.push(v) : (first[first.length++] = v));
    return first;
  };

  rb.unique = rb.uniqueSort = function (arr) { return [...new Set(arr)]; };

  rb.trim = s => s.trim();

  rb.parseJSON  = JSON.parse;
  rb.parseXML   = s => new DOMParser().parseFromString(s, 'text/xml');
  rb.parseHTML  = (s, doc) => {
    const d = doc || document;
    const t = d.createElement('div');
    t.innerHTML = s;
    return toArray(t.childNodes);
  };

  rb.contains = (a, b) => a !== b && a.contains(b);

  rb.proxy = function (fn, context, ...args) {
    return function (...callArgs) { return fn.apply(context, [...args, ...callArgs]); };
  };

  rb.error = msg => { throw new Error(msg); };

  rb.expr = { ':': {} };

  // ─── AJAX (Promise-based) ─────────────────────────────────────────────────────

  rb.ajax = function (url, options = {}) {
    if (isObject(url)) { options = url; url = options.url; }

    const {
      method = 'GET',
      data,
      headers = {},
      contentType = 'application/x-www-form-urlencoded; charset=UTF-8',
      dataType = 'json',
      timeout,
      beforeSend,
      success,
      error,
      complete,
      crossDomain,
      cache = true,
    } = options;

    const controller = new AbortController();
    let timer;

    const fetchOptions = {
      method: method.toUpperCase(),
      headers: { 'Content-Type': contentType, 'X-Requested-With': 'XMLHttpRequest', ...headers },
      signal: controller.signal,
      credentials: crossDomain ? 'include' : 'same-origin',
    };

    if (data && method.toUpperCase() !== 'GET') {
      fetchOptions.body = isString(data) ? data
        : contentType.includes('json') ? JSON.stringify(data)
        : new URLSearchParams(data).toString();
    }

    let finalUrl = url;
    if (data && method.toUpperCase() === 'GET') {
      const params = new URLSearchParams(isString(data) ? data : data);
      finalUrl += (finalUrl.includes('?') ? '&' : '?') + params;
    }

    if (!cache) finalUrl += `${finalUrl.includes('?') ? '&' : '?'}_=${Date.now()}`;

    if (timeout) timer = setTimeout(() => controller.abort(), timeout);

    const xhr = { abort: () => controller.abort() };
    beforeSend?.(xhr, fetchOptions);

    const promise = fetch(finalUrl, fetchOptions).then(async res => {
      clearTimeout(timer);
      if (!res.ok) throw Object.assign(new Error(res.statusText), { status: res.status, xhr: res });

      let result;
      if (dataType === 'json')  result = await res.json();
      else if (dataType === 'xml') result = rb.parseXML(await res.text());
      else result = await res.text();

      success?.(result, res.status, res);
      complete?.(res, res.status);
      return result;
    }).catch(err => {
      clearTimeout(timer);
      error?.(xhr, err.name === 'AbortError' ? 'abort' : 'error', err.message);
      complete?.(xhr, 'error');
      return Promise.reject(err);
    });

    promise.abort = () => controller.abort();
    return promise;
  };

  ['get', 'post', 'put', 'patch', 'delete'].forEach(method => {
    rb[method] = function (url, data, success, dataType) {
      if (isFunction(data)) { dataType = success; success = data; data = undefined; }
      return rb.ajax({ url, method: method.toUpperCase(), data, success, dataType });
    };
  });

  rb.getJSON = function (url, data, success) {
    if (isFunction(data)) { success = data; data = undefined; }
    return rb.ajax({ url, data, success, dataType: 'json' });
  };

  rb.getScript = function (url, success) {
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = url;
      s.onload = () => { success?.(); resolve(); };
      s.onerror = reject;
      document.head.appendChild(s);
    });
  };

  rb.ajaxSetup = function (opts) {
    Object.assign(rb.ajax.defaults = rb.ajax.defaults || {}, opts);
  };

  // ─── Deferred (Promise wrapper) ───────────────────────────────────────────────

  rb.Deferred = function (fn) {
    let _resolve, _reject;
    const promise = new Promise((res, rej) => { _resolve = res; _reject = rej; });

    const deferred = {
      resolve: _resolve,
      reject: _reject,
      promise: () => ({ then: promise.then.bind(promise), catch: promise.catch.bind(promise) }),
      done: fn => { promise.then(fn); return deferred; },
      fail: fn => { promise.catch(fn); return deferred; },
      always: fn => { promise.then(fn, fn); return deferred; },
      then: (res, rej) => { promise.then(res, rej); return deferred; },
    };

    fn?.(deferred);
    return deferred;
  };

  rb.when = function (...args) {
    return rb.Deferred(d => {
      Promise.all(args.map(a => isObject(a) && isFunction(a.promise) ? a.promise() : a))
        .then(d.resolve).catch(d.reject);
    });
  };

  // ─── Template Engine ──────────────────────────────────────────────────────────

  rb.template = function (tpl, data) {
    return tpl.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, key) => {
      return key.split('.').reduce((acc, k) => acc?.[k], data) ?? '';
    }).replace(/\{%\s*if\s+([\w.]+)\s*%\}([\s\S]*?)\{%\s*endif\s*%\}/g, (_, key, inner) => {
      return key.split('.').reduce((a, k) => a?.[k], data) ? inner : '';
    }).replace(/\{%\s*each\s+([\w.]+)\s+as\s+(\w+)\s*%\}([\s\S]*?)\{%\s*endeach\s*%\}/g, (_, key, item, inner) => {
      const arr = key.split('.').reduce((a, k) => a?.[k], data);
      return isArray(arr) ? arr.map(v => rb.template(inner, { ...data, [item]: v })).join('') : '';
    });
  };

  // ─── Storage Utilities ────────────────────────────────────────────────────────

  rb.store = {
    set: (k, v, session) => (session ? sessionStorage : localStorage).setItem(k, JSON.stringify(v)),
    get: (k, session) => {
      try { return JSON.parse((session ? sessionStorage : localStorage).getItem(k)); } catch { return null; }
    },
    remove: (k, session) => (session ? sessionStorage : localStorage).removeItem(k),
    clear: session => (session ? sessionStorage : localStorage).clear(),
  };

  // ─── Cookie Utilities ─────────────────────────────────────────────────────────

  rb.cookie = {
    set: (name, value, days, path = '/') => {
      let exp = '';
      if (days) { const d = new Date(); d.setTime(d.getTime() + days * 86400000); exp = `; expires=${d.toUTCString()}`; }
      document.cookie = `${encodeURIComponent(name)}=${encodeURIComponent(value)}${exp}; path=${path}`;
    },
    get: name => {
      const key = `${encodeURIComponent(name)}=`;
      return decodeURIComponent(document.cookie.split(';').map(c => c.trim()).find(c => c.startsWith(key))?.slice(key.length) || '');
    },
    remove: name => rb.cookie.set(name, '', -1),
    all: () => Object.fromEntries(document.cookie.split(';').map(c => c.trim().split('=').map(decodeURIComponent))),
  };

  // ─── Event Bus ────────────────────────────────────────────────────────────────

  rb.bus = (() => {
    const listeners = {};
    return {
      on: (event, fn) => { (listeners[event] = listeners[event] || []).push(fn); },
      off: (event, fn) => { listeners[event] = (listeners[event] || []).filter(f => f !== fn); },
      emit: (event, ...args) => { (listeners[event] || []).forEach(f => f(...args)); },
      once: (event, fn) => {
        const wrap = (...a) => { fn(...a); rb.bus.off(event, wrap); };
        rb.bus.on(event, wrap);
      },
    };
  })();

  // ─── Throttle / Debounce ──────────────────────────────────────────────────────

  rb.throttle = function (fn, wait) {
    let last = 0;
    return function (...args) { const now = Date.now(); if (now - last >= wait) { last = now; return fn.apply(this, args); } };
  };

  rb.debounce = function (fn, wait) {
    let timer;
    return function (...args) { clearTimeout(timer); timer = setTimeout(() => fn.apply(this, args), wait); };
  };

  // ─── CSS Animation Keyframe Helper ───────────────────────────────────────────

  rb.keyframes = function (name, frames) {
    const rules = Object.entries(frames).map(([k, v]) =>
      `${k} { ${Object.entries(v).map(([p, val]) => `${p.replace(/([A-Z])/g, m => `-${m.toLowerCase()}`)}: ${val}`).join('; ')} }`
    ).join(' ');
    const sheet = document.styleSheets[0] || document.head.appendChild(document.createElement('style')).sheet;
    try { sheet.insertRule(`@keyframes ${name} { ${rules} }`, sheet.cssRules.length); } catch {}
    return rb;
  };

  // ─── Fetch with retry & interceptors ─────────────────────────────────────────

  rb.http = (() => {
    const interceptors = { request: [], response: [] };
    const api = {
      interceptors: {
        request: { use: fn => interceptors.request.push(fn) },
        response: { use: fn => interceptors.response.push(fn) },
      },
      fetch: async (url, opts = {}, retries = 0) => {
        interceptors.request.forEach(fn => { opts = fn(opts) || opts; });
        let res;
        for (let i = 0; i <= retries; i++) {
          try { res = await fetch(url, opts); break; }
          catch (e) { if (i === retries) throw e; await new Promise(r => setTimeout(r, 300 * (i + 1))); }
        }
        interceptors.response.forEach(fn => { res = fn(res) || res; });
        return res;
      },
    };
    ['get', 'post', 'put', 'patch', 'delete'].forEach(m => {
      api[m] = (url, data, opts = {}) => api.fetch(url, {
        method: m.toUpperCase(),
        body: data ? JSON.stringify(data) : undefined,
        headers: { 'Content-Type': 'application/json', ...opts.headers },
        ...opts,
      });
    });
    return api;
  })();

  rb.uuid = uid;

  rb.version = '1.0.0';
  rb.fn.rabbitjs = true;

  return rb;
});
