# Lessons apprises

## Format : [date] | ce qui a mal tourné | règle pour l'éviter

2025-01 | Les sockets dans server/socket/ utilisaient require('../../models') au lieu de require('../models') — chemin relatif incorrect car ils sont déjà dans un sous-dossier de server/ | Toujours vérifier la profondeur des chemins relatifs avec node --check avant de livrer

2025-01 | Migration MongoDB→MySQL : les IDs Sequelize sont .id (UUID string) pas ._id — côté client et serveur, utiliser .id partout | Après toute migration ORM, grep ._id dans tout le codebase

2025-01 | Les IDs créés dynamiquement (getElementById sur des éléments créés par JS) déclenchent de faux positifs dans les vérifications statiques | Distinguer IDs statiques (HTML) vs dynamiques (createElement + .id = '...') avant d'alarmer

2025-01 | openDMWithUser dans ui.js appelait loadDMMessages directement au lieu de openDM — la fonction DM correcte était dans dm.js | Toujours grep les noms de fonctions avant de les appeler depuis un autre fichier
2025-01 | sequelize.sync({ alter: true }) modifie les tables en prod à chaque démarrage — risque de perte de données | Utiliser alter: false en prod, gérer les nouvelles colonnes avec un script de migration one-shot

2025-01 | CORS origin:'*' avec credentials:true — les navigateurs refusent credentials avec wildcard | Toujours définir CLIENT_URL et utiliser corsOptions avec origin function
2025-01 | Les uploads servis en static sans auth permettent l'accès à tous les fichiers par URL | Remplacer le static /uploads par une route Express avec path.basename() pour bloquer le path traversal
2025-01 | socket.on handlers sans try/catch — un payload malformé crash le handler silencieusement | Toujours wrapper chaque socket.on dans try/catch + valider data || {}

2025-01 | findSocketByUserId boucle O(n) sur tous les sockets — lent sous charge | Utiliser la Map onlineUsers (userId→socketId) déjà existante pour un lookup O(1) via socketUtils.js
2025-01 | Les system events nécessitent io dans des routes Express — pattern setIO() | Exporter setIO depuis la route et l'appeler depuis index.js après setupSocket(io)

2025-01 | Les permissions rôles étaient stockées en DB mais jamais vérifiées — purement cosmétiques | Créer un middleware permissions.js avec cache 30s, appelé dans chaque socket handler et route HTTP concernée
2025-01 | La page d'invitation redirige vers / avec ?invite= mais SPA intercepte tout — utiliser /invite/:code servi par une vraie route Express qui sert invite.html séparément | Les pages qui ne nécessitent pas le JS principal de l'app doivent avoir leur propre HTML

2025-01 | uploadAndSendImage envoyait l'URL uploadée mais ne l'incluait pas dans le contenu du message — les autres membres ne voyaient pas l'image | Inclure l'URL de l'image dans le content du message sous forme de lien direct pour que le renderContentAdvanced la détecte et l'affiche

2025-01 | renderChannelsList définie dans servers.js ET categories.js — conflit au chargement | Quand on extrait une fonction dans un nouveau fichier, la supprimer immédiatement de l'ancien
2025-01 | confirm-create-channel-btn avait deux listeners (servers.js + categories.js) — double exécution | Utiliser { once: true } ou supprimer l'ancien listener avant d'en ajouter un nouveau

2025-01 | attach-btn dans le HTML n'avait aucun listener — l'upload était impossible | Toujours vérifier que chaque bouton interactif a un handler effectif, pas seulement un id
2025-01 | drag & drop et paste images non implémentés côté client malgré la route upload existante | L'upload doit avoir 3 entrées : clic bouton, drag & drop, et paste (Ctrl+V)

2025-01 | La reconnexion socket ne re-rejoint pas les rooms guild/channel — les messages envoyés pendant la déco sont manqués | Au reconnect : émettre guilds:join + channel:join + status:set + recharger les messages
2025-01 | Voice participants non affichés dans l'UI — state local non mis à jour à l'arrivée/départ | Maintenir VoiceState.participants en sync avec les events voice:user_joined/left et re-render à chaque changement
