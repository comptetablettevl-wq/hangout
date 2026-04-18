// ── Theme ─────────────────────────────────────────────────
window.toggleTheme = () => {
  const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('ho_theme', next);
};
document.getElementById('theme-toggle-btn').addEventListener('click', toggleTheme);

// ── Settings ──────────────────────────────────────────────
window.openSettings = (tab = 'profile') => {
  renderSettingsAvatar();
  openModal('modal-settings-v2');
  switchSettingsTab(tab);
  loadAudioDevices();
};

document.getElementById('settings-btn').addEventListener('click', () => openSettings('profile'));

// Style des onglets settings
document.querySelectorAll('.settings-tab-btn').forEach(btn => {
  btn.addEventListener('mouseenter', () => { if (!btn.classList.contains('active')) btn.style.background = 'var(--bg-hover)'; btn.style.color = 'var(--text-primary)'; });
  btn.addEventListener('mouseleave', () => { if (!btn.classList.contains('active')) { btn.style.background = ''; btn.style.color = 'var(--text-secondary)'; } });
});

window.switchSettingsTab = (tab) => {
  document.querySelectorAll('.settings-tab-btn').forEach(b => {
    const isActive = b.dataset.tab === tab;
    b.classList.toggle('active', isActive);
    b.style.background = isActive ? 'var(--bg-active)' : '';
    b.style.color = isActive ? 'var(--text-primary)' : 'var(--text-secondary)';
  });
  document.querySelectorAll('.settings-tab-content').forEach(c => {
    c.style.display = c.dataset.tab === tab ? 'block' : 'none';
  });
};

// ── Toast ─────────────────────────────────────────────────
window.showToast = (message, type = 'info', duration = 3500) => {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  const icon = { success: '✓', error: '✕', info: 'i' }[type] || 'i';
  toast.innerHTML = `<span style="font-weight:700;font-size:15px">${icon}</span><span>${escapeHtml(String(message))}</span>`;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.transition = 'opacity 200ms, transform 200ms';
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(8px)';
    setTimeout(() => toast.remove(), 200);
  }, duration);
};

// ── Context menu ──────────────────────────────────────────
window.showContextMenu = (event, items) => {
  event?.preventDefault();
  const menu = document.getElementById('context-menu');
  menu.innerHTML = items.map(item => {
    if (item.divider) return '<div class="ctx-divider"></div>';
    return `<div class="ctx-item ${item.danger ? 'danger' : ''}" data-action="${encodeURIComponent(item.label)}">
      ${item.icon ? `<span>${item.icon}</span>` : ''}<span>${escapeHtml(item.label)}</span></div>`;
  }).join('');

  const x = Math.min(event.clientX, window.innerWidth - 200);
  const y = Math.min(event.clientY, window.innerHeight - items.length * 40);
  menu.style.left = x + 'px';
  menu.style.top = y + 'px';
  menu.classList.remove('hidden');

  items.forEach(item => {
    if (!item.action || item.divider) return;
    menu.querySelector(`[data-action="${encodeURIComponent(item.label)}"]`)
      ?.addEventListener('click', () => { item.action(); menu.classList.add('hidden'); });
  });
};

document.addEventListener('click', (e) => {
  if (!e.target.closest('#context-menu')) document.getElementById('context-menu').classList.add('hidden');
});

// ── Friends panel toggle ──────────────────────────────────
document.getElementById('friends-btn').addEventListener('click', () => {
  const isServer = State.currentServer !== null;
  if (isServer) {
    State.currentServer = null;
    State.currentChannel = null;
    document.getElementById('sidebar-channels').style.display = 'none';
    document.getElementById('chat-view').style.display = 'none';
    document.getElementById('dm-view').style.display = 'none';
    document.getElementById('welcome-screen').style.display = 'flex';
  }
  document.getElementById('welcome-default').style.display = 'none';
  document.getElementById('friends-panel-wrapper').style.display = 'block';
  loadFriends();
  document.querySelectorAll('.server-pill[data-server-id]').forEach(p => p.classList.remove('active'));
  document.getElementById('friends-btn').classList.add('active');
});

