
window.renderDMContent = (text) => {
  let html = (typeof renderContentAdvanced === 'function') ? renderContentAdvanced(text) : renderContent(text);
  html = html.replace(/\|\|(.+?)\|\|/g, '<span class="spoiler" onclick="this.classList.toggle(\'revealed\')" title="Cliquer pour reveler" style="background:var(--bg-input);color:transparent;border-radius:3px;cursor:pointer;padding:0 2px">$1</span>');
  return html;
};

// ── Ouvrir une conversation DM ───────────────────────────
window.openDM = async (userId, username) => {
  if (!userId || userId === State.user?.id) return;

  State.currentDM = { id: userId, username };
  State.currentChannel = null;
  State.currentServer = null;

  // Désélectionner les serveurs
  document.querySelectorAll('.server-pill[data-server-id]').forEach(el => el.classList.remove('active'));
  document.getElementById('home-btn').classList.add('active');

  // Afficher la vue DM
  document.getElementById('sidebar-channels').style.display = 'none';
  document.getElementById('welcome-screen').style.display = 'none';

  const chatView = document.getElementById('chat-view');
  chatView.style.display = 'flex';

  document.getElementById('header-channel-icon').textContent = '@';
  document.getElementById('header-channel-name').textContent = username;
  document.getElementById('message-input').placeholder = `Message @${username}`;

  // Charger l'historique DM
  await loadDMMessages(userId);

  // Fermer sidebar members sur mobile
  if (window.innerWidth <= 768) {
    document.getElementById('sidebar-members').classList.remove('open');
    document.getElementById('sidebar-members').classList.add('collapsed');
  }
};

window.loadDMMessages = async (userId, before = null) => {
  const list = document.getElementById('messages-list');
  if (!before) {
    list.innerHTML = `<div class="channel-welcome">
      <div class="ch-icon-big">@</div>
      <h3>${escapeHtml(State.currentDM?.username || '')}</h3>
      <p>Début de ta conversation avec <strong>${escapeHtml(State.currentDM?.username || '')}</strong></p>
    </div>`;
    State.messages = [];
  }

  try {
    const url = `/dm/${userId}${before ? `?before=${encodeURIComponent(before)}` : ''}`;
    const msgs = await api.get(url);

    if (!before) {
      State.messages = msgs;
      renderAllDMMessages(msgs, list);
      scrollToBottom(true);
    } else {
      const container = document.getElementById('messages-container');
      const prevHeight = container.scrollHeight;
      State.messages = [...msgs, ...State.messages];
      renderAllDMMessages(State.messages, list);
      container.scrollTop += container.scrollHeight - prevHeight;
    }

    if (msgs.length === 50) {
      const btn = document.createElement('div');
      btn.className = 'load-more-btn';
      btn.textContent = '↑ Charger les messages précédents';
      btn.onclick = () => { btn.remove(); loadDMMessages(userId, State.messages[0]?.created_at); };
      const welcome = list.querySelector('.channel-welcome');
      welcome ? welcome.after(btn) : list.prepend(btn);
    }

    updateDMUnreadBadge(userId, 0);
  } catch (err) { showToast(err.message, 'error'); }
};

window.renderAllDMMessages = (msgs, list) => {
  const welcome = list.querySelector('.channel-welcome');
  list.innerHTML = '';
  if (welcome) list.appendChild(welcome);

  let lastDate = null, lastAuthorId = null, lastTime = null;
  msgs.forEach(msg => {
    const d = new Date(msg.created_at);
    const dateStr = formatDate(d);
    const compact = lastAuthorId === (msg.sender?.id || msg.sender_id) &&
                    lastDate === dateStr && (d - new Date(lastTime)) < 300000;
    if (dateStr !== lastDate) {
      list.insertAdjacentHTML('beforeend', `<div class="day-separator">${dateStr}</div>`);
      lastDate = dateStr;
    }
    list.insertAdjacentHTML('beforeend', renderDMMessage(msg, compact));
    lastAuthorId = msg.sender?.id || msg.sender_id;
    lastTime = msg.created_at;
  });
};

window.renderDMMessage = (msg, compact = false) => {
  const author = msg.sender || {};
  const msgId = msg.id;
  const isOwn = (author.id || msg.sender_id) === State.user?.id;

  const avatarCol = compact
    ? `<div style="width:40px;display:flex;justify-content:center;padding-top:2px">
        <span style="font-size:10px;color:var(--text-muted);opacity:0" class="msg-timestamp-inline">${formatTime(msg.created_at)}</span>
       </div>`
    : `<div class="msg-avatar-col">${renderAvatar(author, 'avatar-md')}</div>`;

  const headerHtml = compact ? '' : `
    <div class="msg-header">
      <span class="msg-author">${escapeHtml(author.username || 'Inconnu')}</span>
      <span class="msg-timestamp">${formatTime(msg.created_at)}</span>
    </div>`;

  const actionsHtml = `
    <div class="msg-actions">
      ${isOwn ? `<button class="msg-action-btn" title="Modifier" onclick="startDMEdit('${msgId}')">✏️</button>` : ''}
      ${isOwn ? `<button class="msg-action-btn danger" title="Supprimer" onclick="deleteDMMessage('${msgId}')">🗑️</button>` : ''}
    </div>`;

  return `
    <div class="msg-group ${compact?'compact':''}" data-msg-id="${msgId}">
      ${avatarCol}
      <div class="msg-content-col">
        ${headerHtml}
        <div class="msg-body${msg.edited?' edited':''}">${renderDMContent(msg.content)}</div>
      </div>
      ${actionsHtml}
    </div>`;
};

