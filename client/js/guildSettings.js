// ── Paramètres du serveur — panel complet ─────────────────

const EVENT_TYPES_CONFIG = [
  { key: 'member_join',     label: 'Membre a rejoint',  icon: '👋', desc: 'Quand un utilisateur rejoint le serveur',        default: true  },
  { key: 'member_leave',    label: 'Membre a quitté',   icon: '🚪', desc: 'Quand un utilisateur quitte le serveur',         default: true  },
  { key: 'member_kick',     label: 'Membre expulsé',    icon: '👢', desc: 'Quand un membre est expulsé par un modérateur',  default: true  },
  { key: 'member_ban',      label: 'Membre banni',      icon: '🔨', desc: 'Quand un membre est banni',                      default: true  },
  { key: 'channel_created', label: 'Channel créé',      icon: '📢', desc: 'Quand un nouveau channel est créé',              default: false },
  { key: 'channel_deleted', label: 'Channel supprimé',  icon: '🗑️', desc: 'Quand un channel est supprimé',                  default: false },
  { key: 'server_renamed',  label: 'Serveur renommé',   icon: '✏️', desc: 'Quand le nom du serveur change',                 default: false },
  { key: 'role_created',    label: 'Rôle créé',         icon: '🎭', desc: 'Quand un nouveau rôle est créé',                 default: false },
];

const PERMISSIONS_CONFIG = [
  { key: 'can_send_messages',    label: 'Envoyer des messages',          group: 'Texte',       icon: '💬' },
  { key: 'can_read_history',     label: 'Lire l\'historique',            group: 'Texte',       icon: '📜' },
  { key: 'can_add_reactions',    label: 'Ajouter des réactions',         group: 'Texte',       icon: '😊' },
  { key: 'can_mention_everyone', label: 'Mentionner @everyone',          group: 'Texte',       icon: '📣' },
  { key: 'can_manage_messages',  label: 'Gérer les messages',            group: 'Modération',  icon: '🗑️' },
  { key: 'can_kick',             label: 'Expulser des membres',          group: 'Modération',  icon: '👢' },
  { key: 'can_ban',              label: 'Bannir des membres',            group: 'Modération',  icon: '🔨' },
  { key: 'can_manage_channels',  label: 'Gérer les channels',            group: 'Admin',       icon: '📺' },
  { key: 'can_manage_roles',     label: 'Gérer les rôles',               group: 'Admin',       icon: '🎭' },
  { key: 'can_manage_guild',     label: 'Gérer le serveur',              group: 'Admin',       icon: '⚙️' },
];

window._guildSettingsState  = {};
window._guildSettingsTab    = 'general';
window._permEditingRoleId   = null;

// ── Ouverture ─────────────────────────────────────────────
window.openGuildSettings = async (tab = 'general') => {
  if (!State.currentServer) return;
  const myMember = State.currentServer.members?.find(m => m.user?.id === State.user?.id);
  if (!['owner','admin'].includes(myMember?.role)) {
    showToast('Réservé aux admins', 'error');
    return;
  }
  try {
    const settings = await api.get(`/servers/${State.currentServer.id}/settings`);
    window._guildSettingsState = { ...settings };
    renderGuildSettingsModal(tab);
    openModal('modal-guild-settings');
  } catch (err) { showToast(err.message, 'error'); }
};

window.switchGuildTab = (tab) => {
  window._guildSettingsTab = tab;
  document.querySelectorAll('.guild-tab-btn').forEach(b => {
    const active = b.dataset.tab === tab;
    b.style.background = active ? 'var(--bg-active)' : '';
    b.style.color      = active ? 'var(--text-primary)' : 'var(--text-secondary)';
    b.style.fontWeight = active ? '600' : '400';
  });
  document.querySelectorAll('.guild-tab-pane').forEach(p => {
    p.style.display = p.dataset.tab === tab ? 'block' : 'none';
  });
};

