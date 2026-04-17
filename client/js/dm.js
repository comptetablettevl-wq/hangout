// ── Ouvrir une conversation DM ────────────────────────────
window.openDM = async (userId, username, userObj = null) => {
  if (!userId || userId === State.user?.id) return;
  State.currentDM      = { id: userId, username };
  State.currentChannel = null;
  State.currentServer  = null;

  document.querySelectorAll('.server-pill[data-server-id]').forEach(el => el.classList.remove('active'));
  document.getElementById('home-btn').classList.add('active');
  document.getElementById('sidebar-channels').style.display = 'none';
  document.getElementById('welcome-screen').style.display   = 'none';
  document.getElementById('chat-view').style.display        = 'none';
  document.getElementById('dm-view').style.display          = 'flex';

  const user = userObj || { id: userId, username, status: 'offline' };
  document.getElementById('dm-header').innerHTML = `
    <div class="avatar-wrapper sm" style="flex-shrink:0">
      ${renderAvatar(user, 'avatar-md')}
      <div class="status-dot ${user.status || 'offline'}"></div>
    </div>
    <div style="flex:1;min-width:0">
      <div style="font-weight:600;font-size:15px">${escapeHtml(username)}</div>
      <div style="font-size:12px;color:var(--text-muted)">
        ${{ online:'En ligne', idle:'Absent', dnd:'Ne pas déranger', offline:'Hors ligne' }[user.status||'offline']}
      </div>
    </div>
    <button class="header-btn" onclick="showProfilePopup(event,'${userId}','${escapeHtml(username)}')" data-tooltip="Voir le profil">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>
    </button>`;

  await loadDMMessages(userId);
  updateDMUnreadBadge(userId, 0);
  refreshDMListItem(userId);
};

window.loadDMMessages = async (userId, before = null) => {
  const list = document.getElementById('dm-messages-list');
  if (!before) {
    list.innerHTML = `
      <div class="channel-welcome" style="padding:24px 16px">
        <div class="ch-icon-big">💬</div>
        <h3>${escapeHtml(State.currentDM?.username || '')}</h3>
        <p>Début de ta conversation avec <strong>${escapeHtml(State.currentDM?.username || '')}</strong></p>
      </div>`;
    State.messages = [];
  }
  try {
    const url  = `/dm/${userId}${before ? '?before=' + encodeURIComponent(before) : ''}`;
    const msgs = await api.get(url);
    if (!before) {
      State.messages = msgs;
      renderAllDMMessages(msgs, list);
      const c = document.getElementById('dm-messages-container');
      if (c) c.scrollTop = c.scrollHeight;
    } else {
      const c         = document.getElementById('dm-messages-container');
      const prevH     = c?.scrollHeight || 0;
      State.messages  = [...msgs, ...State.messages];
      renderAllDMMessages(State.messages, list);
      if (c) c.scrollTop += (c.scrollHeight - prevH);
    }
    if (msgs.length === 50) {
      const btn = document.createElement('div');
      btn.className = 'load-more-btn';
      btn.textContent = 'Charger plus';
      btn.onclick = () => { btn.remove(); loadDMMessages(userId, State.messages[0]?.created_at); };
      list.querySelector('.channel-welcome')?.after(btn) || list.prepend(btn);
    }
    updateDMUnreadBadge(userId, 0);
  } catch (err) { showToast(err.message, 'error'); }
};

window.renderAllDMMessages = (msgs, list) => {
  const welcome  = list.querySelector('.channel-welcome');
  const loadMore = list.querySelector('.load-more-btn');
  list.innerHTML  = '';
  if (welcome)  list.appendChild(welcome);
  if (loadMore) list.appendChild(loadMore);
  let lastDate = null, lastAuthorId = null, lastTime = null;
  msgs.forEach(msg => {
    const d       = new Date(msg.created_at);
    const dateStr = formatDate(d);
    const compact = lastAuthorId === (msg.sender?.id || msg.sender_id) && lastDate === dateStr && (d - new Date(lastTime)) < 300000;
    if (dateStr !== lastDate) { list.insertAdjacentHTML('beforeend', `<div class="day-separator">${dateStr}</div>`); lastDate = dateStr; }
    list.insertAdjacentHTML('beforeend', renderDMMessage(msg, compact));
    lastAuthorId = msg.sender?.id || msg.sender_id;
    lastTime     = msg.created_at;
  });
};