window.appendDM = (msg) => {
  const list = document.getElementById('messages-list');
  const last = State.messages[State.messages.length-1];
  const d = new Date(msg.created_at);
  const dateStr = formatDate(d);
  if (!last || formatDate(new Date(last.created_at)) !== dateStr) {
    list.insertAdjacentHTML('beforeend', `<div class="day-separator">${dateStr}</div>`);
  }
  const compact = last &&
    (last.sender?.id||last.sender_id) === (msg.sender?.id||msg.sender_id) &&
    (d - new Date(last.created_at)) < 300000;
  list.insertAdjacentHTML('beforeend', renderDMMessage(msg, compact));
  State.messages.push(msg);
};

window.startDMEdit = (msgId) => {
  const el = document.querySelector(`[data-msg-id="${msgId}"]`);
  if (!el) return;
  const msg = State.messages.find(m => m.id === msgId);
  if (!msg) return;
  const bodyEl = el.querySelector('.msg-body');
  const editEl = document.createElement('div');
  editEl.innerHTML = `<textarea class="edit-input" rows="2">${escapeHtml(msg.content)}</textarea><div class="edit-hint">Entrée pour sauver · Échap pour annuler</div>`;
  bodyEl.replaceWith(editEl);
  const ta = editEl.querySelector('textarea');
  ta.focus(); ta.selectionStart = ta.value.length;
  ta.addEventListener('keydown', e => {
    if (e.key === 'Escape') editEl.replaceWith(bodyEl);
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      const newContent = ta.value.trim();
      if (!newContent) return;
      window.socketClient?.emit('dm:edit', { messageId: msgId, content: newContent });
      editEl.replaceWith(bodyEl);
      bodyEl.innerHTML = renderContent(newContent);
      bodyEl.classList.add('edited');
    }
  });
};

window.deleteDMMessage = (msgId) => {
  if (!confirm('Supprimer ce message ?')) return;
  window.socketClient?.emit('dm:delete', { messageId: msgId });
};

// Unread badge sur le bouton DM ou liste
const dmUnread = {};
window.updateDMUnreadBadge = (userId, count) => {
  if (count !== undefined) dmUnread[userId] = count;
  else dmUnread[userId] = (dmUnread[userId] || 0) + 1;

  const total = Object.values(dmUnread).reduce((a,b) => a+b, 0);
  let badge = document.getElementById('dm-unread-badge');
  if (total > 0) {
    if (!badge) {
      badge = document.createElement('div');
      badge.id = 'dm-unread-badge';
      badge.style.cssText = 'position:absolute;top:-2px;right:-2px;background:var(--red);color:#fff;border-radius:50%;width:16px;height:16px;font-size:10px;font-weight:700;display:flex;align-items:center;justify-content:center;pointer-events:none';
      const homeBtn = document.getElementById('home-btn');
      homeBtn.style.position = 'relative';
      homeBtn.appendChild(badge);
    }
    badge.textContent = total > 99 ? '99+' : total;
  } else {
    badge?.remove();
  }
};

// Clic sur le bouton home : afficher les DM récents
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('home-btn').addEventListener('click', async () => {
    if (window.innerWidth <= 768) {
      document.getElementById('sidebar-channels').classList.toggle('open');
      return;
    }
    try {
      const convs = await api.get('/dm/conversations');
      if (!convs.length) { showToast('Aucune conversation pour l\'instant', 'info'); return; }
      showDMList(convs);
    } catch (_) {}
  });
});

window.showDMList = (convs) => {
  // Afficher dans la sidebar channels
  const sidebar = document.getElementById('sidebar-channels');
  sidebar.style.display = 'flex';
  document.getElementById('current-server-name').textContent = 'Messages privés';

  const list = document.getElementById('channels-list');
  list.innerHTML = convs.map(conv => `
    <div class="channel-item" onclick="openDM('${conv.user.id}','${escapeHtml(conv.user.username)}')">
      <div class="avatar-wrapper sm" style="flex-shrink:0">
        ${renderAvatar(conv.user, 'avatar-sm')}
        <div class="status-dot ${conv.user.status||'offline'}"></div>
      </div>
      <span class="channel-name">${escapeHtml(conv.user.username)}</span>
      ${conv.unread ? `<span style="background:var(--red);color:#fff;border-radius:50%;width:18px;height:18px;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;flex-shrink:0">${conv.unread}</span>` : ''}
    </div>`).join('');
};

// ── Typing indicator DM ───────────────────────────────────
let _dmTypingTimeout = null;

document.addEventListener('DOMContentLoaded', () => {
  const dmInput = document.getElementById('dm-input');
  if (!dmInput) return;
  dmInput.addEventListener('input', () => {
    if (!State.currentDM) return;
    window.socketClient?.emit('dm:typing', { receiverId: State.currentDM.id, typing: true });
    clearTimeout(_dmTypingTimeout);
    _dmTypingTimeout = setTimeout(() => {
      window.socketClient?.emit('dm:typing', { receiverId: State.currentDM.id, typing: false });
    }, 3000);
  });
});

window.updateDMTypingIndicator = (senderId, username, typing) => {
  if (senderId !== State.currentDM?.id) return;
  const el = document.getElementById('dm-typing');
  if (!el) return;
  if (typing) {
    el.innerHTML = '<span class="typing-dots"><span></span><span></span><span></span></span> ' + escapeHtml(username) + ' est en train d\'ecrire…';
  } else {
    el.textContent = '';
  }
};
