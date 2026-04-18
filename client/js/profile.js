// ── Icônes d'activité ─────────────────────────────────────
const ACTIVITY_ICONS = {
  playing:    '🎮',
  watching:   '📺',
  listening:  '🎵',
  competing:  '🏆',
  none:       '',
};

const ACTIVITY_LABELS = {
  playing:   'Joue à',
  watching:  'Regarde',
  listening: 'Écoute',
  competing: 'En compétition sur',
  none:      '',
};

// ── Popup de profil ───────────────────────────────────────
window.showProfilePopup = async (event, userId, username, userObj = null) => {
  const existing = document.getElementById('profile-popup');
  if (existing) {
    if (existing.dataset.userId === userId) { existing.remove(); return; }
    existing.remove();
  }

  // Charger les données complètes (bio, activité, surnom)
  let user, streakData;
  try {
    [user, streakData] = await Promise.all([
      api.get(`/users/${userId}`),
      api.get(`/streaks/${userId}`).catch(() => null),
    ]);
  } catch (_) {
    user = userObj || { id: userId, username, status: 'offline' };
  }

  const member   = State.currentServer?.members?.find(m => m.user?.id === userId);
  const isFriend = window.FriendsState?.friends?.some(f =>
    (f.sender_id === userId || f.receiver_id === userId) && f.status === 'accepted'
  );
  const isMe    = userId === State.user?.id;
  const isAdmin = ['owner','admin'].includes(
    State.currentServer?.members?.find(m => m.user?.id === State.user?.id)?.role
  );

  // Surnom défini par moi pour cet utilisateur
  const displayName = user.nickname
    ? `${escapeHtml(user.nickname)} <span style="font-size:12px;color:var(--text-muted);font-weight:400">(${escapeHtml(user.username)})</span>`
    : escapeHtml(user.username || username);

  const popup = document.createElement('div');
  popup.className = 'profile-popup';
  popup.id        = 'profile-popup';
  popup.dataset.userId = userId;

  const avatarHtml = user.avatar
    ? `<img src="${user.avatar}" class="profile-popup-avatar" style="object-fit:cover" />`
    : `<div class="profile-popup-avatar" style="background:${avatarColor(user.username||username)};color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:20px">${(user.username||username).slice(0,2).toUpperCase()}</div>`;

  // Activité
  const activityHtml = user.activity_type && user.activity_type !== 'none' && user.activity_text
    ? `<div style="display:flex;align-items:center;gap:6px;margin-top:6px;font-size:12px;color:var(--text-secondary);background:var(--bg-elevated);padding:6px 8px;border-radius:var(--radius-sm)">
        <span>${ACTIVITY_ICONS[user.activity_type]}</span>
        <div>
          <span style="color:var(--text-muted)">${ACTIVITY_LABELS[user.activity_type]}</span>
          <strong> ${escapeHtml(user.activity_text)}</strong>
        </div>
      </div>`
    : '';

  // Bio
  const bioHtml = user.biography
    ? `<div style="margin-top:10px;padding-top:10px;border-top:1px solid var(--border)">
        <div style="font-size:11px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px">À propos</div>
        <div style="font-size:13px;color:var(--text-secondary);line-height:1.5;word-break:break-word">${escapeHtml(user.biography)}</div>
      </div>`
    : '';

  // Surnom
  const nicknameHtml = !isMe
    ? `<div style="margin-top:8px;padding-top:8px;border-top:1px solid var(--border)">
        <div style="font-size:11px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px">Mon surnom pour cet ami</div>
        <div style="display:flex;gap:6px;align-items:center">
          <input type="text" id="nickname-input-${userId}" placeholder="Ajouter un surnom…" maxlength="64"
            value="${user.nickname ? escapeHtml(user.nickname) : ''}"
            style="flex:1;background:var(--bg-input);border:1px solid var(--border);border-radius:var(--radius-sm);
                   padding:5px 8px;font-size:13px;color:var(--text-primary);outline:none;font-family:var(--font)" />
          <button class="btn btn-primary btn-sm" onclick="saveNickname('${userId}')">OK</button>
          ${user.nickname ? `<button class="btn btn-ghost btn-sm" onclick="removeNickname('${userId}')" style="color:var(--red)">×</button>` : ''}
        </div>
      </div>`
    : '';

  // Rôle dans le serveur actuel
  const roleHtml = member
    ? `<div style="margin-top:6px"><span class="role-badge role-${member.role}">${member.role}</span></div>`
    : '';

  // Date d'inscription
  const joinDate = user.createdAt
    ? `<div style="font-size:11px;color:var(--text-muted);margin-top:8px">Membre depuis ${new Date(user.createdAt).toLocaleDateString('fr-FR',{month:'long',year:'numeric'})}</div>`
    : '';

  // Streak
  const streakHtml = streakData?.current_streak > 0
    ? `<div style="margin-top:10px">
        <div class="streak-indicator">
          <span>${streakData.current_streak >= 30 ? '🔥' : '⚡'}</span>
          <span>${streakData.current_streak} jour${streakData.current_streak > 1 ? 's' : ''} de streak</span>
        </div>
        ${streakData.current_streak >= 7 ? `<div style="font-size:11px;color:var(--text-muted);margin-top:3px">Record : ${streakData.longest_streak} jours</div>` : ''}
      </div>`
    : '';

  popup.innerHTML = `
    <div class="profile-popup-banner" style="${user.avatar ? `background:${avatarColor(user.username||username)}` : ''}"></div>
    <div class="profile-popup-body">
      ${avatarHtml}
      <div style="margin-top:4px">
        <div class="profile-popup-name">${displayName}</div>
        <div class="profile-popup-status" style="display:flex;align-items:center;gap:4px">
          <span class="status-dot ${user.status||'offline'}" style="display:inline-block;position:static;width:8px;height:8px;border:none;flex-shrink:0"></span>
          ${{ online:'En ligne', idle:'Absent', dnd:'Ne pas déranger', offline:'Hors ligne' }[user.status||'offline']}
        </div>
        ${user.custom_status ? `<div style="font-size:12px;color:var(--text-muted);margin-top:2px;font-style:italic">"${escapeHtml(user.custom_status)}"</div>` : ''}
      </div>
      ${activityHtml}
      ${roleHtml}
      ${bioHtml}
      ${nicknameHtml}
      ${streakHtml}
      ${joinDate}
      ${!isMe ? `
        <div class="profile-popup-actions" style="margin-top:12px">
          <button class="btn btn-primary btn-sm" style="flex:1"
            onclick="openDM('${userId}','${escapeHtml(user.username||username)}');document.getElementById('profile-popup')?.remove()">
            💬 Message
          </button>
          ${!isFriend
            ? `<button class="btn btn-secondary btn-sm" onclick="sendFriendRequest('${escapeHtml(user.username||username)}');document.getElementById('profile-popup')?.remove()">➕ Ami</button>`
            : '<span style="font-size:12px;color:var(--green);padding:4px 8px">✓ Ami</span>'}
        </div>` : `
        <div class="profile-popup-actions" style="margin-top:12px">
          <button class="btn btn-secondary btn-sm btn-full"
            onclick="openSettings('profile');document.getElementById('profile-popup')?.remove()">
            ✏️ Modifier mon profil
          </button>
        </div>`}
    </div>`;

  document.body.appendChild(popup);

  // Positionnement
  if (event) {
    const rect = event.target?.getBoundingClientRect?.() || { right: event.clientX, top: event.clientY };
    const x    = Math.min((rect.right || event.clientX) + 12, window.innerWidth - 300);
    const y    = Math.max(8, Math.min(event.clientY - 20, window.innerHeight - popup.offsetHeight - 8));
    popup.style.left = x + 'px';
    popup.style.top  = y + 'px';
  } else {
    popup.style.left      = '50%';
    popup.style.top       = '50%';
    popup.style.transform = 'translate(-50%,-50%)';
  }

  // Enter dans l'input surnom
  const nicknameInput = document.getElementById(`nickname-input-${userId}`);
  nicknameInput?.addEventListener('keydown', e => {
    if (e.key === 'Enter') saveNickname(userId);
  });

  // Fermer en cliquant ailleurs
  setTimeout(() => {
    document.addEventListener('click', (e) => {
      if (!e.target.closest('#profile-popup')) popup.remove();
    }, { once: true });
  }, 50);
};

