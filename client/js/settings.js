// ── Settings panel ────────────────────────────────────────
window.openSettings = (tab = 'profile') => {
  document.getElementById('modal-settings-v2').classList.remove('hidden');
  switchSettingsTab(tab);
  loadAudioDevices();
};

window.switchSettingsTab = (tab) => {
  document.querySelectorAll('.settings-tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  document.querySelectorAll('.settings-tab-content').forEach(c => c.style.display = c.dataset.tab === tab ? 'block' : 'none');
};

// ── Profile update ────────────────────────────────────────
document.getElementById('save-profile-btn')?.addEventListener('click', async () => {
  const username     = document.getElementById('settings-username-input')?.value.trim();
  const customStatus = document.getElementById('settings-custom-status')?.value;
  try {
    const biography     = document.getElementById('settings-biography')?.value || '';
    const activityType  = document.getElementById('settings-activity-type')?.value || 'none';
    const activityText  = document.getElementById('settings-activity-text')?.value.trim() || '';
    const { user } = await api.patch('/users/me', {
      username,
      custom_status: customStatus,
      biography:     biography || null,
      activity_type: activityType,
      activity_text: activityText || null,
    });
    State.user = { ...State.user, ...user };
    updateUserPanel();
    showToast('Profil mis à jour', 'success');
  } catch (err) { showToast(err.message, 'error'); }
});

// ── Avatar upload ─────────────────────────────────────────
document.getElementById('avatar-upload-input')?.addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const form = new FormData();
  form.append('avatar', file);
  try {
    const res = await fetch('/api/users/me/avatar', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${State.token}` },
      body: form,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    State.user.avatar = data.avatar;
    updateUserPanel();
    renderSettingsAvatar();
    showToast('Avatar mis à jour', 'success');
  } catch (err) { showToast(err.message, 'error'); }
  e.target.value = '';
});

document.getElementById('remove-avatar-btn')?.addEventListener('click', async () => {
  try {
    const { user } = await api.delete('/users/me/avatar');
    State.user.avatar = null;
    updateUserPanel();
    renderSettingsAvatar();
    showToast('Avatar supprimé', 'success');
  } catch (err) { showToast(err.message, 'error'); }
});

// ── Password change ───────────────────────────────────────
document.getElementById('change-password-btn')?.addEventListener('click', async () => {
  const current = document.getElementById('current-password')?.value;
  const newPwd  = document.getElementById('new-password')?.value;
  const confirm = document.getElementById('confirm-password')?.value;
  const errEl   = document.getElementById('password-error');

  if (newPwd !== confirm) { errEl.textContent = 'Les mots de passe ne correspondent pas'; return; }
  if (newPwd.length < 6)  { errEl.textContent = 'Trop court (6 caractères min)'; return; }
  errEl.textContent = '';

  try {
    await api.patch('/users/me/password', { current_password: current, new_password: newPwd });
    document.getElementById('current-password').value = '';
    document.getElementById('new-password').value = '';
    document.getElementById('confirm-password').value = '';
    showToast('Mot de passe mis à jour', 'success');
  } catch (err) { errEl.textContent = err.message; }
});

window.renderSettingsAvatar = () => {
  const el = document.getElementById('settings-avatar-preview');
  if (!el) return;
  if (State.user?.avatar) {
    el.innerHTML = `<img src="${State.user.avatar}" style="width:80px;height:80px;border-radius:50%;object-fit:cover" />`;
  } else {
    el.style.background = avatarColor(State.user?.username);
    el.style.color = '#fff';
    el.textContent = (State.user?.username || '?').slice(0,2).toUpperCase();
  }
  const usernameInput = document.getElementById('settings-username-input');
  if (usernameInput) usernameInput.value = State.user?.username || '';
  const statusInput = document.getElementById('settings-custom-status');
  if (statusInput) statusInput.value = State.user?.custom_status || '';

  const bioInput = document.getElementById('settings-biography');
  if (bioInput) bioInput.value = State.user?.biography || '';

  const actTypeInput = document.getElementById('settings-activity-type');
  if (actTypeInput) actTypeInput.value = State.user?.activity_type || 'none';

  const actTextInput = document.getElementById('settings-activity-text');
  if (actTextInput) actTextInput.value = State.user?.activity_text || '';
};
