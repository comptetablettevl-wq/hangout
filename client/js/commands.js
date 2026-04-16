/**
 * Commandes slash — tapées dans l'input de chat
 * Format : /commande [arguments]
 */
const COMMANDS = {
  me: {
    desc: 'Action en italique',
    usage: '/me <action>',
    exec: (args) => {
      if (!args.trim()) return;
      window.socketClient?.emit('message:send', {
        guildId: State.currentServer?.id,
        channelId: State.currentChannel?.id,
        content: `_${args.trim()}_`,
      });
    },
  },
  shrug: {
    desc: 'Envoie ¯\\_(ツ)_/¯',
    usage: '/shrug',
    exec: () => {
      window.socketClient?.emit('message:send', {
        guildId: State.currentServer?.id,
        channelId: State.currentChannel?.id,
        content: '¯\\_(ツ)_/¯',
      });
    },
  },
  spoiler: {
    desc: 'Masque un texte',
    usage: '/spoiler <texte>',
    exec: (args) => {
      if (!args.trim()) return;
      window.socketClient?.emit('message:send', {
        guildId: State.currentServer?.id,
        channelId: State.currentChannel?.id,
        content: `||${args.trim()}||`,
      });
    },
  },
  tableflip: {
    desc: '(╯°□°）╯︵ ┻━┻',
    usage: '/tableflip',
    exec: () => {
      window.socketClient?.emit('message:send', {
        guildId: State.currentServer?.id,
        channelId: State.currentChannel?.id,
        content: '(╯°□°）╯︵ ┻━┻',
      });
    },
  },
  unflip: {
    desc: '┬─┬ノ( º _ ºノ)',
    usage: '/unflip',
    exec: () => {
      window.socketClient?.emit('message:send', {
        guildId: State.currentServer?.id,
        channelId: State.currentChannel?.id,
        content: '┬─┬ノ( º _ ºノ)',
      });
    },
  },
  nick: {
    desc: 'Change ton pseudo',
    usage: '/nick <nouveau pseudo>',
    exec: async (args) => {
      const username = args.trim();
      if (!username) { showToast('Usage : /nick <pseudo>', 'error'); return; }
      try {
        const { user } = await api.patch('/users/me', { username });
        State.user = { ...State.user, ...user };
        updateUserPanel();
        showToast(`Pseudo changé en ${user.username}`, 'success');
      } catch (err) { showToast(err.message, 'error'); }
    },
  },
  status: {
    desc: 'Change ton statut personnalisé',
    usage: '/status <texte>',
    exec: async (args) => {
      try {
        await api.patch('/users/me', { custom_status: args.trim() });
        State.user.custom_status = args.trim();
        updateUserPanel();
        showToast('Statut mis à jour', 'success');
      } catch (err) { showToast(err.message, 'error'); }
    },
  },
  help: {
    desc: 'Liste des commandes',
    usage: '/help',
    exec: () => {
      const list = Object.entries(COMMANDS)
        .map(([name, cmd]) => `**/${name}** — ${cmd.desc}`)
        .join('\n');
      showCommandHelp(list);
    },
  },
};

window.handleSlashCommand = (input) => {
  if (!input.startsWith('/')) return false;
  const [cmdName, ...argParts] = input.slice(1).split(' ');
  const cmd = COMMANDS[cmdName.toLowerCase()];
  if (!cmd) {
    showToast(`Commande inconnue : /${cmdName} — tape /help`, 'error');
    return true;
  }
  cmd.exec(argParts.join(' '));
  return true;
};

window.showCommandHelp = (text) => {
  showToast('Commandes disponibles dans la console', 'info');
  console.info('[Hang Out] Commandes disponibles:\n' +
    Object.entries(COMMANDS).map(([n,c]) => `  /${n} — ${c.desc} (${c.usage})`).join('\n')
  );
};

// Autocomplete des commandes slash
window.handleSlashAutocomplete = (val) => {
  if (!val.startsWith('/') || val.includes(' ')) {
    closeSlashAutocomplete();
    return;
  }
  const query = val.slice(1).toLowerCase();
  const matches = Object.entries(COMMANDS)
    .filter(([name]) => name.startsWith(query))
    .slice(0, 6);

  if (!matches.length) { closeSlashAutocomplete(); return; }

  let ac = document.getElementById('slash-autocomplete');
  if (!ac) {
    ac = document.createElement('div');
    ac.id = 'slash-autocomplete';
    ac.className = 'mention-autocomplete';
    document.querySelector('.chat-input-wrapper')?.appendChild(ac);
  }

  ac.innerHTML = matches.map(([name, cmd], i) => `
    <div class="mention-item ${i===0?'selected':''}" onclick="insertSlashCommand('${name}')">
      <span style="font-weight:600;color:var(--accent);min-width:90px">/${name}</span>
      <span style="font-size:13px;color:var(--text-muted)">${cmd.desc}</span>
    </div>`).join('');
  ac.classList.remove('hidden');
};

window.insertSlashCommand = (name) => {
  const input = document.getElementById('message-input');
  const cmd = COMMANDS[name];
  // Si la commande prend des args, laisser l'utilisateur les taper
  const hasArgs = cmd.usage.includes('<');
  input.value = `/${name}${hasArgs ? ' ' : ''}`;
  input.focus();
  closeSlashAutocomplete();
};

window.closeSlashAutocomplete = () => {
  document.getElementById('slash-autocomplete')?.classList.add('hidden');
};

// Hook sur l'input du message pour les commandes slash
document.addEventListener('DOMContentLoaded', () => {
  const input = document.getElementById('message-input');
  if (!input) return;

  // Intercept l'envoi pour les commandes
  const origSend = window.sendMessage;

  // Patch de l'input pour l'autocomplete slash
  input.addEventListener('input', () => {
    const val = input.value;
    if (val.startsWith('/') && !val.includes(' ')) {
      handleSlashAutocomplete(val);
    } else {
      closeSlashAutocomplete();
    }
  });
});

// Override sendMessage pour intercepter les /commandes
document.addEventListener('DOMContentLoaded', () => {
  const sendBtn = document.getElementById('send-btn');
  const input   = document.getElementById('message-input');
  if (!sendBtn || !input) return;

  // On wrappe l'event keydown existant
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      const val = input.value.trim();
      if (val.startsWith('/')) {
        e.stopImmediatePropagation();
        e.preventDefault();
        if (handleSlashCommand(val)) {
          input.value = '';
          input.style.height = 'auto';
        }
      }
    }
  }, true); // capture = true pour passer avant chat.js
});