document.getElementById('home-btn').addEventListener('click', () => {
  document.getElementById('friends-panel-wrapper').style.display = 'none';
  document.getElementById('welcome-default').style.display = 'flex';
  document.getElementById('friends-btn').classList.remove('active');
  if (window.innerWidth <= 768) document.getElementById('sidebar-channels').classList.toggle('open');
});

// ── Server header context menu ────────────────────────────
document.getElementById('server-name-header').addEventListener('click', (e) => {
  if (!State.currentServer) return;
  const myMember = State.currentServer.members?.find(m => (m.user?.id || m.user) === State.user?.id);
  const canAdmin = ['owner','admin'].includes(myMember?.role);
  const canBanList = ['owner','admin'].includes(myMember?.role);

  const items = [
    { label: 'Inviter des gens', action: () => document.getElementById('invite-btn').click() },
  ];
  if (canAdmin) {
    items.push({ divider: true });
    items.push({ label: 'Paramètres du serveur', action: () => openGuildSettings('general') });
    items.push({ label: 'Rôles & Permissions', action: () => openGuildSettings('roles') });
    items.push({ label: 'Liste des bans', action: () => openBansList() });
    items.push({ label: 'Membres', action: () => openGuildSettings('members') });

  }
  items.push({ divider: true });
  items.push({ label: 'Quitter le serveur', danger: true, action: leaveServer });
  showContextMenu(e, items);
});

// ── Invite btn ────────────────────────────────────────────
document.getElementById('invite-btn').addEventListener('click', () => {
  if (!State.currentServer) return;
  const code = State.currentServer.invite_code || State.currentServer.inviteCode;
  document.getElementById('invite-link-display').value = `${location.origin}/invite/${code}`;
  openModal('modal-invite');
});

document.getElementById('copy-invite-btn').addEventListener('click', () => {
  navigator.clipboard.writeText(document.getElementById('invite-link-display').value)
    .then(() => showToast('Lien copié !', 'success'))
    .catch(() => showToast('Erreur copie', 'error'));
});

// ── Keyboard shortcuts ────────────────────────────────────
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    document.querySelectorAll('.modal-overlay:not(.hidden)').forEach(m => m.classList.add('hidden'));
    document.getElementById('context-menu').classList.add('hidden');
    document.getElementById('emoji-picker').classList.add('hidden');
  }
  const input = document.getElementById('message-input');
  const active = document.activeElement;
  if (input && e.key && e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey &&
      active && active !== input &&
      !(active.closest && active.closest('input,textarea,select,[contenteditable]')) &&
      State.currentChannel) {
    input.focus();
  }
});

// ── Notifications navigateur ──────────────────────────────
window.sendBrowserNotification = (title, body) => {
  if (document.hasFocus()) return;
  if (Notification.permission === 'granted') {
    new Notification(title, { body });
  } else if (Notification.permission === 'default') {
    Notification.requestPermission();
  }
};

// ── Resize ────────────────────────────────────────────────
window.addEventListener('resize', () => {
  if (window.innerWidth > 768) {
    document.getElementById('sidebar-channels').classList.remove('open');
    const sm = document.getElementById('sidebar-members');
    sm.classList.remove('open');
    if (State.membersVisible) sm.classList.remove('collapsed');
  }
});

// ── DM helpers ────────────────────────────────────────────
window.openDMWithUser = (userId, username) => {
  // Déléguer à openDM dans dm.js
  if (typeof openDM === 'function') openDM(userId, username);
};

// ── Modal helpers ─────────────────────────────────────────
document.querySelectorAll('.modal-overlay').forEach(overlay => {
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.classList.add('hidden'); });
});
