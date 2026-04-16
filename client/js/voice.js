const VoiceState = {
  inChannel: null,
  muted: false,
  deafened: false,
  stream: null,
  peers: {},
  inputDeviceId: null,
  outputDeviceId: null,
};

// ── Device enumeration ────────────────────────────────────
window.loadAudioDevices = async () => {
  try {
    await navigator.mediaDevices.getUserMedia({ audio: true });
    const devices = await navigator.mediaDevices.enumerateDevices();
    const inputs  = devices.filter(d => d.kind === 'audioinput');
    const outputs = devices.filter(d => d.kind === 'audiooutput');

    const inputSel  = document.getElementById('audio-input-select');
    const outputSel = document.getElementById('audio-output-select');
    if (!inputSel || !outputSel) return;

    inputSel.innerHTML  = inputs.map(d => `<option value="${d.deviceId}">${d.label || 'Micro ' + d.deviceId.slice(0,6)}</option>`).join('');
    outputSel.innerHTML = outputs.map(d => `<option value="${d.deviceId}">${d.label || 'Sortie ' + d.deviceId.slice(0,6)}</option>`).join('');

    // Restaurer les préférences
    const savedInput  = localStorage.getItem('ho_audio_input');
    const savedOutput = localStorage.getItem('ho_audio_output');
    if (savedInput)  { inputSel.value  = savedInput;  VoiceState.inputDeviceId  = savedInput; }
    if (savedOutput) { outputSel.value = savedOutput; VoiceState.outputDeviceId = savedOutput; }

    inputSel.onchange  = () => { VoiceState.inputDeviceId  = inputSel.value;  localStorage.setItem('ho_audio_input',  inputSel.value); };
    outputSel.onchange = () => { VoiceState.outputDeviceId = outputSel.value; localStorage.setItem('ho_audio_output', outputSel.value); };
  } catch (_) {}
};

// ── Join voice channel ────────────────────────────────────
window.joinVoiceChannel = async (channel) => {
  if (VoiceState.inChannel?._id === channel._id || VoiceState.inChannel?.id === channel.id) {
    leaveVoiceChannel();
    return;
  }
  try {
    const constraints = { audio: VoiceState.inputDeviceId ? { deviceId: { exact: VoiceState.inputDeviceId } } : true };
    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    VoiceState.stream = stream;
    VoiceState.inChannel = channel;
    showVoiceBar(channel);
    window.socketClient?.emit('voice:join', { channelId: channel.id || channel._id });

    window.socketClient?.once('voice:peers', ({ peers }) => {
      peers.forEach(peer => createOffer(peer.socketId));
    });

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

  } catch (err) {
    const msg = { NotAllowedError: 'Accès au micro refusé', NotFoundError: 'Aucun micro détecté' };
    showToast(msg[err.name] || 'Erreur vocal : ' + err.message, 'error');
  }
};

window.leaveVoiceChannel = () => {
  Object.keys(VoiceState.peers).forEach(closePeer);
  VoiceState.stream?.getTracks().forEach(t => t.stop());
  VoiceState.stream = null;
  window.socketClient?.emit('voice:leave');
  VoiceState.inChannel = null;
  VoiceState.muted = false;
  hideVoiceBar();
};

const createOffer = async (socketId) => {
  const pc = createPeerConnection(socketId);
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
    const audio = document.createElement('audio');
    audio.srcObject = streams[0];
    audio.autoplay = true;
    audio.dataset.peerId = socketId;
    // Appliquer le périphérique de sortie si supporté
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
  document.querySelector(`audio[data-peer-id="${socketId}"]`)?.remove();
};

// ── UI ────────────────────────────────────────────────────
const showVoiceBar = (channel) => {
  document.getElementById('voice-bar').classList.add('active');
  document.getElementById('voice-bar-channel-name').textContent = `🔊 ${channel.name}`;
  document.querySelectorAll('.channel-item').forEach(el => {
    if (el.dataset.channelId === (channel.id || channel._id)) el.style.color = 'var(--green)';
  });
};

const hideVoiceBar = () => {
  document.getElementById('voice-bar').classList.remove('active');
  document.querySelectorAll('.channel-item').forEach(el => el.style.color = '');
};

document.getElementById('voice-leave-btn').addEventListener('click', leaveVoiceChannel);
document.getElementById('mute-btn').addEventListener('click', toggleMute);
document.getElementById('toggle-mute-panel').addEventListener('click', toggleMute);

function toggleMute() {
  VoiceState.muted = !VoiceState.muted;
  VoiceState.stream?.getAudioTracks().forEach(t => { t.enabled = !VoiceState.muted; });
  document.getElementById('mute-btn').classList.toggle('muted', VoiceState.muted);
  document.getElementById('toggle-mute-panel').classList.toggle('active', VoiceState.muted);
  window.socketClient?.emit('voice:mute', { muted: VoiceState.muted });
}