// ── Render modal ──────────────────────────────────────────
window.renderGuildSettingsModal = async (activeTab = 'general') => {
  const modal = document.getElementById('modal-guild-settings');
  if (!modal) return;

  const guild    = State.currentServer;
  const settings = window._guildSettingsState;
  const textChs  = guild?.channels?.filter(c => c.type === 'text') || [];
  const chOpts   = textChs.map(c => `<option value="${c.id}">#${escapeHtml(c.name)}</option>`).join('');
  const myMember = guild?.members?.find(m => m.user?.id === State.user?.id);
  const isOwner  = guild?.owner_id === State.user?.id;

  modal.querySelector('.modal-header h3').textContent = `⚙️ ${escapeHtml(guild?.name || 'Serveur')}`;
  modal.querySelector('.modal-header p').textContent  = 'Paramètres du serveur';

  modal.querySelector('.modal-body').innerHTML = `
    <!-- Sidebar onglets -->
    <div style="display:flex;gap:0;min-height:480px">
      <div style="width:160px;min-width:160px;background:var(--bg-secondary);border-radius:var(--radius) 0 0 var(--radius);padding:12px 6px;display:flex;flex-direction:column;gap:2px">
        ${[
          { tab: 'general',     icon: '🏠', label: 'Général'     },
          { tab: 'roles',       icon: '🎭', label: 'Rôles'        },
          { tab: 'events',      icon: '📣', label: 'Événements'   },
          { tab: 'members',     icon: '👥', label: 'Membres'      },
        ].map(t => `
          <button class="guild-tab-btn" data-tab="${t.tab}" onclick="switchGuildTab('${t.tab}')"
            style="text-align:left;padding:8px 10px;border-radius:6px;font-size:13px;
                   cursor:pointer;background:none;border:none;width:100%;
                   display:flex;align-items:center;gap:8px;
                   color:${activeTab === t.tab ? 'var(--text-primary)' : 'var(--text-secondary)'};
                   background:${activeTab === t.tab ? 'var(--bg-active)' : ''};
                   font-weight:${activeTab === t.tab ? '600' : '400'}">
            <span>${t.icon}</span><span>${t.label}</span>
          </button>`).join('')}
      </div>

      <!-- Contenu -->
      <div style="flex:1;padding:20px;overflow-y:auto;max-height:520px">

        <!-- ═══ GÉNÉRAL ═══ -->
        <div class="guild-tab-pane" data-tab="general" style="display:${activeTab==='general'?'block':'none'}">
          <h4 style="font-size:13px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:16px">Général</h4>

          <!-- Bannière -->
          <div style="margin-bottom:20px">
            <div style="font-size:13px;font-weight:500;color:var(--text-secondary);margin-bottom:8px">Bannière du serveur</div>
            <div id="guild-banner-preview" style="height:100px;border-radius:var(--radius);background:${guild?.banner ? 'none' : 'linear-gradient(135deg,var(--accent),#7289da)'};overflow:hidden;position:relative;cursor:pointer;border:2px dashed ${guild?.banner ? 'transparent' : 'var(--border-strong)'}" onclick="document.getElementById('guild-banner-input').click()">
              ${guild?.banner ? `<img src="${guild.banner}" style="width:100%;height:100%;object-fit:cover" />` : `<div style="display:flex;align-items:center;justify-content:center;height:100%;color:rgba(255,255,255,0.7);font-size:13px">Cliquer pour ajouter une bannière</div>`}
              <div style="position:absolute;inset:0;background:rgba(0,0,0,0);hover:rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;transition:background 200ms" id="banner-overlay">
                <span style="color:#fff;font-size:12px;opacity:0;transition:opacity 200ms" id="banner-hint">✏️ Modifier</span>
              </div>
            </div>
            <input type="file" id="guild-banner-input" accept="image/*" style="display:none" onchange="uploadGuildAsset('banner', this)" />
            ${guild?.banner ? `<button onclick="removeGuildAsset('banner')" style="margin-top:6px;font-size:12px;color:var(--red);background:none;border:none;cursor:pointer">Supprimer la bannière</button>` : ''}
          </div>

          <!-- Photo de profil (icon) -->
          <div style="margin-bottom:20px">
            <div style="font-size:13px;font-weight:500;color:var(--text-secondary);margin-bottom:8px">Photo de profil</div>
            <div style="display:flex;align-items:center;gap:16px">
              <div id="guild-icon-preview" style="width:72px;height:72px;border-radius:var(--radius-lg);background:${guild?.icon ? 'none' : avatarColor(guild?.name)};display:flex;align-items:center;justify-content:center;font-size:28px;font-weight:700;color:#fff;overflow:hidden;cursor:pointer;flex-shrink:0;border:2px solid var(--border)" onclick="document.getElementById('guild-icon-input').click()">
                ${guild?.icon ? `<img src="${guild.icon}" style="width:100%;height:100%;object-fit:cover" />` : (guild?.name||'?').slice(0,2).toUpperCase()}
              </div>
              <div style="display:flex;flex-direction:column;gap:6px">
                <input type="file" id="guild-icon-input" accept="image/*" style="display:none" onchange="uploadGuildAsset('icon', this)" />
                <button class="btn btn-secondary btn-sm" onclick="document.getElementById('guild-icon-input').click()">Changer l'icône</button>
                ${guild?.icon ? `<button class="btn btn-ghost btn-sm" style="color:var(--red)" onclick="removeGuildAsset('icon')">Supprimer</button>` : ''}
              </div>
            </div>
          </div>

          <!-- Nom du serveur -->
          <div class="input-group" style="margin-bottom:16px">
            <label>Nom du serveur</label>
            <input id="guild-name-input" class="input" type="text" value="${escapeHtml(guild?.name || '')}" maxlength="64" placeholder="Nom du serveur" />
          </div>

          <!-- Description -->
          <div class="input-group" style="margin-bottom:20px">
            <label>Description</label>
            <textarea id="guild-desc-input" class="input" maxlength="256" placeholder="Décris ton serveur..."
              style="resize:vertical;min-height:70px;font-family:var(--font)">${escapeHtml(guild?.description || '')}</textarea>
          </div>

          <!-- Code d'invitation -->
          <div style="padding:12px;background:var(--bg-elevated);border-radius:var(--radius);margin-bottom:8px">
            <div style="font-size:12px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px">Lien d'invitation</div>
            <div style="display:flex;gap:8px;align-items:center">
              <code style="flex:1;font-size:13px;color:var(--accent);background:var(--bg-input);padding:6px 10px;border-radius:var(--radius-sm)">${location.origin}?invite=${guild?.invite_code || ''}</code>
              <button class="btn btn-secondary btn-sm" onclick="navigator.clipboard.writeText('${location.origin}?invite=${guild?.invite_code||''}').then(()=>showToast('Copié !','success'))">Copier</button>
            </div>
          </div>

          <button class="btn btn-primary btn-sm" onclick="saveGeneralSettings()" style="margin-top:8px">Sauvegarder</button>
        </div>

        <!-- ═══ RÔLES & PERMISSIONS ═══ -->
        <div class="guild-tab-pane" data-tab="roles" style="display:${activeTab==='roles'?'block':'none'}">
          <h4 style="font-size:13px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:16px">Rôles & Permissions</h4>
          <div style="display:flex;gap:12px;min-height:360px">

            <!-- Liste des rôles -->
            <div style="width:160px;flex-shrink:0;display:flex;flex-direction:column;gap:4px">
              <div style="font-size:11px;font-weight:700;color:var(--text-muted);text-transform:uppercase;padding:0 4px 6px;letter-spacing:.05em">Rôles</div>
              <div id="roles-sidebar-list" style="flex:1;overflow-y:auto"></div>
              <button class="btn btn-primary btn-sm btn-full" onclick="openCreateRoleInline()" style="margin-top:8px">+ Créer un rôle</button>
            </div>

            <!-- Éditeur de permissions -->
            <div style="flex:1;min-width:0" id="role-permissions-editor">
              <div style="display:flex;align-items:center;justify-content:center;height:100%;color:var(--text-muted);font-size:13px">
                ← Sélectionne un rôle
              </div>
            </div>
          </div>
        </div>

        <!-- ═══ ÉVÉNEMENTS ═══ -->
        <div class="guild-tab-pane" data-tab="events" style="display:${activeTab==='events'?'block':'none'}">
          <h4 style="font-size:13px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:8px">Événements système</h4>
          <p style="font-size:12px;color:var(--text-muted);margin-bottom:16px">Choisis quels événements afficher et dans quel salon.</p>

          <div style="display:flex;flex-direction:column;gap:0;border:1px solid var(--border);border-radius:var(--radius);overflow:hidden" id="events-list">
            ${EVENT_TYPES_CONFIG.map((evt, i) => {
              const ek = `event_${evt.key}_enabled`;
              const ck = `event_${evt.key}_channel`;
              const on = settings[ek] !== false;
              const ch = settings[ck] || '';
              return `
                <div style="padding:10px 14px;${i>0?'border-top:1px solid var(--border);':''}background:var(--bg-elevated)">
                  <div style="display:flex;align-items:center;gap:10px">
                    <label style="flex-shrink:0;cursor:pointer;display:flex;align-items:center">
                      <input type="checkbox" id="ev-${evt.key}" ${on?'checked':''} onchange="handleEventToggle('${evt.key}',this.checked)"
                        style="accent-color:var(--accent);width:16px;height:16px;cursor:pointer" />
                    </label>
                    <span style="font-size:16px;flex-shrink:0">${evt.icon}</span>
                    <div style="flex:1;min-width:0">
                      <div style="font-size:13px;font-weight:500;color:${on?'var(--text-primary)':'var(--text-muted)'}" id="evlabel-${evt.key}">${evt.label}</div>
                      <div style="font-size:11px;color:var(--text-muted)">${evt.desc}</div>
                    </div>
                    <div id="evch-${evt.key}" style="${!on?'opacity:0.4;pointer-events:none':''}">
                      <select onchange="handleEventChannelChange('${evt.key}',this.value)"
                        style="background:var(--bg-input);border:1px solid var(--border);border-radius:var(--radius-sm);padding:3px 6px;font-size:12px;color:var(--text-primary);max-width:130px;cursor:pointer">
                        <option value="">1er channel</option>
                        ${chOpts}
                      </select>
                    </div>
                  </div>
                </div>`;
            }).join('')}
          </div>
          <button class="btn btn-primary btn-sm" onclick="saveEventSettings()" style="margin-top:12px">Sauvegarder les événements</button>
        </div>

        <!-- ═══ MEMBRES ═══ -->
        <div class="guild-tab-pane" data-tab="members" style="display:${activeTab==='members'?'block':'none'}">
          <h4 style="font-size:13px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:12px">
            Membres — ${guild?.members?.length || 0}
          </h4>
          <div id="settings-members-list" style="display:flex;flex-direction:column;gap:2px"></div>
        </div>

      </div>
    </div>`;

  // Restaurer les selects événements
  EVENT_TYPES_CONFIG.forEach(evt => {
    const ck = `event_${evt.key}_channel`;
    const sel = document.querySelector(`#evch-${evt.key} select`);
    if (sel && settings[ck]) sel.value = settings[ck];
  });

  // Charger les rôles dans la sidebar
  loadRolesSidebar();

  // Charger les membres
  renderSettingsMembers();

  // Hover sur bannière
  const bannerDiv = document.getElementById('guild-banner-preview');
  const overlay   = document.getElementById('banner-overlay');
  const hint      = document.getElementById('banner-hint');
  if (bannerDiv && overlay && hint) {
    bannerDiv.onmouseenter = () => { overlay.style.background='rgba(0,0,0,0.3)'; hint.style.opacity='1'; };
    bannerDiv.onmouseleave = () => { overlay.style.background='rgba(0,0,0,0)';   hint.style.opacity='0'; };
  }
};

