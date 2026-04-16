// ── Threads UI ────────────────────────────────────────────
window.ThreadState = { open: null, messages: [] };

window.openThread = async (msgId, msgContent, authorName) => {
  // Fermer si déjà ouvert
  if (ThreadState.open === msgId) { closeThread(); return; }
  ThreadState.open = msgId;
  ThreadState.messages = [];

  // Créer/afficher le panel thread
  let panel = document.getElementById('thread-panel');
  if (!panel) {
    panel = document.createElement('aside');
    panel.id = 'thread-panel';
    panel.style.cssText = `
      width:320px;min-width:320px;background:var(--bg-secondary);
      display:flex;flex-direction:column;border-left:1px solid var(--border);
      animation:slideUp 200ms ease`;
    document.getElementById('main').appendChild(panel);
  }

  panel.innerHTML = `
    <div style="padding:12px 16px;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:10px;flex-shrink:0">
      <span style="font-size:16px">🧵</span>
      <div style="flex:1;min-width:0">
        <div style="font-weight:600;font-size:14px">Thread</div>
        <div style="font-size:12px;color:var(--text-muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(msgContent.slice(0,60))}</div>
      </div>
      <button onclick="closeThread()" style="color:var(--text-muted);font-size:18px;background:none;border:none;cursor:pointer">×</button>
    </div>
    <div id="thread-messages" style="flex:1;overflow-y:auto;padding:12px"></div>
    <div id="thread-typing" style="padding:0 12px;font-size:12px;color:var(--text-muted);min-height:18px"></div>
    <div style="padding:8px 12px;border-top:1px solid var(--border)">
      <div style="background:var(--bg-elevated);border-radius:var(--radius);display:flex;align-items:center;gap:8px;padding:8px 10px">
        <textarea id="thread-input" placeholder="Répondre dans le thread..." rows="1"
          style="flex:1;background:transparent;border:none;resize:none;font-size:14px;color:var(--text-primary);outline:none;max-height:120px;overflow-y:auto;font-family:var(--font)"></textarea>
        <button onclick="sendThreadMessage('${msgId}')" class="send-btn" style="width:28px;height:28px">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
        </button>
      </div>
    </div>`;

  // Auto-resize thread input
  const threadInput = document.getElementById('thread-input');
  threadInput?.addEventListener('input', () => {
    threadInput.style.height = 'auto';
    threadInput.style.height = Math.min(threadInput.scrollHeight, 120) + 'px';
  });
  threadInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendThreadMessage(msgId); }
  });

  // Charger les messages du thread
  await loadThreadMessages(msgId);
};

window.closeThread = () => {
  ThreadState.open = null;
  document.getElementById('thread-panel')?.remove();
};

window.loadThreadMessages = async (msgId) => {
  if (!State.currentServer || !State.currentChannel) return;
  try {
    const thread = await api.get(
      `/servers/${State.currentServer.id}/channels/${State.currentChannel.id}/messages/${msgId}/thread`
    );
    const el = document.getElementById('thread-messages');
    if (!el) return;

    if (!thread || !thread.messages?.length) {
      el.innerHTML = '<p style="text-align:center;color:var(--text-muted);font-size:13px;padding:20px">Aucune réponse — sois le premier !</p>';
      return;
    }

    ThreadState.messages = thread.messages;
    el.innerHTML = thread.messages.map(m => renderThreadMessage(m)).join('');
    el.scrollTop = el.scrollHeight;
  } catch (_) {
    const el = document.getElementById('thread-messages');
    if (el) el.innerHTML = '<p style="text-align:center;color:var(--text-muted);font-size:13px;padding:20px">Démarre la conversation !</p>';
  }
};

window.renderThreadMessage = (msg) => {
  const author = msg.author || {};
  return `
    <div style="display:flex;gap:10px;margin-bottom:10px" data-thread-msg="${msg.id}">
      ${renderAvatar(author, 'avatar-sm')}
      <div style="flex:1;min-width:0">
        <div style="display:flex;align-items:baseline;gap:6px;margin-bottom:2px">
          <span style="font-size:13px;font-weight:600">${escapeHtml(author.username || '?')}</span>
          <span style="font-size:11px;color:var(--text-muted)">${formatRelativeTime(msg.created_at)}</span>
        </div>
        <div style="font-size:14px;color:var(--text-primary);line-height:1.4;word-break:break-word">${renderContentAdvanced(msg.content)}</div>
      </div>
    </div>`;
};

window.sendThreadMessage = async (parentMsgId) => {
  const input = document.getElementById('thread-input');
  const content = input?.value.trim();
  if (!content || !State.currentServer || !State.currentChannel) return;

  try {
    const { thread, message } = await api.post(
      `/servers/${State.currentServer.id}/channels/${State.currentChannel.id}/messages/${parentMsgId}/thread`,
      { content }
    );

    const el = document.getElementById('thread-messages');
    if (el) {
      // Supprimer le placeholder si présent
      const placeholder = el.querySelector('p');
      if (placeholder) placeholder.remove();
      el.insertAdjacentHTML('beforeend', renderThreadMessage(message));
      el.scrollTop = el.scrollHeight;
    }

    input.value = '';
    input.style.height = 'auto';

    // Mettre à jour l'indicateur de thread sur le message parent
    updateThreadIndicator(parentMsgId, (thread.message_count || 0) + 1);
  } catch (err) { showToast(err.message, 'error'); }
};

window.updateThreadIndicator = (msgId, count) => {
  const msgEl = document.querySelector(`[data-msg-id="${msgId}"]`);
  if (!msgEl) return;
  let indicator = msgEl.querySelector('.thread-indicator');
  if (!indicator) {
    indicator = document.createElement('div');
    indicator.className = 'thread-indicator';
    indicator.style.cssText = 'display:flex;align-items:center;gap:4px;margin-top:4px;cursor:pointer;font-size:12px;color:var(--accent);width:fit-content';
    indicator.onclick = () => {
      const body = msgEl.querySelector('.msg-body');
      openThread(msgId, body?.textContent || '', '');
    };
    msgEl.querySelector('.msg-content-col')?.appendChild(indicator);
  }
  indicator.innerHTML = `🧵 <span style="font-weight:500">${count} réponse${count > 1 ? 's' : ''}</span>`;
};