window.renderDMMessage = (msg, compact = false) => {
  const author = msg.sender || {};
  const isOwn  = (author.id || msg.sender_id) === State.user?.id;
  const tsIso  = msg.created_at;
  const avatarCol = compact
    ? `<div style="width:40px;display:flex;justify-content:center;flex-shrink:0"><span class="msg-timestamp-inline">${formatTime(tsIso)}</span></div>`
    : `<div class="msg-avatar-col" style="cursor:pointer" onclick="showProfilePopup(event,'${author.id||msg.sender_id}','${escapeHtml(author.username||'')}')">${renderAvatar(author,'avatar-md')}</div>`;
  const headerHtml = compact ? '' : `
    <div class="msg-header">
      <span class="msg-author">${escapeHtml(author.username || '?')}</span>
      <span class="msg-timestamp" data-timestamp="${tsIso}" title="${formatTime(tsIso)}">${typeof formatRelativeTime==='function'?formatRelativeTime(tsIso):formatTime(tsIso)}</span>
    </div>`;
  return `
    <div class="msg-group ${compact?'compact':''}" data-msg-id="${msg.id}">
      ${avatarCol}
      <div class="msg-content-col">
        ${headerHtml}
        <div class="msg-body${msg.edited?' edited':''}" data-msg-body="${msg.id}">${renderDMContent(msg.content)}</div>
      </div>
      <div class="msg-actions">
        ${isOwn?`<button class="msg-action-btn" onclick="startDMEdit('${msg.id}')">✏️</button>`:''}
        ${isOwn?`<button class="msg-action-btn danger" onclick="deleteDMMessage('${msg.id}')">🗑️</button>`:''}
      </div>
    </div>`;
};

window.renderDMContent = (text) => {
  if (typeof renderContentAdvanced === 'function') {
    let html = renderContentAdvanced(text);
    html = html.replace(/\|\|(.+?)\|\|/g,'<span class="spoiler" onclick="this.classList.toggle(\'revealed\')" style="background:var(--bg-input);color:transparent;border-radius:3px;cursor:pointer;padding:0 2px">$1</span>');
    return html;
  }
  return typeof renderContent==='function' ? renderContent(text) : text;
};

window.appendDM = (msg) => {
  const list = document.getElementById('dm-messages-list');
  const last = State.messages[State.messages.length-1];
  const d    = new Date(msg.created_at);
  if (!last || formatDate(new Date(last.created_at)) !== formatDate(d))
    list.insertAdjacentHTML('beforeend', `<div class="day-separator">${formatDate(d)}</div>`);
  const compact = last && (last.sender?.id||last.sender_id)===(msg.sender?.id||msg.sender_id) && (d-new Date(last.created_at))<300000;
  list.insertAdjacentHTML('beforeend', renderDMMessage(msg, compact));
  State.messages.push(msg);
  const c = document.getElementById('dm-messages-container');
  if (c) { const atBottom = c.scrollHeight-c.scrollTop-c.clientHeight < 120; if (atBottom) c.scrollTop = c.scrollHeight; }
};

window.startDMEdit = (msgId) => {
  const el  = document.querySelector(`[data-msg-id="${msgId}"]`);
  const msg = State.messages.find(m => m.id === msgId);
  if (!el || !msg) return;
  const bodyEl = el.querySelector('.msg-body');
  const editEl = document.createElement('div');
  editEl.innerHTML = `<textarea class="edit-input" rows="2">${escapeHtml(msg.content)}</textarea><div class="edit-hint">Entrée · Échap pour annuler</div>`;
  bodyEl.replaceWith(editEl);
  const ta = editEl.querySelector('textarea');
  ta.focus(); ta.selectionStart = ta.value.length;
  ta.addEventListener('keydown', e => {
    if (e.key === 'Escape') editEl.replaceWith(bodyEl);
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      const c = ta.value.trim();
      if (!c) return;
      window.socketClient?.emit('dm:edit', { messageId: msgId, content: c });
      editEl.replaceWith(bodyEl);
      bodyEl.innerHTML = renderDMContent(c);
      bodyEl.classList.add('edited');
    }
  });
};

window.deleteDMMessage = (msgId) => {
  if (!confirm('Supprimer ?')) return;
  window.socketClient?.emit('dm:delete', { messageId: msgId });
};