// ── Surnoms ───────────────────────────────────────────────
window.saveNickname = async (userId) => {
  const input    = document.getElementById(`nickname-input-${userId}`);
  const nickname = input?.value.trim();
  try {
    await api.put(`/users/${userId}/nickname`, { nickname });
    showToast(nickname ? `Surnom "${nickname}" enregistré` : 'Surnom supprimé', 'success');
    // Mettre à jour l'affichage dans la liste membres si présent
    updateDisplayedNickname(userId, nickname);
    document.getElementById('profile-popup')?.remove();
  } catch (err) { showToast(err.message, 'error'); }
};

window.removeNickname = async (userId) => {
  try {
    await api.delete(`/users/${userId}/nickname`);
    showToast('Surnom supprimé', 'success');
    updateDisplayedNickname(userId, null);
    document.getElementById('profile-popup')?.remove();
  } catch (err) { showToast(err.message, 'error'); }
};

// Met à jour les noms affichés dans la page après changement de surnom
window.updateDisplayedNickname = (userId, nickname) => {
  document.querySelectorAll(`[data-member-id="${userId}"] .member-name`).forEach(el => {
    const orig = el.dataset.originalName;
    if (orig) el.textContent = nickname || orig;
  });
};

// ── Par nom d'utilisateur (pour les mentions cliquables) ──
window.showProfilePopupByName = async (username) => {
  try {
    const results = await api.get(`/friends/search?q=${encodeURIComponent(username)}`);
    const user    = results.find(u => u.username === username);
    if (user) showProfilePopup(null, user.id, user.username);
  } catch (_) {}
};
