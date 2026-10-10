const express = require('express');
const path = require('path');
const sessionManager = require('./sessionManager');
const telegramBot = require('./telegramBot');
const { getSettings, updateSettings } = require('./settings');
const { ASCII_STYLES } = require('./asciiStyles');

function setupWebServer(app) {
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Helper auth check middleware
  const requireAdminAuth = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const sessionCookie = req.headers['cookie'] || '';
    const settings = getSettings();
    const currentPass = settings.adminPassword || 'admin123';

    let token = '';
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    } else if (sessionCookie.includes('admin_token=')) {
      token = sessionCookie.split('admin_token=')[1]?.split(';')[0];
    }

    if (token === Buffer.from(currentPass).toString('base64')) {
      return next();
    }
    return res.status(401).json({ error: 'Accès administrateur non autorisé.' });
  };

  // API: Public Pairing Code
  app.post('/api/pair', async (req, res) => {
    try {
      const { phoneNumber } = req.body;
      if (!phoneNumber) {
        return res.status(400).json({ error: 'Veuillez saisir votre numéro de téléphone.' });
      }
      const result = await sessionManager.requestPairing(phoneNumber);
      return res.json(result);
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  });

  // API: Public stats
  app.get('/api/stats', (req, res) => {
    const settings = getSettings();
    const sessions = sessionManager.getAllSessions();
    res.json({
      botName: settings.botName,
      ownerNumber: settings.ownerNumber,
      ownerName: settings.ownerName,
      activeSessions: sessions.length,
      maxSessions: settings.maxSessions || 50,
      uptime: process.uptime(),
      telegramActive: telegramBot.isRunning
    });
  });

  // API: Admin Login
  app.post('/api/admin/login', (req, res) => {
    const { password } = req.body;
    const settings = getSettings();
    if (password === (settings.adminPassword || 'admin123')) {
      const token = Buffer.from(password).toString('base64');
      res.setHeader('Set-Cookie', `admin_token=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=86400`);
      return res.json({ success: true, token });
    }
    return res.status(401).json({ error: 'Mot de passe administrateur incorrect.' });
  });

  // API: Admin Settings
  app.get('/api/admin/settings', requireAdminAuth, (req, res) => {
    const settings = getSettings();
    res.json({ ...settings, adminPassword: '***' });
  });

  app.post('/api/admin/settings', requireAdminAuth, (req, res) => {
    const payload = req.body;
    // Don't overwrite password with stars
    if (payload.adminPassword === '***') {
      delete payload.adminPassword;
    }
    const updated = updateSettings(payload);
    
    // Update telegram bot status if token changed
    if (payload.telegramToken !== undefined) {
      if (payload.telegramToken && payload.telegramToken.trim()) {
        telegramBot.start(payload.telegramToken);
      } else {
        telegramBot.stop();
      }
    }

    res.json({ success: true, settings: { ...updated, adminPassword: '***' } });
  });

  // API: Admin Custom Command Management
  app.post('/api/admin/command/save', requireAdminAuth, (req, res) => {
    const { name, category, description, replyText, scriptCode, enabled } = req.body;
    if (!name) return res.status(400).json({ error: 'Le nom de commande est requis.' });

    const settings = getSettings();
    const current = settings.customCommands || [];
    const filtered = current.filter(c => c.name.toLowerCase() !== name.toLowerCase());
    filtered.push({
      name: name.toLowerCase().replace(/[^a-z0-9_]/g, ''),
      category: category || 'Général',
      description: description || '',
      replyText: replyText || '',
      scriptCode: scriptCode || '',
      enabled: enabled !== false
    });
    updateSettings({ customCommands: filtered });
    res.json({ success: true, commands: filtered });
  });

  app.post('/api/admin/command/delete', requireAdminAuth, (req, res) => {
    const { name } = req.body;
    const settings = getSettings();
    const current = settings.customCommands || [];
    const filtered = current.filter(c => c.name.toLowerCase() !== name.toLowerCase());
    updateSettings({ customCommands: filtered });
    res.json({ success: true, commands: filtered });
  });

  // API: Admin Sessions List
  app.get('/api/admin/sessions', requireAdminAuth, (req, res) => {
    const sessions = sessionManager.getAllSessions();
    res.json({ sessions });
  });

  app.post('/api/admin/session/delete', requireAdminAuth, (req, res) => {
    const { id } = req.body;
    sessionManager.deleteSession(id);
    res.json({ success: true });
  });

  // Web HTML Page (Public + Admin single-page full modern UI)
  app.get(['/', '/admin'], (req, res) => {
    const settings = getSettings();
    res.send(renderHtmlApp(settings));
  });
}

