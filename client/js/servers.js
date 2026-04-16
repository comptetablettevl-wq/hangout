// ── Load servers ──────────────────────────────────────────
window.loadServers = async () => {
  try {
    State.servers = await api.get('/servers');
    renderServersList();
    if (State.servers.length > 0) selectServer(State.servers[0]);
  } catch (err) { showToast(err.message, 'error'); }
};

window.renderServersList = () => {
  const list = document.getElementById('servers-list');
  list.innerHTML = State.servers.map(s => {
    const isActive = State.currentServer?.id === s.id;
    const bg = avatarColor(s.name);
    const icon = s.icon ? `<img src="${s.icon}" alt="${escapeHtml(s.name)}" />` : s.name.slice(0,2).toUpperCase();
    return `<div class="server-pill ${isActive?'active':''}" data-server-id="${s.id}"
      onclick="selectServer(State.servers.find(x=>x.id==='${s.id}'))"
      style="${!s.icon?`background:${isActive?'':bg};color:${isActive?'':'#fff'}`:''}"
      oncontextmenu="event.preventDefault();showServerContextMenu(event,'${s.id}')">
      ${icon}<span class="tooltip">${escapeHtml(s.name)}</span></div>`;
  }).join('');
};

window.showServerContextMenu = (event, guildId) => {
  const guild = State.servers.find(s => s.id === guildId);
  if (!guild) return;
  const myMember = guild.members?.find(m => m.user?.id === State.user?.id);
  const isAdmin = ['owner','admin'].includes(myMember?.role);
  const items = [
    { label: '📨 Inviter', action: () => { selectServer(guild); document.getElementById('invite-btn').click(); } },
  ];
  if (isAdmin) {
    items.push({ divider: true });
    items.push({ label: '🎭 Rôles', action: () => { selectServer(guild); openRolesModal(); } });
    items.push({ label: '🔨 Bans', action: () => { selectServer(guild); openBansList(); } });
  }
  items.push({ divider: true });
  items.push({ label: '🚪 Quitter', danger: true, action: () => { selectServer(guild); leaveServer(); } });
  showContextMenu(event, items);
};

window.selectServer = (server) => {
  if (!server) return;
  State.currentServer = server;
  State.currentChannel = null;

  document.querySelectorAll('.server-pill[data-server-id]').forEach(el => {
    el.classList.toggle('active', el.dataset.serverId === server.id);
    if (!server.icon) el.style.background = el.dataset.serverId === server.id ? '' : avatarColor(server.name);
  });
  document.getElementById('friends-btn').classList.remove('active');
  document.getElementById('friends-panel-wrapper').style.display = 'none';
  document.getElementById('welcome-default').style.display = 'flex';

  const sidebar = document.getElementById('sidebar-channels');
  sidebar.style.display = 'flex';
  document.getElementById('current-server-name').textContent = server.name;
  document.getElementById('welcome-screen').style.display = 'none';
  document.getElementById('chat-view').style.display = 'none';
  document.getElementById('dm-view').style.display = 'none';

  // Afficher la bannière du serveur si elle existe
  const bannerEl = document.getElementById('sidebar-server-banner');
  if (bannerEl) {
    if (server.banner) {
      bannerEl.innerHTML = `<img src="${server.banner}" style="width:100%;height:100%;object-fit:cover" />`;
      bannerEl.style.display = 'block';
    } else {
      bannerEl.style.display = 'none';
    }
  }

  renderChannelsList(server);
  renderMembersList(server);
  if (window.socketClient) window.socketClient.emit('guilds:join');
};

