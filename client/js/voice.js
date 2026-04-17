const VoiceState = {
  inChannel:     null,
  muted:         false,
  deafened:      false,
  stream:        null,
  peers:         {},
  peerVolumes:   {},   // socketId -> GainNode
  inputDeviceId:  null,
  outputDeviceId: null,
  participants:  [],   // { userId, username, socketId, muted }
};

// ── Périphériques audio ───────────────────────────────────
window.loadAudioDevices = async () => {
  try {
    await navigator.mediaDevices.getUserMedia({ audio: true }).catch(() => {});
    const devices = await navigator.mediaDevices.enumerateDevices();
    const inputs  = devices.filter(d => d.kind === 'audioinput');
    const outputs = devices.filter(d => d.kind === 'audiooutput');

    const inputSel  = document.getElementById('audio-input-select');
    const outputSel = document.getElementById('audio-output-select');
    if (!inputSel || !outputSel) return;

    inputSel.innerHTML  = inputs.map(d  => `<option value="${d.deviceId}">${d.label || 'Micro '  + d.deviceId.slice(0,6)}</option>`).join('');
    outputSel.innerHTML = outputs.map(d => `<option value="${d.deviceId}">${d.label || 'Sortie ' + d.deviceId.slice(0,6)}</option>`).join('');

    const savedIn  = localStorage.getItem('ho_audio_input');
    const savedOut = localStorage.getItem('ho_audio_output');
    if (savedIn  && inputSel.querySelector(`[value="${savedIn}"]`))   { inputSel.value  = savedIn;  VoiceState.inputDeviceId  = savedIn;  }
    if (savedOut && outputSel.querySelector(`[value="${savedOut}"]`)) { outputSel.value = savedOut; VoiceState.outputDeviceId = savedOut; }

    inputSel.onchange  = () => { VoiceState.inputDeviceId  = inputSel.value;  localStorage.setItem('ho_audio_input',  inputSel.value); };
    outputSel.onchange = () => { VoiceState.outputDeviceId = outputSel.value; localStorage.setItem('ho_audio_output', outputSel.value); };
  } catch (_) {}
};

// ── Rejoindre un channel vocal ────────────────────────────
window.joinVoiceChannel = async (channel) => {
  const chanId = channel.id || channel._id;
  if (VoiceState.inChannel && (VoiceState.inChannel.id === chanId || VoiceState.inChannel._id === chanId)) {
    leaveVoiceChannel();
    return;
  }
  try {
    const constraints = { audio: VoiceState.inputDeviceId ? { deviceId: { exact: VoiceState.inputDeviceId } } : true };
    const stream      = await navigator.mediaDevices.getUserMedia(constraints);
    VoiceState.stream       = stream;
    VoiceState.inChannel    = channel;
    VoiceState.participants = [];
    showVoiceBar(channel);

    window.socketClient?.emit('voice:join', { channelId: chanId });

    // Recevoir les pairs existants
    const handlePeers = ({ peers }) => {
      peers.forEach(peer => {
        VoiceState.participants.push({ ...peer, muted: false });
        createOffer(peer.socketId);
      });
      renderVoiceParticipants();
    };
    window.socketClient?.once('voice:peers', handlePeers);

    // Quelqu'un rejoint
    window.socketClient?.on('voice:user_joined', ({ userId, username, socketId }) => {
      if (!VoiceState.participants.find(p => p.socketId === socketId)) {
        VoiceState.participants.push({ userId, username, socketId, muted: false });
        renderVoiceParticipants();
      }
    });

    // Quelqu'un part
    window.socketClient?.on('voice:user_left', ({ socketId }) => {
      VoiceState.participants = VoiceState.participants.filter(p => p.socketId !== socketId);
      closePeer(socketId);
      renderVoiceParticipants();
    });

    // Signaling WebRTC
    window.socketClient?.on('voice:offer', async ({ from, offer }) => {
      const pc = createPeerConnection(from);
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      window.socketClient.emit('voice:answer', { to: from, answer });
    });

    window.socketClient?.on('voice:answer', async ({ from, answer }) => {
      await VoiceState.peers[from]?.setRemoteDescription(new RTCSessionDescription(answer));
    });

    window.socketClient?.on('voice:ice', async ({ from, candidate }) => {
      if (VoiceState.peers[from] && candidate)
        await VoiceState.peers[from].addIceCandidate(new RTCIceCandidate(candidate));
    });

    // Mute d'un pair
    window.socketClient?.on('voice:mute_update', ({ userId, muted }) => {
      const p = VoiceState.participants.find(p => p.userId === userId);
      if (p) { p.muted = muted; renderVoiceParticipants(); }
    });

    // Ajouter soi-même aux participants
    VoiceState.participants.unshift({
      userId:   State.user?.id,
      username: State.user?.username,
      socketId: 'self',
      muted:    false,
      isSelf:   true,
    });
    renderVoiceParticipants();

  } catch (err) {
    const msgs = { NotAllowedError: 'Accès au micro refusé', NotFoundError: 'Aucun micro détecté' };
    showToast(msgs[err.name] || 'Erreur vocal : ' + err.message, 'error');
  }
};

window.leaveVoiceChannel = () => {
  Object.keys(VoiceState.peers).forEach(closePeer);
  VoiceState.stream?.getTracks().forEach(t => t.stop());
  VoiceState.stream      = null;
  VoiceState.participants = [];
  window.socketClient?.emit('voice:leave');
  VoiceState.inChannel = null;
  VoiceState.muted     = false;
  VoiceState.deafened  = false;
  hideVoiceBar();
};

const createOffer = async (socketId) => {
  const pc    = createPeerConnection(socketId);
  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);
  window.socketClient?.emit('voice:offer', { to: socketId, offer });
};

