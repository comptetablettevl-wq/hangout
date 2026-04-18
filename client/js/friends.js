// ── State amis ────────────────────────────────────────────
window.FriendsState = { friends: [], pending: [], sent: [] };

window.loadFriends = async () => {
  if (!State.token) return; // Pas encore authentifié
  try {
    const data = await api.get('/friends');
    FriendsState.friends = data.friends;
    FriendsState.pending = data.pending;
    FriendsState.sent    = data.sent;
    renderFriendsPanel();
    updateFriendsBadge();
  } catch (err) { console.error('loadFriends:', err.message); }
};

window.renderFriendsPanel = () => {
  const panel = document.getElementById('friends-panel');
  if (!panel) return;

  const { friends, pending, sent } = FriendsState;

  panel.innerHTML = `
    <!-- Ajouter un ami -->
    <div class="friends-add-bar">
      <input id="friend-search-input" class="input" type="text" placeholder="Rechercher un utilisateur..." style="flex:1" />
      <button class="btn btn-primary btn-sm" id="friend-add-btn">Ajouter</button>
    </div>
    <div id="friend-search-results" style="margin-bottom:8px"></div>

    ${pending.length ? `
    <div class="members-group-label">Demandes reçues — ${pending.length}</div>
    ${pending.map(fr => `
      <div class="member-item" data-fr-id="${fr.id}">
        <div class="avatar-wrapper sm">
          ${renderAvatar(fr.sender, 'avatar-md')}
          <div class="status-dot ${fr.sender.status || 'offline'}"></div>
        </div>
        <span class="member-name">${escapeHtml(fr.sender.username)}</span>
        <div style="display:flex;gap:4px">
          <button class="btn btn-sm" style="background:var(--green);color:#fff;padding:3px 8px"
            onclick="acceptFriend('${fr.id}', '${fr.sender.id}')">✓</button>
          <button class="btn btn-sm btn-danger" style="padding:3px 8px"
            onclick="declineFriend('${fr.id}')">✕</button>
        </div>
      </div>
    `).join('')}` : ''}

    ${sent.length ? `
    <div class="members-group-label">Demandes envoyées — ${sent.length}</div>
    ${sent.map(fr => `
      <div class="member-item">
        <div class="avatar-wrapper sm">
          ${renderAvatar(fr.receiver, 'avatar-md')}
          <div class="status-dot ${fr.receiver.status || 'offline'}"></div>
        </div>
        <span class="member-name">${escapeHtml(fr.receiver.username)}</span>
        <span style="font-size:11px;color:var(--text-muted)">En attente</span>
        <button class="btn btn-sm btn-ghost" style="padding:2px 6px;font-size:12px"
          onclick="cancelFriendRequest('${fr.id}')">Annuler</button>
      </div>
    `).join('')}` : ''}

    <div class="members-group-label">Amis — ${friends.length}</div>
    ${friends.length === 0 ? '<p style="padding:8px;font-size:13px;color:var(--text-muted)">Aucun ami pour l\'instant</p>' : ''}
    ${friends.map(fr => {
      const friend = fr.sender_id === State.user?.id ? fr.receiver : fr.sender;
      return `
        <div class="member-item" style="cursor:pointer" onclick="openDMWithUser('${friend.id}', '${escapeHtml(friend.username)}')">
          <div class="avatar-wrapper sm">
            ${renderAvatar(friend, 'avatar-md')}
            <div class="status-dot ${friend.status || 'offline'}"></div>
          </div>
          <span class="member-name">${escapeHtml(friend.username)}</span>
          <button class="btn btn-sm btn-ghost" style="padding:3px 6px;font-size:12px"
            title="Message" onclick="event.stopPropagation();openDMWithUser('${friend.id}','${escapeHtml(friend.username)}')">💬</button>
          <button class="btn btn-sm btn-ghost" style="padding:3px 6px;font-size:12px;color:var(--red)"
            title="Retirer" onclick="event.stopPropagation();removeFriend('${fr.id}')">✕</button>
        </div>
      `;
    }).join('')}
  `;

  // Search
  let searchTimeout;
  document.getElementById('friend-search-input')?.addEventListener('input', (e) => {
    clearTimeout(searchTimeout);
    const q = e.target.value.trim();
    if (q.length < 2) { document.getElementById('friend-search-results').innerHTML = ''; return; }
    searchTimeout = setTimeout(() => searchUsers(q), 300);
  });

  document.getElementById('friend-add-btn')?.addEventListener('click', () => {
    const username = document.getElementById('friend-search-input')?.value.trim();
    if (username) sendFriendRequest(username);
  });
};

