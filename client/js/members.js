window.renderMembersList = (server) => {
  if (!server?.members) return;
  const list = document.getElementById('members-list');
  const onlineCount = server.members.filter(m => ['online','idle','dnd'].includes(m.user?.status)).length;
  const totalCount  = server.members.length;
  const myMember = server.members?.find(m => (m.user?.id || m.user) === State.user?.id);
  const myRole = myMember?.role || 'member';
  const canMod = ['owner','admin','moderator'].includes(myRole);
  const canBan = ['owner','admin'].includes(myRole);

  const grouped = { online: [], idle: [], dnd: [], offline: [] };
  server.members.forEach(m => {
    const status = m.user?.status || 'offline';
    grouped[status]?.push(m);
  });

  const roleOrder = { owner: 0, admin: 1, moderator: 2, member: 3 };
  const sort = arr => arr.sort((a,b) => roleOrder[a.role] - roleOrder[b.role]);

  const renderMember = (m) => {
    const user = m.user || {};
    const status = user.status || 'offline';
    const isMe = user.id === State.user?.id;
    const targetRole = m.role || 'member';
    return `
      <div class="member-item" data-member-id="${user.id || ''}"
        oncontextmenu="event.preventDefault();showMemberContextMenu(event,'${user.id}','${escapeHtml(user.username || '')}','${targetRole}',${canMod},${canBan},${isMe})">
        <div class="avatar-wrapper sm">
          ${renderAvatar(user, 'avatar-md')}
          <div class="status-dot ${status}"></div>
        </div>
        <div style="flex:1;min-width:0">
          <div class="member-name" style="${m.role !== 'member' ? `color:${getRoleColor(m.role)}` : ''}">${escapeHtml(user.username || 'Inconnu')}</div>
          ${user.custom_status ? `<div style="font-size:11px;color:var(--text-muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(user.custom_status)}</div>` : ''}
        </div>
        ${m.role !== 'member' ? `<span class="role-badge role-${m.role}">${m.role}</span>` : ''}
      </div>
    `;
  };

  const renderGroup = (label, members) => {
    if (!members.length) return '';
    return `
      <div class="members-group-label">${label} — ${members.length}</div>
      ${sort(members).map(renderMember).join('')}
    `;
  };

  list.innerHTML = `
    <div style="padding:10px 8px 6px;border-bottom:1px solid var(--border);flex-shrink:0">
      <div style="font-size:12px;color:var(--text-muted);margin-bottom:8px">
        <span style="color:var(--green)">●</span> ${onlineCount} en ligne
        <span style="margin-left:8px;color:var(--text-muted)">● ${totalCount - onlineCount} hors ligne</span>
      </div>
      <input type="text" id="members-search-input" placeholder="Rechercher un membre..."
        style="width:100%;background:var(--bg-input);border:1px solid var(--border);border-radius:var(--radius-sm);
               padding:5px 8px;font-size:13px;color:var(--text-primary);outline:none;font-family:var(--font)"
        oninput="filterMembers(this.value)" />
    </div>
    <div id="members-list-inner" style="overflow-y:auto;flex:1">
      ${renderGroup('En ligne', [...grouped.online, ...grouped.idle, ...grouped.dnd])}
      ${renderGroup('Hors ligne', grouped.offline)}
    </div>`;
};

const getRoleColor = (role) => {
  const colors = { owner: 'var(--yellow)', admin: 'var(--red)', moderator: 'var(--accent)' };
  return colors[role] || 'var(--text-secondary)';
};

window.showMemberContextMenu = (event, userId, username, role, canMod, canBan, isMe) => {
  const items = [
    { label: `💬 Envoyer un MP`, action: () => openDMWithUser(userId, username) },
  ];

  if (!isMe && canMod) {
    items.push({ divider: true });
    if (['owner','admin'].includes(State.currentServer?.members?.find(m => m.user?.id === userId)?.role || 'member')) {
      // Pas de kick/ban sur les admins/owner si on est juste modo
    } else {
      items.push({ label: '👢 Expulser', action: () => openKickModal(userId, username, role) });
      if (canBan) items.push({ label: '🔨 Bannir', danger: true, action: () => openBanModal(userId, username, role) });
    }
  }

  showContextMenu(event, items);
};

window.openKickModal = (userId, username, role) => {
  document.getElementById('mod-modal-title').textContent = `Expulser ${username}`;
  document.getElementById('mod-target-name').textContent = username;
  document.getElementById('mod-target-role').textContent = role;
  document.getElementById('mod-target-avatar').innerHTML = renderAvatar({ username }, 'avatar-md');
  document.getElementById('mod-reason-group').style.display = 'none';

  const btn = document.getElementById('mod-confirm-btn');
  btn.className = 'btn btn-danger';
  btn.textContent = 'Expulser';
  btn.onclick = async () => {
    try {
      await api.post(`/servers/${State.currentServer.id}/kick/${userId}`);
      closeModal('modal-moderation');
      // Retirer de la liste locale
      State.currentServer.members = State.currentServer.members.filter(m => (m.user?.id || m.user) !== userId);
      renderMembersList(State.currentServer);
      showToast(`${username} a été expulsé`, 'success');
    } catch (err) { showToast(err.message, 'error'); }
  };
  openModal('modal-moderation');
};

window.openBanModal = (userId, username, role) => {
  document.getElementById('mod-modal-title').textContent = `Bannir ${username}`;
  document.getElementById('mod-target-name').textContent = username;
  document.getElementById('mod-target-role').textContent = role;
  document.getElementById('mod-target-avatar').innerHTML = renderAvatar({ username }, 'avatar-md');
  document.getElementById('mod-reason-group').style.display = 'block';
  document.getElementById('mod-reason-input').value = '';

  const btn = document.getElementById('mod-confirm-btn');
  btn.className = 'btn btn-danger';
  btn.textContent = 'Bannir définitivement';
  btn.onclick = async () => {
    try {
      const reason = document.getElementById('mod-reason-input').value.trim();
      await api.post(`/servers/${State.currentServer.id}/ban/${userId}`, { reason });
      closeModal('modal-moderation');
      State.currentServer.members = State.currentServer.members.filter(m => (m.user?.id || m.user) !== userId);
      renderMembersList(State.currentServer);
      showToast(`${username} a été banni`, 'success');
    } catch (err) { showToast(err.message, 'error'); }
  };
  openModal('modal-moderation');
};

window.openBansList = async () => {
  if (!State.currentServer) return;
  try {
    const bans = await api.get(`/servers/${State.currentServer.id}/bans`);
    const list = document.getElementById('bans-list');
    list.innerHTML = bans.length === 0
      ? '<p style="color:var(--text-muted);font-size:13px;padding:8px">Aucun membre banni</p>'
      : bans.map(b => `
        <div class="member-item">
          ${renderAvatar(b.user, 'avatar-md')}
          <div style="flex:1">
            <div class="member-name">${escapeHtml(b.user?.username || '?')}</div>
            ${b.reason ? `<div style="font-size:12px;color:var(--text-muted)">Raison : ${escapeHtml(b.reason)}</div>` : ''}
          </div>
          <button class="btn btn-sm btn-secondary" onclick="unbanMember('${b.user_id}','${escapeHtml(b.user?.username||'')}')">Débannir</button>
        </div>
      `).join('');
    openModal('modal-bans');
  } catch (err) { showToast(err.message, 'error'); }
};

window.unbanMember = async (userId, username) => {
  try {
    await api.delete(`/servers/${State.currentServer.id}/ban/${userId}`);
    showToast(`${username} a été débanni`, 'success');
    openBansList();
  } catch (err) { showToast(err.message, 'error'); }
};

// Toggle sidebar membres
document.getElementById('members-toggle-btn').addEventListener('click', () => {
  State.membersVisible = !State.membersVisible;
  const sidebar = document.getElementById('sidebar-members');
  sidebar.classList.toggle('collapsed', !State.membersVisible);
  if (window.innerWidth <= 768) sidebar.classList.toggle('open', State.membersVisible);
  document.getElementById('members-toggle-btn').classList.toggle('active', State.membersVisible);
});

document.addEventListener('click', (e) => {
  if (window.innerWidth > 768) return;
  const sidebar = document.getElementById('sidebar-members');
  if (sidebar.classList.contains('open') &&
      !e.target.closest('#sidebar-members') &&
      !e.target.closest('#members-toggle-btn')) {
    sidebar.classList.remove('open');
    sidebar.classList.add('collapsed');
    State.membersVisible = false;
    document.getElementById('members-toggle-btn').classList.remove('active');
  }
});

window.filterMembers = (query) => {
  const q    = query.toLowerCase().trim();
  const inner = document.getElementById('members-list-inner');
  if (!inner || !State.currentServer?.members) return;

  const members = State.currentServer.members;
  const filtered = q ? members.filter(m => (m.user?.username || '').toLowerCase().includes(q)) : members;

  const grouped = { online: [], idle: [], dnd: [], offline: [] };
  filtered.forEach(m => { const s = m.user?.status || 'offline'; grouped[s]?.push(m); });

  const roleOrder = { owner: 0, admin: 1, moderator: 2, member: 3 };
  const sort = arr => arr.sort((a,b) => roleOrder[a.role] - roleOrder[b.role]);

  const myMember = State.currentServer.members?.find(m => m.user?.id === State.user?.id);
  const canMod = ['owner','admin','moderator'].includes(myMember?.role);
  const canBan = ['owner','admin'].includes(myMember?.role);

  const renderMember = (m) => {
    const user   = m.user || {};
    const status = user.status || 'offline';
    const isMe   = user.id === State.user?.id;
    return `
      <div class="member-item" data-member-id="${user.id || ''}"
        oncontextmenu="event.preventDefault();showMemberContextMenu(event,'${user.id}','${escapeHtml(user.username || '')}','${m.role}',${canMod},${canBan},${isMe})">
        <div class="avatar-wrapper sm">
          ${renderAvatar(user, 'avatar-md')}
          <div class="status-dot ${status}"></div>
        </div>
        <div style="flex:1;min-width:0">
          <div class="member-name" style="${m.role !== 'member' ? 'color:' + getRoleColor(m.role) : ''}">${escapeHtml(user.username || 'Inconnu')}</div>
          ${user.custom_status ? `<div style="font-size:11px;color:var(--text-muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(user.custom_status)}</div>` : ''}
        </div>
        ${m.role !== 'member' ? `<span class="role-badge role-${m.role}">${m.role}</span>` : ''}
      </div>`;
  };

  const renderGroup = (label, members) => {
    if (!members.length) return '';
    return `<div class="members-group-label">${label} — ${members.length}</div>
      ${sort(members).map(renderMember).join('')}`;
  };

  inner.innerHTML = `
    ${renderGroup('En ligne', [...grouped.online, ...grouped.idle, ...grouped.dnd])}
    ${renderGroup('Hors ligne', grouped.offline)}
    ${!filtered.length ? '<p style="padding:12px;font-size:13px;color:var(--text-muted);text-align:center">Aucun résultat</p>' : ''}`;
};
