const fs = require('fs');
const path = require('path');
const NodeCache = require('node-cache');
const pino = require('pino');
const {
  default: makeWASocket,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
  makeInMemoryStore,
  DisconnectReason
} = require('baileys');

const handleMessage = require('./handler');
const { smsg } = require('./myfunc');
const { getSettings } = require('./settings');

const SESSIONS_DIR = path.join(__dirname, '..', 'session', 'instances');
const MAX_SESSIONS = 50;

if (!fs.existsSync(SESSIONS_DIR)) {
  fs.mkdirSync(SESSIONS_DIR, { recursive: true });
}

// Active session registry
const activeSessions = new Map();

class SessionManager {
  constructor() {
    this.primarySocket = null;
    this.store = makeInMemoryStore({
      logger: pino({ level: 'silent' })
    });
  }

  // Set reference to primary bot socket (Instance 0)
  setPrimarySocket(sock) {
    this.primarySocket = sock;
    const settings = getSettings();
    activeSessions.set('primary', {
      id: 'primary',
      phoneNumber: settings.ownerNumber || '50937081286',
      status: 'active',
      isPrimary: true,
      lastActive: new Date().toISOString()
    });
  }

  // Get summary of all sessions
  getAllSessions() {
    const list = [];
    const primaryInfo = activeSessions.get('primary') || {
      id: 'primary',
      phoneNumber: getSettings().ownerNumber || '50937081286',
      status: this.primarySocket?.user ? 'connected' : 'starting',
      isPrimary: true,
      lastActive: new Date().toISOString()
    };
    list.push(primaryInfo);

    try {
      const files = fs.readdirSync(SESSIONS_DIR);
      for (const f of files) {
        const sessionPath = path.join(SESSIONS_DIR, f);
        if (fs.statSync(sessionPath).isDirectory()) {
          const inMemory = activeSessions.get(f);
          const hasCreds = fs.existsSync(path.join(sessionPath, 'creds.json'));
          list.push({
            id: f,
            phoneNumber: f,
            status: inMemory ? inMemory.status : (hasCreds ? 'saved' : 'pending'),
            isPrimary: false,
            lastActive: inMemory ? inMemory.lastActive : new Date().toISOString()
          });
        }
      }
    } catch (e) {
      console.error('Erreur listing sessions:', e);
    }

    return list.slice(0, MAX_SESSIONS);
  }

  // Create or request pairing code for a specific phone number
  async requestPairing(phoneNumber) {
    const cleanNumber = String(phoneNumber).replace(/[^0-9]/g, '');
    if (!cleanNumber || cleanNumber.length < 8) {
      throw new Error('Numéro de téléphone invalide. Incluez l\'indicatif pays (ex: 50937081286).');
    }

    if (activeSessions.size >= MAX_SESSIONS) {
      throw new Error(`Limite de ${MAX_SESSIONS} sessions atteinte. Supprimez-en une pour continuer.`);
    }

    const sessionPath = path.join(SESSIONS_DIR, cleanNumber);
    if (!fs.existsSync(sessionPath)) {
      fs.mkdirSync(sessionPath, { recursive: true });
    }

    const { state, saveCreds } = await useMultiFileAuthState(sessionPath);
    const { version } = await fetchLatestBaileysVersion();
    const msgRetryCounterCache = new NodeCache();

    const sock = makeWASocket({
      version,
      logger: pino({ level: 'silent' }),
      printQRInTerminal: false,
      auth: {
        creds: state.creds,
        keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'silent' }))
      },
      browser: ['CHRIST-X-MD', 'Chrome', '20.0.04'],
      markOnlineOnConnect: true,
      generateHighQualityLinkPreview: true,
      msgRetryCounterCache
    });

    this.store.bind(sock.ev);

    activeSessions.set(cleanNumber, {
      id: cleanNumber,
      phoneNumber: cleanNumber,
      status: 'requesting_code',
      socket: sock,
      isPrimary: false,
      lastActive: new Date().toISOString()
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
      const { connection, lastDisconnect } = update;
      const sess = activeSessions.get(cleanNumber);
      if (sess) {
        sess.lastActive = new Date().toISOString();
        if (connection === 'open') {
          sess.status = 'connected';
          console.log(`[CHRIST-X-MD] Instance ${cleanNumber} connectée avec succès !`);
        } else if (connection === 'close') {
          const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
          sess.status = shouldReconnect ? 'reconnecting' : 'disconnected';
        }
      }
    });

    sock.ev.on('messages.upsert', async (chatUpdate) => {
      try {
        const mek = chatUpdate.messages[0];
        if (!mek.message) return;
        const m = smsg(sock, mek, this.store);
        await handleMessage(sock, m, chatUpdate, this.store);
      } catch (err) {
        console.error(`Erreur message session ${cleanNumber}:`, err);
      }
    });

    await new Promise(r => setTimeout(r, 1500));

    if (!sock.authState.creds.registered) {
      let code = await sock.requestPairingCode(cleanNumber);
      code = String(code || '').replace(/[^0-9]/g, '');

      const sess = activeSessions.get(cleanNumber);
      if (sess) {
        sess.pairingCode = code;
        sess.status = 'pairing_ready';
      }

      return {
        success: true,
        pairingCode: code,
        phoneNumber: cleanNumber
      };
    } else {
      return {
        success: true,
        pairingCode: 'DÉJÀ CONNECTÉ',
        phoneNumber: cleanNumber,
        alreadyConnected: true
      };
    }
  }

  deleteSession(sessionId) {
    const sess = activeSessions.get(sessionId);
    if (sess && sess.socket) {
      try {
        sess.socket.end(new Error('Session closed by admin'));
      } catch (e) {}
    }
    activeSessions.delete(sessionId);
    const targetDir = path.join(SESSIONS_DIR, sessionId);
    if (fs.existsSync(targetDir)) {
      try {
        fs.rmSync(targetDir, { recursive: true, force: true });
      } catch (e) {}
    }
    return true;
  }
}

const sessionManager = new SessionManager();
module.exports = sessionManager;
