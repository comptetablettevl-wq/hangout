// ── State global ──────────────────────────────────────────
window.State = {
  token: localStorage.getItem('ho_token') || null,
  user: null,
  servers: [],
  currentServer: null,
  currentChannel: null,
  currentDMUser: null,
  messages: [],
  members: [],
  typingUsers: {},
  replyingTo: null,
  membersVisible: false,
  newChannelType: 'text',
};

// ── API ───────────────────────────────────────────────────
window.api = {
  async request(method, path, body) {
    const opts = { method, headers: { 'Content-Type': 'application/json' } };
    if (State.token) opts.headers['Authorization'] = `Bearer ${State.token}`;
    if (body) opts.body = JSON.stringify(body);
    const res = await fetch(`/api${path}`, opts);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Erreur serveur');
    return data;
  },
  get:    (p)    => api.request('GET', p),
  post:   (p, b) => api.request('POST', p, b),
  patch:  (p, b) => api.request('PATCH', p, b),
  delete: (p)    => api.request('DELETE', p),
};

// ── Utils ─────────────────────────────────────────────────
window.avatarColor = (str) => {
  const colors = ['#5865F2','#57F287','#FEE75C','#EB459E','#ED4245','#E67E22','#3BA55C','#9B59B6'];
  let hash = 0;
  for (let c of (str || 'X')) hash = c.charCodeAt(0) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
};

window.renderAvatar = (user, sizeClass = 'avatar-md') => {
  if (user?.avatar) return `<div class="avatar ${sizeClass}"><img src="${user.avatar}" alt="${escapeHtml(user.username||'')}" /></div>`;
  const initials = (user?.username || '?').slice(0,2).toUpperCase();
  return `<div class="avatar ${sizeClass}" style="background:${avatarColor(user?.username)};color:#fff">${initials}</div>`;
};

window.formatTime = (date) => new Date(date).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

window.formatDate = (date) => {
  const d = new Date(date), now = new Date(), diff = now - d;
  if (diff < 86400000 && d.getDate() === now.getDate()) return "Aujourd'hui";
  if (diff < 172800000) return 'Hier';
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
};

window.escapeHtml = (str) => String(str)
  .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

window.renderContent = (content) => {
  let html = escapeHtml(content);
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
  html = html.replace(/`([^`]+)`/g, '<code style="background:var(--bg-input);padding:1px 4px;border-radius:3px;font-family:var(--font-mono);font-size:13px">$1</code>');
  html = html.replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank" rel="noopener">$1</a>');
  return html;
};

// ── Modal helpers ─────────────────────────────────────────
window.openModal  = (id) => document.getElementById(id)?.classList.remove('hidden');
window.closeModal = (id) => document.getElementById(id)?.classList.add('hidden');
window.switchAddTab = (tab) => {
  const isCreate = tab === 'create';
  document.getElementById('tab-create-content').style.display = isCreate ? 'block' : 'none';
  document.getElementById('tab-join-content').style.display   = isCreate ? 'none'  : 'block';
  document.getElementById('tab-create').className = `btn btn-sm ${isCreate ? 'btn-primary' : 'btn-secondary'}`;
  document.getElementById('tab-join').className   = `btn btn-sm ${isCreate ? 'btn-secondary' : 'btn-primary'}`;
};
window.selectChannelType = (type) => {
  State.newChannelType = type;
  document.getElementById('type-text-btn').className  = `btn btn-sm ${type==='text'  ? 'btn-primary' : 'btn-secondary'}`;
  document.getElementById('type-voice-btn').className = `btn btn-sm ${type==='voice' ? 'btn-primary' : 'btn-secondary'}`;
};

// ── Init ──────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', () => {
  const theme = localStorage.getItem('ho_theme') || 'dark';
  document.documentElement.setAttribute('data-theme', theme);

  if (State.token) {
    api.get('/auth/me')
      .then(({ user }) => { State.user = user; showApp(); })
      .catch(() => {
        State.token = null;
        localStorage.removeItem('ho_token');
        // Pas de token valide : afficher landing
      });
  }
  // Si pas de token : la landing est déjà visible par défaut
});

window.showApp = () => {
  document.getElementById('auth-screen').classList.add('hidden');
  document.getElementById('landing-screen').classList.add('hidden');
  document.getElementById('app').style.display = 'flex';
  initSocket();
  loadServers();
  loadFriends();
  updateUserPanel();
};

window.showAuth = () => {
  document.getElementById('auth-screen').classList.remove('hidden');
  document.getElementById('app').style.display = 'none';
};

window.updateUserPanel = () => {
  if (!State.user) return;
  const u = State.user;
  const el = document.getElementById('user-panel-avatar');
  el.innerHTML = '';
  if (u.avatar) {
    el.innerHTML = `<img src="${u.avatar}" style="width:100%;height:100%;border-radius:50%;object-fit:cover" />`;
  } else {
    el.style.background = avatarColor(u.username);
    el.style.color = '#fff';
    el.textContent = u.username.slice(0,2).toUpperCase();
  }
  document.getElementById('user-panel-name').textContent = u.username;
  updateStatusText(u.status || 'online');
};

window.updateStatusText = (status) => {
  const map = { online: 'En ligne', idle: 'Absent', dnd: 'Ne pas déranger', offline: 'Invisible' };
  document.getElementById('user-panel-status').textContent = map[status] || 'En ligne';
  document.getElementById('user-panel-dot').className = `status-dot ${status}`;
};

window.setStatus = async (status) => {
  try {
    await api.patch('/auth/status', { status });
    State.user.status = status;
    updateStatusText(status);
    window.socketClient?.emit('status:set', { status });
    showToast('Statut mis à jour', 'success');
  } catch (err) { showToast(err.message, 'error'); }
};
