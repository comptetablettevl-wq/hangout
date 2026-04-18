// ── Système de streaks & cosmétiques ─────────────────────
window.StreakState = {
  current:   0,
  longest:   0,
  total:     0,
  unlocked:  [],
  equipped_username: null,
  equipped_avatar:   null,
  cosmetics: [],
};

// Appelé au login — reçoit les données streak depuis la réponse auth
window.initStreakFromLogin = (streakInfo) => {
  if (!streakInfo) return;
  StreakState.current = streakInfo.current_streak || 0;
  StreakState.longest = streakInfo.longest_streak || 0;
  StreakState.total   = streakInfo.total_days     || 0;

  // Afficher les nouveaux cosmétiques débloqués
  if (streakInfo.new_cosmetics?.length) {
    setTimeout(() => {
      streakInfo.new_cosmetics.forEach(c => showCosmeticUnlocked(c));
    }, 2000); // délai pour que l'UI soit chargée
  }
};

// Charger le streak complet depuis l'API
window.loadMyStreak = async () => {
  try {
    const data = await api.get('/streaks/me');
    StreakState.current            = data.current_streak;
    StreakState.longest            = data.longest_streak;
    StreakState.total              = data.total_days;
    StreakState.unlocked           = data.unlocked || [];
    StreakState.equipped_username  = data.equipped_username_cosmetic;
    StreakState.equipped_avatar    = data.equipped_avatar_cosmetic;
    StreakState.cosmetics          = data.cosmetics || [];
    return data;
  } catch (_) { return null; }
};

// ── Rendu du pseudo avec cosmétique ──────────────────────
window.renderUsername = (username, cosmeticId, badges = []) => {
  const badgesHtml = badges.map(b => `<span class="streak-badge" title="${b.name}">${b.emoji}</span>`).join('');

  if (!cosmeticId) return `${badgesHtml}${escapeHtml(username)}`;

  // Appliquer le CSS du cosmétique
  const cosmetic = StreakState.cosmetics.find(c => c.id === cosmeticId)
    || window._cosmeticsCatalog?.[cosmeticId];
  if (!cosmetic?.css) return `${badgesHtml}${escapeHtml(username)}`;

  return `${badgesHtml}<span class="cosmetic-username" style="${cosmetic.css}">${escapeHtml(username)}</span>`;
};

// ── Rendu avatar avec cosmétique ─────────────────────────
window.applyAvatarCosmetic = (avatarEl, cosmeticId) => {
  if (!avatarEl || !cosmeticId) return;
  const cosmetic = StreakState.cosmetics.find(c => c.id === cosmeticId)
    || window._cosmeticsCatalog?.[cosmeticId];
  if (cosmetic?.css) {
    cosmetic.css.split(';').forEach(rule => {
      const [prop, val] = rule.split(':');
      if (prop && val) avatarEl.style[prop.trim().replace(/-([a-z])/g, (_,l) => l.toUpperCase())] = val.trim();
    });
  }
};

// ── Animation de déblocage ────────────────────────────────
window.showCosmeticUnlocked = (cosmetic) => {
  const toast = document.createElement('div');
  toast.className = 'cosmetic-unlock-toast';
  toast.innerHTML = `
    <div class="unlock-glow"></div>
    <div style="font-size:40px;margin-bottom:8px;animation:bounce 0.5s ease">${cosmetic.emoji}</div>
    <div style="font-size:11px;font-weight:700;color:var(--accent);text-transform:uppercase;letter-spacing:.1em;margin-bottom:4px">Nouveau cosmétique débloqué !</div>
    <div style="font-size:18px;font-weight:700;color:var(--text-primary);margin-bottom:4px">${escapeHtml(cosmetic.name)}</div>
    <div style="font-size:12px;color:var(--text-muted)">${escapeHtml(cosmetic.desc)}</div>
    <div style="margin-top:12px">
      <button class="btn btn-primary btn-sm" onclick="openStreaksModal();this.closest('.cosmetic-unlock-toast').remove()">Voir mes récompenses</button>
    </div>`;

  document.body.appendChild(toast);

  // Confettis
  launchConfetti();

  setTimeout(() => toast.style.opacity = '0', 5000);
  setTimeout(() => toast.remove(), 5500);
};

