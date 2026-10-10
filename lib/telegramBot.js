const axios = require('axios');
const sessionManager = require('./sessionManager');
const { getSettings } = require('./settings');

class TelegramBotManager {
  constructor() {
    this.token = '';
    this.isRunning = false;
    this.pollingTimeout = null;
    this.lastUpdateId = 0;
  }

  start(token) {
    if (!token || token.trim().length === 0) {
      this.stop();
      return;
    }
    if (this.token === token && this.isRunning) return;

    this.token = token.trim();
    this.isRunning = true;
    console.log('[CHRIST-X-MD] Démarrage du bot Telegram...');
    this.poll();
  }

  stop() {
    this.isRunning = false;
    if (this.pollingTimeout) {
      clearTimeout(this.pollingTimeout);
      this.pollingTimeout = null;
    }
    console.log('[CHRIST-X-MD] Bot Telegram arrêté.');
  }

  async sendTelegramMessage(chatId, text, options = {}) {
    if (!this.token) return;
    try {
      await axios.post(`https://api.telegram.org/bot${this.token}/sendMessage`, {
        chat_id: chatId,
        text,
        parse_mode: 'Markdown',
        ...options
      });
    } catch (e) {
      console.error('Erreur envoi Telegram:', e.response?.data?.description || e.message);
    }
  }

  async poll() {
    if (!this.isRunning || !this.token) return;

    try {
      const res = await axios.get(`https://api.telegram.org/bot${this.token}/getUpdates`, {
        params: {
          offset: this.lastUpdateId + 1,
          timeout: 20
        },
        timeout: 25000
      });

      if (res.data?.ok && Array.isArray(res.data.result)) {
        for (const update of res.data.result) {
          this.lastUpdateId = update.update_id;
          if (update.message && update.message.text) {
            await this.handleMessage(update.message);
          }
        }
      }
    } catch (err) {
      // Ignore network timeouts in long polling
      if (!err.message?.includes('timeout')) {
        console.error('Erreur polling Telegram:', err.message);
      }
    }

    if (this.isRunning) {
      this.pollingTimeout = setTimeout(() => this.poll(), 2000);
    }
  }

  async handleMessage(msg) {
    const chatId = msg.chat.id;
    const text = (msg.text || '').trim();
    const settings = getSettings();

    if (text.startsWith('/start')) {
      const welcome = `👑 *BIENVENUE SUR ${settings.botName || 'CHRIST-X-MD'}* 👑\n\n`
        + `🤖 *Bot WhatsApp Multi-Device & Cloud Portal*\n`
        + `👤 *Créateur:* ${settings.ownerName || 'Christ Foreign'} (+${settings.ownerNumber || '50937081286'})\n\n`
        + `📱 *POUR CONNECTER TON WHATSAPP :*\n`
        + `Tape simplement :\n`
        + `👉 \`/pair <ton_numero>\`\n\n`
        + `*Exemple :* \`/pair 50937081286\`\n\n`
        + `Tu recevras instantanément ton *Pairing Code* à 8 chiffres pour lier ton WhatsApp sans QR code ! 🚀\n\n`
        + `💡 Tape \`/status\` pour voir les statistiques ou \`/help\` pour l'aide.`;
      return this.sendTelegramMessage(chatId, welcome);
    }

    if (text.startsWith('/pair') || text.startsWith('/connect')) {
      const parts = text.split(' ');
      const rawNumber = parts[1];

      if (!rawNumber) {
        return this.sendTelegramMessage(chatId, `⚠️ *Format incorrect !*\n\nUtilisation : \`/pair <ton_numero_avec_indicatif>\`\n*Exemple :* \`/pair 50937081286\``);
      }

      await this.sendTelegramMessage(chatId, `⏳ *Génération de ton code d'appairage pour* \`+${rawNumber}\` *en cours...*`);

      try {
        const result = await sessionManager.requestPairing(rawNumber);
        if (result.alreadyConnected) {
          return this.sendTelegramMessage(chatId, `✅ *Ce numéro (+${result.phoneNumber}) est déjà connecté et actif sur CHRIST-X-MD !*`);
        }

        const reply = `🎉 *TON CODE DE PAIRING WHATSAPP EST PRÊT !*\n\n`
          + `🔢 Code : \`${result.pairingCode}\`\n\n`
          + `📲 *Comment l'utiliser :*\n`
          + `1. Ouvre WhatsApp sur ton téléphone.\n`
          + `2. Va dans *Paramètres > Appareils connectés > Connecter un appareil*.\n`
          + `3. Clique sur *"Associer avec un numéro de téléphone"*.\n`
          + `4. Entre le code ci-dessus : \`${result.pairingCode}\`\n\n`
          + `⏱️ *Valide pendant 2 minutes !*`;

        return this.sendTelegramMessage(chatId, reply);
      } catch (err) {
        return this.sendTelegramMessage(chatId, `❌ *Erreur:* ${err.message}`);
      }
    }

    if (text.startsWith('/status')) {
      const sessions = sessionManager.getAllSessions();
      const uptimeH = (process.uptime() / 3600).toFixed(1);
      const memMB = (process.memoryUsage().rss / (1024 * 1024)).toFixed(1);

      const statusMsg = `📊 *STATUT DU SERVEUR CHRIST-X-MD*\n\n`
        + `⚡ *Uptime :* ${uptimeH} heures\n`
        + `💾 *Mémoire :* ${memMB} MB\n`
        + `📱 *Sessions WhatsApp actives :* ${sessions.length}/50\n`
        + `👑 *Owner :* +${settings.ownerNumber || '50937081286'}\n`
        + `🟢 *Système :* Opérationnel 24/7`;

      return this.sendTelegramMessage(chatId, statusMsg);
    }

    if (text.startsWith('/help')) {
      const helpMsg = `📖 *AIDE DU BOT TELEGRAM :*\n\n`
        + `✦ \`/pair <numero>\` : Génère un code d'appairage WhatsApp\n`
        + `✦ \`/status\` : Affiche les statistiques du bot\n`
        + `✦ \`/start\` : Affiche l'écran d'accueil`;
      return this.sendTelegramMessage(chatId, helpMsg);
    }
  }
}

const telegramBotManager = new TelegramBotManager();
module.exports = telegramBotManager;
