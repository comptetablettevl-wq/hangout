// ── Catégories de channels ────────────────────────────────

window.CategoriesState = {
  collapsed: new Set(JSON.parse(localStorage.getItem('ho_collapsed_cats') || '[]')),
};

const saveCategoriesState = () => {
  localStorage.setItem('ho_collapsed_cats', JSON.stringify([...CategoriesState.collapsed]));
};

/**
 * Rend la liste des channels organisée par catégories.
 * Si le serveur a des catégories, les utilise.
 * Sinon, fallback sur le rendu plat actuel.
 */
window.renderChannelsList = (server) => {
  const list = document.getElementById('channels-list');
  const myMember = server.members?.find(m => m.user?.id === State.user?.id);
  const canManage = ['owner','admin'].includes(myMember?.role);

  const categories = server.categories || [];

  if (categories.length > 0) {
    renderWithCategories(list, server, categories, canManage);
  } else {
    renderFlat(list, server, canManage);
  }
};

const renderWithCategories = (list, server, categories, canManage) => {
  // Channels sans catégorie
  const uncategorized = (server.channels || []).filter(c => !c.category_id);

  let html = '';

  // D'abord les channels sans catégorie (si il y en a)
  if (uncategorized.length > 0) {
    html += uncategorized.map(ch => renderChannelItem(ch, server, canManage)).join('');
  }

  // Ensuite les catégories
  categories.forEach(cat => {
    const channels  = cat.channels || [];
    const collapsed = CategoriesState.collapsed.has(cat.id);

    html += `
      <div class="channel-category cat-header" data-cat-id="${cat.id}" onclick="toggleCategoryCollapse('${cat.id}')">
        <div style="display:flex;align-items:center;gap:4px;flex:1;min-width:0">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"
            style="transition:transform 200ms;transform:rotate(${collapsed ? '-90' : '0'}deg);flex-shrink:0"
            id="cat-arrow-${cat.id}">
            <path d="M7 10l5 5 5-5z"/>
          </svg>
          <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap"
            ondblclick="event.stopPropagation();inlineRenameCategory('${cat.id}',this)"
            title="Double-clic pour renommer">${escapeHtml(cat.name)}</span>
        </div>
        <div style="display:flex;align-items:center;gap:2px" onclick="event.stopPropagation()">
          ${canManage ? `
            <button class="channel-add-btn" title="Ajouter un channel"
              onclick="openCreateChannelInCategory('${cat.id}')"
              style="width:16px;height:16px;font-size:14px;color:var(--text-muted);background:none;border:none;cursor:pointer;line-height:1;display:flex;align-items:center;justify-content:center">+</button>
            <button class="channel-add-btn" title="Modifier la catégorie"
              onclick="openEditCategory('${cat.id}','${escapeHtml(cat.name)}')"
              style="width:16px;height:16px;font-size:11px;color:var(--text-muted);background:none;border:none;cursor:pointer">✏️</button>
            <button class="channel-add-btn" title="Supprimer la catégorie"
              onclick="deleteCategory('${cat.id}','${escapeHtml(cat.name)}')"
              style="width:16px;height:16px;font-size:11px;color:var(--red);background:none;border:none;cursor:pointer">🗑️</button>` : ''}
        </div>
      </div>
      <div id="cat-channels-${cat.id}" class="cat-channels-list" style="${collapsed ? 'display:none' : ''}">
        ${channels.map(ch => renderChannelItem(ch, server, canManage)).join('')}
      </div>`;
  });

  // Bouton créer catégorie
  if (canManage) {
    html += `<div style="padding:8px 8px 0">
      <button onclick="openCreateCategory()" class="btn btn-ghost btn-sm btn-full"
        style="font-size:12px;color:var(--text-muted);text-align:left;padding:4px 8px">
        + Ajouter une catégorie
      </button>
    </div>`;
  }

  list.innerHTML = html;
};