// ── Confettis légers ──────────────────────────────────────
window.launchConfetti = (x, y) => {
  const colors = ['#5865F2','#57F287','#FEE75C','#EB459E','#ED4245','#fff'];
  const container = document.getElementById('confetti-container') || (() => {
    const el = document.createElement('div');
    el.id = 'confetti-container';
    el.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:9999;overflow:hidden';
    document.body.appendChild(el);
    return el;
  })();

  for (let i = 0; i < 60; i++) {
    const piece = document.createElement('div');
    const color = colors[Math.floor(Math.random() * colors.length)];
    const size  = Math.random() * 8 + 6;
    const startX = x ? x + (Math.random() - 0.5) * 100 : Math.random() * 100;

    piece.style.cssText = `
      position:absolute;
      width:${size}px;height:${size * (Math.random() > 0.5 ? 0.4 : 1)}px;
      background:${color};
      left:${startX}%;top:-10px;
      border-radius:${Math.random() > 0.5 ? '50%' : '2px'};
      animation:confetti-fall ${1.5 + Math.random() * 2}s ${Math.random() * 0.5}s ease-in forwards;
      transform:rotate(${Math.random() * 360}deg)`;
    container.appendChild(piece);
    setTimeout(() => piece.remove(), 3500);
  }
};

// ── Modal des récompenses ─────────────────────────────────
window.openStreaksModal = async () => {
  const data = await loadMyStreak();
  if (!data) return;

  let modal = document.getElementById('modal-streaks-overlay');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'modal-streaks-overlay';
    modal.className = 'modal-overlay';
    modal.innerHTML = `
      <div class="modal" style="max-width:580px;padding:0;overflow:hidden">
        <div style="background:linear-gradient(135deg,#1a1a2e,#16213e,#0f3460);padding:24px;position:relative;overflow:hidden">
          <div style="position:absolute;inset:0;background:url('data:image/svg+xml,<svg xmlns=\"http://www.w3.org/2000/svg\"><circle cx=\"20\" cy=\"20\" r=\"1\" fill=\"rgba(255,255,255,0.1)\"/></svg>') repeat"></div>
          <div style="position:relative;text-align:center">
            <div style="font-size:48px" id="streak-modal-flame">🔥</div>
            <div style="font-size:36px;font-weight:900;color:#fff;font-family:'Space Grotesk',sans-serif" id="streak-modal-count">0</div>
            <div style="font-size:14px;color:rgba(255,255,255,0.7);margin-top:4px">jours consécutifs</div>
            <div style="display:flex;justify-content:center;gap:24px;margin-top:16px" id="streak-modal-stats"></div>
          </div>
        </div>
        <div style="padding:20px;max-height:60vh;overflow-y:auto" id="streak-modal-body"></div>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="document.getElementById('modal-streaks-overlay').classList.add('hidden')">Fermer</button>
        </div>
      </div>`;
    document.body.appendChild(modal);
    modal.addEventListener('click', e => { if (e.target === modal) modal.classList.add('hidden'); });
  }

  // Remplir les données
  document.getElementById('streak-modal-count').textContent = data.current_streak;
  document.getElementById('streak-modal-flame').textContent =
    data.current_streak >= 100 ? '🌟' : data.current_streak >= 30 ? '🔥' : data.current_streak >= 7 ? '⚡' : '🔥';

  document.getElementById('streak-modal-stats').innerHTML = `
    <div style="text-align:center">
      <div style="font-size:20px;font-weight:700;color:#fff">${data.longest_streak}</div>
      <div style="font-size:11px;color:rgba(255,255,255,0.6)">Record</div>
    </div>
    <div style="text-align:center">
      <div style="font-size:20px;font-weight:700;color:#fff">${data.total_days}</div>
      <div style="font-size:11px;color:rgba(255,255,255,0.6)">Total jours</div>
    </div>`;

  renderCosmeticsGrid(data);
  modal.classList.remove('hidden');
};

