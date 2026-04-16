// ── Load messages ─────────────────────────────────────────
window.loadMessages = async (guildId, channelId, before = null) => {
  const list = document.getElementById('messages-list');
  if (!before) {
    list.innerHTML = `<div class="channel-welcome">
      <div class="ch-icon-big">#</div>
      <h3>${escapeHtml(State.currentChannel?.name || '')}</h3>
      <p>Bienvenue dans <strong>#${escapeHtml(State.currentChannel?.name || '')}</strong></p>
    </div>`;
    State.messages = [];
  }
  try {
    const url = `/messages/${guildId}/${channelId}${before ? `?before=${before}` : ''}`;
    const msgs = await api.get(url);
    if (!before) {
      State.messages = msgs;
      renderAllMessages(msgs);
      scrollToBottom(true);
    } else {
      const firstEl = list.children[1]; // skip welcome
      State.messages = [...msgs, ...State.messages];
      renderAllMessages(State.messages);
      firstEl?.scrollIntoView({ block: 'start' });
    }
    // Scroll infini : observer sur le 1er message
    setupScrollObserver(guildId, channelId);
    // Marquer comme lu
    markChannelRead(channelId);
  } catch (err) { showToast(err.message, 'error'); }
};

// ── Scroll infini ─────────────────────────────────────────
let _scrollObserver = null;
window.setupScrollObserver = (guildId, channelId) => {
  if (_scrollObserver) _scrollObserver.disconnect();
  const firstMsg = document.querySelector('.msg-group');
  if (!firstMsg || State.messages.length < 50) return;

  _scrollObserver = new IntersectionObserver((entries) => {
    if (entries[0].isIntersecting) {
      _scrollObserver.disconnect();
      loadMessages(guildId, channelId, State.messages[0]?.created_at);
    }
  }, { root: document.getElementById('messages-container'), threshold: 0.1 });

  _scrollObserver.observe(firstMsg);
};

// ── Render ────────────────────────────────────────────────
window.renderAllMessages = (msgs) => {
  const list = document.getElementById('messages-list');
  const welcome = list.querySelector('.channel-welcome');
  let html = '';
  let lastDate = null, lastAuthorId = null, lastTime = null;

  msgs.forEach(msg => {
    const d = new Date(msg.created_at || msg.createdAt);
    const dateStr = formatDate(d);
    const compact = lastAuthorId === msg.author_id &&
                    lastDate === dateStr &&
                    (d - new Date(lastTime)) < 300000;
    if (dateStr !== lastDate) { html += `<div class="day-separator">${dateStr}</div>`; lastDate = dateStr; }
    html += renderMessage(msg, compact);
    lastAuthorId = msg.author_id;
    lastTime = msg.created_at || msg.createdAt;
  });

  list.innerHTML = '';
  if (welcome) list.appendChild(welcome);
  list.insertAdjacentHTML('beforeend', html);
};

