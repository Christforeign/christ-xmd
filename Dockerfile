FROM node:22-bullseye-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    imagemagick \
    webp \
    git \
    && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm install --legacy-peer-deps

COPY . .

EXPOSE 3000

ENV PORT=3000 \
    BOT_NAME=CHRIST-X-MD \
    OWNER_NUMBER=50937081286

CMD ["npm", "start"]
