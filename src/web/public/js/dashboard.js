/* The guild dashboard: loads settings, tracks edits, saves them in one go. */

(() => {
  'use strict';

  const root = document.querySelector('.dash');
  if (!root) return;

  const guildId = root.dataset.guild;
  const csrf = document.querySelector('meta[name="csrf-token"]')?.content ?? '';
  const api = (path) => `/api/guilds/${guildId}${path}`;

  /** Current saved values, and the edits not yet written. */
  let settings = {};
  let guild = { channels: [], roles: [] };
  const pending = new Map();

  /* ── fetch helper ───────────────────────────────────────────── */

  async function request(path, options = {}) {
    const response = await fetch(api(path), {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': csrf,
        ...(options.headers ?? {}),
      },
    });

    let data = null;
    try {
      data = await response.json();
    } catch {
      data = null;
    }

    if (!response.ok) throw new Error(data?.error ?? `Request failed (${response.status})`);
    return data;
  }

  /* ── panels ─────────────────────────────────────────────────── */

  const nav = document.getElementById('panel-nav');
  const panels = [...document.querySelectorAll('[data-panel-body]')];

  function showPanel(name, { push = true } = {}) {
    const exists = panels.some((panel) => panel.dataset.panelBody === name);
    const target = exists ? name : 'overview';

    panels.forEach((panel) => panel.classList.toggle('is-active', panel.dataset.panelBody === target));
    nav?.querySelectorAll('button').forEach((button) => {
      button.classList.toggle('is-active', button.dataset.panel === target);
    });

    if (push && location.hash.slice(1) !== target) history.replaceState(null, '', `#${target}`);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  nav?.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-panel]');
    if (button) showPanel(button.dataset.panel);
  });

  /* ── option lists ───────────────────────────────────────────── */

  function populateSelects() {
    const byType = {
      text: guild.channels.filter((channel) => channel.type === 'text'),
      voice: guild.channels.filter((channel) => channel.type === 'voice'),
      category: guild.channels.filter((channel) => channel.type === 'category'),
      all: guild.channels.filter((channel) => channel.type !== 'category'),
      role: guild.roles,
    };

    document.querySelectorAll('select[data-populate]').forEach((select) => {
      const kind = select.dataset.populate;
      const items = byType[kind] ?? [];
      const keep = select.value;

      // Preserve the placeholder, replace everything else.
      const placeholder = select.querySelector('option[value=""]');
      select.replaceChildren();
      if (placeholder) select.appendChild(placeholder);

      for (const item of items) {
        const option = document.createElement('option');
        option.value = item.id;
        if (kind === 'role') {
          option.textContent = item.assignable ? `@${item.name}` : `@${item.name} (above the bot)`;
          if (!item.assignable) option.dataset.warn = 'true';
        } else {
          option.textContent = item.type === 'voice' ? `🔊 ${item.name}` : item.type === 'category' ? `▸ ${item.name}` : `# ${item.name}`;
        }
        select.appendChild(option);
      }

      if (keep) select.value = keep;
    });
  }

  const channelName = (id) => guild.channels.find((channel) => channel.id === id)?.name ?? id;
  const roleFor = (id) => guild.roles.find((role) => role.id === id);

  /* ── rendering values into controls ─────────────────────────── */

  function renderChips(key) {
    const box = document.querySelector(`[data-chips="${CSS.escape(key)}"]`);
    if (!box) return;

    const type = box.dataset.type;
    const values = current(key) ?? [];
    box.replaceChildren();

    values.forEach((value) => {
      const chip = document.createElement('span');
      chip.className = 'chip';

      if (type === 'roles') {
        const role = roleFor(value);
        if (role?.color) {
          const dot = document.createElement('span');
          dot.className = 'chip-dot';
          dot.style.background = role.color;
          chip.appendChild(dot);
        }
      }

      const label = document.createElement('span');
      label.textContent = type === 'roles' ? `@${roleFor(value)?.name ?? value}` : type === 'channels' ? `#${channelName(value)}` : value;
      chip.appendChild(label);

      const remove = document.createElement('button');
      remove.type = 'button';
      remove.textContent = '×';
      remove.setAttribute('aria-label', `Remove ${label.textContent}`);
      remove.addEventListener('click', () => {
        stage(key, values.filter((entry) => entry !== value));
        renderChips(key);
      });

      chip.appendChild(remove);
      box.appendChild(chip);
    });
  }

  /** The value to display: a pending edit if there is one, else the saved value. */
  function current(key) {
    return pending.has(key) ? pending.get(key) : settings[key];
  }

  function renderControls() {
    document.querySelectorAll('[data-setting]').forEach((input) => {
      const key = input.dataset.setting;
      const value = current(key);

      switch (input.dataset.type) {
        case 'boolean': {
          input.checked = Boolean(value);
          const state = input.parentElement.querySelector('.state');
          if (state) state.textContent = input.checked ? 'On' : 'Off';
          break;
        }
        case 'color': {
          const hex = typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value) ? value : '#000000';
          input.value = hex;
          const text = document.querySelector(`[data-color-text="${CSS.escape(key)}"]`);
          if (text) text.value = hex;
          break;
        }
        default:
          input.value = value === null || value === undefined ? '' : value;
          break;
      }
    });

    document.querySelectorAll('[data-chips]').forEach((box) => renderChips(box.dataset.chips));
  }

  /* ── edit tracking ──────────────────────────────────────────── */

  const saveBar = document.getElementById('save-bar');
  const changeCount = document.getElementById('change-count');

  function sameValue(a, b) {
    if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every((value, index) => value === b[index]);
    return a === b;
  }

  function stage(key, value) {
    if (sameValue(value, settings[key])) pending.delete(key);
    else pending.set(key, value);
    refreshSaveBar();
  }

  function refreshSaveBar() {
    if (!saveBar) return;
    saveBar.classList.toggle('is-visible', pending.size > 0);
    if (changeCount) changeCount.textContent = String(pending.size);
  }

  // One delegated listener covers every generated control.
  document.addEventListener('input', (event) => {
    const input = event.target.closest('[data-setting]');
    if (!input) return;

    const key = input.dataset.setting;

    switch (input.dataset.type) {
      case 'boolean': {
        const state = input.parentElement.querySelector('.state');
        if (state) state.textContent = input.checked ? 'On' : 'Off';
        stage(key, input.checked);
        break;
      }
      case 'number':
        stage(key, input.value === '' ? 0 : Number(input.value));
        break;
      case 'color': {
        const text = document.querySelector(`[data-color-text="${CSS.escape(key)}"]`);
        if (text) text.value = input.value;
        stage(key, input.value.toLowerCase());
        break;
      }
      case 'channel':
      case 'category':
      case 'role':
        stage(key, input.value || null);
        break;
      default:
        stage(key, input.value);
        break;
    }
  });

  // Typing a hex value by hand should drive the picker too.
  document.addEventListener('input', (event) => {
    const text = event.target.closest('[data-color-text]');
    if (!text) return;

    const key = text.dataset.colorText;
    let value = text.value.trim();
    if (!value.startsWith('#')) value = `#${value}`;
    if (!/^#[0-9a-f]{6}$/i.test(value)) return;

    const picker = document.querySelector(`[data-setting="${CSS.escape(key)}"][data-type="color"]`);
    if (picker) picker.value = value;
    stage(key, value.toLowerCase());
  });

  // Chip adders.
  document.addEventListener('click', (event) => {
    const button = event.target.closest('[data-add]');
    if (!button) return;

    const key = button.dataset.add;
    const adder = document.querySelector(`[data-adder-for="${CSS.escape(key)}"]`);
    if (!adder) return;

    const value = adder.value.trim();
    if (!value) return;

    const values = [...(current(key) ?? [])];
    if (values.includes(value)) {
      window.toast?.('That is already in the list.', 'info');
      return;
    }

    values.push(value);
    stage(key, values);
    renderChips(key);
    adder.value = '';
  });

  // Enter in a text adder should add rather than submit anything.
  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter') return;
    const adder = event.target.closest('input[data-adder-for]');
    if (!adder) return;
    event.preventDefault();
    document.querySelector(`[data-add="${CSS.escape(adder.dataset.adderFor)}"]`)?.click();
  });

  /* ── saving ─────────────────────────────────────────────────── */

  document.getElementById('save-changes')?.addEventListener('click', async (event) => {
    if (!pending.size) return;

    const button = event.currentTarget;
    button.disabled = true;
    button.textContent = 'Saving…';

    try {
      const body = Object.fromEntries(pending);
      const result = await request('/settings', { method: 'PATCH', body: JSON.stringify(body) });

      settings = result.settings;
      pending.clear();
      renderControls();
      refreshSaveBar();

      const failed = Object.entries(result.errors ?? {});
      if (failed.length) {
        window.toast?.(`${failed[0][0]}: ${failed[0][1]}`, 'error', 6000);
      } else {
        window.toast?.(`Saved ${result.saved.length} change${result.saved.length === 1 ? '' : 's'}.`, 'success');
      }
    } catch (error) {
      window.toast?.(error.message, 'error', 6000);
    } finally {
      button.disabled = false;
      button.textContent = 'Save changes';
    }
  });

  document.getElementById('discard-changes')?.addEventListener('click', () => {
    pending.clear();
    renderControls();
    refreshSaveBar();
    window.toast?.('Changes discarded.', 'info');
  });

  // Leaving with unsaved edits is almost always a mistake.
  window.addEventListener('beforeunload', (event) => {
    if (!pending.size) return;
    event.preventDefault();
    event.returnValue = '';
  });

  /* ── reset a section ────────────────────────────────────────── */

  document.addEventListener('click', async (event) => {
    const button = event.target.closest('[data-reset-category]');
    if (!button) return;

    const category = button.dataset.resetCategory;
    if (!confirm(`Reset every ${category} setting back to its default?`)) return;

    try {
      const result = await request('/reset', { method: 'POST', body: JSON.stringify({ category }) });
      settings = result.settings;
      pending.clear();
      renderControls();
      refreshSaveBar();
      window.toast?.(`${category} reset to defaults.`, 'success');
    } catch (error) {
      window.toast?.(error.message, 'error');
    }
  });

  /* ── prefix ─────────────────────────────────────────────────── */

  document.getElementById('save-prefix')?.addEventListener('click', async () => {
    const input = document.getElementById('prefix-input');
    const prefix = input.value.trim();
    if (!prefix) return window.toast?.('Give me a prefix.', 'error');

    try {
      await request('/prefix', { method: 'POST', body: JSON.stringify({ prefix }) });
      window.toast?.(`Prefix is now "${prefix}".`, 'success');
    } catch (error) {
      window.toast?.(error.message, 'error');
    }
    return undefined;
  });

  /* ── template preview ───────────────────────────────────────── */

  document.addEventListener('click', async (event) => {
    const button = event.target.closest('[data-preview]');
    if (!button) return;

    const key = button.dataset.preview;
    const textarea = document.querySelector(`textarea[data-setting="${CSS.escape(key)}"]`);
    const target = document.querySelector(`[data-preview-target="${CSS.escape(key)}"]`);
    if (!textarea || !target) return;

    try {
      const result = await request('/preview', { method: 'POST', body: JSON.stringify({ template: textarea.value }) });
      target.hidden = false;
      target.replaceChildren(buildPreview(result));
    } catch (error) {
      window.toast?.(error.message, 'error');
    }
  });

  /** Build a Discord-ish preview of what the template renders to. */
  function buildPreview({ content, embed }) {
    const shell = document.createElement('div');
    shell.className = 'preview-shell';

    if (content) {
      const line = document.createElement('div');
      line.className = 'preview-content';
      line.textContent = content;
      shell.appendChild(line);
    }

    if (embed) {
      const box = document.createElement('div');
      box.className = 'preview-embed';
      if (typeof embed.color === 'number') {
        box.style.borderLeftColor = `#${embed.color.toString(16).padStart(6, '0')}`;
      }

      if (embed.author?.name) {
        const author = document.createElement('div');
        author.className = 'f';
        author.style.marginTop = '0';
        author.style.marginBottom = '6px';
        author.textContent = embed.author.name;
        box.appendChild(author);
      }

      if (embed.title) {
        const title = document.createElement('div');
        title.className = 't';
        title.textContent = embed.title;
        box.appendChild(title);
      }

      if (embed.description) {
        const description = document.createElement('div');
        description.className = 'd';
        description.textContent = embed.description;
        box.appendChild(description);
      }

      (embed.fields ?? []).forEach((field) => {
        const wrapper = document.createElement('div');
        wrapper.style.marginTop = '8px';
        const name = document.createElement('div');
        name.className = 't';
        name.style.fontSize = '0.85rem';
        name.textContent = field.name;
        const value = document.createElement('div');
        value.className = 'd';
        value.textContent = field.value;
        wrapper.append(name, value);
        box.appendChild(wrapper);
      });

      if (embed.thumbnail?.url) {
        const thumb = document.createElement('img');
        thumb.className = 'thumb';
        thumb.src = embed.thumbnail.url;
        thumb.alt = '';
        box.appendChild(thumb);
      }

      if (embed.footer?.text) {
        const footer = document.createElement('div');
        footer.className = 'f';
        footer.textContent = embed.footer.text;
        box.appendChild(footer);
      }

      shell.appendChild(box);
    }

    if (!content && !embed) {
      const empty = document.createElement('p');
      empty.className = 'dim small';
      empty.style.margin = '0';
      empty.textContent = 'This template produces an empty message.';
      shell.appendChild(empty);
    }

    return shell;
  }

  // Variable chips insert at the cursor.
  document.addEventListener('click', (event) => {
    const chip = event.target.closest('[data-insert]');
    if (!chip) return;

    const textarea = document.querySelector(`textarea[data-setting="${CSS.escape(chip.dataset.insert)}"]`);
    if (!textarea) return;

    const start = textarea.selectionStart ?? textarea.value.length;
    const end = textarea.selectionEnd ?? textarea.value.length;
    const variable = chip.dataset.variable;

    textarea.value = textarea.value.slice(0, start) + variable + textarea.value.slice(end);
    textarea.focus();
    textarea.setSelectionRange(start + variable.length, start + variable.length);
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
  });

  /* ── level rewards ──────────────────────────────────────────── */

  function renderRewards(rewards) {
    const list = document.getElementById('level-rewards');
    if (!list) return;

    if (!rewards.length) {
      list.replaceChildren(Object.assign(document.createElement('p'), {
        className: 'dim small',
        textContent: 'No rewards yet — add one below.',
      }));
      return;
    }

    list.replaceChildren();
    rewards.forEach((reward) => {
      const row = document.createElement('div');
      row.className = 'row-item';

      const level = document.createElement('strong');
      level.textContent = `Level ${reward.level}`;

      const arrow = document.createElement('span');
      arrow.className = 'dim';
      arrow.textContent = '→';

      const role = document.createElement('span');
      role.className = 'grow';
      const found = roleFor(reward.role_id);
      role.textContent = found ? `@${found.name}` : `Deleted role (${reward.role_id})`;
      if (found?.color) role.style.color = found.color;

      const remove = document.createElement('button');
      remove.className = 'btn btn-sm btn-danger';
      remove.type = 'button';
      remove.textContent = 'Remove';
      remove.addEventListener('click', async () => {
        try {
          const result = await request(`/level-rewards/${reward.level}`, { method: 'DELETE' });
          renderRewards(result.rewards);
          window.toast?.('Reward removed.', 'success');
        } catch (error) {
          window.toast?.(error.message, 'error');
        }
      });

      row.append(level, arrow, role, remove);
      list.appendChild(row);
    });
  }

  document.getElementById('add-reward')?.addEventListener('click', async () => {
    const level = Number(document.getElementById('reward-level').value);
    const roleId = document.getElementById('reward-role').value;
    if (!level || !roleId) return window.toast?.('Pick a level and a role.', 'error');

    try {
      const result = await request('/level-rewards', { method: 'POST', body: JSON.stringify({ level, roleId }) });
      renderRewards(result.rewards);
      document.getElementById('reward-level').value = '';
      window.toast?.('Reward added.', 'success');
    } catch (error) {
      window.toast?.(error.message, 'error');
    }
    return undefined;
  });

  /* ── autoresponders ─────────────────────────────────────────── */

  function renderAutoresponders(items) {
    const list = document.getElementById('autoresponders');
    if (!list) return;

    if (!items.length) {
      list.replaceChildren(Object.assign(document.createElement('p'), {
        className: 'dim small',
        textContent: 'None yet — add one below.',
      }));
      return;
    }

    list.replaceChildren();
    items.forEach((item) => {
      const row = document.createElement('div');
      row.className = 'row-item';

      const trigger = document.createElement('strong');
      trigger.textContent = item.trigger;

      const arrow = document.createElement('span');
      arrow.className = 'dim';
      arrow.textContent = '→';

      const response = document.createElement('span');
      response.className = 'grow';
      response.textContent = item.response;

      const remove = document.createElement('button');
      remove.className = 'btn btn-sm btn-danger';
      remove.type = 'button';
      remove.textContent = 'Remove';
      remove.addEventListener('click', async () => {
        try {
          const result = await request(`/autoresponders/${item.id}`, { method: 'DELETE' });
          renderAutoresponders(result.items);
          window.toast?.('Autoresponder removed.', 'success');
        } catch (error) {
          window.toast?.(error.message, 'error');
        }
      });

      row.append(trigger, arrow, response, remove);
      list.appendChild(row);
    });
  }

  document.getElementById('add-ar')?.addEventListener('click', async () => {
    const trigger = document.getElementById('ar-trigger').value.trim();
    const response = document.getElementById('ar-response').value.trim();
    if (!trigger || !response) return window.toast?.('Fill in both fields.', 'error');

    try {
      const result = await request('/autoresponders', { method: 'POST', body: JSON.stringify({ trigger, response }) });
      renderAutoresponders(result.items);
      document.getElementById('ar-trigger').value = '';
      document.getElementById('ar-response').value = '';
      window.toast?.('Autoresponder added.', 'success');
    } catch (error) {
      window.toast?.(error.message, 'error');
    }
    return undefined;
  });

  /* ── stats ──────────────────────────────────────────────────── */

  function renderStats(stats) {
    document.querySelectorAll('[data-stat]').forEach((element) => {
      const value = stats[element.dataset.stat];
      element.textContent = typeof value === 'number' ? value.toLocaleString() : '0';
    });

    renderRewards(stats.levelRewards ?? []);

    const top = document.getElementById('top-members');
    if (top) {
      if (!stats.topMembers?.length) {
        top.replaceChildren(Object.assign(document.createElement('p'), { className: 'dim small', textContent: 'No XP earned yet.' }));
      } else {
        top.replaceChildren();
        stats.topMembers.forEach((member, index) => {
          const row = document.createElement('div');
          row.className = 'mini-row';

          const position = document.createElement('span');
          position.className = 'muted';
          position.textContent = `#${index + 1}`;

          if (member.avatar) {
            const avatar = document.createElement('img');
            avatar.src = member.avatar;
            avatar.alt = '';
            row.appendChild(position);
            row.appendChild(avatar);
          } else {
            row.appendChild(position);
          }

          const name = document.createElement('span');
          name.className = 'grow';
          name.textContent = member.name;

          const level = document.createElement('span');
          level.className = 'muted';
          level.textContent = `level ${member.level}`;

          row.append(name, level);
          top.appendChild(row);
        });
      }
    }

    const recent = document.getElementById('recent-cases');
    if (recent) {
      if (!stats.recentCases?.length) {
        recent.replaceChildren(Object.assign(document.createElement('p'), { className: 'dim small', textContent: 'No moderation actions yet.' }));
      } else {
        recent.replaceChildren();
        stats.recentCases.forEach((entry) => {
          const row = document.createElement('div');
          row.className = 'mini-row';

          const number = document.createElement('span');
          number.className = 'muted';
          number.textContent = `#${entry.case_number}`;

          const label = document.createElement('span');
          label.className = 'grow';
          label.textContent = `${entry.type} — ${entry.name}`;

          const when = document.createElement('span');
          when.className = 'muted';
          when.textContent = new Date(entry.created_at * 1000).toLocaleDateString();

          row.append(number, label, when);
          recent.appendChild(row);
        });
      }
    }
  }

  /* ── boot ───────────────────────────────────────────────────── */

  (async function load() {
    try {
      const data = await request('');
      guild = data.guild;
      settings = data.settings;

      populateSelects();
      renderControls();
      showPanel(location.hash.slice(1) || 'overview', { push: false });

      const stats = await request('/stats');
      renderStats(stats);

      const autoresponders = await request('/autoresponders');
      renderAutoresponders(autoresponders.items);
    } catch (error) {
      window.toast?.(`Could not load this server: ${error.message}`, 'error', 8000);
    }
  })();
})();