window.renderMessage = (msg, compact = false) => {
  const author = msg.author || {};
  const avatarHtml = compact
    ? `<div style="width:40px;display:flex;justify-content:center;align-items:center;flex-shrink:0">
        <span class="msg-timestamp-inline">${formatTime(msg.created_at || msg.createdAt)}</span></div>`
    : `<div class="msg-avatar-col" onclick="showProfilePopup(event,'${msg.author_id}','${escapeHtml(author.username||'')}')" style="cursor:pointer">${renderAvatar(author,'avatar-md')}</div>`;

  const replyHtml = msg.replyMessage ? `
    <div class="msg-reply" onclick="scrollToMessage('${msg.reply_to}')">
      <span class="reply-author">${escapeHtml(msg.replyMessage.author?.username || '?')}</span>
      <span class="reply-content">${escapeHtml((msg.replyMessage.content||'').slice(0,80))}</span>
    </div>` : '';

  const tsIso = msg.created_at || msg.createdAt;
  const headerHtml = compact ? '' : `
    <div class="msg-header">
      <span class="msg-author" onclick="showProfilePopup(event,'${msg.author_id}','${escapeHtml(author.username||'')}')">${escapeHtml(author.username || '?')}</span>
      <span class="msg-timestamp" data-timestamp="${tsIso}" title="${formatTime(tsIso)}">${formatRelativeTime(tsIso)}</span>
    </div>`;

  const reactionsHtml = `<div class="msg-reactions">${renderReactionsInner(msg.id, msg.reactions||[])}</div>`;

  const isOwn = msg.author_id === State.user?.id;
  const myMember = State.currentServer?.members?.find(m => m.user?.id === State.user?.id);
  const canPin = ['owner','admin','moderator'].includes(myMember?.role);
  const actionsHtml = `
    <div class="msg-actions">
      <button class="msg-action-btn" title="Réagir" onclick="toggleEmojiForMsg('${msg.id}')">😊</button>
      <button class="msg-action-btn" title="Répondre" onclick="startReply('${msg.id}','${escapeHtml(author.username||'')}')">↩</button>
      <button class="msg-action-btn" title="Ouvrir un thread" onclick="openThread('${msg.id}','${escapeHtml((msg.content||'').slice(0,60))}','${escapeHtml(author.username||'')}')">🧵</button>
      ${canPin ? `<button class="msg-action-btn" title="Épingler" onclick="pinMessage('${msg.id}')">📌</button>` : ''}
      ${isOwn ? `<button class="msg-action-btn" title="Modifier" onclick="startEdit('${msg.id}')">✏️</button>` : ''}
      ${isOwn && msg.edited ? `<button class="msg-action-btn" title="Historique" onclick="showEditHistory('${msg.id}')" style="font-size:11px;color:var(--text-muted)">hist.</button>` : ''}
      ${isOwn ? `<button class="msg-action-btn danger" title="Supprimer" onclick="deleteMessage('${msg.id}')">🗑️</button>` : ''}
    </div>`;

  // OG preview pour les URLs
  const ogHtml = extractUrls(msg.content).length ? `<div class="og-previews" data-msg="${msg.id}"></div>` : '';


  // Réactions rapides au hover
  const quickReactionsHtml = `
    <div class="msg-quick-reactions">
      ${['👍','❤️','😂','😮','😢','🔥'].map(e =>
        `<button class="quick-react-btn" onclick="sendReaction('${msg.id}','${e}')" title="${e}">${e}</button>`
      ).join('')}
    </div>`;

  return `
    <div class="msg-group ${compact?'compact':''}" data-msg-id="${msg.id}">
      ${avatarHtml}
      <div class="msg-content-col">
        ${replyHtml}${headerHtml}
        <div class="msg-body${msg.edited?' edited':''}" data-msg-body="${msg.id}">${renderContentAdvanced(msg.content)}</div>
        ${ogHtml}
        ${reactionsHtml}
      </div>
      ${quickReactionsHtml}
      ${actionsHtml}
    </div>`;
};