function renderHtmlApp(settings) {
  return `<!DOCTYPE html>
<html lang="fr" class="dark">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${settings.botName || 'CHRIST-X-MD'} - WhatsApp Multi-Device & Cloud Portal</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
  <script>
    tailwind.config = {
      darkMode: 'class',
      theme: {
        extend: {
          colors: {
            brand: { 500: '#10b981', 600: '#059669', 700: '#047857' }
          }
        }
      }
    }
  </script>
  <style>
    body { background: radial-gradient(circle at top, #111827 0%, #030712 100%); min-height: 100vh; }
    .glass { background: rgba(17, 24, 39, 0.7); backdrop-filter: blur(12px); border: 1px solid rgba(255, 255, 255, 0.08); }
    .glass-card { background: rgba(31, 41, 55, 0.6); backdrop-filter: blur(8px); border: 1px solid rgba(255, 255, 255, 0.06); }
    pre { font-family: 'Courier New', Courier, monospace; }
  </style>
</head>
<body class="text-gray-100 flex flex-col justify-between min-h-screen">

  <!-- Header -->
  <header class="glass sticky top-0 z-50 border-b border-gray-800 px-6 py-4">
    <div class="max-w-7xl mx-auto flex items-center justify-between">
      <div class="flex items-center space-x-3">
        <div class="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-500 to-cyan-500 flex items-center justify-center text-white font-bold text-xl shadow-lg shadow-emerald-500/20">
          ⚡
        </div>
        <div>
          <h1 class="text-xl font-black tracking-wider bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
            ${settings.botName || 'CHRIST-X-MD'}
          </h1>
          <p class="text-xs text-gray-400 font-mono">By ${settings.ownerName || 'Christ Foreign'} • Multi-Device v1.0</p>
        </div>
      </div>

      <div class="flex items-center space-x-4">
        <a href="https://github.com/Christforeign/MR-CHRIST-X-BOT-MD-V1" target="_blank" class="hidden sm:flex items-center space-x-2 text-xs font-semibold px-3 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-200 transition">
          <i class="fab fa-github text-sm"></i>
          <span>GitHub</span>
        </a>
        <button onclick="toggleAdminModal()" class="flex items-center space-x-2 text-xs font-bold px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/30 transition">
          <i class="fas fa-lock text-xs"></i>
          <span>Admin Portal</span>
        </button>
      </div>
    </div>
  </header>

  <!-- Main Container -->
  <main class="max-w-7xl mx-auto px-4 sm:px-6 py-8 flex-grow w-full">

    <!-- Hero / Pairing Section -->
    <div class="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start mb-12">

      <!-- Left: Public Pairing Portal -->
      <div class="lg:col-span-7 space-y-6">
        <div class="glass p-6 sm:p-8 rounded-3xl shadow-2xl relative overflow-hidden">
          <div class="absolute -right-16 -top-16 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none"></div>

          <div class="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 text-xs font-bold mb-4">
            <span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>Supporte jusqu'à 50 logins simultanés</span>
          </div>

          <h2 class="text-3xl sm:text-4xl font-extrabold text-white tracking-tight mb-3">
            Connecte ton WhatsApp en <span class="text-emerald-400">1 Clic</span>
          </h2>
          <p class="text-gray-400 text-sm leading-relaxed mb-6">
            Obtiens ton code de liaison officiel sans scanner de code QR. Entre simplement ton numéro de téléphone avec l'indicatif de ton pays.
          </p>

          <!-- Pairing Form -->
          <form id="pairForm" onsubmit="handleGetPairingCode(event)" class="space-y-4">
            <div>
              <label class="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">
                Numéro WhatsApp (avec indicatif pays)
              </label>
              <div class="relative">
                <span class="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-base">📞</span>
                <input 
                  type="text" 
                  id="phoneInput" 
                  placeholder="Ex: 50937081286 ou 33612345678" 
                  class="w-full pl-12 pr-4 py-3.5 bg-gray-900/80 border border-gray-700 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 rounded-xl text-white placeholder-gray-500 text-base font-mono outline-none transition"
                  required
                />
              </div>
            </div>

            <button 
              type="submit" 
              id="pairSubmitBtn"
              class="w-full py-4 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-extrabold text-base tracking-wide shadow-lg shadow-emerald-500/25 flex items-center justify-center space-x-2 transition transform active:scale-[0.99]"
            >
              <i class="fas fa-qrcode text-lg"></i>
              <span>Obtenir mon Pairing Code</span>
            </button>
          </form>

          <!-- Result Area -->
          <div id="pairResult" class="hidden mt-6 p-6 rounded-2xl bg-gray-900 border border-emerald-500/30 text-center animate-fade-in">
            <p class="text-xs uppercase font-extrabold tracking-widest text-emerald-400 mb-2">Ton code de liaison officiel</p>
            <div class="flex items-center justify-center space-x-3 my-3">
              <span id="codeDisplay" class="text-3xl sm:text-4xl font-black font-mono tracking-widest text-white px-4 py-2 bg-black/60 rounded-xl border border-gray-700 select-all">
                ----
              </span>
              <button onclick="copyCode()" class="p-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl transition" title="Copier le code">
                <i class="fas fa-copy text-lg"></i>
              </button>
            </div>
            <p class="text-xs text-gray-400 mt-2">
              👉 Ouvre <b>WhatsApp</b> > <b>Appareils connectés</b> > <b>Associer avec un numéro</b> et entre ce code.
            </p>
          </div>

          <div id="pairError" class="hidden mt-4 p-4 rounded-xl bg-red-900/40 border border-red-500/30 text-red-300 text-sm"></div>
        </div>
      </div>

      <!-- Right: Real-time Stats & Live ASCII Style -->
      <div class="lg:col-span-5 space-y-6">
        <!-- Live System Card -->
        <div class="glass p-6 rounded-3xl">
          <h3 class="text-sm font-bold uppercase tracking-wider text-gray-400 mb-4 flex items-center justify-between">
            <span>Statut du Système</span>
            <span class="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping"></span>
          </h3>

          <div class="grid grid-cols-2 gap-4">
            <div class="glass-card p-4 rounded-2xl">
              <div class="text-gray-400 text-xs mb-1">Owner Contact</div>
              <div class="text-white font-mono font-bold text-sm">+${settings.ownerNumber || '50937081286'}</div>
            </div>
            <div class="glass-card p-4 rounded-2xl">
              <div class="text-gray-400 text-xs mb-1">Sessions Actives</div>
              <div class="text-emerald-400 font-mono font-bold text-sm" id="statSessionsCount">1 / 50</div>
            </div>
            <div class="glass-card p-4 rounded-2xl">
              <div class="text-gray-400 text-xs mb-1">Mode Média Menu</div>
              <div class="text-cyan-400 font-bold text-sm uppercase">${settings.menuMediaType || 'both'}</div>
            </div>
            <div class="glass-card p-4 rounded-2xl">
              <div class="text-gray-400 text-xs mb-1">Langues</div>
              <div class="text-yellow-400 font-bold text-sm">FR • EN • ES • HT</div>
            </div>
          </div>

          <!-- ASCII Preview -->
          <div class="mt-6">
            <div class="flex items-center justify-between text-xs text-gray-400 mb-2">
              <span class="font-bold uppercase tracking-wider">Aperçu Banderole ASCII</span>
              <span class="px-2 py-0.5 rounded bg-gray-800 text-gray-300 font-mono text-[10px] uppercase">${settings.asciiStyle || 'cyber'}</span>
            </div>
            <div class="bg-black/80 rounded-2xl p-4 border border-gray-800 overflow-x-auto text-[10px] text-emerald-400 font-mono leading-none select-none">
              <pre>${ASCII_STYLES[settings.asciiStyle] || ASCII_STYLES.cyber}</pre>
            </div>
          </div>
        </div>

        <!-- Telegram Quick Connect -->
        <div class="glass p-6 rounded-3xl border-l-4 border-l-cyan-500 flex items-center justify-between">
          <div class="flex items-center space-x-4">
            <div class="w-12 h-12 rounded-2xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center text-2xl">
              <i class="fab fa-telegram"></i>
            </div>
            <div>
              <h4 class="font-bold text-white text-sm">Bot Telegram Intégré</h4>
              <p class="text-xs text-gray-400">Connecte-toi depuis le web ou directement sur Telegram</p>
            </div>
          </div>
          <span class="px-3 py-1 rounded-full text-xs font-bold ${telegramBot.isRunning ? 'bg-emerald-500/20 text-emerald-400' : 'bg-gray-800 text-gray-400'}">
            ${telegramBot.isRunning ? 'Actif' : 'Configurable'}
          </span>
        </div>
      </div>
    </div>

    <!-- Deployment Platforms Section (8 Services) -->
    <div class="mt-12">
      <div class="mb-6 flex flex-col sm:flex-row sm:items-end justify-between">
        <div>
          <h3 class="text-2xl font-black text-white">Centre de Déploiement Polyvalent</h3>
          <p class="text-gray-400 text-sm">Compatible avec plus de 8 services d'hébergement gratuits et 24/7</p>
        </div>
        <span class="text-xs text-emerald-400 font-mono mt-2 sm:mt-0 font-bold">1-Click Ready</span>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <!-- 1. Render -->
        <div class="glass p-5 rounded-2xl hover:border-emerald-500/50 transition">
          <div class="flex items-center space-x-3 mb-3">
            <div class="w-9 h-9 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center font-bold">R</div>
            <div>
              <h4 class="font-bold text-white text-sm">Render.com</h4>
              <p class="text-[11px] text-gray-400">Sync 100% GitHub 24/7</p>
            </div>
          </div>
          <p class="text-xs text-gray-400 mb-3">Connecte ton repo GitHub et déploie en 1 clic grâce à <code>render.yaml</code>.</p>
          <span class="text-[11px] text-emerald-400 font-mono">Fichier: render.yaml</span>
        </div>

        <!-- 2. Koyeb -->
        <div class="glass p-5 rounded-2xl hover:border-emerald-500/50 transition">
          <div class="flex items-center space-x-3 mb-3">
            <div class="w-9 h-9 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center font-bold">K</div>
            <div>
              <h4 class="font-bold text-white text-sm">Koyeb.com</h4>
              <p class="text-[11px] text-gray-400">Conteneur Docker gratuit</p>
            </div>
          </div>
          <p class="text-xs text-gray-400 mb-3">Tourne en continu avec support automatique des WebSockets Baileys.</p>
          <span class="text-[11px] text-emerald-400 font-mono">Fichier: Dockerfile</span>
        </div>

        <!-- 3. Railway -->
        <div class="glass p-5 rounded-2xl hover:border-emerald-500/50 transition">
          <div class="flex items-center space-x-3 mb-3">
            <div class="w-9 h-9 rounded-xl bg-pink-500/20 text-pink-400 flex items-center justify-center font-bold">🚂</div>
            <div>
              <h4 class="font-bold text-white text-sm">Railway.app</h4>
              <p class="text-[11px] text-gray-400">Déploiement instantané</p>
            </div>
          </div>
          <p class="text-xs text-gray-400 mb-3">Détection Node.js native, port 3000 automatique sans configuration.</p>
          <span class="text-[11px] text-emerald-400 font-mono">Fichier: railway.json</span>
        </div>

        <!-- 4. Katabump / Bot-Hosting -->
        <div class="glass p-5 rounded-2xl hover:border-emerald-500/50 transition">
          <div class="flex items-center space-x-3 mb-3">
            <div class="w-9 h-9 rounded-xl bg-green-500/20 text-green-400 flex items-center justify-center font-bold">📦</div>
            <div>
              <h4 class="font-bold text-white text-sm">Katabump / Panel</h4>
              <p class="text-[11px] text-gray-400">Envoi ZIP Direct</p>
            </div>
          </div>
          <p class="text-xs text-gray-400 mb-3">Zip prêt à l'emploi pour les serveurs Pterodactyl / Bot-Hosting.</p>
          <span class="text-[11px] text-emerald-400 font-mono">Fichier: Procfile</span>
        </div>

        <!-- 5. Oracle Cloud -->
        <div class="glass p-5 rounded-2xl hover:border-emerald-500/50 transition">
          <div class="flex items-center space-x-3 mb-3">
            <div class="w-9 h-9 rounded-xl bg-red-500/20 text-red-400 flex items-center justify-center font-bold">☁️</div>
            <div>
              <h4 class="font-bold text-white text-sm">Oracle Cloud Free</h4>
              <p class="text-[11px] text-gray-400">VPS 24/7 Gratuit à vie</p>
            </div>
          </div>
          <p class="text-xs text-gray-400 mb-3">Jusqu'à 4 vCPU et 24 Go RAM. Aucun arrêt, idéal pour 50 sessions.</p>
          <span class="text-[11px] text-emerald-400 font-mono">Guide inclus</span>
        </div>

        <!-- 6. Fly.io -->
        <div class="glass p-5 rounded-2xl hover:border-emerald-500/50 transition">
          <div class="flex items-center space-x-3 mb-3">
            <div class="w-9 h-9 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center font-bold">🪰</div>
            <div>
              <h4 class="font-bold text-white text-sm">Fly.io</h4>
              <p class="text-[11px] text-gray-400">App Edge mondiale</p>
            </div>
          </div>
          <p class="text-xs text-gray-400 mb-3">Déploiement en 1 commande <code>fly launch</code> avec configuration automatique.</p>
          <span class="text-[11px] text-emerald-400 font-mono">Fichier: fly.toml</span>
        </div>

        <!-- 7. Heroku / Okteto -->
        <div class="glass p-5 rounded-2xl hover:border-emerald-500/50 transition">
          <div class="flex items-center space-x-3 mb-3">
            <div class="w-9 h-9 rounded-xl bg-violet-500/20 text-violet-400 flex items-center justify-center font-bold">⚡</div>
            <div>
              <h4 class="font-bold text-white text-sm">Heroku / Docker</h4>
              <p class="text-[11px] text-gray-400">Buildpack Node.js</p>
            </div>
          </div>
          <p class="text-xs text-gray-400 mb-3">Compatible Procfile <code>web: npm start</code> avec dynos standard.</p>
          <span class="text-[11px] text-emerald-400 font-mono">Fichier: Procfile</span>
        </div>

        <!-- 8. Termux Android -->
        <div class="glass p-5 rounded-2xl hover:border-emerald-500/50 transition">
          <div class="flex items-center space-x-3 mb-3">
            <div class="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold">📱</div>
            <div>
              <h4 class="font-bold text-white text-sm">Termux / Android</h4>
              <p class="text-[11px] text-gray-400">Hébergement sur téléphone</p>
            </div>
          </div>
          <p class="text-xs text-gray-400 mb-3">Fais tourner le bot directement sur ton smartphone 24/7 avec PM2.</p>
          <span class="text-[11px] text-emerald-400 font-mono">Script: termux.sh</span>
        </div>
      </div>
    </div>
  </main>

  <!-- Footer -->
  <footer class="glass border-t border-gray-800 py-6 px-6 text-center text-xs text-gray-400">
    <p>© 2026 <b>${settings.botName || 'CHRIST-X-MD'}</b> • Créé avec ❤️ par <b>${settings.ownerName || 'Christ Foreign'}</b> (+${settings.ownerNumber || '50937081286'})</p>
  </footer>

  <!-- Admin Modal -->
  <div id="adminModal" class="fixed inset-0 z-50 bg-black/80 backdrop-blur-md hidden flex items-center justify-center p-4">
    <div class="bg-gray-900 border border-gray-700 w-full max-w-4xl max-h-[90vh] rounded-3xl overflow-hidden flex flex-col shadow-2xl">
      
      <!-- Modal Header -->
      <div class="p-6 border-b border-gray-800 flex items-center justify-between">
        <div class="flex items-center space-x-3">
          <div class="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-lg">
            <i class="fas fa-sliders-h"></i>
          </div>
          <div>
            <h3 class="font-black text-lg text-white">Panneau d'Administration en Direct</h3>
            <p class="text-xs text-gray-400">Configuration en temps réel sans toucher au code</p>
          </div>
        </div>
        <button onclick="toggleAdminModal()" class="text-gray-400 hover:text-white p-2">
          <i class="fas fa-times text-lg"></i>
        </button>
      </div>

      <!-- Login View -->
      <div id="adminLoginView" class="p-8 text-center max-w-md mx-auto w-full my-auto">
        <div class="w-16 h-16 rounded-2xl bg-emerald-500/10 text-emerald-400 mx-auto flex items-center justify-center text-2xl mb-4">
          <i class="fas fa-shield-alt"></i>
        </div>
        <h4 class="text-xl font-bold text-white mb-2">Authentification Requise</h4>
        <p class="text-xs text-gray-400 mb-6">Entre le mot de passe d'administration (par défaut : <code>admin123</code>)</p>

        <form onsubmit="handleAdminLogin(event)" class="space-y-4">
          <input 
            type="password" 
            id="adminPassInput" 
            placeholder="Mot de passe admin" 
            class="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white outline-none focus:border-emerald-500" 
            required
          />
          <button type="submit" class="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl shadow-lg transition">
            Connexion au Dashboard
          </button>
          <div id="adminLoginError" class="text-xs text-red-400 hidden"></div>
        </form>
      </div>

      <!-- Dashboard View (Shown after login) -->
      <div id="adminDashboardView" class="hidden flex-grow overflow-hidden flex flex-col">
        <!-- Tabs Nav -->
        <div class="flex border-b border-gray-800 px-6 overflow-x-auto text-xs font-bold">
          <button onclick="switchTab('general')" id="tabBtn-general" class="px-4 py-3 border-b-2 border-emerald-500 text-emerald-400 whitespace-nowrap">Général & Identité</button>
          <button onclick="switchTab('appearance')" id="tabBtn-appearance" class="px-4 py-3 border-b-2 border-transparent text-gray-400 hover:text-white whitespace-nowrap">Menu & Médias (Vidéo/Photo)</button>
          <button onclick="switchTab('commands')" id="tabBtn-commands" class="px-4 py-3 border-b-2 border-transparent text-gray-400 hover:text-white whitespace-nowrap">Commandes & Scripts en Direct</button>
          <button onclick="switchTab('sessions')" id="tabBtn-sessions" class="px-4 py-3 border-b-2 border-transparent text-gray-400 hover:text-white whitespace-nowrap">Multi-Sessions (50 Logins)</button>
          <button onclick="switchTab('telegram')" id="tabBtn-telegram" class="px-4 py-3 border-b-2 border-transparent text-gray-400 hover:text-white whitespace-nowrap">Bot Telegram</button>
        </div>

        <!-- Tab Contents -->
        <div class="p-6 overflow-y-auto flex-grow space-y-6 text-sm">
          
          <!-- TAB 1: General -->
          <div id="tab-general" class="space-y-4">
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label class="block text-xs font-bold text-gray-400 mb-1">Nom du Bot</label>
                <input type="text" id="cfg-botName" class="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white" />
              </div>
              <div>
                <label class="block text-xs font-bold text-gray-400 mb-1">Numéro du Propriétaire (Owner)</label>
                <input type="text" id="cfg-ownerNumber" class="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white" />
              </div>
              <div>
                <label class="block text-xs font-bold text-gray-400 mb-1">Nom du Propriétaire</label>
                <input type="text" id="cfg-ownerName" class="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white" />
              </div>
              <div>
                <label class="block text-xs font-bold text-gray-400 mb-1">Préfixe principal</label>
                <input type="text" id="cfg-prefix" class="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white" />
              </div>
              <div>
                <label class="block text-xs font-bold text-gray-400 mb-1">Langue par défaut</label>
                <select id="cfg-defaultLang" class="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white">
                  <option value="fr">Français (FR) 🇫🇷</option>
                  <option value="en">English (EN) 🇬🇧</option>
                  <option value="es">Español (ES) 🇪🇸</option>
                  <option value="ht">Kreyòl Ayisyen (HT) 🇭🇹</option>
                </select>
              </div>
              <div>
                <label class="block text-xs font-bold text-gray-400 mb-1">Mode d'accès</label>
                <select id="cfg-mode" class="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white">
                  <option value="public">Public (Tout le monde)</option>
                  <option value="private">Privé (Owner uniquement)</option>
                </select>
              </div>
              <div class="sm:col-span-2">
                <label class="block text-xs font-bold text-gray-400 mb-1">Changer le Mot de passe Admin</label>
                <input type="text" id="cfg-adminPassword" placeholder="Laisse vide pour ne pas changer" class="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white" />
              </div>
            </div>
            <button onclick="saveGeneralSettings()" class="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg transition">
              Enregistrer les modifications
            </button>
          </div>

          <!-- TAB 2: Appearance & Menu Media -->
          <div id="tab-appearance" class="space-y-4 hidden">
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label class="block text-xs font-bold text-gray-400 mb-1">Type de Média pour le .menu</label>
                <select id="cfg-menuMediaType" class="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white">
                  <option value="both">Les 2 (Aléatoire Photo & Vidéo) 🎬</option>
                  <option value="video">Vidéo Uniquement 🎥</option>
                  <option value="image">Photo Uniquement 🖼️</option>
                </select>
              </div>
              <div>
                <label class="block text-xs font-bold text-gray-400 mb-1">Style de Banderole ASCII</label>
                <select id="cfg-asciiStyle" class="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white">
                  <option value="cyber">Cyber Modern</option>
                  <option value="classic">Classic Boxed</option>
                  <option value="gothic">Gothic Bold</option>
                  <option value="neon">Neon Block</option>
                </select>
              </div>
              <div class="sm:col-span-2">
                <label class="block text-xs font-bold text-gray-400 mb-1">URLs d'Images (1 par ligne)</label>
                <textarea id="cfg-menuImages" rows="3" class="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white font-mono text-xs"></textarea>
              </div>
              <div class="sm:col-span-2">
                <label class="block text-xs font-bold text-gray-400 mb-1">URLs de Vidéos (1 par ligne - MP4)</label>
                <textarea id="cfg-menuVideos" rows="3" class="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white font-mono text-xs"></textarea>
              </div>
              <div class="sm:col-span-2">
                <label class="block text-xs font-bold text-gray-400 mb-1">Banderole ASCII Personnalisée (Optionnel)</label>
                <textarea id="cfg-customAscii" rows="4" placeholder="Colle ton propre ASCII art ici si désiré..." class="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white font-mono text-xs"></textarea>
              </div>
            </div>
            <button onclick="saveAppearanceSettings()" class="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg transition">
              Enregistrer l'Apparence
            </button>
          </div>

          <!-- TAB 3: Commands & Scripts -->
          <div id="tab-commands" class="space-y-6 hidden">
            <!-- Add Command Form -->
            <div class="glass-card p-4 rounded-xl border border-gray-700 space-y-3">
              <h5 class="font-bold text-white text-xs uppercase">Ajouter ou Modifier une Commande en Direct</h5>
              <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <input type="text" id="cmd-name" placeholder="Nom (ex: regles)" class="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-xs" />
                <input type="text" id="cmd-category" placeholder="Catégorie (ex: Infos)" class="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-xs" />
                <input type="text" id="cmd-desc" placeholder="Description courte" class="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-xs" />
              </div>
              <div>
                <label class="block text-[11px] font-bold text-gray-400 mb-1">Réponse Texte Simple</label>
                <textarea id="cmd-reply" rows="2" placeholder="Texte envoyé en réponse..." class="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-xs"></textarea>
              </div>
              <div>
                <label class="block text-[11px] font-bold text-gray-400 mb-1">OU Script JS Personnalisé (Avancé - variables: sock, m, args, text)</label>
                <textarea id="cmd-script" rows="3" placeholder="// Ex: await m.reply('Message dynamique: ' + text);" class="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white font-mono text-xs"></textarea>
              </div>
              <button onclick="saveCustomCommand()" class="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-lg transition">
                Sauvegarder la Commande
              </button>
            </div>

            <!-- Custom Commands List -->
            <div>
              <h5 class="font-bold text-white text-xs uppercase mb-3">Commandes Personnalisées Existantes</h5>
              <div id="customCommandsList" class="space-y-2"></div>
            </div>
          </div>

          <!-- TAB 4: Sessions (50 Logins) -->
          <div id="tab-sessions" class="space-y-4 hidden">
            <div class="flex items-center justify-between">
              <div>
                <h5 class="font-bold text-white">Gestionnaire des 50 Connexions WhatsApp</h5>
                <p class="text-xs text-gray-400">Chaque utilisateur peut connecter son propre numéro</p>
              </div>
              <button onclick="loadAdminSessions()" class="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-xs font-bold text-white rounded-lg transition">
                <i class="fas fa-sync-alt mr-1"></i> Actualiser
              </button>
            </div>
            <div id="sessionsTableContainer" class="overflow-x-auto">
              <!-- Rendered table -->
            </div>
          </div>

          <!-- TAB 5: Telegram Bot -->
          <div id="tab-telegram" class="space-y-4 hidden">
            <div class="glass-card p-5 rounded-2xl border border-gray-700 space-y-4">
              <h5 class="font-bold text-white flex items-center space-x-2">
                <i class="fab fa-telegram text-cyan-400 text-lg"></i>
                <span>Configuration du Bot Telegram</span>
              </h5>
              <p class="text-xs text-gray-400">
                Crée un bot sur Telegram via <b>@BotFather</b> et colle son Token HTTP ci-dessous. Dès que tu enregistres, le bot Telegram démarre immédiatement !
              </p>
              <div>
                <label class="block text-xs font-bold text-gray-400 mb-1">Token Telegram Bot</label>
                <input type="text" id="cfg-telegramToken" placeholder="Ex: 7123456789:AAHk..._xyz" class="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white font-mono text-xs" />
              </div>
              <button onclick="saveTelegramSettings()" class="px-6 py-2.5 bg-cyan-600 hover:bg-cyan-500 text-white font-bold rounded-lg transition">
                Activer / Mettre à jour le Bot Telegram
              </button>
            </div>
          </div>

        </div>
      </div>
    </div>
  </div>

  <!-- Scripts -->
  <script>
    let adminToken = '';
    let currentSettings = {};

    async function handleGetPairingCode(e) {
      e.preventDefault();
      const phoneInput = document.getElementById('phoneInput');
      const submitBtn = document.getElementById('pairSubmitBtn');
      const resultArea = document.getElementById('pairResult');
      const errorArea = document.getElementById('pairError');
      const codeDisplay = document.getElementById('codeDisplay');

      resultArea.classList.add('hidden');
      errorArea.classList.add('hidden');
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i> Génération du code en cours...';

      try {
        const res = await fetch('/api/pair', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phoneNumber: phoneInput.value })
        });
        const data = await res.json();

        if (res.ok && data.success) {
          codeDisplay.innerText = data.pairingCode;
          resultArea.classList.remove('hidden');
        } else {
          errorArea.innerText = data.error || 'Erreur lors de la génération du code.';
          errorArea.classList.remove('hidden');
        }
      } catch (err) {
        errorArea.innerText = 'Erreur réseau : ' + err.message;
        errorArea.classList.remove('hidden');
      } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i class="fas fa-qrcode text-lg mr-2"></i> Obtenir mon Pairing Code';
      }
    }

    function copyCode() {
      const code = document.getElementById('codeDisplay').innerText;
      navigator.clipboard.writeText(code);
      alert('Code copié : ' + code);
    }

    function toggleAdminModal() {
      const modal = document.getElementById('adminModal');
      modal.classList.toggle('hidden');
    }

    async function handleAdminLogin(e) {
      e.preventDefault();
      const pass = document.getElementById('adminPassInput').value;
      const err = document.getElementById('adminLoginError');
      err.classList.add('hidden');

      try {
        const res = await fetch('/api/admin/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password: pass })
        });
        const data = await res.json();
        if (res.ok && data.success) {
          adminToken = data.token;
          document.getElementById('adminLoginView').classList.add('hidden');
          document.getElementById('adminDashboardView').classList.remove('hidden');
          loadAdminSettings();
        } else {
          err.innerText = data.error || 'Mot de passe erroné';
          err.classList.remove('hidden');
        }
      } catch (e) {
        err.innerText = e.message;
        err.classList.remove('hidden');
      }
    }

    function switchTab(tab) {
      ['general', 'appearance', 'commands', 'sessions', 'telegram'].forEach(t => {
        document.getElementById('tab-' + t).classList.add('hidden');
        const btn = document.getElementById('tabBtn-' + t);
        btn.classList.remove('border-emerald-500', 'text-emerald-400');
        btn.classList.add('border-transparent', 'text-gray-400');
      });
      document.getElementById('tab-' + tab).classList.remove('hidden');
      const activeBtn = document.getElementById('tabBtn-' + tab);
      activeBtn.classList.add('border-emerald-500', 'text-emerald-400');
      activeBtn.classList.remove('border-transparent', 'text-gray-400');

      if (tab === 'sessions') loadAdminSessions();
    }

    async function loadAdminSettings() {
      try {
        const res = await fetch('/api/admin/settings', {
          headers: { 'Authorization': 'Bearer ' + adminToken }
        });
        const data = await res.json();
        currentSettings = data;

        document.getElementById('cfg-botName').value = data.botName || '';
        document.getElementById('cfg-ownerNumber').value = data.ownerNumber || '';
        document.getElementById('cfg-ownerName').value = data.ownerName || '';
        document.getElementById('cfg-prefix').value = data.prefix || '.';
        document.getElementById('cfg-defaultLang').value = data.defaultLang || 'fr';
        document.getElementById('cfg-mode').value = data.mode || 'public';
        document.getElementById('cfg-menuMediaType').value = data.menuMediaType || 'both';
        document.getElementById('cfg-asciiStyle').value = data.asciiStyle || 'cyber';
        document.getElementById('cfg-menuImages').value = (data.menuImages || []).join('\\n');
        document.getElementById('cfg-menuVideos').value = (data.menuVideos || []).join('\\n');
        document.getElementById('cfg-customAscii').value = data.customAscii || '';
        document.getElementById('cfg-telegramToken').value = data.telegramToken || '';

        renderCommandsList(data.customCommands || []);
      } catch (e) {
        console.error(e);
      }
    }

    function renderCommandsList(cmds) {
      const container = document.getElementById('customCommandsList');
      if (cmds.length === 0) {
        container.innerHTML = '<p class="text-xs text-gray-500">Aucune commande personnalisée.</p>';
        return;
      }
      container.innerHTML = cmds.map(c => \`
        <div class="flex items-center justify-between p-3 rounded-lg bg-gray-800 border border-gray-700">
          <div>
            <span class="font-bold text-white font-mono text-xs">.\${c.name}</span>
            <span class="text-[10px] text-gray-400 ml-2">(\${c.category || 'Général'})</span>
            <p class="text-[11px] text-gray-300 truncate max-w-xs mt-0.5">\${c.replyText || 'Script JS personnalisé'}</p>
          </div>
          <button onclick="deleteCustomCommand('\${c.name}')" class="text-red-400 hover:text-red-300 p-2 text-xs">
            <i class="fas fa-trash"></i>
          </button>
        </div>
      \`).join('');
    }

    async function saveGeneralSettings() {
      const payload = {
        botName: document.getElementById('cfg-botName').value,
        ownerNumber: document.getElementById('cfg-ownerNumber').value,
        ownerName: document.getElementById('cfg-ownerName').value,
        prefix: document.getElementById('cfg-prefix').value,
        defaultLang: document.getElementById('cfg-defaultLang').value,
        mode: document.getElementById('cfg-mode').value
      };
      const pass = document.getElementById('cfg-adminPassword').value;
      if (pass.trim()) payload.adminPassword = pass.trim();

      await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + adminToken },
        body: JSON.stringify(payload)
      });
      alert('Paramètres généraux enregistrés !');
    }

    async function saveAppearanceSettings() {
      const payload = {
        menuMediaType: document.getElementById('cfg-menuMediaType').value,
        asciiStyle: document.getElementById('cfg-asciiStyle').value,
        menuImages: document.getElementById('cfg-menuImages').value.split('\\n').filter(Boolean),
        menuVideos: document.getElementById('cfg-menuVideos').value.split('\\n').filter(Boolean),
        customAscii: document.getElementById('cfg-customAscii').value
      };
      await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + adminToken },
        body: JSON.stringify(payload)
      });
      alert('Apparence du menu enregistrée !');
    }

    async function saveTelegramSettings() {
      const token = document.getElementById('cfg-telegramToken').value;
      await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + adminToken },
        body: JSON.stringify({ telegramToken: token })
      });
      alert('Bot Telegram mis à jour !');
    }

    async function saveCustomCommand() {
      const payload = {
        name: document.getElementById('cmd-name').value,
        category: document.getElementById('cmd-category').value,
        description: document.getElementById('cmd-desc').value,
        replyText: document.getElementById('cmd-reply').value,
        scriptCode: document.getElementById('cmd-script').value
      };
      const res = await fetch('/api/admin/command/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + adminToken },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success) {
        renderCommandsList(data.commands);
        document.getElementById('cmd-name').value = '';
        document.getElementById('cmd-reply').value = '';
        document.getElementById('cmd-script').value = '';
        alert('Commande sauvegardée !');
      }
    }

    async function deleteCustomCommand(name) {
      if (!confirm('Supprimer la commande .' + name + ' ?')) return;
      const res = await fetch('/api/admin/command/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + adminToken },
        body: JSON.stringify({ name })
      });
      const data = await res.json();
      if (data.success) renderCommandsList(data.commands);
    }

    async function loadAdminSessions() {
      const container = document.getElementById('sessionsTableContainer');
      container.innerHTML = '<p class="text-xs text-gray-400">Chargement des sessions...</p>';
      const res = await fetch('/api/admin/sessions', {
        headers: { 'Authorization': 'Bearer ' + adminToken }
      });
      const data = await res.json();
      const sessions = data.sessions || [];

      container.innerHTML = \`
        <table class="w-full text-left text-xs border border-gray-800 rounded-xl overflow-hidden">
          <thead class="bg-gray-800 text-gray-400">
            <tr>
              <th class="p-3">Numéro</th>
              <th class="p-3">Statut</th>
              <th class="p-3">Type</th>
              <th class="p-3">Action</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-800">
            \${sessions.map(s => \`
              <tr class="hover:bg-gray-800/50">
                <td class="p-3 font-mono font-bold text-white">+\${s.phoneNumber}</td>
                <td class="p-3">
                  <span class="px-2 py-0.5 rounded text-[10px] font-bold \${s.status === 'connected' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-yellow-500/20 text-yellow-400'}">
                    \${s.status}
                  </span>
                </td>
                <td class="p-3 text-gray-400">\${s.isPrimary ? 'Principal (Owner)' : 'Multi-Client'}</td>
                <td class="p-3">
                  \${!s.isPrimary ? \`<button onclick="deleteSession('\${s.id}')" class="text-red-400 hover:text-red-300 font-bold">Déconnecter</button>\` : '-'}
                </td>
              </tr>
            \`).join('')}
          </tbody>
        </table>
      \`;
    }

    async function deleteSession(id) {
      if (!confirm('Déconnecter cette session ?')) return;
      await fetch('/api/admin/session/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + adminToken },
        body: JSON.stringify({ id })
      });
      loadAdminSessions();
    }
  </script>
</body>
</html>`;
}

module.exports = {
  setupWebServer
};
