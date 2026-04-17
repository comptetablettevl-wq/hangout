window.initSocket = () => {
  if (window.socketClient) window.socketClient.disconnect();

  window.socketClient = io({
    auth: { token: State.token },
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 10000,
  });

  const s = window.socketClient;

  // ── Connexion / reconnexion ──────────────────────────
  s.on('connect', () => {
    console.log('[Socket] connecté');
    hideReconnectBanner();
    s.emit('guilds:join');
    if (State.currentChannel) {
      s.emit('channel:join', {
        guildId: State.currentServer?.id,
        channelId: State.currentChannel.id,
      });
    }
  });

  s.on('disconnect', (reason) => {
    if (reason !== 'io client disconnect') showReconnectBanner();
  });

  s.on('connect_error', (err) => {
    if (err.message === 'Token manquant' || err.message === 'Token invalide') return;
    showReconnectBanner();
  });

  s.on('reconnect', () => {
    hideReconnectBanner();
    showToast('Reconnecté ✓', 'success');
    // Re-rejoindre les guilds rooms
    s.emit('guilds:join');
    // Re-rejoindre le channel actuel
    if (State.currentChannel && State.currentServer) {
      s.emit('channel:join', {
        guildId:   State.currentServer.id,
        channelId: State.currentChannel.id,
      });
    }
    // Re-broadcaster le statut online
    s.emit('status:set', { status: State.user?.status || 'online' });
    // Recharger les messages du channel actuel pour rattraper ce qu'on a manqué
    if (State.currentChannel && State.currentServer) {
      loadMessages(State.currentServer.id, State.currentChannel.id);
    }
  });


  // System events
  s.on('system:event', (event) => {
    if (event.channel_id !== State.currentChannel?.id) return;
    const list = document.getElementById('messages-list');
    if (list) list.insertAdjacentHTML('beforeend', renderSystemEvent(event));
    scrollToBottom();
  });


  // Partage d'écran reçu
  s.on('voice:screen_share', ({ userId, username, sharing }) => {
    if (sharing) {
      showToast(`${username} partage son écran`, 'info', 5000);
    } else {
      document.getElementById('screen-share-view')?.remove();
      showToast(`${username} a arrêté le partage`, 'info');
    }
  });

  // ── Messages ─────────────────────────────────────────
  s.on('message:new', (msg) => {
    if (msg.channel_id !== State.currentChannel?.id) return;
    appendMessage(msg);
    const container = document.getElementById('messages-container');
    const atBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 120;
    if (atBottom) scrollToBottom();
  });

  s.on('message:notify', ({ guildId, channelId, author, content }) => {
    markChannelUnread(channelId);
    playNotificationSound();
    addPageNotif('channel');
    sendBrowserNotification(`#${getChannelName(guildId, channelId)}`, `${author}: ${content}`);
  });

  s.on('message:edited', ({ id, content, edited, edited_at }) => {
    const el = document.querySelector(`[data-msg-id="${id}"]`);
    if (!el) return;
    const body = el.querySelector('.msg-body');
    if (body) { body.innerHTML = renderContent(content); body.classList.toggle('edited', edited); }
  });

  s.on('message:deleted', ({ id }) => {
    document.querySelector(`[data-msg-id="${id}"]`)?.remove();
  });

  s.on('message:reaction', ({ messageId, reactions }) => {
    const el = document.querySelector(`[data-msg-id="${messageId}"]`);
    if (!el) return;
    const zone = el.querySelector('.msg-reactions');
    if (zone) zone.innerHTML = renderReactionsInner(messageId, reactions);
  });

  // ── Typing ───────────────────────────────────────────
  s.on('typing:update', ({ userId, username, typing }) => {
    if (typing) State.typingUsers[userId] = username;
    else delete State.typingUsers[userId];
    updateTypingIndicator();
  });

  // ── Présence ─────────────────────────────────────────
  s.on('presence:update', ({ userId, status }) => {
    document.querySelectorAll(`[data-member-id="${userId}"] .status-dot`).forEach(dot => {
      dot.className = `status-dot ${status}`;
    });
    // Mettre à jour la liste membres si le serveur est ouvert
    if (State.currentServer) {
      const m = State.currentServer.members?.find(m => (m.user?.id || m.user_id) === userId);
      if (m && m.user) m.user.status = status;
    }
  });

  // ── Voice ────────────────────────────────────────────
  s.on('voice:members_update', ({ channelId, members }) => {
    updateVoiceChannelMembers(channelId, members);
  });

  // ── DM ───────────────────────────────────────────────

  // Typing DM
  s.on('dm:typing', ({ senderId, username, typing }) => {
    if (typeof updateDMTypingIndicator === 'function') {
      updateDMTypingIndicator(senderId, username, typing);
    }
  });

  s.on('dm:new', (msg) => {
    if (State.currentDM?.id === msg.sender_id || State.currentDM?.id === msg.receiver_id) {
      appendDM(msg);
      const container = document.getElementById('messages-container');
      const atBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 120;
      if (atBottom) scrollToBottom();
    }
  });

  s.on('dm:notify', ({ senderId, username, content }) => {
    playNotificationSound();
    addPageNotif('channel');
    sendBrowserNotification(`MP de ${username}`, content);
    updateDMUnreadBadge(senderId);
  });

  s.on('dm:edited', ({ id, content }) => {
    const el = document.querySelector(`[data-msg-id="${id}"]`);
    if (!el) return;
    const body = el.querySelector('.msg-body');
    if (body) { body.innerHTML = renderContent(content); body.classList.add('edited'); }
  });

  s.on('dm:deleted', ({ id }) => {
    document.querySelector(`[data-msg-id="${id}"]`)?.remove();
  });

  s.on('dm:typing', ({ username, typing }) => {
    if (typing) State.typingUsers['_dm'] = username;
    else delete State.typingUsers['_dm'];
    updateTypingIndicator();
  });

  s.on('error', ({ message }) => showToast(message, 'error'));
};

// ── Typing indicator ────────────────────────────────────
window.updateTypingIndicator = () => {
  const el = document.getElementById('typing-text');
  const users = Object.values(State.typingUsers).filter(u => u !== State.user?.username);
  if (!users.length) { el.textContent = ''; return; }
  const names = users.slice(0, 3).join(', ');
  const verb = users.length === 1 ? 'est en train d\'écrire' : 'écrivent';
  el.innerHTML = `<span class="typing-dots"><span></span><span></span><span></span></span> <strong>${escapeHtml(names)}</strong> ${verb}…`;
};

// ── Reconnect banner ────────────────────────────────────
const showReconnectBanner = () => {
  let banner = document.getElementById('reconnect-banner');
  if (banner) return;
  banner = document.createElement('div');
  banner.id = 'reconnect-banner';
  banner.style.cssText = 'position:fixed;top:0;left:0;right:0;background:var(--red);color:#fff;text-align:center;padding:8px;font-size:13px;font-weight:600;z-index:9999';
  banner.textContent = 'Connexion perdue — reconnexion en cours…';
  document.body.prepend(banner);
};

const hideReconnectBanner = () => {
  document.getElementById('reconnect-banner')?.remove();
};

// ── Helpers ─────────────────────────────────────────────
window.getChannelName = (guildId, channelId) => {
  const guild = State.servers.find(s => s.id === guildId);
  return guild?.channels?.find(c => c.id === channelId)?.name || 'channel';
};
