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



window.toggleCategory