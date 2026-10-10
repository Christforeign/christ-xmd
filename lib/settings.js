const fs = require('fs');
const path = require('path');

const SETTINGS_FILE = path.join(__dirname, '..', 'database', 'settings.json');

const DEFAULT_SETTINGS = {
  botName: 'CHRIST-X-MD',
  ownerNumber: '50937081286',
  ownerName: 'Christ Foreign',
  repoUrl: 'https://github.com/Christforeign/MR-CHRIST-X-BOT-MD-V1',
  prefix: '.',
  prefixes: ['.', '!', '/', '#'],
  mode: 'public', // 'public' | 'private'
  defaultLang: 'fr', // 'fr' | 'en' | 'es' | 'ht'
  adminPassword: 'admin' + '123',
  themeEmoji: '⚡',
  telegramToken: '',
  menuMediaType: 'both', // 'image' | 'video' | 'both'
  menuImages: [
    'https://files.catbox.moe/nwvkbt.png',
    'https://raw.githubusercontent.com/Cyrilix-XMD/ELITEPRO-URL-CLOUD/main/20250328_045427.jpg'
  ],
  menuVideos: [
    'https://files.catbox.moe/a4hy3j.mp4'
  ],
  asciiStyle: 'cyber', // 'cyber' | 'classic' | 'gothic' | 'neon'
  customAscii: '',
  autoReact: true,
  antiLink: true,
  welcome: true,
  autoRead: false,
  autoTyping: false,
  maxSessions: 50,
  customCommands: [
    {
      name: 'hello',
      category: 'Général',
      description: 'Salutations personnalisées',
      replyText: '👋 Salut mon reuf ! CHRIST-X-MD est à ton service 24/7 ! 🚀',
      scriptCode: '',
      enabled: true
    },
    {
      name: 'support',
      category: 'Général',
      description: 'Lien du support WhatsApp & GitHub',
      replyText: '📞 *SUPPORT CHRIST-X-MD*\n\n👑 *Owner:* +50937081286\n🌐 *GitHub:* https://github.com/Christforeign/MR-CHRIST-X-BOT-MD-V1\n🚀 *Statut:* Actif 24/7',
      scriptCode: '',
      enabled: true
    }
  ]
};

function getSettings() {
  try {
    if (!fs.existsSync(SETTINGS_FILE)) {
      saveSettings(DEFAULT_SETTINGS);
      return { ...DEFAULT_SETTINGS };
    }
    const data = fs.readFileSync(SETTINGS_FILE, 'utf-8');
    const parsed = JSON.parse(data);
    return { ...DEFAULT_SETTINGS, ...parsed };
  } catch (err) {
    console.error('Erreur lecture settings.json:', err);
    return { ...DEFAULT_SETTINGS };
  }
}

function saveSettings(newSettings) {
  try {
    const dir = path.dirname(SETTINGS_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(newSettings, null, 2), 'utf-8');
    return true;
  } catch (err) {
    console.error('Erreur écriture settings.json:', err);
    return false;
  }
}

function updateSettings(partial) {
  const current = getSettings();
  const updated = { ...current, ...partial };
  saveSettings(updated);
  return updated;
}

module.exports = {
  getSettings,
  saveSettings,
  updateSettings,
  DEFAULT_SETTINGS
};
