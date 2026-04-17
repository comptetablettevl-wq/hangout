// ── Titre de page avec compteur de non-lus ───────────────
window.NotifState = { total: 0, dmCount: 0, channelCount: 0 };

window.updatePageTitle = () => {
  const total = NotifState.dmCount + NotifState.channelCount;
  document.title = total > 0 ? `(${total}) Hang Out` : 'Hang Out';
  // Favicon badge (simple)
  updateFaviconBadge(total);
};

window.addPageNotif = (type = 'channel') => {
  if (document.hasFocus() && type !== 'mention') return;
  if (type === 'dm' || type === 'mention') NotifState.dmCount++;
  else NotifState.channelCount++;
  updatePageTitle();
};

window.clearPageNotif = (type = 'channel') => {
  if (type === 'dm') NotifState.dmCount = 0;
  else NotifState.channelCount = 0;
  updatePageTitle();
};

// Reset au focus
window.addEventListener('focus', () => {
  NotifState.dmCount = 0;
  NotifState.channelCount = 0;
  updatePageTitle();
});

// Favicon badge via canvas
window.updateFaviconBadge = (count) => {
  const canvas = document.createElement('canvas');
  canvas.width = 32; canvas.height = 32;
  const ctx = canvas.getContext('2d');

  // Fond violet
  ctx.fillStyle = '#5865F2';
  ctx.beginPath();
  ctx.arc(16, 16, 14, 0, Math.PI * 2);
  ctx.fill();

  // Lettre H
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 16px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('H', 16, 17);

  if (count > 0) {
    // Badge rouge
    ctx.fillStyle = '#ed4245';
    ctx.beginPath();
    ctx.arc(26, 6, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 9px sans-serif';
    ctx.fillText(count > 9 ? '9+' : count, 26, 6);
  }

  let link = document.querySelector("link[rel~='icon']");
  if (!link) {
    link = document.createElement('link');
    link.rel = 'icon';
    document.head.appendChild(link);
  }
  link.href = canvas.toDataURL();
};

// Init favicon au chargement
document.addEventListener('DOMContentLoaded', () => updateFaviconBadge(0));

// ── Preview image avant envoi ─────────────────────────────
window.setupImagePreview = () => {
  const fileInput = document.getElementById('file-input');
  if (!fileInput) return;

  // Brancher le bouton d'attachement sur l'input file
  const attachBtn = document.getElementById('attach-btn');
  if (attachBtn) {
    attachBtn.addEventListener('click', () => fileInput.click());
  }

  fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) { showToast('Seules les images sont supportées', 'error'); return; }
    if (file.size > 8 * 1024 * 1024)    { showToast('Fichier trop grand (max 8 Mo)', 'error'); return; }

    const reader = new FileReader();
    reader.onload = (ev) => showImagePreview(ev.target.result, file.name, file);
    reader.readAsDataURL(file);
    e.target.value = '';
  });
};

window.showImagePreview = (dataUrl, filename, file) => {
  // Supprimer l'ancien preview
  document.getElementById('image-preview-bar')?.remove();

  const bar = document.createElement('div');
  bar.id = 'image-preview-bar';
  bar.style.cssText = `
    position:absolute;bottom:calc(100% + 4px);left:0;right:0;
    background:var(--bg-elevated);border:1px solid var(--border);
    border-radius:var(--radius);padding:10px 12px;
    display:flex;align-items:center;gap:12px;z-index:10;
  `;
  bar.innerHTML = `
    <img src="${dataUrl}" style="width:60px;height:45px;object-fit:cover;border-radius:4px;flex-shrink:0" />
    <div style="flex:1;min-width:0">
      <div style="font-size:13px;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(filename)}</div>
      <div style="font-size:11px;color:var(--text-muted)">${(file.size/1024).toFixed(0)} Ko — Entrée pour envoyer</div>
    </div>
    <button onclick="cancelImagePreview()" style="color:var(--text-muted);font-size:18px;background:none;border:none;cursor:pointer;flex-shrink:0">×</button>
  `;

  document.querySelector('.chat-input-wrapper').style.position = 'relative';
  document.querySelector('.chat-input-wrapper').appendChild(bar);

  // Stocker le fichier pour l'envoi
  window._pendingImageFile = file;
  window._pendingImageData = dataUrl;
};

window.cancelImagePreview = () => {
  document.getElementById('image-preview-bar')?.remove();
  window._pendingImageFile = null;
  window._pendingImageData = null;
};