window.renderChannelsList = (server) => {
  const list = document.getElementById('channels-list');
  const textChannels  = server.channels?.filter(c => c.type === 'text')  || [];
  const voiceChannels = server.channels?.filter(c => c.type === 'voice') || [];
  const myMember = server.members?.find(m => m.user?.id === State.user?.id);
  const canManage = ['owner','admin'].includes(myMember?.role);

  const renderCh = (ch) => {
    const isActive = State.currentChannel?.id === ch.id;
    const icon = ch.type === 'voice' ? '🔊' : '#';
    return `
      <div class="channel-item ${isActive?'active':''}" data-channel-id="${ch.id}" onclick="selectChannel('${ch.id}')"
        oncontextmenu="event.preventDefault();showChannelContextMenu(event,'${ch.id}','${escapeHtml(ch.name)}',${canManage})">
        <span class="channel-icon">${icon}</span>
        <span class="channel-name">${escapeHtml(ch.name)}</span>
        ${canManage ? `<span class="channel-actions"><button onclick="event.stopPropagation();deleteChannel('${ch.id}')" style="color:var(--red)">×</button></span>` : ''}
      </div>
      <div id="voice-members-${ch.id}"></div>`;
  };

  list.innerHTML = `
    <div class="channel-category" data-cat="text" onclick="toggleCategory('text')">
      <span>Texte</span>
      <div style="display:flex;align-items:center;gap:4px">
        ${canManage ? `<button onclick="event.stopPropagation();openCreateChannelModal('text')" style="font-size:18px;color:var(--text-muted);line-height:1">+</button>` : ''}
        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M7 10l5 5 5-5z"/></svg>
      </div>
    </div>
    <div class="channel-category-items" id="cat-text" style="max-height:2000px">
      ${textChannels.map(renderCh).join('')}
    </div>
    <div class="channel-category" data-cat="voice" onclick="toggleCategory('voice')" style="margin-top:16px">
      <span>Vocal</span>
      <div style="display:flex;align-items:center;gap:4px">
        ${canManage ? `<button onclick="event.stopPropagation();openCreateChannelModal('voice')" style="font-size:18px;color:var(--text-muted);line-height:1">+</button>` : ''}
        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M7 10l5 5 5-5z"/></svg>
      </div>
    </div>
    <div class="channel-category-items" id="cat-voice" style="max-height:2000px">
      ${voiceChannels.map(renderCh).join('')}
    </div>`;
};

window.toggleCategory = (cat) => {
  const items = document.getElementById(`cat-${cat}`);
  const header = document.querySelector(`[data-cat="${cat}"]`);
  if (!items) return;
  const collapsed = items.classList.toggle('collapsed');
  header?.classList.toggle('collapsed', collapsed);
};

window.showChannelContextMenu = (event, channelId, name, canManage) => {
  const items = [{ label: `📋 Copier l'ID`, action: () => navigator.clipboard.writeText(channelId) }];
  if (canManage) items.push({ divider: true }, { label: '🗑️ Supprimer', danger: true, action: () => deleteChannel(channelId) });
  showContextMenu(event, items);
};

window.selectChannel = (channelId) => {
  const server = State.currentServer;
  if (!server) return;
  const channel = server.channels?.find(c => c.id === channelId);
  if (!channel) return;

  if (channel.type === 'voice') { joinVoiceChannel(channel); return; }

  State.currentChannel = channel;
  document.querySelectorAll('.channel-item').forEach(el => el.classList.toggle('active', el.dataset.channelId === channelId));
  document.getElementById('header-channel-name').textContent = channel.name;
  document.getElementById('header-channel-icon').textContent = '#';
  document.getElementById('message-input').placeholder = `Message #${channel.name}`;
  document.getElementById('welcome-screen').style.display = 'none';
  document.getElementById('chat-view').style.display = 'flex';
  document.getElementById('dm-view').style.display = 'none';

  window.socketClient?.emit('channel:join', { guildId: server.id, channelId });
  loadMessages(server.id, channelId);
};

window.updateVoiceChannelMembers = (channelId, members) => {
  const el = document.getElementById(`voice-members-${channelId}`);
  if (!el) return;
  el.innerHTML = members.map(m => `
    <div class="voice-member">
      <span style="color:var(--green);font-size:12px">🔊</span>
      <span style="font-size:12px;color:var(--text-muted)">${escapeHtml(m.username)}</span>
    </div>`).join('');
};