window.searchUsers = async (q) => {
  try {
    const users = await api.get(`/friends/search?q=${encodeURIComponent(q)}`);
    const el = document.getElementById('friend-search-results');
    if (!el) return;
    if (!users.length) { el.innerHTML = '<p style="font-size:13px;color:var(--text-muted);padding:4px 8px">Aucun résultat</p>'; return; }
    el.innerHTML = users.map(u => `
      <div class="member-item">
        ${renderAvatar(u, 'avatar-md')}
        <span class="member-name">${escapeHtml(u.username)}</span>
        <button class="btn btn-sm btn-primary" style="padding:3px 8px;font-size:12px"
          onclick="sendFriendRequest('${escapeHtml(u.username)}')">Ajouter</button>
      </div>
    `).join('');
  } catch (_) {}
};

window.sendFriendRequest = async (username) => {
  try {
    const fr = await api.post('/friends/add', { username });
    FriendsState.sent.push(fr);
    renderFriendsPanel();
    showToast(`Demande envoyée à ${username}`, 'success');
    // Notif temps réel
    window.socketClient?.emit('friend:request', { receiverId: fr.receiver_id });
  } catch (err) { showToast(err.message, 'error'); }
};

window.acceptFriend = async (frId, senderId) => {
  try {
    const fr = await api.patch(`/friends/${frId}/accept`);
    FriendsState.pending = FriendsState.pending.filter(f => f.id !== frId);
    FriendsState.friends.push(fr);
    renderFriendsPanel();
    updateFriendsBadge();
    window.socketClient?.emit('friend:accepted', { senderId });
    showToast('Ami ajouté !', 'success');
  } catch (err) { showToast(err.message, 'error'); }
};

window.declineFriend = async (frId) => {
  try {
    await api.patch(`/friends/${frId}/decline`);
    FriendsState.pending = FriendsState.pending.filter(f => f.id !== frId);
    renderFriendsPanel();
    updateFriendsBadge();
  } catch (err) { showToast(err.message, 'error'); }
};

window.cancelFriendRequest = async (frId) => {
  try {
    await api.delete(`/friends/${frId}`);
    FriendsState.sent = FriendsState.sent.filter(f => f.id !== frId);
    renderFriendsPanel();
  } catch (err) { showToast(err.message, 'error'); }
};

window.removeFriend = async (frId) => {
  if (!confirm('Retirer cet ami ?')) return;
  try {
    await api.delete(`/friends/${frId}`);
    FriendsState.friends = FriendsState.friends.filter(f => f.id !== frId);
    renderFriendsPanel();
    showToast('Ami retiré', 'info');
  } catch (err) { showToast(err.message, 'error'); }
};

window.updateFriendsBadge = () => {
  const badge = document.getElementById('friends-badge');
  if (!badge) return;
  const count = FriendsState.pending.length;
  badge.textContent = count || '';
  badge.style.display = count ? 'flex' : 'none';
};

// Socket events amis
window.initFriendSocketEvents = () => {
  const s = window.socketClient;
  if (!s) return;

  s.on('friend:request_received', (fr) => {
    FriendsState.pending.push(fr);
    updateFriendsBadge();
    renderFriendsPanel();
    showToast(`${fr.sender.username} t'a envoyé une demande d'ami`, 'info');
    sendBrowserNotification('Demande d\'ami', `${fr.sender.username} veut t'ajouter`);
  });

  s.on('friend:accepted', ({ username }) => {
    loadFriends();
    showToast(`${username} a accepté ta demande !`, 'success');
  });
};
