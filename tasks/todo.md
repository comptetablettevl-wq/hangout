# Hang Out — Plan d'implémentation

## Structure finale
```
hangout/
├── client/
│   ├── index.html          # App shell + auth pages
│   ├── css/
│   │   ├── reset.css       # Reset + variables CSS
│   │   ├── layout.css      # Structure principale (sidebars, zones)
│   │   ├── components.css  # Boutons, inputs, modals, avatars
│   │   ├── chat.css        # Zone messages + input
│   │   └── theme.css       # Dark/light mode variables
│   ├── js/
│   │   ├── app.js          # Init + state global
│   │   ├── auth.js         # Login / register
│   │   ├── socket.js       # Gestion WebSocket (Socket.io client)
│   │   ├── servers.js      # Logique serveurs + channels
│   │   ├── chat.js         # Envoi/réception messages, scroll, edit/delete
│   │   ├── members.js      # Sidebar membres + statuts
│   │   ├── voice.js        # WebRTC audio channels
│   │   └── ui.js           # Modals, tooltips, notifications, theme toggle
│   └── assets/
│       └── icons/          # SVG icons inline
├── server/
│   ├── index.js            # Entry point Express + Socket.io
│   ├── config.js           # Config DB, JWT secret, ports
│   ├── models/
│   │   ├── User.js         # Schema utilisateur
│   │   ├── Server.js       # Schema serveur + channels
│   │   └── Message.js      # Schema message
│   ├── routes/
│   │   ├── auth.js         # POST /api/auth/register, /login, /me
│   │   ├── servers.js      # CRUD serveurs + channels
│   │   └── messages.js     # GET historique messages
│   ├── middleware/
│   │   └── auth.js         # Middleware JWT verify
│   └── socket/
│       ├── index.js        # Setup handlers Socket.io
│       ├── chat.js         # Events: send_message, edit, delete
│       ├── presence.js     # Events: user_join, user_leave, status_update
│       └── voice.js        # Events: voice_join, voice_leave, WebRTC signaling
├── package.json
└── .env.example

## V2 — Migration MySQL + améliorations

### Backend
- [ ] package.json — remplacer mongoose par sequelize + mysql2
- [ ] config.js — MySQL config
- [ ] db.js — Sequelize instance + sync
- [ ] models/ — réécrire en Sequelize (User, Guild, Channel, Message, Reaction, Member, DirectMessage)
- [ ] middleware/auth.js — inchangé
- [ ] middleware/rateLimiter.js — express-rate-limit
- [ ] middleware/validate.js — joi validation
- [ ] routes/auth.js — adapter Sequelize
- [ ] routes/servers.js — adapter Sequelize
- [ ] routes/messages.js — adapter + scroll infini
- [ ] routes/dm.js — NOUVEAU messages privés
- [ ] socket/chat.js — adapter + notif navigateur trigger
- [ ] socket/presence.js — adapter
- [ ] socket/voice.js — ajouter vérif membership

### Frontend
- [ ] js/socket.js — reconnexion auto
- [ ] js/chat.js — scroll infini + mentions @
- [ ] js/dm.js — NOUVEAU interface DM
- [ ] js/ui.js — sons de notif + OG preview
```

## V4 — Améliorations UX/UI

### Frontend prioritaire
- [ ] Mentions @username avec autocomplétion dans l'input
- [ ] Scroll infini (IntersectionObserver) au lieu du bouton "charger plus"
- [ ] Aperçu OG links (YouTube, Twitter, etc.)
- [ ] Sons de notification (Web Audio API, pas de fichier externe)
- [ ] Recherche de messages dans un channel (Ctrl+F)
- [ ] Profil utilisateur au clic sur un avatar (popup)
- [ ] Indicateur "non lus" sur les channels
- [ ] Catégories de channels repliables
- [ ] Drag & drop pour réordonner les channels (admin)
- [ ] Réponse rapide en survolant un message (bouton reply visible)
- [ ] Formatage markdown avancé (code block, quote >)
- [ ] Landing page avant login

### Backend
- [ ] Route GET /api/users/search pour les mentions
- [ ] Route GET /api/servers/:id/search?q= pour chercher dans les messages
- [ ] Webhook Discord-like pour les events serveur


## V5 — Sécurité & Stabilité

### Problèmes identifiés
1. CORS `origin: '*'` — accepte n'importe quelle origine
2. Pas de helmet (headers HTTP de sécurité)
3. Pas de compression gzip
4. `/uploads/*` servi sans auth — URL devinable
5. Rate limit absent sur les events socket (spam messages)
6. OG route : SSRF possible (fetch vers localhost/IPs internes)
7. Multer : extension fichier non vérifiée indépendamment du mimetype (bypass possible)
8. Pas de try/catch sur channel:join socket (crash si payload malformé)
9. trust proxy non configuré (rate limit IP faussé derrière Railway)
10. Pas de helmet CSP — XSS possible via injections dans le DOM

### Plan
- [x] Lire leçons
- [ ] npm install helmet compression
- [ ] Configurer helmet + CSP strict
- [ ] Configurer compression gzip
- [ ] Fixer CORS pour n'accepter que CLIENT_URL
- [ ] Rate limit socket (5 msg/s par user)
- [ ] Sécuriser uploads (auth + extension whitelist renforcée)
- [ ] Bloquer SSRF dans OG route (IPs privées, localhost)
- [ ] trust proxy Railway
- [ ] Hardening multer (double vérification extension + magic bytes)
- [ ] Wrapping try/catch sur tous les events socket
- [ ] Cache OG en mémoire côté serveur (TTL 1h)
- [ ] Indexes MySQL sur les colonnes fréquemment requêtées
- [ ] Vérification complète des imports

## V7 — Features & Optimisations

- [ ] Fix findSocketByUserId O(1) via onlineUsers Map
- [ ] Recherche globale FULLTEXT /api/servers/:id/search
- [ ] Threads (MessageThread model + UI)
- [ ] Événements système dans le chat (join/leave/ban)
- [ ] Historique des éditions (MessageHistory model)
- [ ] Export messages channel (JSON + CSV)
- [ ] UI: lightbox image, timestamps relatifs, hover reactions
- [ ] Route search users globale pour les mentions