window.renderCosmeticsGrid = (data) => {
  const body    = document.getElementById('streak-modal-body');
  const catalog = data.cosmetics || [];

  // Grouper par type
  const groups = {
    badge:          { label: 'Badges',             items: [] },
    username:       { label: 'Styles de pseudo',    items: [] },
    avatar:         { label: '🖼️ Effets d\'avatar',    items: [] },
    profile_effect: { label: 'Effets de profil',    items: [] },
  };

  catalog.forEach(c => groups[c.type]?.items.push(c));

  body.innerHTML = Object.values(groups).filter(g => g.items.length).map(group => `
    <div style="margin-bottom:20px">
      <div style="font-size:13px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:10px">${group.label}</div>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:8px">
        ${group.items.map(c => {
          const isUnlocked = data.unlocked?.includes(c.id);
          const isEquippedU = data.equipped_username_cosmetic === c.id;
          const isEquippedA = data.equipped_avatar_cosmetic === c.id;
          const isEquipped  = isEquippedU || isEquippedA;
          const progress    = Math.min(100, Math.round((data.current_streak / c.days) * 100));

          return `
            <div style="background:var(--bg-elevated);border-radius:var(--radius);padding:12px;
                        border:1px solid ${isUnlocked ? 'var(--accent)' : 'var(--border)'};
                        opacity:${isUnlocked ? '1' : '0.6'};position:relative;overflow:hidden">
              ${isEquipped ? '<div style="position:absolute;top:6px;right:6px;background:var(--accent);color:#fff;font-size:10px;font-weight:700;padding:1px 6px;border-radius:3px">ÉQUIPÉ</div>' : ''}
              <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">
                <span style="font-size:24px">${c.emoji}</span>
                <div>
                  <div style="font-size:13px;font-weight:600;color:${isUnlocked?'var(--text-primary)':'var(--text-muted)'}">${c.name}</div>
                  <div style="font-size:11px;color:var(--text-muted)">🔥 ${c.days} jours</div>
                </div>
              </div>
              ${c.css && c.type === 'username' ? `<div style="font-size:12px;padding:3px 0"><span style="${c.css}">Aperçu du pseudo</span></div>` : ''}
              ${!isUnlocked ? `
                <div style="margin-top:8px">
                  <div style="height:4px;background:var(--bg-active);border-radius:2px;overflow:hidden">
                    <div style="height:100%;width:${progress}%;background:var(--accent);border-radius:2px;transition:width 1s ease"></div>
                  </div>
                  <div style="font-size:10px;color:var(--text-muted);margin-top:3px">${data.current_streak}/${c.days} jours</div>
                </div>` : ''}
              ${isUnlocked && (c.type === 'username' || c.type === 'avatar') ? `
                <div style="margin-top:8px;display:flex;gap:6px">
                  ${!isEquipped
                    ? `<button class="btn btn-primary btn-sm" onclick="equipCosmetic('${c.id}','${c.type}')">Équiper</button>`
                    : `<button class="btn btn-secondary btn-sm" onclick="unequipCosmetic('${c.type}')">Déséquiper</button>`}
                </div>` : ''}
            </div>`;
        }).join('')}
      </div>
    </div>`).join('');
};

// ── Équiper / déséquiper ──────────────────────────────────
window.equipCosmetic = async (cosmeticId, type) => {
  const slot = type === 'username' ? 'username' : 'avatar';
  try {
    await api.post('/streaks/equip', { cosmetic_id: cosmeticId, slot });
    StreakState[`equipped_${slot}`] = cosmeticId;
    showToast('Cosmétique équipé ✓', 'success');
    const data = await loadMyStreak();
    renderCosmeticsGrid(data);
  } catch (err) { showToast(err.message, 'error'); }
};

window.unequipCosmetic = async (type) => {
  const slot = type === 'username' ? 'username' : 'avatar';
  try {
    await api.post('/streaks/equip', { cosmetic_id: null, slot });
    StreakState[`equipped_${slot}`] = null;
    showToast('Cosmétique retiré', 'success');
    const data = await loadMyStreak();
    renderCosmeticsGrid(data);
  } catch (err) { showToast(err.message, 'error'); }
};

// ── Cache des cosmétiques utilisateurs ───────────────────
// userId -> { equipped_username, equipped_avatar, badges }
window._userCosmeticCache = {};

/**
 * Récupère (et cache) les données cosmétiques d'un user
 */
