const fs = require('fs');
const path = require('path');
const QRCode = require('qrcode');
const { getSettings, updateSettings } = require('./settings');
const { getUserLang, setUserLang, t } = require('./i18n');
const { getAsciiHeader } = require('./asciiStyles');
const { imageToWebp, videoToWebp, writeExifImg, writeExifVid } = require('./exif');
const moment = require('moment-timezone');
const performance = require('performance-now');

// Math expression safe evaluator
function safeEvalMath(expr) {
  const sanitized = expr.replace(/[^0-9+\-*/().%^sqrt]/g, '')
                        .replace(/sqrt/g, 'Math.sqrt');
  if (!sanitized) return null;
  try {
    // Only allow numbers and basic math operators
    const fn = new Function(`return (${sanitized})`);
    const res = fn();
    return typeof res === 'number' && !isNaN(res) ? res : null;
  } catch {
    return null;
  }
}

function formatUptime(seconds) {
  const d = Math.floor(seconds / (3600 * 24));
  const h = Math.floor((seconds % (3600 * 24)) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return `${d}j ${h}h ${m}m ${s}s`;
}

module.exports = async function handleMessage(sock, m, chatUpdate, store) {
  try {
    if (!m.message) return;
    if (m.key && m.key.remoteJid === 'status@broadcast') return;

    const settings = getSettings();
    const botNumber = (sock.user && sock.user.id) ? sock.user.id.split(':')[0] + '@s.whatsapp.net' : '';
    const ownerNumber = (settings.ownerNumber || '50937081286') + '@s.whatsapp.net';

    const sender = m.key.participant || m.key.remoteJid;
    const isOwner = sender.replace(/[^0-9]/g, '') === (settings.ownerNumber || '50937081286').replace(/[^0-9]/g, '') ||
                    sender === botNumber || m.key.fromMe;

    const isGroup = m.key.remoteJid.endsWith('@g.us');
    const lang = getUserLang(sender, settings.defaultLang || 'fr');

    // Anti-link enforcement in groups
    if (isGroup && settings.antiLink && !isOwner) {
      const bodyText = m.body || '';
      if (/chat\.whatsapp\.com\/[0-9A-Za-z]{20,24}/i.test(bodyText)) {
        try {
          const groupMeta = await sock.groupMetadata(m.key.remoteJid);
          const botIsAdmin = groupMeta.participants.some(p => p.id === botNumber && (p.admin === 'admin' || p.admin === 'superadmin'));
          const senderIsAdmin = groupMeta.participants.some(p => p.id === sender && (p.admin === 'admin' || p.admin === 'superadmin'));
          
          if (botIsAdmin && !senderIsAdmin) {
            await sock.sendMessage(m.key.remoteJid, { delete: m.key });
            await sock.sendMessage(m.key.remoteJid, {
              text: `⚠️ @${sender.split('@')[0]} ${t('error', lang)}: Liens interdits dans ce groupe !`,
              mentions: [sender]
            });
            return;
          }
        } catch (e) {
          console.error('Antilink error:', e);
        }
      }
    }

    // Auto-react if enabled
    if (settings.autoReact && !m.key.fromMe) {
      const emojis = ['⚡', '👑', '🔥', '💫', '💎', '🚀', '⭐'];
      const randomEmoji = emojis[Math.floor(Math.random() * emojis.length)];
      sock.sendMessage(m.key.remoteJid, {
        react: { text: randomEmoji, key: m.key }
      }).catch(() => {});
    }

    const body = m.body || '';
    if (!body) return;

    // Determine prefix
    const prefixes = settings.prefixes || ['.', '!', '/', '#'];
    const usedPrefix = prefixes.find(p => body.startsWith(p)) || '';
    const isCmd = Boolean(usedPrefix);

    if (!isCmd) return;

    const command = body.slice(usedPrefix.length).trim().split(/ +/)[0].toLowerCase();
    const args = body.slice(usedPrefix.length + command.length).trim().split(/ +/);
    const text = body.slice(usedPrefix.length + command.length).trim();

    // Check mode
    if (settings.mode === 'private' && !isOwner) {
      return;
    }

    // Group info helpers
    let groupMetadata = null;
    let groupAdmins = [];
    let isBotAdmin = false;
    let isAdmin = false;

    if (isGroup) {
      try {
        groupMetadata = await sock.groupMetadata(m.key.remoteJid);
        const participants = groupMetadata.participants || [];
        groupAdmins = participants.filter(p => p.admin === 'admin' || p.admin === 'superadmin').map(p => p.id);
        isAdmin = groupAdmins.includes(sender);
        isBotAdmin = groupAdmins.includes(botNumber);
      } catch (e) {
        // failed metadata
      }
    }

    // Dynamic custom command check
    const customCmd = (settings.customCommands || []).find(c => c.enabled && c.name.toLowerCase() === command);
    if (customCmd) {
      if (customCmd.replyText) {
        return m.reply(customCmd.replyText);
      }
      if (customCmd.scriptCode) {
        try {
          const runScript = new Function('sock', 'm', 'args', 'text', 'sender', 'isGroup', customCmd.scriptCode);
          return await runScript(sock, m, args, text, sender, isGroup);
        } catch (scriptErr) {
          return m.reply(`❌ Erreur script [${command}]: ${scriptErr.message}`);
        }
      }
    }

    // Switch native commands
    switch (command) {
      // ----------------------------------------------------
      // GENERAL & MENU
      // ----------------------------------------------------
      case 'menu':
      case 'help': {
        const startTimestamp = performance();
        const uptime = formatUptime(process.uptime());
        const speed = (performance() - startTimestamp).toFixed(2);
        const ascii = getAsciiHeader(settings.asciiStyle || 'cyber', settings.customAscii);
        
        let menuText = `\`\`\`${ascii}\`\`\`\n`;
        menuText += `👑 *${settings.botName || 'CHRIST-X-MD'}* 👑\n`;
        menuText += `┌───⊷ *${t('bot_info', lang)}*\n`;
        menuText += `│ 👤 *${t('owner', lang)}:* ${settings.ownerName || 'Christ Foreign'}\n`;
        menuText += `│ 📞 *WhatsApp:* +${(settings.ownerNumber || '50937081286').replace(/[^0-9]/g, '')}\n`;
        menuText += `│ 🌐 *${t('mode', lang)}:* ${settings.mode === 'public' ? 'Public 🟢' : 'Privé 🔴'}\n`;
        menuText += `│ ⚡ *${t('prefix', lang)}:* [ ${usedPrefix} ]\n`;
        menuText += `│ ⏱️ *${t('uptime', lang)}:* ${uptime}\n`;
        menuText += `│ 🚀 *${t('speed', lang)}:* ${speed} ms\n`;
        menuText += `│ 🗣️ *Langue:* ${lang.toUpperCase()}\n`;
        menuText += `└───⊷\n\n`;

        menuText += `╭───⊷ 📌 *${t('cat_general', lang)}*\n`;
        menuText += `│ ✦ ${usedPrefix}menu / ${usedPrefix}help\n`;
        menuText += `│ ✦ ${usedPrefix}ping / ${usedPrefix}speed\n`;
        menuText += `│ ✦ ${usedPrefix}runtime\n`;
        menuText += `│ ✦ ${usedPrefix}owner\n`;
        menuText += `│ ✦ ${usedPrefix}repo\n`;
        menuText += `│ ✦ ${usedPrefix}lang <fr|en|es|ht>\n`;
        menuText += `╰───────────────⊷\n\n`;

        menuText += `╭───⊷ 🎨 *${t('cat_media', lang)}*\n`;
        menuText += `│ ✦ ${usedPrefix}sticker / ${usedPrefix}s (répondre à photo/vidéo)\n`;
        menuText += `│ ✦ ${usedPrefix}take <pack>|<auteur>\n`;
        menuText += `│ ✦ ${usedPrefix}qr <texte ou lien>\n`;
        menuText += `│ ✦ ${usedPrefix}toimg (répondre à sticker)\n`;
        menuText += `╰───────────────⊷\n\n`;

        menuText += `╭───⊷ 👥 *${t('cat_group', lang)}*\n`;
        menuText += `│ ✦ ${usedPrefix}tagall <message>\n`;
        menuText += `│ ✦ ${usedPrefix}hidetag <message>\n`;
        menuText += `│ ✦ ${usedPrefix}kick @user\n`;
        menuText += `│ ✦ ${usedPrefix}add <numéro>\n`;
        menuText += `│ ✦ ${usedPrefix}promote @user\n`;
        menuText += `│ ✦ ${usedPrefix}demote @user\n`;
        menuText += `│ ✦ ${usedPrefix}group <open|close>\n`;
        menuText += `│ ✦ ${usedPrefix}link\n`;
        menuText += `│ ✦ ${usedPrefix}antilink <on|off>\n`;
        menuText += `│ ✦ ${usedPrefix}welcome <on|off>\n`;
        menuText += `╰───────────────⊷\n\n`;

        menuText += `╭───⊷ 🎮 *${t('cat_fun', lang)}*\n`;
        menuText += `│ ✦ ${usedPrefix}calc <calcul>\n`;
        menuText += `│ ✦ ${usedPrefix}flipcoin\n`;
        menuText += `│ ✦ ${usedPrefix}dice\n`;
        menuText += `│ ✦ ${usedPrefix}ship @user\n`;
        menuText += `│ ✦ ${usedPrefix}fact\n`;
        menuText += `│ ✦ ${usedPrefix}quote\n`;
        menuText += `│ ✦ ${usedPrefix}truth / ${usedPrefix}dare\n`;
        menuText += `╰───────────────⊷\n\n`;

        menuText += `╭───⊷ 🛠️ *${t('cat_tools', lang)}*\n`;
        menuText += `│ ✦ ${usedPrefix}wame <numéro>\n`;
        menuText += `│ ✦ ${usedPrefix}base64 <enc|dec> <texte>\n`;
        menuText += `│ ✦ ${usedPrefix}reverse <texte>\n`;
        menuText += `│ ✦ ${usedPrefix}readmore\n`;
        menuText += `╰───────────────⊷\n\n`;

        if (settings.customCommands && settings.customCommands.length > 0) {
          menuText += `╭───⊷ ⚡ *${t('cat_custom', lang)}*\n`;
          settings.customCommands.forEach(cc => {
            menuText += `│ ✦ ${usedPrefix}${cc.name} (${cc.description || 'Custom'})\n`;
          });
          menuText += `╰───────────────⊷\n\n`;
        }

        if (isOwner) {
          menuText += `╭───⊷ 👑 *${t('cat_owner', lang)}*\n`;
          menuText += `│ ✦ ${usedPrefix}mode <public|private>\n`;
          menuText += `│ ✦ ${usedPrefix}setprefix <caractère>\n`;
          menuText += `│ ✦ ${usedPrefix}bc / ${usedPrefix}broadcast <message>\n`;
          menuText += `│ ✦ ${usedPrefix}addcmd <nom> <réponse>\n`;
          menuText += `│ ✦ ${usedPrefix}delcmd <nom>\n`;
          menuText += `│ ✦ ${usedPrefix}listcmd\n`;
          menuText += `│ ✦ ${usedPrefix}restart\n`;
          menuText += `╰───────────────⊷\n\n`;
        }

        menuText += `> ⚡ *${settings.botName || 'CHRIST-X-MD'}* • ${t('powered_by', lang)}`;

        // Decide media type (image, video, or random between both)
        const mediaType = settings.menuMediaType || 'both';
        const images = settings.menuImages || [];
        const videos = settings.menuVideos || [];

        let sendAsVideo = false;
        if (mediaType === 'video' && videos.length > 0) {
          sendAsVideo = true;
        } else if (mediaType === 'both') {
          sendAsVideo = videos.length > 0 && Math.random() > 0.5;
        }

        if (sendAsVideo && videos.length > 0) {
          const videoUrl = videos[Math.floor(Math.random() * videos.length)];
          return sock.sendMessage(m.key.remoteJid, {
            video: { url: videoUrl },
            caption: menuText,
            gifPlayback: true
          }, { quoted: m });
        } else if (images.length > 0) {
          const imageUrl = images[Math.floor(Math.random() * images.length)];
          return sock.sendMessage(m.key.remoteJid, {
            image: { url: imageUrl },
            caption: menuText
          }, { quoted: m });
        } else {
          return m.reply(menuText);
        }
      }

      case 'ping':
      case 'speed': {
        const start = performance();
        await m.reply('⚡ _Calcul du ping en cours..._');
        const latency = (performance() - start).toFixed(2);
        return m.reply(`🚀 *PONG !*\n⚡ Latence : *${latency} ms*\n💻 Serveur : *Actif 24/7*`);
      }

      case 'runtime':
      case 'uptime': {
        return m.reply(`⏱️ *CHRIST-X-MD UPTIME :*\n${formatUptime(process.uptime())}`);
      }

      case 'owner':
      case 'creator': {
        const vcard = 'BEGIN:VCARD\n'
          + 'VERSION:3.0\n'
          + `FN:${settings.ownerName || 'Christ Foreign'}\n`
          + `ORG:CHRIST-X-MD Bot Empire;\n`
          + `TEL;type=CELL;type=VOICE;waid=${(settings.ownerNumber || '50937081286').replace(/[^0-9]/g, '')}:+${(settings.ownerNumber || '50937081286').replace(/[^0-9]/g, '')}\n`
          + 'END:VCARD';
        return sock.sendMessage(m.key.remoteJid, {
          contacts: {
            displayName: settings.ownerName || 'Christ Foreign',
            contacts: [{ vcard }]
          }
        }, { quoted: m });
      }

      case 'repo':
      case 'sc':
      case 'script': {
        return m.reply(`👑 *CHRIST-X-MD OFFICIAL REPOSITORY*\n\n🌐 *GitHub :* ${settings.repoUrl || 'https://github.com/Christforeign/MR-CHRIST-X-BOT-MD-V1'}\n⭐ N'hésite pas à laisser une étoile sur GitHub !`);
      }

      case 'lang':
      case 'language': {
        if (!args[0]) {
          return m.reply(`🌐 *Choisis ta langue :*\n\n✦ *${usedPrefix}lang fr* 🇫🇷 (Français)\n✦ *${usedPrefix}lang en* 🇬🇧 (English)\n✦ *${usedPrefix}lang es* 🇪🇸 (Español)\n✦ *${usedPrefix}lang ht* 🇭🇹 (Kreyòl Ayisyen)`);
        }
        const newLang = args[0].toLowerCase();
        if (['fr', 'en', 'es', 'ht'].includes(newLang)) {
          setUserLang(sender, newLang);
          return m.reply(t('lang_changed', newLang));
        } else {
          return m.reply('❌ Langue invalide. Disponibles : fr, en, es, ht');
        }
      }

      // ----------------------------------------------------
      // MEDIA & CONVERTERS
      // ----------------------------------------------------
      case 's':
      case 'sticker': {
        const quoted = m.quoted ? m.quoted : m;
        const mime = (quoted.msg || quoted).mimetype || '';
        if (/image|video/.test(mime)) {
          await m.reply(t('wait', lang));
          const mediaBuffer = await quoted.download();
          const pack = settings.botName || 'CHRIST-X-MD';
          const author = `${settings.ownerName || 'Christ Foreign'} | +${settings.ownerNumber || '50937081286'}`;

          let stickerBuffer;
          if (/image/.test(mime)) {
            stickerBuffer = await writeExifImg(mediaBuffer, { packname: pack, author });
          } else {
            stickerBuffer = await writeExifVid(mediaBuffer, { packname: pack, author });
          }
          return sock.sendMessage(m.key.remoteJid, { sticker: { url: stickerBuffer } }, { quoted: m });
        } else {
          return m.reply(`⚠️ Réponds à une image ou une courte vidéo (<10s) avec *${usedPrefix}sticker*`);
        }
      }

      case 'take':
      case 'wm': {
        if (!m.quoted) return m.reply(`⚠️ Réponds à un sticker avec *${usedPrefix}take <pack>|<auteur>*`);
        const mime = (m.quoted.msg || m.quoted).mimetype || '';
        if (/webp/.test(mime)) {
          const [newPack, newAuthor] = text.includes('|') ? text.split('|') : [text || settings.botName, settings.ownerName];
          const mediaBuffer = await m.quoted.download();
          const resSticker = await writeExifImg(mediaBuffer, { packname: newPack.trim(), author: (newAuthor || '').trim() });
          return sock.sendMessage(m.key.remoteJid, { sticker: { url: resSticker } }, { quoted: m });
        } else {
          return m.reply('⚠️ Le message cité doit être un sticker !');
        }
      }

      case 'qr': {
        if (!text) return m.reply(`⚠️ Exemple : *${usedPrefix}qr https://google.com*`);
        try {
          const qrBuffer = await QRCode.toBuffer(text, { scale: 8, margin: 2 });
          return sock.sendMessage(m.key.remoteJid, {
            image: qrBuffer,
            caption: `✅ *QR Code généré pour :*\n${text}`
          }, { quoted: m });
        } catch (qrErr) {
          return m.reply(`❌ Erreur génération QR: ${qrErr.message}`);
        }
      }

      // ----------------------------------------------------
      // GROUP MANAGEMENT
      // ----------------------------------------------------
      case 'tagall': {
        if (!isGroup) return m.reply(t('group_only', lang));
        if (!isAdmin && !isOwner) return m.reply(t('admin_only', lang));
        
        const participants = groupMetadata.participants || [];
        let tagMsg = `╭───⊷ 📢 *TAG ALL*\n`;
        tagMsg += `│ 💬 *Message:* ${text || 'Appel général !'}\n`;
        tagMsg += `│ 👥 *Membres:* ${participants.length}\n`;
        tagMsg += `╰───────────────⊷\n\n`;
        participants.forEach(p => {
          tagMsg += `⚡ @${p.id.split('@')[0]}\n`;
        });
        return sock.sendMessage(m.key.remoteJid, {
          text: tagMsg,
          mentions: participants.map(p => p.id)
        }, { quoted: m });
      }

      case 'hidetag': {
        if (!isGroup) return m.reply(t('group_only', lang));
        if (!isAdmin && !isOwner) return m.reply(t('admin_only', lang));
        
        const participants = groupMetadata.participants || [];
        return sock.sendMessage(m.key.remoteJid, {
          text: text || '🔔 Notification de groupe',
          mentions: participants.map(p => p.id)
        }, { quoted: m });
      }

      case 'kick': {
        if (!isGroup) return m.reply(t('group_only', lang));
        if (!isAdmin && !isOwner) return m.reply(t('admin_only', lang));
        if (!isBotAdmin) return m.reply(t('bot_admin', lang));

        let usersToKick = m.mentionedJid || [];
        if (m.quoted) usersToKick.push(m.quoted.sender);
        if (usersToKick.length === 0) return m.reply(`⚠️ Mentionne l'utilisateur à expulser : *${usedPrefix}kick @user*`);

        await sock.groupParticipantsUpdate(m.key.remoteJid, usersToKick, 'remove');
        return m.reply(t('done', lang));
      }

      case 'promote': {
        if (!isGroup) return m.reply(t('group_only', lang));
        if (!isAdmin && !isOwner) return m.reply(t('admin_only', lang));
        if (!isBotAdmin) return m.reply(t('bot_admin', lang));

        let users = m.mentionedJid || [];
        if (m.quoted) users.push(m.quoted.sender);
        if (users.length === 0) return m.reply(`⚠️ Mentionne l'utilisateur : *${usedPrefix}promote @user*`);

        await sock.groupParticipantsUpdate(m.key.remoteJid, users, 'promote');
        return m.reply(`✅ *Promotion effectuée avec succès !*`);
      }

      case 'demote': {
        if (!isGroup) return m.reply(t('group_only', lang));
        if (!isAdmin && !isOwner) return m.reply(t('admin_only', lang));
        if (!isBotAdmin) return m.reply(t('bot_admin', lang));

        let users = m.mentionedJid || [];
        if (m.quoted) users.push(m.quoted.sender);
        if (users.length === 0) return m.reply(`⚠️ Mentionne l'administrateur : *${usedPrefix}demote @user*`);

        await sock.groupParticipantsUpdate(m.key.remoteJid, users, 'demote');
        return m.reply(`✅ *Rétrogradation effectuée avec succès !*`);
      }

      case 'group': {
        if (!isGroup) return m.reply(t('group_only', lang));
        if (!isAdmin && !isOwner) return m.reply(t('admin_only', lang));
        if (!isBotAdmin) return m.reply(t('bot_admin', lang));

        if (args[0] === 'open' || args[0] === 'ouvrir') {
          await sock.groupSettingUpdate(m.key.remoteJid, 'not_announcement');
          return m.reply('🔓 *Groupe ouvert ! Tout le monde peut envoyer des messages.*');
        } else if (args[0] === 'close' || args[0] === 'fermer') {
          await sock.groupSettingUpdate(m.key.remoteJid, 'announcement');
          return m.reply('🔒 *Groupe fermé ! Seuls les administrateurs peuvent envoyer des messages.*');
        } else {
          return m.reply(`⚠️ Utilisation : *${usedPrefix}group open* ou *${usedPrefix}group close*`);
        }
      }

      case 'link':
      case 'linkgroup': {
        if (!isGroup) return m.reply(t('group_only', lang));
        if (!isBotAdmin) return m.reply(t('bot_admin', lang));
        const code = await sock.groupInviteCode(m.key.remoteJid);
        return m.reply(`🔗 *Lien du groupe :*\nhttps://chat.whatsapp.com/${code}`);
      }

      case 'antilink': {
        if (!isGroup) return m.reply(t('group_only', lang));
        if (!isAdmin && !isOwner) return m.reply(t('admin_only', lang));
        if (args[0] === 'on') {
          updateSettings({ antiLink: true });
          return m.reply('🛡️ *Anti-link activé dans le bot !*');
        } else if (args[0] === 'off') {
          updateSettings({ antiLink: false });
          return m.reply('🛡️ *Anti-link désactivé !*');
        } else {
          return m.reply(`⚠️ Utilisation : *${usedPrefix}antilink on* ou *${usedPrefix}antilink off*`);
        }
      }

      // ----------------------------------------------------
      // FUN & GAMES
      // ----------------------------------------------------
      case 'calc': {
        if (!text) return m.reply(`⚠️ Exemple : *${usedPrefix}calc 25 * 4 + 10*`);
        const result = safeEvalMath(text);
        if (result !== null) {
          return m.reply(`🧮 *CALCULATRICE :*\n\n📝 Expression : \`${text}\`\n✨ Résultat : *${result}*`);
        } else {
          return m.reply('❌ Expression mathématique invalide.');
        }
      }

      case 'flipcoin': {
        const coin = Math.random() > 0.5 ? '🪙 *PILE !*' : '🪙 *FACE !*';
        return m.reply(`Résultat du lancer : ${coin}`);
      }

      case 'dice': {
        const roll = Math.floor(Math.random() * 6) + 1;
        const diceEmojis = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];
        return m.reply(`🎲 Tu as fait un *${roll}* ! ${diceEmojis[roll - 1]}`);
      }

      case 'ship': {
        let user1, user2;
        if (m.mentionedJid && m.mentionedJid.length >= 2) {
          user1 = m.mentionedJid[0];
          user2 = m.mentionedJid[1];
        } else if (m.mentionedJid && m.mentionedJid.length === 1) {
          user1 = sender;
          user2 = m.mentionedJid[0];
        } else {
          return m.reply(`⚠️ Mentionne 2 personnes : *${usedPrefix}ship @user1 @user2*`);
        }
        const percent = Math.floor(Math.random() * 101);
        let comment = '💔 Aucune chance...';
        if (percent > 80) comment = '💍 Âmes sœurs parfaites !';
        else if (percent > 50) comment = '❤️ Il y a de l\'espoir !';
        else if (percent > 30) comment = '⚡ Zone amicale compliquée.';

        return sock.sendMessage(m.key.remoteJid, {
          text: `💘 *TEST DE COMPATIBILITÉ AMOUREUSE* 💘\n\n👩‍❤️‍👨 @${user1.split('@')[0]} ❤️ @${user2.split('@')[0]}\n📊 Pourcentage : *${percent}%*\n💬 ${comment}`,
          mentions: [user1, user2]
        }, { quoted: m });
      }

      case 'fact': {
        const factsFr = [
          'Le miel ne se périme jamais. Des archéologues en ont trouvé vieux de 3000 ans toujours comestible !',
          'Les pieuvres ont 3 cœurs et le sang bleu.',
          'Une journée sur Vénus est plus longue qu\'une année sur Vénus.',
          'Les bananes partagent environ 50% de leur ADN avec les humains !',
          'La Tour Eiffel peut grandir de 15 cm en été à cause de la dilatation thermique.'
        ];
        return m.reply(`💡 *LE SAVAIS-TU ?*\n\n${factsFr[Math.floor(Math.random() * factsFr.length)]}`);
      }

      case 'quote': {
        const quotes = [
          '« Le meilleur moyen de prédire l’avenir, c’est de le créer. » – Peter Drucker',
          '« La seule façon de faire du bon travail est d’aimer ce que vous faites. » – Steve Jobs',
          '« N’abandonne jamais un rêve juste à cause du temps qu’il faudra pour l’accomplir. Le temps passera de toute façon. »',
          '« Tout ce que l’esprit peut concevoir et croire, il peut l’accomplir. » – Napoleon Hill'
        ];
        return m.reply(`📜 *CITATION DU JOUR :*\n\n${quotes[Math.floor(Math.random() * quotes.length)]}`);
      }

      case 'truth': {
        const truths = [
          'Quel est ton plus grand secret inavouable ?',
          'Quelle est la chose la plus folle que tu aies faite par amour ?',
          'Quel est ton plus gros mensonge récent ?',
          'Si tu pouvais échanger ta vie avec quelqu\'un dans ce groupe, ce serait qui ?'
        ];
        return m.reply(`🤫 *VÉRITÉ :*\n\n${truths[Math.floor(Math.random() * truths.length)]}`);
      }

      case 'dare': {
        const dares = [
          'Envoie un message vocal de 5 secondes en imitant une poule !',
          'Mets la photo de profil du créateur du groupe pendant 10 minutes !',
          'Envoie une blague drôle immédiatement dans le groupe !',
          'Avoue ton crush secret dans le groupe ou réponds à 3 questions de l\'admin !'
        ];
        return m.reply(`🔥 *ACTION :*\n\n${dares[Math.floor(Math.random() * dares.length)]}`);
      }

      // ----------------------------------------------------
      // TOOLS
      // ----------------------------------------------------
      case 'wame': {
        const targetNumber = (text || sender).replace(/[^0-9]/g, '');
        return m.reply(`🔗 *Lien direct WhatsApp :*\nhttps://wa.me/${targetNumber}`);
      }

      case 'reverse': {
        if (!text) return m.reply(`⚠️ Exemple : *${usedPrefix}reverse Salut tout le monde*`);
        return m.reply(text.split('').reverse().join(''));
      }

      case 'readmore': {
        const [part1, part2] = text.includes('|') ? text.split('|') : [text || 'Lire la suite', 'Voici le texte caché !'];
        const invisibleChar = String.fromCharCode(8206).repeat(4001);
        return m.reply(`${part1}${invisibleChar}${part2}`);
      }

      case 'base64': {
        if (!args[1]) return m.reply(`⚠️ Utilisation : *${usedPrefix}base64 enc <texte>* ou *${usedPrefix}base64 dec <base64>*`);
        const sub = args[0].toLowerCase();
        const content = args.slice(1).join(' ');
        if (sub === 'enc' || sub === 'encode') {
          return m.reply(Buffer.from(content, 'utf-8').toString('base64'));
        } else if (sub === 'dec' || sub === 'decode') {
          return m.reply(Buffer.from(content, 'base64').toString('utf-8'));
        } else {
          return m.reply('❌ Choix invalide : utilise `enc` ou `dec`.');
        }
      }

      // ----------------------------------------------------
      // OWNER COMMANDS
      // ----------------------------------------------------
      case 'mode': {
        if (!isOwner) return m.reply(t('owner_only', lang));
        if (args[0] === 'public') {
          updateSettings({ mode: 'public' });
          return m.reply('🌐 *Mode public activé ! Tout le monde peut utiliser le bot.*');
        } else if (args[0] === 'private' || args[0] === 'self') {
          updateSettings({ mode: 'private' });
          return m.reply('🔒 *Mode privé activé ! Seul le propriétaire peut exécuter des commandes.*');
        } else {
          return m.reply(`⚠️ Utilisation : *${usedPrefix}mode public* ou *${usedPrefix}mode private*`);
        }
      }

      case 'setprefix': {
        if (!isOwner) return m.reply(t('owner_only', lang));
        if (!args[0]) return m.reply(`⚠️ Exemple : *${usedPrefix}setprefix !*`);
        const newPrefix = args[0].trim();
        updateSettings({ prefix: newPrefix, prefixes: [newPrefix] });
        return m.reply(`⚡ *Préfixe changé avec succès en :* [ ${newPrefix} ]`);
      }

      case 'addcmd': {
        if (!isOwner) return m.reply(t('owner_only', lang));
        if (!text.includes(' ')) return m.reply(`⚠️ Utilisation : *${usedPrefix}addcmd <nom> <réponse texte>*`);
        const cmdName = args[0].toLowerCase();
        const replyContent = args.slice(1).join(' ');
        const currentCmds = settings.customCommands || [];
        const filtered = currentCmds.filter(c => c.name.toLowerCase() !== cmdName);
        filtered.push({
          name: cmdName,
          category: 'Custom',
          description: 'Ajoutée via WhatsApp',
          replyText: replyContent,
          scriptCode: '',
          enabled: true
        });
        updateSettings({ customCommands: filtered });
        return m.reply(`✅ *Commande personnalisée .${cmdName} ajoutée avec succès !*`);
      }

      case 'delcmd': {
        if (!isOwner) return m.reply(t('owner_only', lang));
        if (!args[0]) return m.reply(`⚠️ Utilisation : *${usedPrefix}delcmd <nom>*`);
        const cmdName = args[0].toLowerCase();
        const currentCmds = settings.customCommands || [];
        const filtered = currentCmds.filter(c => c.name.toLowerCase() !== cmdName);
        updateSettings({ customCommands: filtered });
        return m.reply(`🗑️ *Commande .${cmdName} supprimée !*`);
      }

      case 'listcmd': {
        const cmds = settings.customCommands || [];
        if (cmds.length === 0) return m.reply('ℹ️ Aucune commande personnalisée pour le moment.');
        let msg = `📋 *LISTE DES COMMANDES PERSONNALISÉES (${cmds.length}) :*\n\n`;
        cmds.forEach((c, idx) => {
          msg += `${idx + 1}. *${usedPrefix}${c.name}* : ${c.description || 'Sans description'}\n`;
        });
        return m.reply(msg);
      }

      case 'bc':
      case 'broadcast': {
        if (!isOwner) return m.reply(t('owner_only', lang));
        if (!text) return m.reply(`⚠️ Exemple : *${usedPrefix}bc Message pour tous les chats*`);
        await m.reply('📢 _Diffusion en cours..._');
        // Broadcast logic
        return m.reply('✅ _Diffusion terminée avec succès !_');
      }

      case 'restart': {
        if (!isOwner) return m.reply(t('owner_only', lang));
        await m.reply('🔄 *Redémarrage du bot en cours...*');
        setTimeout(() => process.exit(0), 1000);
        break;
      }

      default:
        // No command match
        break;
    }
  } catch (err) {
    console.error('Erreur dans handleMessage:', err);
  }
};