// ── Markdown avancé ───────────────────────────────────────
window.renderContentAdvanced = (content) => {
  let html = escapeHtml(content);
  // Code block ```...```
  html = html.replace(/```([^`]*?)```/gs, (_, code) => `<pre><code>${code.trim()}</code></pre>`);
  // Quote > ...
  html = html.replace(/^&gt; (.+)$/gm, '<blockquote>$1</blockquote>');
  // Bold **
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  // Italic *
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
  // Inline code `...`
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
  // Mentions @username
  html = html.replace(/@(\w{2,32})/g, (match, name) => {
    const isSelf = name === State.user?.username;
    return `<span class="mention${isSelf?' mention-self':''}" onclick="showProfilePopupByName('${name}')">@${name}</span>`;
  });
  // Images inline (URLs d'image)
  html = html.replace(/(https?:\/\/[^\s<]+\.(?:jpg|jpeg|png|gif|webp)(\?[^\s<]*)?)/gi,
    (url) => `<img src="${url}" class="msg-image" onclick="openLightbox('${url}')" style="max-width:400px;max-height:300px;border-radius:var(--radius);margin-top:4px;cursor:zoom-in;display:block" loading="lazy" />`
  );
  // URLs (non-images)
  html = html.replace(/(https?:\/\/[^\s<"]+)/g, (url) => {
    if (/\.(jpg|jpeg|png|gif|webp)(\?|$)/i.test(url)) return url; // déjà converti
    return `<a href="${url}" target="_blank" rel="noopener">${url}</a>`;
  });
  return html;
};

// ── OG preview ────────────────────────────────────────────
const ogCache = new Map();
window.extractUrls = (text) => {
  const matches = text?.match(/https?:\/\/[^\s]+/g) || [];
  return [...new Set(matches)].slice(0, 2);
};

window.loadOGPreviews = async (msgId, content) => {
  const urls = extractUrls(content);
  if (!urls.length) return;
  const container = document.querySelector(`[data-msg-id="${msgId}"] .og-previews`);
  if (!container) return;

  for (const url of urls) {
    try {
      let data = ogCache.get(url);
      if (!data) {
        const res = await api.get(`/og?url=${encodeURIComponent(url)}`);
        data = res;
        ogCache.set(url, data);
      }
      if (!data.title) continue;
      const el = document.createElement('div');
      el.className = 'og-preview';
      el.onclick = () => window.open(url, '_blank');
      el.innerHTML = `
        <div class="og-preview-text">
          <div class="og-preview-title">${escapeHtml(data.title)}</div>
          ${data.description ? `<div class="og-preview-desc">${escapeHtml(data.description)}</div>` : ''}
          <div class="og-preview-url">${new URL(url).hostname}</div>
        </div>
        ${data.image ? `<img class="og-preview-image" src="${data.image}" alt="" loading="lazy" />` : ''}
      `;
      container.appendChild(el);
    } catch (_) {}
  }
};

// ── Append + scroll ───────────────────────────────────────
window.appendMessage = (msg) => {
  const list = document.getElementById('messages-list');
  const last = State.messages[State.messages.length - 1];
  const d = new Date(msg.created_at || msg.createdAt);
  const dateStr = formatDate(d);
  if (!last || formatDate(new Date(last.created_at || last.createdAt)) !== dateStr) {
    list.insertAdjacentHTML('beforeend', `<div class="day-separator">${dateStr}</div>`);
  }
  const compact = last &&
    last.author_id === msg.author_id &&
    (d - new Date(last.created_at || last.createdAt)) < 300000;
  list.insertAdjacentHTML('beforeend', renderMessage(msg, compact));
  State.messages.push(msg);
  // OG async
  setTimeout(() => loadOGPreviews(msg.id, msg.content), 300);
};

window.scrollToMessage = (msgId) => {
  const el = document.querySelector(`[data-msg-id="${msgId}"]`);
  if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); el.style.background = 'rgba(88,101,242,0.15)'; setTimeout(() => el.style.background = '', 1500); }
};

window.scrollToBottom = (instant = false) => {
  const c = document.getElementById('messages-container');
  if (instant) c.scrollTop = c.scrollHeight;
  else c.scrollTo({ top: c.scrollHeight, behavior: 'smooth' });
};

// ── Reactions ─────────────────────────────────────────────
window.renderReactionsInner = (msgId, reactions) =>
  (reactions||[]).map(r => {
    const users = r.users || r.Reactions || [];
    const mine = users.some(u => (u.id || u.user_id) === State.user?.id);
    return `<span class="reaction-chip ${mine?'mine':''}" onclick="sendReaction('${msgId}','${r.emoji}')">
      ${r.emoji} <span class="count">${users.length}</span></span>`;
  }).join('');

window.sendReaction = (msgId, emoji) => window.socketClient?.emit('message:react', { messageId: msgId, emoji });

// ── Edit ──────────────────────────────────────────────────
window.startEdit = (msgId) => {
  const msg = State.messages.find(m => m.id === msgId);
  if (!msg) return;
  const bodyEl = document.querySelector(`[data-msg-body="${msgId}"]`);
  if (!bodyEl) return;
  const editEl = document.createElement('div');
  editEl.innerHTML = `
    <textarea class="edit-input" rows="2">${escapeHtml(msg.content)}</textarea>
    <div class="edit-hint">Entrée pour sauver · Échap pour annuler</div>`;
  bodyEl.replaceWith(editEl);
  const ta = editEl.querySelector('textarea');
  ta.focus(); ta.selectionStart = ta.value.length;
  ta.addEventListener('keydown', e => {
    if (e.key === 'Escape') { editEl.replaceWith(bodyEl); }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      const content = ta.value.trim();
      if (!content) return;
      window.socketClient?.emit('message:edit', { messageId: msgId, content });
      editEl.replaceWith(bodyEl);
      bodyEl.innerHTML = renderContentAdvanced(content);
      bodyEl.classList.add('edited');
    }
  });
};

window.deleteMessage = (msgId) => {
  if (!confirm('Supprimer ce message ?')) return;
  window.socketClient?.emit('message:delete', { messageId: msgId, guildId: State.currentServer?.id });
};

// ── Reply ─────────────────────────────────────────────────
window.startReply = (msgId, authorName) => {
  const msg = State.messages.find(m => m.id === msgId);
  if (!msg) return;
  State.replyingTo = msg;
  document.getElementById('reply-author-name').textContent = authorName;
  document.getElementById('reply-preview').classList.remove('hidden');
  document.getElementById('message-input').focus();
};

document.getElementById('cancel-reply-btn').addEventListener('click', () => {
  State.replyingTo = null;
  document.getElementById('reply-preview').classList.add('hidden');
});

// ── Envoi ─────────────────────────────────────────────────
const messageInput = document.getElementById('message-input');
const sendBtn = document.getElementById('send-btn');

const sendMessage = () => {
  const content = messageInput.value.trim();
  if (!content || !State.currentChannel || !window.socketClient) return;
  window.socketClient.emit('message:send', {
    guildId: State.currentServer.id,
    channelId: State.currentChannel.id,
    content,
    reply_to: State.replyingTo?.id || null,
  });
  messageInput.value = '';
  messageInput.style.height = 'auto';
  State.replyingTo = null;
  document.getElementById('reply-preview').classList.add('hidden');
  window.socketClient.emit('typing:stop', { channelId: State.currentChannel.id });
  closeMentionAutocomplete();
  scrollToBottom();
};

sendBtn.addEventListener('click', sendMessage);
messageInput.addEventListener('keydown', e => {
  // Navigation dans l'autocomplete
  const ac = document.getElementById('mention-autocomplete');
  if (ac && !ac.classList.contains('hidden')) {
    if (e.key === 'ArrowDown') { e.preventDefault(); moveMentionSelection(1); return; }
    if (e.key === 'ArrowUp')   { e.preventDefault(); moveMentionSelection(-1); return; }
    if (e.key === 'Tab' || e.key === 'Enter') {
      const sel = ac.querySelector('.selected');
      if (sel) { e.preventDefault(); sel.click(); return; }
    }
    if (e.key === 'Escape') { closeMentionAutocomplete(); return; }
  }
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
});

// Auto-resize
messageInput.addEventListener('input', () => {
  messageInput.style.height = 'auto';
  messageInput.style.height = Math.min(messageInput.scrollHeight, 200) + 'px';
  handleMentionTyping();
});

// Typing indicator
let typingTimeout = null;
messageInput.addEventListener('input', () => {
  if (!State.currentChannel || !window.socketClient) return;
  window.socketClient.emit('typing:start', { channelId: State.currentChannel.id });
  clearTimeout(typingTimeout);
  typingTimeout = setTimeout(() => window.socketClient?.emit('typing:stop', { channelId: State.currentChannel.id }), 3000);
});

// ── Mentions autocomplete ─────────────────────────────────
window.handleMentionTyping = () => {
  const val = messageInput.value;
  const cursorPos = messageInput.selectionStart;
  const textBefore = val.slice(0, cursorPos);
  const match = textBefore.match(/@(\w*)$/);

  if (!match) { closeMentionAutocomplete(); return; }
  const query = match[1].toLowerCase();
  const members = State.currentServer?.members || [];
  const filtered = members
    .map(m => m.user)
    .filter(u => u && u.username.toLowerCase().startsWith(query))
    .slice(0, 8);

  if (!filtered.length) { closeMentionAutocomplete(); return; }
  showMentionAutocomplete(filtered, match[1]);
};

window.showMentionAutocomplete = (users, query) => {
  let ac = document.getElementById('mention-autocomplete');
  if (!ac) {
    ac = document.createElement('div');
    ac.id = 'mention-autocomplete';
    ac.className = 'mention-autocomplete';
    document.querySelector('.chat-input-wrapper').appendChild(ac);
  }
  ac.innerHTML = users.map((u, i) => `
    <div class="mention-item ${i===0?'selected':''}" onclick="insertMention('${escapeHtml(u.username)}')">
      ${renderAvatar(u, 'avatar-sm')}
      <span class="mention-item-name">${escapeHtml(u.username)}</span>
    </div>`).join('');
  ac.classList.remove('hidden');
};

window.insertMention = (username) => {
  const val = messageInput.value;
  const cursor = messageInput.selectionStart;
  const before = val.slice(0, cursor).replace(/@\w*$/, `@${username} `);
  messageInput.value = before + val.slice(cursor);
  messageInput.focus();
  closeMentionAutocomplete();
};

window.closeMentionAutocomplete = () => {
  document.getElementById('mention-autocomplete')?.classList.add('hidden');
};

window.moveMentionSelection = (dir) => {
  const items = document.querySelectorAll('#mention-autocomplete .mention-item');
  if (!items.length) return;
  const current = [...items].findIndex(i => i.classList.contains('selected'));
  items[current]?.classList.remove('selected');
  const next = (current + dir + items.length) % items.length;
  items[next].classList.add('selected');
};

// ── Recherche messages ─────────────────────────────────────
let searchOpen = false;
document.addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'f' && State.currentChannel) {
    e.preventDefault();
    toggleSearch();
  }
});

window.toggleSearch = () => {
  let bar = document.getElementById('search-bar');
  if (!bar) {
    bar = document.createElement('div');
    bar.id = 'search-bar';
    bar.className = 'search-bar';
    bar.innerHTML = `
      <div class="search-bar-input-wrap">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" style="color:var(--text-muted);flex-shrink:0"><path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/></svg>
        <input type="text" id="search-input" class="input" placeholder="Rechercher dans #${State.currentChannel?.name||''}..." style="flex:1;background:transparent;border:none;font-size:14px" />
        <button onclick="document.getElementById('search-bar').classList.add('hidden')" style="color:var(--text-muted);font-size:18px;background:none;border:none;cursor:pointer">×</button>
      </div>
      <div class="search-bar-results" id="search-results"></div>`;
    document.getElementById('chat-header').style.position = 'relative';
    document.getElementById('chat-header').appendChild(bar);

    document.getElementById('search-input').addEventListener('input', debounce(doSearch, 400));
  }
  bar.classList.toggle('hidden');
  if (!bar.classList.contains('hidden')) document.getElementById('search-input').focus();
};

window.doSearch = async () => {
  const q = document.getElementById('search-input')?.value.trim();
  const results = document.getElementById('search-results');
  if (!q || q.length < 2) { results.innerHTML = ''; return; }

  // Recherche locale dans les messages chargés
  const matches = State.messages.filter(m => m.content.toLowerCase().includes(q.toLowerCase()));
  if (!matches.length) { results.innerHTML = '<div style="padding:12px;font-size:13px;color:var(--text-muted)">Aucun résultat</div>'; return; }

  results.innerHTML = matches.slice(0, 20).map(m => `
    <div class="search-result-item" onclick="scrollToMessage('${m.id}');document.getElementById('search-bar').classList.add('hidden')">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
        ${renderAvatar(m.author, 'avatar-sm')}
        <span style="font-size:13px;font-weight:600">${escapeHtml(m.author?.username||'?')}</span>
        <span style="font-size:11px;color:var(--text-muted)">${formatTime(m.created_at)}</span>
      </div>
      <div style="font-size:13px;color:var(--text-secondary)">${highlightSearch(escapeHtml(m.content), q)}</div>
    </div>`).join('');
};

window.highlightSearch = (text, query) =>
  text.replace(new RegExp(escapeHtml(query), 'gi'), m => `<span class="search-highlight">${m}</span>`);

// ── Unread tracking ───────────────────────────────────────
const unreadChannels = new Map(); // channelId -> count

window.markChannelRead = (channelId) => {
  if (typeof clearPageNotif === 'function') clearPageNotif('channel');
  unreadChannels.delete(channelId);
  const el = document.querySelector(`[data-channel-id="${channelId}"]`);
  if (el) { el.classList.remove('has-unread'); el.querySelector('.unread-count')?.remove(); el.querySelector('.unread-dot')?.remove(); }
};

window.markChannelUnread = (channelId) => {
  if (channelId === State.currentChannel?.id) return;
  const count = (unreadChannels.get(channelId) || 0) + 1;
  unreadChannels.set(channelId, count);
  const el = document.querySelector(`[data-channel-id="${channelId}"]`);
  if (!el) return;
  el.classList.add('has-unread');
  let badge = el.querySelector('.unread-count');
  if (!badge) { badge = document.createElement('span'); badge.className = 'unread-count'; el.appendChild(badge); }
  badge.textContent = count > 99 ? '99+' : count;
};

// ── Emoji picker ──────────────────────────────────────────
const EMOJIS = ['😀','😂','🥰','😎','😭','😤','🤔','😴','🎉','🔥','👍','👎','❤️','✨','💯','🎮','🎵','🍕','😅','🙏','💀','🤣','😊','😋','🥳','🤩','😬','🫡','🫠','💪','🤝','✌️','🫶','🙌','👏','🤦','🤷','🎯','🚀','💡'];
const emojiPicker = document.getElementById('emoji-picker');
emojiPicker.innerHTML = `<div class="emoji-grid">${EMOJIS.map(e => `<button class="emoji-btn" onclick="insertEmoji('${e}')">${e}</button>`).join('')}</div>`;

document.getElementById('emoji-toggle-btn').addEventListener('click', e => { e.stopPropagation(); emojiPicker.classList.toggle('hidden'); });
window.insertEmoji = (emoji) => { messageInput.value += emoji; messageInput.focus(); emojiPicker.classList.add('hidden'); };

window.toggleEmojiForMsg = (msgId) => {
  document.getElementById('quick-emoji-picker')?.remove();
  const picker = document.createElement('div');
  picker.id = 'quick-emoji-picker';
  picker.className = 'emoji-picker';
  picker.style.cssText = 'position:fixed;z-index:200';
  picker.innerHTML = `<div class="emoji-grid">${EMOJIS.slice(0,18).map(e =>
    `<button class="emoji-btn" onclick="sendReaction('${msgId}','${e}');this.closest('#quick-emoji-picker').remove()">${e}</button>`).join('')}</div>`;
  const btn = document.querySelector(`[data-msg-id="${msgId}"] .msg-action-btn`);
  if (btn) { const r = btn.getBoundingClientRect(); picker.style.top=(r.top-160)+'px'; picker.style.left=r.left+'px'; }
  document.body.appendChild(picker);
};

document.addEventListener('click', e => {
  if (!e.target.closest('#emoji-toggle-btn') && !e.target.closest('#emoji-picker')) emojiPicker.classList.add('hidden');
  if (!e.target.closest('.msg-action-btn') && !e.target.closest('#quick-emoji-picker')) document.getElementById('quick-emoji-picker')?.remove();
});

// ── Son notification ──────────────────────────────────────
window.playNotificationSound = () => {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.1);
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.3);
  } catch (_) {}
};

// ── Utils ─────────────────────────────────────────────────
window.debounce = (fn, delay) => { let t; return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), delay); }; };

window.getChannelName = (guildId, channelId) => {
  const guild = State.servers.find(s => s.id === guildId);
  return guild?.channels?.find(c => c.id === channelId)?.name || channelId;
};

window.showProfilePopupByName = (username) => {
  const member = State.currentServer?.members?.find(m => m.user?.username === username);
  if (member?.user) showProfilePopup(null, member.user.id, username, member.user);
};
