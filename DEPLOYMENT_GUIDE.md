# 🚀 GUIDE DE DÉPLOIEMENT COMPLET — CHRIST-X-MD

Ce guide explique étape par étape comment déployer **CHRIST-X-MD** sur plus de 8 plateformes gratuites ou 24/7.

---

## 1. RENDER.COM (Recommandé — Synchronisation GitHub 24/7)
1. Va sur [render.com](https://render.com) et connecte-toi avec ton compte **GitHub**.
2. Clique sur **New +** puis **Web Service**.
3. Sélectionne ton dépôt GitHub (`MR-CHRIST-X-BOT-MD-V1`).
4. Remplis les champs :
   - **Name :** `christ-x-md`
   - **Region :** Frankfurt ou Oregon
   - **Branch :** `main`
   - **Runtime :** `Node`
   - **Build Command :** `npm install`
   - **Start Command :** `npm start`
   - **Plan :** `Free`
5. Dans **Environment Variables**, ajoute :
   - `PORT` = `3000`
   - `OWNER_NUMBER` = `50937081286`
   - `BOT_NAME` = `CHRIST-X-MD`
6. Clique sur **Create Web Service**. Dès que tu fais un commit sur GitHub, Render redéploie le bot tout seul !

---

## 2. KOYEB.COM (Conteneurs Docker 24/7)
1. Va sur [koyeb.com](https://koyeb.com) et crée un compte.
2. Clique sur **Create App** puis sélectionne **GitHub**.
3. Choisis ton dépôt.
4. Koyeb va détecter le `Dockerfile` automatiquement.
5. Règle le port sur `3000` (Protocole HTTP).
6. Clique sur **Deploy**.

---

## 3. RAILWAY.APP (Déploiement Instantané)
1. Va sur [railway.app](https://railway.app) et connecte-toi avec GitHub.
2. Clique sur **New Project** > **Deploy from GitHub repo**.
3. Choisis ton dépôt.
4. Railway utilise le fichier `railway.json` et lance le bot automatiquement.
5. Dans les paramètres de l'app, génère un domaine public (`Generate Domain`) pour accéder au Dashboard web.

---

## 4. KATABUMP / BOT-HOSTING.NET / PANEL PTERODACTYL (Envoi ZIP)
1. Télécharge le projet sous format **ZIP** (via GitHub Code > Download ZIP).
2. Connecte-toi sur ton panel (Katabump ou Bot-Hosting.net).
3. Va dans le gestionnaire de fichiers (**File Manager**).
4. Téléverse le fichier `.zip` et clique sur **Unarchive / Extraire**.
5. Assure-toi que la version de Node.js est **Node 18+ ou Node 22**.
6. Clique sur **Console** puis **Start**.

---

## 5. ORACLE CLOUD FREE TIER (VPS Linux 24/7 Gratuit à Vie)
1. Crée une instance VPS gratuite sur Oracle Cloud (Ubuntu 22.04 ou 24.04).
2. Connecte-toi en SSH sur ton VPS :
   ```bash
   ssh ubuntu@ton-ip
   ```
3. Installe Node.js et PM2 :
   ```bash
   sudo apt update && sudo apt upgrade -y
   sudo apt install -y nodejs npm git ffmpeg imagemagick
   sudo npm install -g pm2
   ```
4. Clone ton projet et lance-le en 24/7 :
   ```bash
   git clone https://github.com/Christforeign/MR-CHRIST-X-BOT-MD-V1.git
   cd MR-CHRIST-X-BOT-MD-V1
   npm install
   pm2 start main.js --name "christ-x-md"
   pm2 save
   pm2 startup
   ```

---

## 6. FLY.IO
1. Installe la CLI flyctl (`curl -L https://fly.io/install.sh | sh`).
2. Dans le dossier du bot, exécute :
   ```bash
   fly launch
   ```
3. Réponds aux questions et lance le déploiement :
   ```bash
   fly deploy
   ```

---

## 7. HEROKU / OKTETO / DOCKER
1. Avec Docker installé :
   ```bash
   docker build -t christ-x-md .
   docker run -d -p 3000:3000 --name christ-x-md christ-x-md
   ```
2. Ou via Docker Compose :
   ```bash
   docker compose up -d
   ```

---

## 8. TERMUX (Smartphone Android 24/7)
1. Installe **Termux** depuis F-Droid.
2. Ouvre Termux et exécute :
   ```bash
   pkg update && pkg upgrade -y
   pkg install -y git nodejs ffmpeg imagemagick
   npm install -g pm2
   git clone https://github.com/Christforeign/MR-CHRIST-X-BOT-MD-V1.git
   cd MR-CHRIST-X-BOT-MD-V1
   npm install
   pm2 start main.js --name "christ-x-md"
   pm2 logs
   ```
