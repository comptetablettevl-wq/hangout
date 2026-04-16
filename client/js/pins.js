// ── Messages épinglés ─────────────────────────────────────
window.openPinsPanel = async () => {
  if (!State.currentChannel || !State.currentServer) return;

  try {
    const pins = await api.get(`/servers/${State.currentServer.id}/channels/${State.currentChannel.id}/pins`);
    showPinsModal(pins);
  } catch (err) { showToast(err.message, 'error'); }
};

window.showPinsModal = (pins) => {
  let modal = document.getElementById('modal-pins');
  if (!modal) {
    modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.id = 'modal-pins-overlay';
    modal.innerHTML = `
      <div class="modal" id="modal-pins" style="max-width:500px">
        <div class="modal-header">
          <h3>📌 Messages épinglés</h3>
          <p id="pins-channel-name"></p>
        </div>
        <div id="pins-list" style="max-height:400px;overflow-y:auto;display:flex;flex-direction:column;gap:8px"></div>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="document.getElementById('modal-pins-overlay').classList.add('hidden')">Fermer</button>
        </div>
      </div>`;
    document.body.appendChild(modal);
    modal.addEventListener('click', e => { if (e.target === modal) modal.classList.add('hidden'); });
  }

  document.getElementById('pins-channel-name').textContent = `#${State.currentChannel?.name}`;
  const list = document.getElementById('pins-list');
  const myMember = State.currentServer?.members?.find(m => m.user?.id === State.user?.id);
  const canUnpin = ['owner','admin','moderator'].includes(myMember?.role);

  if (!pins.length) {
    list.innerHTML = '<p style="color:var(--text-muted);font-size:13px;padding:8px;text-align:center">Aucun message épinglé dans ce channel</p>';
  } else {
    list.innerHTML = pins.map(pin => {
      const msg = pin.message;
      const author = msg?.author || {};
      return `
        <div style="background:var(--bg-elevated);border-radius:var(--radius);padding:12px;border-left:3px solid var(--accent)">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
            ${renderAvatar(author, 'avatar-sm')}
            <span style="font-weight:600;font-size:13px">${escapeHtml(author.username||'?')}</span>
            <span style="font-size:11px;color:var(--text-muted)">${formatTime(msg?.created_at)}</span>
            ${canUnpin ? `<button class="btn btn-ghost btn-sm" style="margin-left:auto;font-size:12px;color:var(--text-muted)"
              onclick="unpinMessage('${pin.message_id}')">Désépingler</button>` : ''}
          </div>
          <div style="font-size:14px;color:var(--text-secondary);cursor:pointer"
            onclick="scrollToMessage('${pin.message_id}');document.getElementById('modal-pins-overlay').classList.add('hidden')"
          >${escapeHtml((msg?.content||'').slice(0,200))}${(msg?.content||'').length>200?'…':''}</div>
          <div style="font-size:11px;color:var(--text-muted);margin-top:4px">Épinglé par ${escapeHtml(pin.pinnedBy?.username||'?')}</div>
        </div>`;
    }).join('');
  }

  document.getElementById('modal-pins-overlay').classList.remove('hidden');
};

window.pinMessage = async (msgId) => {
  if (!State.currentServer || !State.currentChannel) return;
  try {
    await api.post(`/servers/${State.currentServer.id}/channels/${State.currentChannel.id}/pins/${msgId}`);
    showToast('Message épinglé 📌', 'success');
  } catch (err) { showToast(err.message, 'error'); }
};

window.unpinMessage = async (msgId) => {
  if (!State.currentServer || !State.currentChannel) return;
  try {
    await api.delete(`/servers/${State.currentServer.id}/channels/${State.currentChannel.id}/pins/${msgId}`);
    showToast('Message désépinglé', 'success');
    // Refresh la liste
    openPinsPanel();
  } catch (err) { showToast(err.message, 'error'); }
};
