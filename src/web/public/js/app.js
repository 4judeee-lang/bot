/* Shared behaviour: mobile nav, toasts, and the guide search. */

(() => {
  'use strict';

  /* ── mobile navigation ──────────────────────────────────────── */

  const toggle = document.querySelector('.nav-toggle');
  const nav = document.getElementById('site-nav');

  if (toggle && nav) {
    toggle.addEventListener('click', () => {
      const open = toggle.getAttribute('aria-expanded') === 'true';
      toggle.setAttribute('aria-expanded', String(!open));
      nav.classList.toggle('is-open', !open);
    });

    // Close when a link is tapped, or when the viewport grows past the breakpoint.
    nav.addEventListener('click', (event) => {
      if (event.target.closest('a')) {
        toggle.setAttribute('aria-expanded', 'false');
        nav.classList.remove('is-open');
      }
    });

    window.matchMedia('(min-width: 801px)').addEventListener('change', (event) => {
      if (event.matches) {
        toggle.setAttribute('aria-expanded', 'false');
        nav.classList.remove('is-open');
      }
    });
  }

  /* ── toasts ─────────────────────────────────────────────────── */

  const stack = document.getElementById('toasts');

  window.toast = (message, kind = 'info', duration = 4000) => {
    if (!stack) return;
    const element = document.createElement('div');
    element.className = `toast toast-${kind}`;
    element.textContent = message;
    stack.appendChild(element);

    setTimeout(() => {
      element.classList.add('is-leaving');
      element.addEventListener('animationend', () => element.remove(), { once: true });
    }, duration);
  };

  /* ── guide search ───────────────────────────────────────────── */

  const search = document.getElementById('cmd-search');

  if (search) {
    const groups = [...document.querySelectorAll('.cmd-group[data-category]')];
    const commands = [...document.querySelectorAll('.cmd[data-search]')];
    const empty = document.getElementById('no-results');
    const summary = document.getElementById('search-summary');

    const apply = () => {
      const query = search.value.trim().toLowerCase();

      if (!query) {
        commands.forEach((command) => {
          command.hidden = false;
          command.open = false;
        });
        groups.forEach((group) => { group.hidden = false; });
        if (empty) empty.hidden = true;
        if (summary) summary.hidden = true;
        return;
      }

      let matches = 0;
      commands.forEach((command) => {
        const hit = command.dataset.search.includes(query);
        command.hidden = !hit;
        // Open the first few matches so the answer is visible immediately.
        command.open = hit && matches < 5;
        if (hit) matches += 1;
      });

      groups.forEach((group) => {
        group.hidden = ![...group.querySelectorAll('.cmd')].some((command) => !command.hidden);
      });

      if (empty) empty.hidden = matches > 0;
      if (summary) {
        summary.hidden = false;
        summary.textContent = `${matches} command${matches === 1 ? '' : 's'} match “${search.value.trim()}”`;
      }
    };

    let timer;
    search.addEventListener('input', () => {
      clearTimeout(timer);
      timer = setTimeout(apply, 120);
    });

    // "/" focuses the search box, Escape clears it.
    document.addEventListener('keydown', (event) => {
      if (event.key === '/' && document.activeElement !== search && !/input|textarea/i.test(document.activeElement.tagName)) {
        event.preventDefault();
        search.focus();
      }
      if (event.key === 'Escape' && document.activeElement === search) {
        search.value = '';
        apply();
        search.blur();
      }
    });
  }
})();