// ── CRUD serveurs ─────────────────────────────────────────
document.getElementById('add-server-btn').addEventListener('click', () => {
  document.getElementById('add-server-error').textContent = '';
  document.getElementById('new-server-name').value = '';
  document.getElementById('invite-code-input').value = '';
  switchAddTab('create');
  openModal('modal-add-server');
});
document.getElementById('welcome-add-btn').addEventListener('click', () => openModal('modal-add-server'));

document.getElementById('confirm-add-server-btn').addEventListener('click', async () => {
  const errEl = document.getElementById('add-server-error');
  errEl.textContent = '';
  const isCreate = document.getElementById('tab-create-content').style.display !== 'none';
  try {
    let server;
    if (isCreate) {
      const name = document.getElementById('new-server-name').value.trim();
      if (!name) { errEl.textContent = 'Nom requis'; return; }
      server = await api.post('/servers', { name });
    } else {
      const code = document.getElementById('invite-code-input').value.trim();
      if (!code) { errEl.textContent = 'Code requis'; return; }
      server = await api.post(`/servers/join/${code}`);
    }
    const idx = State.servers.findIndex(s => s.id === server.id);
    if (idx === -1) State.servers.push(server); else State.servers[idx] = server;
    renderServersList();
    selectServer(State.servers.find(s => s.id === server.id));
    closeModal('modal-add-server');
    showToast(isCreate ? 'Serveur créé !' : 'Serveur rejoint !', 'success');
  } catch (err) { errEl.textContent = err.message; }
});

window.openCreateChannelModal = (type) => {
  State.newChannelType = type;
  document.getElementById('new-channel-name').value = '';
  document.getElementById('create-channel-error').textContent = '';
  selectChannelType(type);
  openModal('modal-create-channel');
};

document.getElementById('confirm-create-channel-btn').addEventListener('click', async () => {
  const name = document.getElementById('new-channel-name').value.trim();
  const errEl = document.getElementById('create-channel-error');
  if (!name) { errEl.textContent = 'Nom requis'; return; }
  try {
    const channel = await api.post(`/servers/${State.currentServer.id}/channels`, { name, type: State.newChannelType });
    State.currentServer.channels.push(channel);
    renderChannelsList(State.currentServer);
    closeModal('modal-create-channel');
    showToast('Channel créé !', 'success');
  } catch (err) { errEl.textContent = err.message; }
});

window.deleteChannel = async (channelId) => {
  if (!confirm('Supprimer ce channel ?')) return;
  try {
    await api.delete(`/servers/${State.currentServer.id}/channels/${channelId}`);
    State.currentServer.channels = State.currentServer.channels.filter(c => c.id !== channelId);
    if (State.currentChannel?.id === channelId) {
      State.currentChannel = null;
      document.getElementById('chat-view').style.display = 'none';
    }
    renderChannelsList(State.currentServer);
    showToast('Channel supprimé', 'success');
  } catch (err) { showToast(err.message, 'error'); }
};

window.leaveServer = async () => {
  if (!State.currentServer || !confirm(`Quitter "${State.currentServer.name}" ?`)) return;
  try {
    await api.delete(`/servers/${State.currentServer.id}/leave`);
    State.servers = State.servers.filter(s => s.id !== State.currentServer.id);
    State.currentServer = null; State.currentChannel = null;
    renderServersList();
    document.getElementById('sidebar-channels').style.display = 'none';
    document.getElementById('welcome-screen').style.display = 'flex';
    document.getElementById('chat-view').style.display = 'none';
    showToast('Serveur quitté', 'info');
  } catch (err) { showToast(err.message, 'error'); }
};

// Auto-join via URL
const urlInvite = new URLSearchParams(location.search).get('invite');
if (urlInvite) {
  window.addEventListener('appReady', async () => {
    try {
      const server = await api.post(`/servers/join/${urlInvite}`);
      const idx = State.servers.findIndex(s => s.id === server.id);
      if (idx === -1) State.servers.push(server);
      renderServersList();
      selectServer(State.servers.find(s => s.id === server.id));
      history.replaceState(null, '', '/');
    } catch (_) {}
  });
}
