// ── Load servers ──────────────────────────────────────────
window.loadServers = async () => {
  if (!State.token) return; // Pas encore authentifié
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



// ── Channel actions ───────────────────────────────────────
window.selectChannel = async (channelId) => {
  const server = State.currentServer;
  if (!server) return;
  const channel = server.channels?.find(c => c.id === channelId)
    || server.categories?.flatMap(c => c.channels || []).find(c => c.id === channelId);
  if (!channel) return;

  if (channel.type === 'voice') { joinVoiceChannel(channel); return; }

  State.currentChannel = channel;
  document.querySelectorAll('.channel-item').forEach(el => {
    el.classList.toggle('active', el.dataset.channelId === channelId);
  });

  document.getElementById('current-channel-name').textContent = '#' + channel.name;
  document.getElementById('chat-view').style.display  = 'flex';
  document.getElementById('dm-view').style.display    = 'none';
  document.getElementById('welcome-screen').style.display = 'none';

  await loadMessages(server.id, channelId);

  window.socketClient?.emit('channel:join', { guildId: server.id, channelId });
};

window.loadMessages = async (guildId, channelId, before = null) => {
  const list = document.getElementById('messages-list');
  if (!before) {
    list.innerHTML = `<div class="channel-welcome">
      <div class="ch-icon-big">#</div>
      <h3>${escapeHtml(State.currentChannel?.name || '')}</h3>
      <p>Début du channel <strong>#${escapeHtml(State.currentChannel?.name || '')}</strong></p>
    </div>`;
    State.messages = [];
  }
  try {
    const url = `/messages/${guildId}/${channelId}${before ? '?before=' + encodeURIComponent(before) : ''}`;
    const msgs = await api.get(url);
    if (!before) {
      State.messages = msgs;
      renderAllMessages(msgs);
      scrollToBottom();
    } else {
      const container = document.getElementById('messages-container');
      const prevH = container?.scrollHeight || 0;
      State.messages = [...msgs, ...State.messages];
      renderAllMessages(State.messages);
      if (container) container.scrollTop += container.scrollHeight - prevH;
    }
    if (msgs.length === 50) {
      const btn = document.createElement('div');
      btn.className = 'load-more-btn';
      btn.textContent = 'Charger plus';
      btn.onclick = () => { btn.remove(); loadMessages(guildId, channelId, State.messages[0]?.created_at); };
      const welcome = list.querySelector('.channel-welcome');
      welcome ? welcome.after(btn) : list.prepend(btn);
    }
    initScrollToBottomBtn();
  } catch (err) { showToast(err.message, 'error'); }
};

window.deleteChannel = async (channelId) => {
  if (!confirm('Supprimer ce channel ?')) return;
  try {
    await api.delete(`/servers/${State.currentServer.id}/channels/${channelId}`);
    State.currentServer.channels = State.currentServer.channels?.filter(c => c.id !== channelId) || [];
    if (State.currentServer.categories) {
      State.currentServer.categories.forEach(cat => {
        cat.channels = cat.channels?.filter(c => c.id !== channelId) || [];
      });
    }
    if (State.currentChannel?.id === channelId) {
      State.currentChannel = null;
      document.getElementById('chat-view').style.display = 'none';
    }
    renderChannelsList(State.currentServer);
    showToast('Channel supprimé', 'success');
  } catch (err) { showToast(err.message, 'error'); }
};

window.leaveServer = async () => {
  if (!State.currentServer) return;
  if (!confirm(`Quitter "${State.currentServer.name}" ?`)) return;
  try {
    await api.delete(`/servers/${State.currentServer.id}/leave`);
    State.servers = State.servers.filter(s => s.id !== State.currentServer.id);
    State.currentServer = null;
    State.currentChannel = null;
    renderServersList();
    document.getElementById('sidebar-channels').style.display = 'none';
    document.getElementById('chat-view').style.display = 'none';
    document.getElementById('welcome-screen').style.display = 'flex';
    showToast('Serveur quitté', 'success');
  } catch (err) { showToast(err.message, 'error'); }
};

window.openCreateChannelModal = (type = 'text') => {
  State.newChannelType = type;
  window._targetCategoryId = null;
  document.getElementById('new-channel-name').value = '';
  const errEl = document.getElementById('create-channel-error');
  if (errEl) errEl.textContent = '';
  document.getElementById('type-text-btn').className  = 'btn btn-sm ' + (type === 'text'  ? 'btn-primary' : 'btn-secondary');
  document.getElementById('type-voice-btn').className = 'btn btn-sm ' + (type === 'voice' ? 'btn-primary' : 'btn-secondary');
  openModal('modal-create-channel');
};

window.showChannelContextMenu = (event, channelId, channelName, canManage) => {
  const items = [
    { label: 'Copier l\'ID', action: () => { navigator.clipboard.writeText(channelId); showToast('ID copié', 'success'); } },
  ];
  if (canManage) {
    items.push({ divider: true });
    items.push({ label: 'Supprimer', danger: true, action: () => deleteChannel(channelId) });
  }
  showContextMenu(event, items);
};

window.openInviteModal = () => {
  if (!State.currentServer) return;
  const code = State.currentServer.invite_code;
  const link = `${location.origin}/invite/${code}`;
  const el = document.getElementById('invite-link-display');
  if (el) el.value = link;
  openModal('modal-invite');
};

window.scrollToBottom = () => {
  const container = document.getElementById('messages-container');
  if (container) container.scrollTop = container.scrollHeight;
};

window.scrollToMessage = (msgId) => {
  const el = document.querySelector(`[data-msg-id="${msgId}"]`);
  if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); el.style.background = 'rgba(88,101,242,0.15)'; setTimeout(() => el.style.background = '', 1500); }
};


window.handleConfirmAddServer = async () => {
  const nameInput = document.getElementById('new-server-name');
  const codeInput = document.getElementById('invite-code-input');
  const errEl     = document.getElementById('add-server-error');
  if (errEl) errEl.textContent = '';

  const isCreate = document.getElementById('tab-create-content')?.style.display !== 'none';

  try {
    if (isCreate) {
      const name = nameInput?.value.trim();
      if (!name) { if (errEl) errEl.textContent = 'Nom requis'; return; }
      const server = await api.post('/servers', { name });
      State.servers.push(server);
      renderServersList();
      selectServer(server);
    } else {
      const code = codeInput?.value.trim();
      if (!code) { if (errEl) errEl.textContent = 'Code requis'; return; }
      const server = await api.post('/servers/join/' + code, {});
      State.servers.push(server);
      renderServersList();
      selectServer(server);
    }
    closeModal('modal-add-server');
    if (nameInput) nameInput.value = '';
    if (codeInput) codeInput.value = '';
  } catch (err) {
    if (errEl) errEl.textContent = err.message;
  }
};

// ── Listeners boutons créer / rejoindre serveur ───────────
document.addEventListener('DOMContentLoaded', () => {
  // Bouton + dans la sidebar servers
  document.getElementById('add-server-btn')?.addEventListener('click', () => {
    openModal('modal-add-server');
    switchAddTab('create');
  });

  // Bouton "Créer un serveur" sur l'écran de bienvenue
  document.getElementById('welcome-add-btn')?.addEventListener('click', () => {
    openModal('modal-add-server');
    switchAddTab('create');
  });

  document.getElementById('confirm-add-server-btn')?.addEventListener('click', handleConfirmAddServer);
});