// Upload réel via FormData
window.uploadAndSendImage = async () => {
  if (!window._pendingImageFile) return false;

  // Indicateur de chargement dans la preview
  const bar = document.getElementById('image-preview-bar');
  if (bar) {
    bar.style.opacity = '0.6';
    bar.style.pointerEvents = 'none';
    const hint = bar.querySelector('div > div:last-child');
    if (hint) hint.textContent = 'Upload en cours…';
  }

  try {
    const form = new FormData();
    form.append('file', window._pendingImageFile);
    const res = await fetch('/api/upload', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${State.token}` },
      body: form,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);

    const textContent = document.getElementById('message-input').value.trim();
    // URL absolue pour que renderContentAdvanced la détecte comme image
    const imageUrl = `${location.origin}${data.url}`;
    const finalContent = textContent ? `${imageUrl}\n${textContent}` : imageUrl;

    window.socketClient?.emit('message:send', {
      guildId:   State.currentServer?.id,
      channelId: State.currentChannel?.id,
      content:   finalContent,
    });

    cancelImagePreview();
    document.getElementById('message-input').value = '';
    document.getElementById('message-input').style.height = 'auto';
    return true;
  } catch (err) {
    // Restaurer la preview en cas d'erreur
    if (bar) { bar.style.opacity = '1'; bar.style.pointerEvents = 'auto'; }
    showToast('Erreur upload : ' + err.message, 'error');
    return false;
  }
};

document.addEventListener('DOMContentLoaded', () => {
  setupImagePreview();

  // Hook: si image en attente, l'envoyer avec le message
  const input = document.getElementById('message-input');
  input?.addEventListener('keydown', async (e) => {
    if (e.key === 'Enter' && !e.shiftKey && window._pendingImageFile) {
      e.stopImmediatePropagation();
      e.preventDefault();
      await uploadAndSendImage();
      input.value = '';
      input.style.height = 'auto';
    }
  }, true);
});

// ── Heartbeat / détection déconnexion silencieuse ────────
window.startHeartbeat = () => {
  setInterval(() => {
    if (window.socketClient?.connected) return;
    // Tentative de reconnexion si déconnecté depuis > 5s
    if (!document.getElementById('reconnect-banner')) {
      window.socketClient?.connect();
    }
  }, 5000);
};

document.addEventListener('DOMContentLoaded', startHeartbeat);

// ── Drag & drop et paste d'images ────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  const chatInputZone = document.getElementById('chat-input-zone');
  if (!chatInputZone) return;

  // Overlay drag global sur le main
  const mainEl = document.getElementById('main');
  if (mainEl) {
    mainEl.addEventListener('dragenter', (e) => {
      if (!e.dataTransfer.types.includes('Files')) return;
      if (!State.currentChannel) return;
      if (!document.getElementById('drag-overlay')) {
        const ov = document.createElement('div');
        ov.id = 'drag-overlay';
        ov.className = 'drag-overlay';
        ov.innerHTML = '<div class="drag-overlay-text">📎 Déposer pour envoyer</div>';
        mainEl.appendChild(ov);
      }
    });
    mainEl.addEventListener('dragleave', (e) => {
      if (!mainEl.contains(e.relatedTarget)) {
        document.getElementById('drag-overlay')?.remove();
      }
    });
    mainEl.addEventListener('dragover', (e) => { e.preventDefault(); });
    mainEl.addEventListener('drop', (e) => {
      e.preventDefault();
      document.getElementById('drag-overlay')?.remove();
      const file = e.dataTransfer.files[0];
      if (file && file.type.startsWith('image/') && State.currentChannel) {
        handleDroppedFile(file);
      }
    });
  }

  // Drag & drop sur la zone input aussi
  chatInputZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    chatInputZone.style.background = 'var(--accent-dim)';
  });
  chatInputZone.addEventListener('dragleave', () => {
    chatInputZone.style.background = '';
  });
  chatInputZone.addEventListener('drop', (e) => {
    e.preventDefault();
    chatInputZone.style.background = '';
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
      handleDroppedFile(file);
    } else if (file) {
      showToast('Seules les images sont supportées', 'error');
    }
  });

  // Coller une image (Ctrl+V)
  document.addEventListener('paste', (e) => {
    if (!State.currentChannel) return;
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) {
          e.preventDefault();
          handleDroppedFile(file);
          break;
        }
      }
    }
  });
});

window.handleDroppedFile = (file) => {
  if (file.size > 8 * 1024 * 1024) { showToast('Fichier trop grand (max 8 Mo)', 'error'); return; }
  const reader = new FileReader();
  reader.onload = (ev) => showImagePreview(ev.target.result, file.name || 'image.png', file);
  reader.readAsDataURL(file);
};