// ── Envoi ─────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  const dmInput   = document.getElementById('dm-input');
  const dmSendBtn = document.getElementById('dm-send-btn');
  if (!dmInput || !dmSendBtn) return;
  const sendDM = () => {
    const c = dmInput.value.trim();
    if (!c || !State.currentDM || !window.socketClient) return;
    window.socketClient.emit('dm:send', { receiverId: State.currentDM.id, content: c });
    dmInput.value = '';
    dmInput.style.height = 'auto';
    window.socketClient.emit('dm:typing', { receiverId: State.currentDM.id, typing: false });
  };
  dmSendBtn.addEventListener('click', sendDM);
  dmInput.addEventListener('keydown', e => { if (e.key==='Enter'&&!e.shiftKey) { e.preventDefault(); sendDM(); } });
  dmInput.addEventListener('input', () => { dmInput.style.height='auto'; dmInput.style.height=Math.min(dmInput.scrollHeight,120)+'px'; });
  let _t = null;
  dmInput.addEventListener('input', () => {
    if (!State.currentDM) return;
    window.socketClient?.emit('dm:typing',{receiverId:State.currentDM.id,typing:true});
    clearTimeout(_t);
    _t = setTimeout(()=>window.socketClient?.emit('dm:typing',{receiverId:State.currentDM.id,typing:false}),3000);
  });
});

// ── Typing indicator ──────────────────────────────────────
window.updateDMTypingIndicator = (senderId, username, typing) => {
  if (senderId !== State.currentDM?.id) return;
  const el = document.getElementById('dm-typing');
  if (!el) return;
  el.innerHTML = typing ? `<span class="typing-dots"><span></span><span></span><span></span></span> <strong>${escapeHtml(username)}</strong> est en train d'écrire…` : '';
};

// ── Badges non lus ────────────────────────────────────────
const dmUnread = {};
window.updateDMUnreadBadge = (userId, count) => {
  if (count !== undefined) dmUnread[userId] = count;
  else dmUnread[userId] = (dmUnread[userId] || 0) + 1;
  const total = Object.values(dmUnread).reduce((a,b)=>a+b,0);
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
  } else { badge?.remove(); }
};

window.refreshDMListItem = (userId) => {
  document.querySelector(`[data-dm-user="${userId}"] .dm-unread-badge`)?.remove();
};

// ── Liste DM ──────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('home-btn').addEventListener('click', async () => {
    if (window.innerWidth <= 768) { document.getElementById('sidebar-channels').classList.toggle('open'); return; }
    try { const convs = await api.get('/dm/conversations'); showDMList(convs); } catch (_) {}
  });
});

window.showDMList = (convs) => {
  const sidebar = document.getElementById('sidebar-channels');
  sidebar.style.display = 'flex';
  document.getElementById('current-server-name').textContent = 'Messages privés';
  document.querySelectorAll('.server-pill[data-server-id]').forEach(el => el.classList.remove('active'));
  document.getElementById('home-btn').classList.add('active');
  const list = document.getElementById('channels-list');
  if (!convs.length) {
    list.innerHTML = `<div style="padding:24px 16px;text-align:center"><div style="font-size:32px;margin-bottom:8px">💬</div><div style="font-size:14px;color:var(--text-secondary);font-weight:500;margin-bottom:4px">Aucune conversation</div><div style="font-size:13px;color:var(--text-muted)">Utilise la section Amis pour envoyer un MP</div></div>`;
    return;
  }
  list.innerHTML = `
    <div class="channel-category" style="margin-top:8px">MESSAGES PRIVÉS</div>
    ${convs.map(conv => {
      const last    = conv.lastMessage;
      const isMe    = last?.sender_id === State.user?.id;
      const preview = last ? `${isMe?'Toi : ':(conv.user.username+' : ')}${(last.content||'').replace(/https?:\/\/\S+/g,'📎').slice(0,40)}${(last.content||'').length>40?'…':''}` : 'Aucun message';
      const userJson = JSON.stringify(conv.user).replace(/"/g,'&quot;');
      return `
        <div class="channel-item" data-dm-user="${conv.user.id}"
          onclick="openDM('${conv.user.id}','${escapeHtml(conv.user.username)}',${userJson})">
          <div class="avatar-wrapper sm" style="flex-shrink:0">
            ${renderAvatar(conv.user,'avatar-sm')}
            <div class="status-dot ${conv.user.status||'offline'}"></div>
          </div>
          <div style="flex:1;min-width:0">
            <div style="font-size:13px;font-weight:${conv.unread?'600':'400'};color:${conv.unread?'var(--text-primary)':'var(--text-secondary)'};overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(conv.user.username)}</div>
            <div style="font-size:11px;color:var(--text-muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(preview)}</div>
          </div>
          <div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px;flex-shrink:0">
            ${last?`<div style="font-size:10px;color:var(--text-muted)">${typeof formatRelativeTime==='function'?formatRelativeTime(last.created_at):formatTime(last.created_at)}</div>`:''}
            ${conv.unread?`<div class="dm-unread-badge" style="background:var(--red);color:#fff;border-radius:50%;min-width:18px;height:18px;font-size:11px;font-weight:700;display:flex;align-items:center;justify-content:center;padding:0 4px">${conv.unread}</div>`:''}
          </div>
        </div>`; }).join('')}`;
};