const renderFlat = (list, server, canManage) => {
  const textChannels  = server.channels?.filter(c => c.type === 'text')  || [];
  const voiceChannels = server.channels?.filter(c => c.type === 'voice') || [];

  list.innerHTML = `
    <div class="channel-category cat-header" data-cat-id="text" onclick="toggleCategoryCollapse('text')">
      <div style="display:flex;align-items:center;gap:4px;flex:1">
        <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"
          style="transition:transform 200ms;transform:rotate(${CategoriesState.collapsed.has('text') ? '-90' : '0'}deg)"
          id="cat-arrow-text"><path d="M7 10l5 5 5-5z"/></svg>
        <span>TEXTE</span>
      </div>
      ${canManage ? `<button onclick="event.stopPropagation();openCreateChannelModal('text')" style="font-size:14px;color:var(--text-muted);background:none;border:none;cursor:pointer">+</button>` : ''}
    </div>
    <div id="cat-channels-text" style="${CategoriesState.collapsed.has('text') ? 'display:none' : ''}">
      ${textChannels.map(ch => renderChannelItem(ch, server, canManage)).join('')}
    </div>
    <div class="channel-category cat-header" data-cat-id="voice" onclick="toggleCategoryCollapse('voice')" style="margin-top:8px">
      <div style="display:flex;align-items:center;gap:4px;flex:1">
        <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"
          style="transition:transform 200ms;transform:rotate(${CategoriesState.collapsed.has('voice') ? '-90' : '0'}deg)"
          id="cat-arrow-voice"><path d="M7 10l5 5 5-5z"/></svg>
        <span>VOCAL</span>
      </div>
      ${canManage ? `<button onclick="event.stopPropagation();openCreateChannelModal('voice')" style="font-size:14px;color:var(--text-muted);background:none;border:none;cursor:pointer">+</button>` : ''}
    </div>
    <div id="cat-channels-voice" style="${CategoriesState.collapsed.has('voice') ? 'display:none' : ''}">
      ${voiceChannels.map(ch => renderChannelItem(ch, server, canManage)).join('')}
    </div>`;
};

const renderChannelItem = (ch, server, canManage) => {
  const isActive = State.currentChannel?.id === ch.id;
  const icon = ch.type === 'voice' ? '🔊' : '#';
  return `
    <div class="channel-item ${isActive ? 'active' : ''}" data-channel-id="${ch.id}"
      onclick="selectChannel('${ch.id}')"
      oncontextmenu="event.preventDefault();showChannelContextMenu(event,'${ch.id}','${escapeHtml(ch.name)}',${canManage})">
      <span class="channel-icon">${icon}</span>
      <span class="channel-name">${escapeHtml(ch.name)}</span>
      ${canManage ? `<span class="channel-actions">
        <button onclick="event.stopPropagation();deleteChannel('${ch.id}')" style="color:var(--red)">×</button>
      </span>` : ''}
    </div>
    <div id="voice-members-${ch.id}"></div>`;
};

// ── Toggle collapse ───────────────────────────────────────
window.toggleCategoryCollapse = (catId) => {
  const el    = document.getElementById(`cat-channels-${catId}`);
  const arrow = document.getElementById(`cat-arrow-${catId}`);
  if (!el) return;

  const isCollapsed = el.style.display === 'none';
  el.style.display = isCollapsed ? '' : 'none';
  if (arrow) arrow.style.transform = `rotate(${isCollapsed ? '0' : '-90'}deg)`;

  if (isCollapsed) CategoriesState.collapsed.delete(catId);
  else             CategoriesState.collapsed.add(catId);
  saveCategoriesState();
};

// ── CRUD catégories ───────────────────────────────────────
window.openCreateCategory = async () => {
  const name = prompt('Nom de la catégorie :');
  if (!name?.trim()) return;
  try {
    const cat = await api.post(`/servers/${State.currentServer.id}/categories`, { name: name.trim() });
    if (!State.currentServer.categories) State.currentServer.categories = [];
    cat.channels = [];
    State.currentServer.categories.push(cat);
    renderChannelsList(State.currentServer);
    showToast('Catégorie créée !', 'success');
  } catch (err) { showToast(err.message, 'error'); }
};

window.openEditCategory = async (catId, currentName) => {
  const name = prompt('Renommer la catégorie :', currentName);
  if (!name?.trim() || name.trim() === currentName) return;
  try {
    await api.patch(`/servers/${State.currentServer.id}/categories/${catId}`, { name: name.trim() });
    const cat = State.currentServer.categories?.find(c => c.id === catId);
    if (cat) cat.name = name.trim().toUpperCase();
    renderChannelsList(State.currentServer);
    showToast('Catégorie renommée', 'success');
  } catch (err) { showToast(err.message, 'error'); }
};

