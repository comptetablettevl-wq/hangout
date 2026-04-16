// ── Profil popup au clic sur un avatar ───────────────────
window.showProfilePopup = async (event, userId, username, userObj = null) => {
  // Fermer si déjà ouvert pour le même user
  const existing = document.getElementById('profile-popup');
  if (existing) {
    if (existing.dataset.userId === userId) { existing.remove(); return; }
    existing.remove();
  }

  const user = userObj || await api.get(`/users/${userId}`).catch(() => ({ id: userId, username }));
  const member = State.currentServer?.members?.find(m => m.user?.id === userId);
  const isFriend = window.FriendsState?.friends?.some(f => f.sender_id === userId || f.receiver_id === userId);
  const isMe = userId === State.user?.id;

  const popup = document.createElement('div');
  popup.className = 'profile-popup';
  popup.id = 'profile-popup';
  popup.dataset.userId = userId;

  const avatarHtml = user.avatar
    ? `<img src="${user.avatar}" class="profile-popup-avatar" style="object-fit:cover" />`
    : `<div class="profile-popup-avatar" style="background:${avatarColor(username)};color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:20px">${username.slice(0,2).toUpperCase()}</div>`;

  popup.innerHTML = `
    <div class="profile-popup-banner"></div>
    <div class="profile-popup-body">
      ${avatarHtml}
      <div class="profile-popup-name">${escapeHtml(user.username || username)}</div>
      <div class="profile-popup-status">
        <span class="status-dot ${user.status||'offline'}" style="display:inline-block;position:static;width:8px;height:8px;margin-right:4px;border:none"></span>
        ${{ online:'En ligne', idle:'Absent', dnd:'Ne pas déranger', offline:'Hors ligne' }[user.status||'offline']}
      </div>
      ${user.custom_status ? `<div style="font-size:12px;color:var(--text-muted);margin-top:4px">${escapeHtml(user.custom_status)}</div>` : ''}
      ${member ? `<div style="margin-top:8px"><span class="role-badge role-${member.role}">${member.role}</span></div>` : ''}
      ${!isMe ? `
      <div class="profile-popup-actions">
        <button class="btn btn-primary btn-sm" style="flex:1" onclick="openDMWithUser('${userId}','${escapeHtml(username)}');document.getElementById('profile-popup')?.remove()">💬 Message</button>
        ${!isFriend ? `<button class="btn btn-secondary btn-sm" onclick="sendFriendRequest('${escapeHtml(username)}');document.getElementById('profile-popup')?.remove()">➕ Ami</button>` : ''}
      </div>` : `<div class="profile-popup-actions"><button class="btn btn-secondary btn-sm btn-full" onclick="openSettings('profile');document.getElementById('profile-popup')?.remove()">✏️ Modifier mon profil</button></div>`}
    </div>`;

  // Positionnement
  document.body.appendChild(popup);
  if (event) {
    const x = Math.min(event.clientX + 12, window.innerWidth - 300);
    const y = Math.min(event.clientY, window.innerHeight - 320);
    popup.style.left = x + 'px';
    popup.style.top  = y + 'px';
  } else {
    popup.style.left = '50%';
    popup.style.top  = '50%';
    popup.style.transform = 'translate(-50%, -50%)';
  }

  // Fermer en cliquant ailleurs
  setTimeout(() => {
    document.addEventListener('click', (e) => {
      if (!e.target.closest('#profile-popup')) popup.remove();
    }, { once: true });
  }, 50);
};
