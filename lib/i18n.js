const TRANSLATIONS = {
  fr: {
    name: 'Français',
    flag: '🇫🇷',
    menu_title: 'TABLEAU DES COMMANDES',
    menu_desc: 'Voici la liste complète des fonctionnalités disponibles.',
    bot_info: 'INFOS DU BOT',
    owner: 'Créateur',
    mode: 'Mode',
    prefix: 'Préfixe',
    uptime: 'En ligne depuis',
    speed: 'Vitesse',
    version: 'Version',
    commands_count: 'Commandes totales',
    powered_by: 'Propulsé par Christ Foreign',
    
    // Categories
    cat_general: 'GÉNÉRAL & INFOS',
    cat_media: 'CONVERTISSEURS & MÉDIAS',
    cat_group: 'GESTION DE GROUPE',
    cat_fun: 'JEUX & DIVERTISSEMENT',
    cat_tools: 'OUTILS PRATIQUES',
    cat_owner: 'COMMANDES CRÉATEUR',
    cat_custom: 'COMMANDES PERSONNALISÉES',

    // Replies
    wait: '⏳ _Traitement en cours, veuillez patienter..._',
    done: '✅ *Action terminée avec succès !*',
    error: '❌ *Une erreur est survenue lors de l\'exécution.*',
    admin_only: '⚠️ *Cette commande est réservée aux administrateurs du groupe.*',
    bot_admin: '⚠️ *Le bot doit être administrateur du groupe pour exécuter cette commande.*',
    owner_only: '👑 *Cette commande est strictement réservée au créateur du bot.*',
    group_only: '👥 *Cette commande fonctionne uniquement dans les groupes.*',
    private_only: '📩 *Cette commande fonctionne uniquement en discussion privée.*',
    lang_changed: '🌐 Langue changée avec succès en : *Français*'
  },
  en: {
    name: 'English',
    flag: '🇬🇧',
    menu_title: 'COMMANDS MENU',
    menu_desc: 'Here is the full list of available features.',
    bot_info: 'BOT INFO',
    owner: 'Owner',
    mode: 'Mode',
    prefix: 'Prefix',
    uptime: 'Uptime',
    speed: 'Speed',
    version: 'Version',
    commands_count: 'Total Commands',
    powered_by: 'Powered by Christ Foreign',

    // Categories
    cat_general: 'GENERAL & INFO',
    cat_media: 'MEDIA & CONVERTERS',
    cat_group: 'GROUP MANAGEMENT',
    cat_fun: 'FUN & GAMES',
    cat_tools: 'USEFUL TOOLS',
    cat_owner: 'OWNER COMMANDS',
    cat_custom: 'CUSTOM COMMANDS',

    // Replies
    wait: '⏳ _Processing, please wait..._',
    done: '✅ *Action completed successfully!*',
    error: '❌ *An error occurred during execution.*',
    admin_only: '⚠️ *This command is restricted to group admins.*',
    bot_admin: '⚠️ *The bot must be an admin in this group to run this command.*',
    owner_only: '👑 *This command is strictly reserved for the bot owner.*',
    group_only: '👥 *This command can only be used in groups.*',
    private_only: '📩 *This command can only be used in private chat.*',
    lang_changed: '🌐 Language successfully changed to: *English*'
  },
  es: {
    name: 'Español',
    flag: '🇪🇸',
    menu_title: 'MENÚ DE COMANDOS',
    menu_desc: 'Aquí está la lista completa de funciones disponibles.',
    bot_info: 'INFO DEL BOT',
    owner: 'Creador',
    mode: 'Modo',
    prefix: 'Prefijo',
    uptime: 'Tiempo activo',
    speed: 'Velocidad',
    version: 'Versión',
    commands_count: 'Comandos totales',
    powered_by: 'Desarrollado por Christ Foreign',

    // Categories
    cat_general: 'GENERAL E INFO',
    cat_media: 'MEDIOS Y CONVERTIDORES',
    cat_group: 'GESTIÓN DE GRUPO',
    cat_fun: 'JUEGOS Y DIVERSIÓN',
    cat_tools: 'HERRAMIENTAS ÚTILES',
    cat_owner: 'COMANDOS DEL DUEÑO',
    cat_custom: 'COMANDOS PERSONALIZADOS',

    // Replies
    wait: '⏳ _Procesando, por favor espere..._',
    done: '✅ *¡Acción completada con éxito!*',
    error: '❌ *Ocurrió un error durante la ejecución.*',
    admin_only: '⚠️ *Este comando es solo para administradores del grupo.*',
    bot_admin: '⚠️ *El bot debe ser administrador para ejecutar este comando.*',
    owner_only: '👑 *Este comando es exclusivo para el dueño del bot.*',
    group_only: '👥 *Este comando solo funciona en grupos.*',
    private_only: '📩 *Este comando solo funciona en chat privado.*',
    lang_changed: '🌐 Idioma cambiado con éxito a: *Español*'
  },
  ht: {
    name: 'Kreyòl Ayisyen',
    flag: '🇭🇹',
    menu_title: 'LIS KOMAND YO',
    menu_desc: 'Men tout lis fonksyon ki disponib nan bot la.',
    bot_info: 'ENFÒMASYON SOU BÒT LA',
    owner: 'Mèt Bòt la',
    mode: 'Mòd',
    prefix: 'Prefiks',
    uptime: 'Tan li an liy',
    speed: 'Vitès',
    version: 'Vèsyon',
    commands_count: 'Kantite komand',
    powered_by: 'Kreye pa Christ Foreign',

    // Categories
    cat_general: 'JENERAL & ENFÒMASYON',
    cat_media: 'MEDYA & KONVÈTISÈ',
    cat_group: 'JERANS GWOU P',
    cat_fun: 'JWÈT & ANBIYANS',
    cat_tools: 'ZOUTI ITIL',
    cat_owner: 'KOMAND POU MÈT LA',
    cat_custom: 'KOMAND PÈSONALIZE',

    // Replies
    wait: '⏳ _Nap trete demann ou an, tanpri pasyante..._',
    done: '✅ *Aksyon an fèt ak siksè !*',
    error: '❌ *Gen yon erè ki fèt pandan egzekisyon an.*',
    admin_only: '⚠️ *Komand sa a se sèlman pou admin gwoup la.*',
    bot_admin: '⚠️ *Fòk bot la admin nan gwoup la pou l ka fè sa.*',
    owner_only: '👑 *Komand sa a se sèlman pou mèt bot la.*',
    group_only: '👥 *Komand sa a mache sèlman anndan gwoup.*',
    private_only: '📩 *Komand sa a mache sèlman nan mesaj prive.*',
    lang_changed: '🌐 Lang lan chanje ak siksè pou : *Kreyòl Ayisyen*'
  }
};

const userLangs = {};

function getUserLang(userId, defaultLang = 'fr') {
  return userLangs[userId] || defaultLang || 'fr';
}

function setUserLang(userId, lang) {
  if (TRANSLATIONS[lang]) {
    userLangs[userId] = lang;
    return true;
  }
  return false;
}

function t(key, lang = 'fr') {
  const selectedLang = TRANSLATIONS[lang] ? lang : 'fr';
  return TRANSLATIONS[selectedLang][key] || TRANSLATIONS['fr'][key] || key;
}

module.exports = {
  TRANSLATIONS,
  getUserLang,
  setUserLang,
  t
};