const createPeerConnection = (socketId) => {
  if (VoiceState.peers[socketId]) return VoiceState.peers[socketId];

  const pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
  VoiceState.stream?.getTracks().forEach(track => pc.addTrack(track, VoiceState.stream));

  pc.onicecandidate = ({ candidate }) => {
    if (candidate) window.socketClient?.emit('voice:ice', { to: socketId, candidate });
  };

  pc.ontrack = ({ streams }) => {
    // Créer un contexte audio pour contrôler le volume
    const ctx  = new (window.AudioContext || window.webkitAudioContext)();
    const src  = ctx.createMediaStreamSource(streams[0]);
    const gain = ctx.createGain();
    gain.gain.value = 1.0;
    src.connect(gain);
    gain.connect(ctx.destination);
    VoiceState.peerVolumes[socketId] = gain;

    // Fallback audio element pour la lecture
    const audio = document.createElement('audio');
    audio.srcObject = streams[0];
    audio.autoplay = true;
    audio.dataset.peerId = socketId;
    if (VoiceState.outputDeviceId && audio.setSinkId) {
      audio.setSinkId(VoiceState.outputDeviceId).catch(() => {});
    }
    document.body.appendChild(audio);
  };

  VoiceState.peers[socketId] = pc;
  return pc;
};

const closePeer = (socketId) => {
  VoiceState.peers[socketId]?.close();
  delete VoiceState.peers[socketId];
  delete VoiceState.peerVolumes[socketId];
  document.querySelector(`audio[data-peer-id="${socketId}"]`)?.remove();
};

// ── UI Voice Bar ──────────────────────────────────────────
const showVoiceBar = (channel) => {
  document.getElementById('voice-bar').classList.add('active');
  document.getElementById('voice-bar-channel-name').textContent = `🔊 ${channel.name}`;
  document.querySelectorAll('.channel-item').forEach(el => {
    if (el.dataset.channelId === (channel.id || channel._id)) el.style.color = 'var(--green)';
  });
};

const hideVoiceBar = () => {
  document.getElementById('voice-bar').classList.remove('active');
  document.getElementById('voice-participants')?.remove();
  document.querySelectorAll('.channel-item').forEach(el => el.style.color = '');
};

// ── Liste participants ────────────────────────────────────
window.renderVoiceParticipants = () => {
  let panel = document.getElementById('voice-participants');
  if (!panel) {
    panel = document.createElement('div');
    panel.id = 'voice-participants';
    panel.style.cssText = 'padding:6px 8px;border-top:1px solid rgba(59,165,92,0.2)';
    document.getElementById('voice-bar').appendChild(panel);
  }

  panel.innerHTML = VoiceState.participants.map(p => `
    <div style="display:flex;align-items:center;gap:8px;padding:3px 0">
      <div style="position:relative;flex-shrink:0">
        ${renderAvatar({ username: p.username }, 'avatar-sm')}
        ${p.muted ? '<div style="position:absolute;bottom:-2px;right:-2px;width:12px;height:12px;background:var(--red);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:7px;border:2px solid var(--bg-secondary)">🔇</div>' : ''}
      </div>
      <span style="font-size:12px;color:${p.isSelf?'var(--green)':'var(--text-secondary)'};flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">
        ${escapeHtml(p.username || '?')}${p.isSelf ? ' (toi)' : ''}
      </span>
      ${!p.isSelf ? `
        <input type="range" min="0" max="200" value="100" title="Volume"
          style="width:60px;accent-color:var(--accent)"
          oninput="setPeerVolume('${p.socketId}', this.value)" />` : ''}
    </div>`).join('');
};

window.setPeerVolume = (socketId, value) => {
  const gain = VoiceState.peerVolumes[socketId];
  if (gain) gain.gain.value = parseInt(value) / 100;
};

// ── Partage d'écran ───────────────────────────────────────
window.startScreenShare = async () => {
  if (!VoiceState.inChannel) { showToast('Rejoins un channel vocal d\'abord', 'error'); return; }
  try {
    const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
    const videoTrack   = screenStream.getVideoTracks()[0];

    // Remplacer la piste vidéo dans tous les peers
    Object.values(VoiceState.peers).forEach(pc => {
      const sender = pc.getSenders().find(s => s.track?.kind === 'video');
      if (sender) sender.replaceTrack(videoTrack);
      else pc.addTrack(videoTrack, screenStream);
    });

    window.socketClient?.emit('voice:screen_share', { sharing: true });
    showToast('Partage d\'écran démarré', 'success');

    videoTrack.onended = () => stopScreenShare();
  } catch (err) {
    if (err.name !== 'NotAllowedError') showToast('Erreur partage : ' + err.message, 'error');
  }
};

window.stopScreenShare = () => {
  window.socketClient?.emit('voice:screen_share', { sharing: false });
  showToast('Partage d\'écran arrêté', 'info');
};

// ── Mute / Deafen ─────────────────────────────────────────
document.getElementById('voice-leave-btn').addEventListener('click', leaveVoiceChannel);
document.getElementById('mute-btn').addEventListener('click', toggleMute);
document.getElementById('toggle-mute-panel').addEventListener('click', toggleMute);

function toggleMute() {
  VoiceState.muted = !VoiceState.muted;
  VoiceState.stream?.getAudioTracks().forEach(t => { t.enabled = !VoiceState.muted; });
  document.getElementById('mute-btn').classList.toggle('muted', VoiceState.muted);
  document.getElementById('toggle-mute-panel').classList.toggle('active', VoiceState.muted);

  // Mettre à jour soi-même dans la liste
  const self = VoiceState.participants.find(p => p.isSelf);
  if (self) { self.muted = VoiceState.muted; renderVoiceParticipants(); }

  window.socketClient?.emit('voice:mute', { muted: VoiceState.muted });
}
