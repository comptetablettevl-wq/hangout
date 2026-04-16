// ── Rôles ─────────────────────────────────────────────────
window.RolesState = { roles: [] };

window.loadRoles = async (guildId) => {
  try {
    RolesState.roles = await api.get(`/servers/${guildId}/roles`);
  } catch (_) {}
};

window.openRolesModal = async () => {
  if (!State.currentServer) return;
  await loadRoles(State.currentServer.id);
  renderRolesModal();
  openModal('modal-roles');
};

window.renderRolesModal = () => {
  const list = document.getElementById('roles-list');
  if (!list) return;
  list.innerHTML = RolesState.roles.length === 0
    ? '<p style="color:var(--text-muted);font-size:13px;padding:8px">Aucun rôle custom</p>'
    : RolesState.roles.map(r => `
      <div class="role-item" style="display:flex;align-items:center;gap:10px;padding:8px;border-radius:6px;margin-bottom:4px;background:var(--bg-elevated)">
        <div style="width:16px;height:16px;border-radius:50%;background:${r.color};flex-shrink:0"></div>
        <span style="flex:1;font-weight:500">${escapeHtml(r.name)}</span>
        <div style="display:flex;gap:2px">
          ${r.can_kick ? '<span style="font-size:10px;background:rgba(237,66,69,0.2);color:var(--red);padding:2px 5px;border-radius:3px">kick</span>' : ''}
          ${r.can_ban  ? '<span style="font-size:10px;background:rgba(237,66,69,0.2);color:var(--red);padding:2px 5px;border-radius:3px">ban</span>' : ''}
          ${r.can_manage_channels ? '<span style="font-size:10px;background:var(--accent-dim);color:var(--accent);padding:2px 5px;border-radius:3px">channels</span>' : ''}
        </div>
        <button class="btn btn-sm btn-ghost" onclick="editRole('${r.id}')" style="padding:3px 8px">✏️</button>
        <button class="btn btn-sm btn-ghost" onclick="deleteRole('${r.id}')" style="padding:3px 8px;color:var(--red)">🗑️</button>
      </div>
    `).join('');
};

window.editRole = (roleId) => {
  const role = RolesState.roles.find(r => r.id === roleId) || {};
  document.getElementById('role-id-input').value = roleId;
  document.getElementById('role-name-input').value = role.name || '';
  document.getElementById('role-color-input').value = role.color || '#99aab5';
  document.getElementById('role-perm-channels').checked  = !!role.can_manage_channels;
  document.getElementById('role-perm-roles').checked     = !!role.can_manage_roles;
  document.getElementById('role-perm-kick').checked      = !!role.can_kick;
  document.getElementById('role-perm-ban').checked       = !!role.can_ban;
  document.getElementById('role-perm-messages').checked  = !!role.can_manage_messages;
  document.getElementById('role-form-title').textContent = 'Modifier le rôle';
};

window.clearRoleForm = () => {
  document.getElementById('role-id-input').value = '';
  document.getElementById('role-name-input').value = '';
  document.getElementById('role-color-input').value = '#5865F2';
  ['channels','roles','kick','ban','messages'].forEach(p => {
    document.getElementById(`role-perm-${p}`).checked = false;
  });
  document.getElementById('role-form-title').textContent = 'Nouveau rôle';
};

window.saveRole = async () => {
  const id    = document.getElementById('role-id-input').value;
  const name  = document.getElementById('role-name-input').value.trim();
  const color = document.getElementById('role-color-input').value;
  if (!name) { showToast('Nom requis', 'error'); return; }

  const payload = {
    name, color,
    can_manage_channels: document.getElementById('role-perm-channels').checked,
    can_manage_roles:    document.getElementById('role-perm-roles').checked,
    can_kick:            document.getElementById('role-perm-kick').checked,
    can_ban:             document.getElementById('role-perm-ban').checked,
    can_manage_messages: document.getElementById('role-perm-messages').checked,
  };

  try {
    if (id) {
      const updated = await api.patch(`/servers/${State.currentServer.id}/roles/${id}`, payload);
      RolesState.roles = RolesState.roles.map(r => r.id === id ? updated : r);
    } else {
      const created = await api.post(`/servers/${State.currentServer.id}/roles`, payload);
      RolesState.roles.push(created);
    }
    renderRolesModal();
    clearRoleForm();
    showToast('Rôle sauvegardé', 'success');
  } catch (err) { showToast(err.message, 'error'); }
};

window.deleteRole = async (roleId) => {
  if (!confirm('Supprimer ce rôle ?')) return;
  try {
    await api.delete(`/servers/${State.currentServer.id}/roles/${roleId}`);
    RolesState.roles = RolesState.roles.filter(r => r.id !== roleId);
    renderRolesModal();
    showToast('Rôle supprimé', 'success');
  } catch (err) { showToast(err.message, 'error'); }
};
