// ── Timestamps relatifs ───────────────────────────────────
window.formatRelativeTime = (date) => {
  const d = new Date(date);
  const now = new Date();
  const diff = now - d;
  const sec  = Math.floor(diff / 1000);
  const min  = Math.floor(sec / 60);
  const hr   = Math.floor(min / 60);
  const day  = Math.floor(hr / 24);

  if (sec < 10)  return "à l'instant";
  if (sec < 60)  return `il y a ${sec}s`;
  if (min < 60)  return `il y a ${min}min`;
  if (hr < 24)   return `il y a ${hr}h`;
  if (day === 1) return 'hier';
  if (day < 7)   return `il y a ${day}j`;
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
};

// Mettre à jour les timestamps toutes les 60s
setInterval(() => {
  document.querySelectorAll('[data-timestamp]').forEach(el => {
    el.textContent = formatRelativeTime(el.dataset.timestamp);
  });
}, 60_000);

// ── Lightbox image ────────────────────────────────────────
window.openLightbox = (src, alt = '') => {
  const existing = document.getElementById('lightbox');
  if (existing) existing.remove();

  const lb = document.createElement('div');
  lb.id = 'lightbox';
  lb.style.cssText = `
    position:fixed;inset:0;background:rgba(0,0,0,0.9);
    display:flex;align-items:center;justify-content:center;
    z-index:1000;cursor:zoom-out;animation:fadeIn 150ms ease`;
  lb.innerHTML = `
    <div style="position:relative;max-width:90vw;max-height:90vh">
      <img src="${escapeHtml(src)}" alt="${escapeHtml(alt)}"
        style="max-width:90vw;max-height:90vh;object-fit:contain;border-radius:var(--radius);box-shadow:0 0 40px rgba(0,0,0,0.8)"
        onclick="event.stopPropagation()" />
      <a href="${escapeHtml(src)}" download target="_blank"
        style="position:absolute;top:-36px;right:0;color:#fff;font-size:13px;text-decoration:none;
               background:rgba(255,255,255,0.1);padding:4px 10px;border-radius:4px"
        onclick="event.stopPropagation()">⬇ Télécharger</a>
    </div>`;
  lb.addEventListener('click', () => lb.remove());
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') lb.remove(); }, { once: true });
  document.body.appendChild(lb);
};

// Rendre les images dans les messages cliquables pour la lightbox
document.addEventListener('click', e => {
  const img = e.target.closest('.msg-image, .msg-body img');
  if (img) { e.preventDefault(); openLightbox(img.src, img.alt); }
});

// ── System events dans le chat ────────────────────────────
window.renderSystemEvent = (event) => {
  return `
    <div class="system-event" data-event-id="${event.id}"
      style="text-align:center;padding:4px 16px;margin:4px 0">
      <span style="font-size:12px;color:var(--text-muted);background:var(--bg-elevated);
                   padding:2px 10px;border-radius:var(--radius-full)">
        ${event.message}
      </span>
    </div>`;
};

// ── Historique des éditions ───────────────────────────────
window.showEditHistory = async (msgId) => {
  const channelId = State.currentChannel?.id;
  const guildId   = State.currentServer?.id;
  if (!channelId || !guildId) return;

  try {
    const history = await api.get(`/messages/${guildId}/${channelId}/${msgId}/history`);

    let modal = document.getElementById('modal-edit-history-overlay');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'modal-edit-history-overlay';
      modal.className = 'modal-overlay';
      modal.innerHTML = `
        <div class="modal" style="max-width:480px">
          <div class="modal-header"><h3>📝 Historique des modifications</h3></div>
          <div id="edit-history-list" style="max-height:360px;overflow-y:auto;display:flex;flex-direction:column;gap:8px"></div>
          <div class="modal-footer">
            <button class="btn btn-secondary" onclick="document.getElementById('modal-edit-history-overlay').classList.add('hidden')">Fermer</button>
          </div>
        </div>`;
      document.body.appendChild(modal);
      modal.addEventListener('click', e => { if (e.target === modal) modal.classList.add('hidden'); });
    }

    const list = document.getElementById('edit-history-list');
    if (!history.length) {
      list.innerHTML = '<p style="color:var(--text-muted);font-size:13px;padding:8px;text-align:center">Aucun historique disponible</p>';
    } else {
      list.innerHTML = history.map((h, i) => `
        <div style="background:var(--bg-elevated);border-radius:var(--radius);padding:10px 12px;border-left:3px solid ${i === 0 ? 'var(--accent)' : 'var(--border-strong)'}">
          <div style="font-size:11px;color:var(--text-muted);margin-bottom:4px">
            ${i === 0 ? '<span style="color:var(--accent)">Version actuelle</span>' : formatRelativeTime(h.edited_at)}
          </div>
          <div style="font-size:14px;color:var(--text-secondary)">${escapeHtml(h.content)}</div>
        </div>`).join('');
    }
    modal.classList.remove('hidden');
  } catch (err) { showToast(err.message, 'error'); }
};

// ── Export channel ────────────────────────────────────────
window.exportChannel = async (format = 'json') => {
  if (!State.currentServer || !State.currentChannel) return;
  try {
    const url = `/api/servers/${State.currentServer.id}/channels/${State.currentChannel.id}/export?format=${format}`;
    const res = await fetch(url, { headers: { 'Authorization': `Bearer ${State.token}` } });
    if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
    const blob = await res.blob();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${State.currentChannel.name}-export.${format}`;
    a.click();
    URL.revokeObjectURL(a.href);
    showToast('Export téléchargé', 'success');
  } catch (err) { showToast(err.message, 'error'); }
};