window.openCreateChannelInCategory = (catId) => {
  // Stocker la catégorie cible et ouvrir la modal existante
  window._targetCategoryId = catId;
  openCreateChannelModal('text');
};

// ── Créer channel avec catégorie ─────────────────────────
// Override du confirm-create-channel pour associer la catégorie
const _origConfirmChannel = window._confirmCreateChannel;
// Remplace le handler global de création de channel pour gérer les catégories
// Utilise un flag window._createChannelHandler pour éviter les doublons
document.addEventListener('DOMContentLoaded', () => {
  const btn = document.getElementById('confirm-create-channel-btn');
  if (!btn) return;

  // Supprimer tout ancien listener
  const newBtn = btn.cloneNode(true);
  btn.parentNode.replaceChild(newBtn, btn);

  newBtn.addEventListener('click', async () => {
    const name  = document.getElementById('new-channel-name').value.trim();
    const errEl = document.getElementById('create-channel-error');
    if (!name) { errEl.textContent = 'Nom requis'; return; }
    try {
      const channel = await api.post(`/servers/${State.currentServer.id}/channels`, {
        name,
        type: State.newChannelType,
      });

      if (window._targetCategoryId) {
        await api.patch(`/servers/${State.currentServer.id}/categories/assign/${channel.id}`, {
          category_id: window._targetCategoryId,
        });
        channel.category_id = window._targetCategoryId;
        const cat = State.currentServer.categories?.find(c => c.id === window._targetCategoryId);
        if (cat) {
          if (!cat.channels) cat.channels = [];
          cat.channels.push(channel);
        }
        window._targetCategoryId = null;
      } else {
        if (!State.currentServer.channels) State.currentServer.channels = [];
        State.currentServer.channels.push(channel);
      }

      renderChannelsList(State.currentServer);
      closeModal('modal-create-channel');
      showToast('Channel créé !', 'success');
    } catch (err) { errEl.textContent = err.message; }
  });
});

window.deleteCategory = async (catId, catName) => {
  if (!confirm(`Supprimer la catégorie "${catName}" ?\nLes channels qu'elle contient ne seront pas supprimés.`)) return;
  try {
    await api.delete(`/servers/${State.currentServer.id}/categories/${catId}`);
    // Déplacer les channels vers la liste principale
    const cat = State.currentServer.categories?.find(c => c.id === catId);
    if (cat?.channels?.length) {
      cat.channels.forEach(ch => {
        ch.category_id = null;
        State.currentServer.channels.push(ch);
      });
    }
    State.currentServer.categories = State.currentServer.categories?.filter(c => c.id !== catId) || [];
    renderChannelsList(State.currentServer);
    showToast('Catégorie supprimée', 'success');
  } catch (err) { showToast(err.message, 'error'); }
};

window.inlineRenameCategory = (catId, spanEl) => {
  const currentName = spanEl.textContent;
  const input = document.createElement('input');
  input.value = currentName;
  input.style.cssText = 'background:var(--bg-input);border:1px solid var(--accent);border-radius:3px;padding:1px 4px;font-size:11px;font-weight:700;color:var(--text-primary);width:120px;outline:none;font-family:var(--font)';
  spanEl.replaceWith(input);
  input.focus();
  input.select();

  const save = async () => {
    const newName = input.value.trim();
    if (newName && newName !== currentName) {
      try {
        await api.patch(`/servers/${State.currentServer.id}/categories/${catId}`, { name: newName });
        const cat = State.currentServer.categories?.find(c => c.id === catId);
        if (cat) cat.name = newName.toUpperCase();
        renderChannelsList(State.currentServer);
        return;
      } catch (err) { showToast(err.message, 'error'); }
    }
    // Annuler : restaurer le span
    input.replaceWith(spanEl);
  };

  input.addEventListener('blur', save);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); input.blur(); }
    if (e.key === 'Escape') { input.value = currentName; input.blur(); }
  });
};
