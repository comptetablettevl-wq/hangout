// ── Recherche globale dans un serveur ─────────────────────
window.openGlobalSearch = () => {
  let overlay = document.getElementById('global-search-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'global-search-overlay';
    overlay.style.cssText = `
      position:fixed;inset:0;background:rgba(0,0,0,0.7);
      display:flex;align-items:flex-start;justify-content:center;
      padding-top:80px;z-index:500;animation:fadeIn 100ms ease`;
    overlay.innerHTML = `
      <div style="background:var(--bg-modal);border-radius:var(--radius-lg);width:100%;max-width:600px;
                  box-shadow:var(--shadow-lg);overflow:hidden;animation:slideUp 200ms ease">
        <div style="display:flex;align-items:center;gap:12px;padding:16px;border-bottom:1px solid var(--border)">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" style="color:var(--text-muted);flex-shrink:0">
            <path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
          </svg>
          <input id="global-search-input" type="text" placeholder="Rechercher dans ce serveur..."
            style="flex:1;background:transparent;border:none;font-size:16px;color:var(--text-primary);outline:none" />
          <span style="font-size:12px;color:var(--text-muted);background:var(--bg-elevated);
                       padding:2px 6px;border-radius:4px;flex-shrink:0">ESC</span>
        </div>
        <div style="padding:8px;display:flex;gap:6px;flex-wrap:wrap;border-bottom:1px solid var(--border)" id="search-channel-filters"></div>
        <div id="global-search-results" style="max-height:400px;overflow-y:auto"></div>
      </div>`;
    document.body.appendChild(overlay);

    overlay.addEventListener('click', e => { if (e.target === overlay) closeGlobalSearch(); });
    document.addEventListener('keydown', handleSearchKeydown);
  }

  overlay.style.display = 'flex';
  document.getElementById('global-search-input').value = '';
  document.getElementById('global-search-results').innerHTML = '';
  document.getElementById('global-search-input').focus();

  // Filtres par channel
  renderChannelFilters();
};

window._searchChannelFilter = null;

window.renderChannelFilters = () => {
  const el = document.getElementById('search-channel-filters');
  if (!el || !State.currentServer) return;
  const textChannels = State.currentServer.channels?.filter(c => c.type === 'text') || [];
  el.innerHTML = `
    <button class="btn btn-sm ${!_searchChannelFilter ? 'btn-primary' : 'btn-secondary'}"
      onclick="setSearchFilter(null)" style="padding:3px 10px;font-size:12px">Tout</button>
    ${textChannels.map(c => `
      <button class="btn btn-sm ${_searchChannelFilter === c.id ? 'btn-primary' : 'btn-secondary'}"
        onclick="setSearchFilter('${c.id}')" style="padding:3px 10px;font-size:12px">#${escapeHtml(c.name)}</button>
    `).join('')}`;
};

window.setSearchFilter = (channelId) => {
  window._searchChannelFilter = channelId;
  renderChannelFilters();
  const q = document.getElementById('global-search-input')?.value;
  if (q?.length >= 2) performGlobalSearch(q);
};

window.closeGlobalSearch = () => {
  const overlay = document.getElementById('global-search-overlay');
  if (overlay) overlay.style.display = 'none';
  document.removeEventListener('keydown', handleSearchKeydown);
};

window.handleSearchKeydown = (e) => {
  if (e.key === 'Escape') closeGlobalSearch();
};

// Debounce search
let _searchTimeout;
document.addEventListener('input', e => {
  if (e.target.id !== 'global-search-input') return;
  clearTimeout(_searchTimeout);
  const q = e.target.value.trim();
  if (q.length < 2) {
    document.getElementById('global-search-results').innerHTML =
      '<p style="padding:20px;text-align:center;color:var(--text-muted);font-size:13px">Tape au moins 2 caractères</p>';
    return;
  }
  _searchTimeout = setTimeout(() => performGlobalSearch(q), 350);
});

window.performGlobalSearch = async (q) => {
  if (!State.currentServer) return;
  const el = document.getElementById('global-search-results');
  el.innerHTML = '<p style="padding:20px;text-align:center;color:var(--text-muted);font-size:13px">Recherche...</p>';

  try {
    const params = new URLSearchParams({ q, limit: 20 });
    if (window._searchChannelFilter) params.set('channel', window._searchChannelFilter);

    const results = await api.get(`/servers/${State.currentServer.id}/search?${params}`);

    if (!results.length) {
      el.innerHTML = '<p style="padding:20px;text-align:center;color:var(--text-muted);font-size:13px">Aucun résultat pour "' + escapeHtml(q) + '"</p>';
      return;
    }

    el.innerHTML = results.map(msg => {
      const channelName = State.currentServer.channels?.find(c => c.id === msg.channel_id)?.name || '?';
      const highlighted = escapeHtml(msg.content).replace(
        new RegExp(escapeHtml(q), 'gi'),
        m => `<mark style="background:rgba(250,166,26,0.3);color:var(--yellow);border-radius:2px;padding:0 1px">${m}</mark>`
      );
      return `
        <div style="padding:12px 16px;border-bottom:1px solid var(--border);cursor:pointer;transition:background 100ms"
          onmouseover="this.style.background='var(--bg-hover)'" onmouseout="this.style.background=''"
          onclick="jumpToSearchResult('${msg.channel_id}','${msg.id}')">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
            ${renderAvatar(msg.author, 'avatar-sm')}
            <span style="font-weight:600;font-size:13px">${escapeHtml(msg.author?.username || '?')}</span>
            <span style="font-size:11px;color:var(--text-muted)">#${escapeHtml(channelName)}</span>
            <span style="font-size:11px;color:var(--text-muted);margin-left:auto">${formatRelativeTime(msg.created_at)}</span>
          </div>
          <div style="font-size:14px;color:var(--text-secondary);line-height:1.4">${highlighted.slice(0, 200)}</div>
        </div>`;
    }).join('');
  } catch (err) {
    el.innerHTML = `<p style="padding:20px;text-align:center;color:var(--red);font-size:13px">${escapeHtml(err.message)}</p>`;
  }
};

window.jumpToSearchResult = (channelId, msgId) => {
  closeGlobalSearch();
  // Naviguer vers le channel si différent
  if (channelId !== State.currentChannel?.id) {
    selectChannel(channelId);
    // Attendre que les messages soient chargés puis scroller
    setTimeout(() => scrollToMessage(msgId), 800);
  } else {
    scrollToMessage(msgId);
  }
};

// Raccourci clavier Ctrl+K
document.addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
    e.preventDefault();
    if (State.currentServer) openGlobalSearch();
  }
});
