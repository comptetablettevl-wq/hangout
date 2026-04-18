// ── Auth forms ───────────────────────────────────────────
document.getElementById('show-register').addEventListener('click', () => {
  document.getElementById('landing-screen').classList.add('hidden');
  document.getElementById('login-form').style.display = 'none';
  document.getElementById('register-form').style.display = 'block';
});

document.getElementById('show-login').addEventListener('click', () => {
  document.getElementById('landing-screen').classList.add('hidden');
  document.getElementById('register-form').style.display = 'none';
  document.getElementById('login-form').style.display = 'block';
});

// Login
document.getElementById('login-btn').addEventListener('click', async () => {
  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  const errEl = document.getElementById('login-error');
  errEl.textContent = '';

  if (!email || !password) { errEl.textContent = 'Remplis tous les champs'; return; }

  const btn = document.getElementById('login-btn');
  btn.disabled = true;
  btn.textContent = 'Connexion...';

  try {
    const data = await api.post('/auth/login', { email, password });
    State.token = data.token;
    State.user  = data.user;
    localStorage.setItem('ho_token', data.token);
    if (typeof initStreakFromLogin === 'function') initStreakFromLogin(data.streak);
    showApp();
  } catch (err) {
    errEl.textContent = err.message;
  } finally {
    btn.disabled = false;
    btn.textContent = 'Se connecter';
  }
});

// Register
document.getElementById('register-btn').addEventListener('click', async () => {
  const username = document.getElementById('reg-username').value.trim();
  const email = document.getElementById('reg-email').value.trim();
  const password = document.getElementById('reg-password').value;
  const errEl = document.getElementById('reg-error');
  errEl.textContent = '';

  if (!username || !email || !password) { errEl.textContent = 'Remplis tous les champs'; return; }
  if (password.length < 6) { errEl.textContent = 'Mot de passe trop court (6 min)'; return; }

  const btn = document.getElementById('register-btn');
  btn.disabled = true;
  btn.textContent = 'Création...';

  try {
    const { token, user } = await api.post('/auth/register', { username, email, password });
    State.token = token;
    State.user = user;
    localStorage.setItem('ho_token', token);
    showApp();
  } catch (err) {
    errEl.textContent = err.message;
  } finally {
    btn.disabled = false;
    btn.textContent = 'Créer un compte';
  }
});

// Enter key on inputs
['login-email', 'login-password'].forEach(id => {
  document.getElementById(id)?.addEventListener('keydown', e => {
    if (e.key === 'Enter') document.getElementById('login-btn').click();
  });
});

['reg-username', 'reg-email', 'reg-password'].forEach(id => {
  document.getElementById(id)?.addEventListener('keydown', e => {
    if (e.key === 'Enter') document.getElementById('register-btn').click();
  });
});

// Logout
document.getElementById('logout-btn').addEventListener('click', () => {
  if (window.socketClient) window.socketClient.disconnect();
  State.token = null;
  State.user = null;
  State.servers = [];
  State.currentServer = null;
  State.currentChannel = null;
  localStorage.removeItem('ho_token');
  closeModal('modal-settings');
  showAuth();
});

// Update user panel
window.updateUserPanel = () => {
  if (!State.user) return;
  const u = State.user;
  document.getElementById('user-panel-name').textContent = u.username;
  document.getElementById('user-panel-avatar').innerHTML =
    renderAvatar(u, 'avatar-md').replace(/<div[^>]*>/, '').replace('</div>', '');
  document.getElementById('user-panel-avatar').style.background = avatarColor(u.username);
  document.getElementById('user-panel-avatar').style.color = '#fff';
  if (!u.avatar) document.getElementById('user-panel-avatar').textContent = u.username.slice(0,2).toUpperCase();
  updateStatusText(u.status || 'online');

  // Settings modal
  document.getElementById('settings-username').textContent = u.username;
  const sa = document.getElementById('settings-avatar');
  sa.style.background = avatarColor(u.username);
  sa.style.color = '#fff';
  sa.textContent = u.username.slice(0,2).toUpperCase();
};

window.updateStatusText = (status) => {
  const map = { online: 'En ligne', idle: 'Absent', dnd: 'Ne pas déranger', offline: 'Hors ligne' };
  document.getElementById('user-panel-status').textContent = map[status] || 'En ligne';
  const dot = document.getElementById('user-panel-dot');
  dot.className = `status-dot ${status}`;
};

window.setStatus = async (status) => {
  try {
    await api.patch('/auth/status', { status });
    State.user.status = status;
    updateStatusText(status);
    if (window.socketClient) window.socketClient.emit('status:set', { status });
    showToast('Statut mis à jour', 'success');
  } catch (err) {
    showToast(err.message, 'error');
  }
};

document.getElementById('settings-btn').addEventListener('click', () => openModal('modal-settings'));