window.fetchUserCosmetics = async (userId) => {
  if (_userCosmeticCache[userId]) return _userCosmeticCache[userId];
  try {
    const data = await api.get(`/streaks/${userId}`);
    _userCosmeticCache[userId] = {
      equipped_username: data.equipped_username_cosmetic,
      equipped_avatar:   data.equipped_avatar_cosmetic,
      streak:            data.current_streak,
    };
    // Expirer le cache après 5 min
    setTimeout(() => delete _userCosmeticCache[userId], 5 * 60 * 1000);
    return _userCosmeticCache[userId];
  } catch (_) {
    return { equipped_username: null, equipped_avatar: null, streak: 0 };
  }
};

/**
 * Rendu synchrone du pseudo avec cosmétique (depuis le cache)
 * Si pas en cache, affiche le pseudo normal et charge en arrière-plan
 */
window.renderAuthorName = (author) => {
  if (!author?.id) return escapeHtml(author?.username || '?');

  const cached = _userCosmeticCache[author.id];

  if (!cached) {
    // Charger en arrière-plan et mettre à jour les éléments DOM
    fetchUserCosmetics(author.id).then(data => {
      if (data.equipped_username) {
        // Mettre à jour tous les pseudos de cet auteur visibles
        document.querySelectorAll(`[data-author-id="${author.id}"] .msg-author`).forEach(el => {
          el.innerHTML = buildUsernameHtml(author.username, data.equipped_username, data.streak);
        });
      }
    });
    return escapeHtml(author.username || '?');
  }

  return buildUsernameHtml(author.username, cached.equipped_username, cached.streak);
};

window.buildUsernameHtml = (username, cosmeticId, streak) => {
  // Badges selon le streak
  const badges = [];
  if (streak >= 200) badges.push('🌟');
  else if (streak >= 100) badges.push('👑');
  else if (streak >= 14) badges.push('⚡');
  else if (streak >= 3)  badges.push('🔥');

  const badgesHtml = badges.map(b =>
    `<span class="streak-badge" title="${streak} jours de streak">${b}</span>`
  ).join('');

  if (!cosmeticId) return badgesHtml + escapeHtml(username || '?');

  // Chercher le CSS du cosmétique dans le catalogue
  const cosmetic = (StreakState.cosmetics || []).find(c => c.id === cosmeticId)
    || window._cosmeticsCatalog?.[cosmeticId];

  if (!cosmetic?.css) return badgesHtml + escapeHtml(username || '?');

  return `${badgesHtml}<span style="${cosmetic.css}">${escapeHtml(username || '?')}</span>`;
};

// Charger le catalogue cosmétiques au démarrage pour renderAuthorName
document.addEventListener('DOMContentLoaded', async () => {
  try {
    const data = await api.get('/streaks/me').catch(() => null);
    if (data?.cosmetics) {
      StreakState.cosmetics = data.cosmetics;
      // Map rapide par ID
      window._cosmeticsCatalog = Object.fromEntries(data.cosmetics.map(c => [c.id, c]));
      // Pré-remplir le cache pour soi-même
      _userCosmeticCache[State.user?.id] = {
        equipped_username: data.equipped_username_cosmetic,
        equipped_avatar:   data.equipped_avatar_cosmetic,
        streak:            data.current_streak,
      };
    }
  } catch (_) {}
});