// ── Onglet Général ────────────────────────────────────────
window.uploadGuildAsset = async (type, input) => {
  const file = input.files[0];
  if (!file) return;
  const form = new FormData();
  form.append('file', file);
  try {
    const res  = await fetch(`/api/servers/${State.currentServer.id}/${type}`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${State.token}` },
      body: form,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);

    if (type === 'icon') {
      State.currentServer.icon = data.icon;
      // Mettre à jour la pill du serveur
      renderServersList();
      // Refresh le preview
      const prev = document.getElementById('guild-icon-preview');
      if (prev) prev.innerHTML = `<img src="${data.icon}" style="width:100%;height:100%;object-fit:cover" />`;
    } else {
      State.currentServer.banner = data.banner;
      const prev = document.getElementById('guild-banner-preview');
      if (prev) prev.style.background = 'none';
      if (prev) prev.innerHTML = `<img src="${data.banner}" style="width:100%;height:100%;object-fit:cover" />` + prev.innerHTML.split('</div>').slice(1).join('</div>');
    }
    showToast(type === 'icon' ? 'Icône mise à jour' : 'Bannière mise à jour', 'success');
  } catch (err) { showToast(err.message, 'error'); }
  input.value = '';
};

window.removeGuildAsset = async (type) => {
  try {
    await api.delete(`/servers/${State.currentServer.id}/${type}`);
    if (type === 'icon')   { State.currentServer.icon = null;   renderServersList(); }
    if (type === 'banner') { State.currentServer.banner = null; }
    showToast(type === 'icon' ? 'Icône supprimée' : 'Bannière supprimée', 'success');
    renderGuildSettingsModal(window._guildSettingsTab);
  } catch (err) { showToast(err.message, 'error'); }
};

window.saveGeneralSettings = async () => {
  const name = document.getElementById('guild-name-input')?.value.trim();
  const desc = document.getElementById('guild-desc-input')?.value;
  if (!name) { showToast('Le nom ne peut pas être vide', 'error'); return; }
  try {
    await api.patch(`/servers/${State.currentServer.id}`, { name, description: desc });
    State.currentServer.name = name;
    State.currentServer.description = desc;
    document.getElementById('current-server-name').textContent = name;
    renderServersList();
    showToast('Serveur mis à jour ✓', 'success');
  } catch (err) { showToast(err.message, 'error'); }
};

// ── Onglet Rôles & Permissions ────────────────────────────
window.loadRolesSidebar = async () => {
  const el = document.getElementById('roles-sidebar-list');
  if (!el) return;
  try {
    const roles = await api.get(`/servers/${State.currentServer.id}/roles`);
    window._cachedRoles = roles;
    el.innerHTML = roles.length
      ? roles.map(r => `
          <div onclick="editRolePermissions('${r.id}')"
            style="display:flex;align-items:center;gap:8px;padding:7px 8px;border-radius:6px;cursor:pointer;
                   background:${window._permEditingRoleId===r.id?'var(--bg-active)':''};transition:background 100ms"
            onmouseover="this.style.background='var(--bg-hover)'"
            onmouseout="this.style.background='${window._permEditingRoleId===r.id?'var(--bg-active)':''}'"
            id="role-sidebar-${r.id}">
            <div style="width:12px;height:12px;border-radius:50%;background:${r.color};flex-shrink:0"></div>
            <span style="font-size:13px;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(r.name)}</span>
          </div>`).join('')
      : '<p style="font-size:12px;color:var(--text-muted);padding:4px 8px">Aucun rôle</p>';
  } catch (_) {}
};

window.editRolePermissions = async (roleId) => {
  window._permEditingRoleId = roleId;
  // Surligner dans la sidebar
  document.querySelectorAll('[id^="role-sidebar-"]').forEach(el => el.style.background = '');
  document.getElementById(`role-sidebar-${roleId}`)?.style.setProperty('background', 'var(--bg-active)');

  const role  = window._cachedRoles?.find(r => r.id === roleId);
  const el    = document.getElementById('role-permissions-editor');
  if (!el || !role) return;

  const isOwner = State.currentServer?.owner_id === State.user?.id;
  const groups  = [...new Set(PERMISSIONS_CONFIG.map(p => p.group))];

  el.innerHTML = `
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:16px;padding-bottom:12px;border-bottom:1px solid var(--border)">
      <div style="width:20px;height:20px;border-radius:50%;background:${role.color};flex-shrink:0"></div>
      <div style="flex:1">
        <input id="perm-role-name" class="input" value="${escapeHtml(role.name)}" maxlength="32"
          style="font-size:14px;font-weight:600;padding:4px 8px" placeholder="Nom du rôle" />
      </div>
      <input type="color" value="${role.color}" id="perm-role-color"
        onchange="document.querySelector('#perm-role-name').parentElement.previousElementSibling.style.background=this.value"
        style="width:32px;height:32px;border:none;border-radius:50%;cursor:pointer;padding:0;background:none;flex-shrink:0" />
      <button class="btn btn-danger btn-sm" onclick="deleteRoleFromSettings('${roleId}')">Supprimer</button>
    </div>

    <div style="font-size:11px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:12px">Permissions</div>

    ${groups.map(group => `
      <div style="margin-bottom:16px">
        <div style="font-size:11px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.05em;padding-bottom:6px;border-bottom:1px solid var(--border);margin-bottom:8px">${group}</div>
        ${PERMISSIONS_CONFIG.filter(p => p.group === group).map(perm => `
          <div style="display:flex;align-items:center;justify-content:space-between;padding:6px 0">
            <div style="display:flex;align-items:center;gap:8px">
              <span style="font-size:14px">${perm.icon}</span>
              <span style="font-size:13px;color:var(--text-secondary)">${perm.label}</span>
            </div>
            <label style="cursor:pointer;position:relative;display:inline-flex;align-items:center">
              <input type="checkbox" id="perm-${perm.key}" ${role[perm.key]!==false?'checked':''}
                style="accent-color:var(--accent);width:16px;height:16px;cursor:pointer" />
            </label>
          </div>`).join('')}
      </div>`).join('')}

    <div style="display:flex;gap:8px;margin-top:8px;padding-top:12px;border-top:1px solid var(--border)">
      <button class="btn btn-primary btn-sm" onclick="saveRolePermissions('${roleId}')">Sauvegarder</button>
      <button class="btn btn-ghost btn-sm" onclick="loadRolesSidebar()">Annuler</button>
    </div>`;
};

window.saveRolePermissions = async (roleId) => {
  const name  = document.getElementById('perm-role-name')?.value.trim();
  const color = document.getElementById('perm-role-color')?.value;
  if (!name) { showToast('Nom requis', 'error'); return; }

  const payload = { name, color };
  PERMISSIONS_CONFIG.forEach(p => {
    const el = document.getElementById(`perm-${p.key}`);
    if (el) payload[p.key] = el.checked;
  });

  try {
    await api.patch(`/servers/${State.currentServer.id}/roles/${roleId}`, payload);
    // Mettre à jour le cache local
    const idx = window._cachedRoles?.findIndex(r => r.id === roleId);
    if (idx !== -1) window._cachedRoles[idx] = { ...window._cachedRoles[idx], ...payload };
    loadRolesSidebar();
    document.getElementById(`role-sidebar-${roleId}`)?.click();
    showToast('Rôle sauvegardé ✓', 'success');
  } catch (err) { showToast(err.message, 'error'); }
};

window.deleteRoleFromSettings = async (roleId) => {
  if (!confirm('Supprimer ce rôle ?')) return;
  try {
    await api.delete(`/servers/${State.currentServer.id}/roles/${roleId}`);
    window._permEditingRoleId = null;
    document.getElementById('role-permissions-editor').innerHTML =
      '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:var(--text-muted);font-size:13px">← Sélectionne un rôle</div>';
    loadRolesSidebar();
    showToast('Rôle supprimé', 'success');
  } catch (err) { showToast(err.message, 'error'); }
};

window.openCreateRoleInline = async () => {
  try {
    const role = await api.post(`/servers/${State.currentServer.id}/roles`, {
      name: 'Nouveau rôle', color: '#99aab5',
    });
    if (!window._cachedRoles) window._cachedRoles = [];
    window._cachedRoles.push(role);
    loadRolesSidebar();
    setTimeout(() => editRolePermissions(role.id), 100);
  } catch (err) { showToast(err.message, 'error'); }
};

// ── Onglet Événements ─────────────────────────────────────
window.handleEventToggle = (key, enabled) => {
  window._guildSettingsState[`event_${key}_enabled`] = enabled;
  const label = document.getElementById(`evlabel-${key}`);
  const chWrap = document.getElementById(`evch-${key}`);
  if (label) label.style.color = enabled ? 'var(--text-primary)' : 'var(--text-muted)';
  if (chWrap) { chWrap.style.opacity = enabled ? '1' : '0.4'; chWrap.style.pointerEvents = enabled ? 'auto' : 'none'; }
};

window.handleEventChannelChange = (key, channelId) => {
  window._guildSettingsState[`event_${key}_channel`] = channelId || null;
};

window.saveEventSettings = async () => {
  const payload = {};
  EVENT_TYPES_CONFIG.forEach(evt => {
    const ek = `event_${evt.key}_enabled`;
    const ck = `event_${evt.key}_channel`;
    if (window._guildSettingsState[ek] !== undefined) payload[ek] = window._guildSettingsState[ek];
    if (window._guildSettingsState[ck] !== undefined) payload[ck] = window._guildSettingsState[ck];
  });
  try {
    await api.patch(`/servers/${State.currentServer.id}/settings`, payload);
    showToast('Événements sauvegardés ✓', 'success');
  } catch (err) { showToast(err.message, 'error'); }
};

// ── Onglet Membres ────────────────────────────────────────
window.renderSettingsMembers = () => {
  const el = document.getElementById('settings-members-list');
  if (!el || !State.currentServer?.members) return;
  const isOwner = State.currentServer.owner_id === State.user?.id;
  const isAdmin = ['owner','admin'].includes(State.currentServer.members.find(m=>m.user?.id===State.user?.id)?.role);

  el.innerHTML = State.currentServer.members.map(m => {
    const user   = m.user || {};
    const isMe   = user.id === State.user?.id;
    const canAct = isAdmin && !isMe && !['owner'].includes(m.role);
    return `
      <div style="display:flex;align-items:center;gap:10px;padding:8px;border-radius:var(--radius-sm);transition:background 100ms"
        onmouseover="this.style.background='var(--bg-hover)'" onmouseout="this.style.background=''">
        <div class="avatar-wrapper sm">
          ${renderAvatar(user, 'avatar-md')}
          <div class="status-dot ${user.status||'offline'}"></div>
        </div>
        <div style="flex:1;min-width:0">
          <div style="font-size:13px;font-weight:500">${escapeHtml(user.username||'?')}</div>
          <div style="font-size:11px;color:var(--text-muted)">${m.role}</div>
        </div>
        ${isOwner && !isMe ? `
        <select onchange="changeGuildMemberRole('${user.id}',this.value)"
          style="background:var(--bg-input);border:1px solid var(--border);border-radius:var(--radius-sm);padding:3px 6px;font-size:12px;color:var(--text-primary);cursor:pointer">
          ${['admin','moderator','member'].map(r=>`<option value="${r}" ${m.role===r?'selected':''}>${r}</option>`).join('')}
        </select>` : `<span class="role-badge role-${m.role}">${m.role}</span>`}
        ${canAct ? `
        <button class="btn btn-sm btn-ghost" style="color:var(--red);padding:3px 6px;font-size:12px"
          onclick="openKickModal('${user.id}','${escapeHtml(user.username||'')}','${m.role}')">Expulser</button>` : ''}
      </div>`;
  }).join('');
};

window.changeGuildMemberRole = async (userId, role) => {
  try {
    await api.patch(`/servers/${State.currentServer.id}/members/${userId}/role`, { role });
    const m = State.currentServer.members?.find(m => m.user?.id === userId);
    if (m) m.role = role;
    showToast('Rôle mis à jour', 'success');
  } catch (err) { showToast(err.message, 'error'); }
};

// Alias pour compatibilité avec l'ancien code
window.saveGuildSettings = saveEventSettings;