// ── Onglet Récompenses dans les settings ──────────────────
window.loadStreakSettings = async () => {
  const el = document.getElementById('streak-settings-content');
  if (!el) return;
  el.innerHTML = '<div style="color:var(--text-muted);padding:20px;text-align:center">Chargement...</div>';

  const data = await loadMyStreak();
  if (!data) {
    el.innerHTML = '<p style="color:var(--text-muted)">Impossible de charger les données</p>';
    return;
  }

  const nextCosmetic = (data.cosmetics || [])
    .filter(c => !data.unlocked?.includes(c.id))
    .sort((a,b) => a.days - b.days)[0];

  const streakIcon = data.current_streak >= 100 ? '★' : data.current_streak >= 30 ? '▲' : '●';

  el.innerHTML = `
    <div style="background:linear-gradient(135deg,#1a1a2e,#16213e);border-radius:var(--radius-lg);padding:16px;margin-bottom:16px;text-align:center">
      <div style="font-size:32px;font-weight:900;color:#fff;font-family:'Space Grotesk',sans-serif;line-height:1">${data.current_streak}</div>
      <div style="font-size:12px;color:rgba(255,255,255,0.6);margin-top:2px">jours consécutifs</div>
      <div style="display:flex;justify-content:center;gap:24px;margin-top:10px">
        <div><div style="font-size:16px;font-weight:700;color:#fff">${data.longest_streak}</div><div style="font-size:10px;color:rgba(255,255,255,0.5)">Record</div></div>
        <div><div style="font-size:16px;font-weight:700;color:#fff">${data.total_days}</div><div style="font-size:10px;color:rgba(255,255,255,0.5)">Total</div></div>
      </div>
    </div>

    ${nextCosmetic ? `
    <div style="background:var(--bg-elevated);border-radius:var(--radius);padding:10px 12px;margin-bottom:16px;border:1px solid var(--border)">
      <div style="font-size:12px;color:var(--text-muted);margin-bottom:4px">Prochain débloquage</div>
      <div style="font-size:13px;font-weight:600;margin-bottom:6px">${escapeHtml(nextCosmetic.name)} — ${nextCosmetic.days} jours</div>
      <div style="height:4px;background:var(--bg-active);border-radius:2px;overflow:hidden">
        <div style="height:100%;width:${Math.round(Math.min(100,(data.current_streak/nextCosmetic.days)*100))}%;background:var(--accent);border-radius:2px"></div>
      </div>
      <div style="font-size:11px;color:var(--text-muted);margin-top:3px">${data.current_streak} / ${nextCosmetic.days}</div>
    </div>` : '<div style="color:var(--green);font-size:13px;margin-bottom:12px">Tous les cosmétiques débloqués ✓</div>'}

    <div id="settings-cosmetics-grid"></div>`;

  // Rendre la grille directement
  const grid = document.getElementById('settings-cosmetics-grid');
  if (!grid) return;

  const catalog = data.cosmetics || [];
  const groups  = { badge: 'Badges', username: 'Styles de pseudo', avatar: 'Effets d'avatar', profile_effect: 'Effets de profil' };

  let html = '';
  for (const [type, label] of Object.entries(groups)) {
    const items = catalog.filter(c => c.type === type);
    if (!items.length) continue;
    html += `<div style="margin-bottom:16px">
      <div style="font-size:11px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:8px">${label}</div>
      <div style="display:flex;flex-direction:column;gap:6px">
        ${items.map(c => {
          const unlocked  = data.unlocked?.includes(c.id);
          const equippedU = data.equipped_username_cosmetic === c.id;
          const equippedA = data.equipped_avatar_cosmetic   === c.id;
          const equipped  = equippedU || equippedA;
          const progress  = Math.round(Math.min(100, (data.current_streak / c.days) * 100));
          return `<div style="display:flex;align-items:center;gap:10px;padding:8px 10px;background:var(--bg-elevated);border-radius:var(--radius-sm);border:1px solid ${unlocked?'var(--border-strong)':'var(--border)'};opacity:${unlocked?1:0.6}">
            <span style="font-size:18px;flex-shrink:0">${c.emoji}</span>
            <div style="flex:1;min-width:0">
              <div style="font-size:13px;font-weight:500">${escapeHtml(c.name)}</div>
              <div style="font-size:11px;color:var(--text-muted)">${c.days} jours${unlocked ? ' — débloqué' : ''}</div>
              ${!unlocked ? `<div style="height:3px;background:var(--bg-active);border-radius:2px;margin-top:4px;overflow:hidden"><div style="height:100%;width:${progress}%;background:var(--accent);border-radius:2px"></div></div>` : ''}
            </div>
            ${equipped ? '<span style="font-size:11px;color:var(--accent);font-weight:600;flex-shrink:0">Équipé</span>' : ''}
            ${unlocked && !equipped && (c.type==='username'||c.type==='avatar') ? `<button class="btn btn-primary btn-sm" style="flex-shrink:0;font-size:11px;padding:3px 8px" onclick="equipCosmetic('${c.id}','${c.type}')">Équiper</button>` : ''}
            ${equipped ? `<button class="btn btn-secondary btn-sm" style="flex-shrink:0;font-size:11px;padding:3px 8px" onclick="unequipCosmetic('${c.type}')">Retirer</button>` : ''}
          </div>`;
        }).join('')}
      </div>
    </div>`;
  }
  grid.innerHTML = html;
};
