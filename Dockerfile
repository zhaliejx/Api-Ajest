FROM node:21-slim

# Runtime libs for Chromium (Puppeteer CF-solver used by kickassanime/animekai)
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates curl gnupg git \
    libnss3 libnspr4 libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 \
    libxkbcommon0 libxcomposite1 libxdamage1 libxfixes3 libxrandr2 \
    libgbm1 libasound2 libpango-1.0-0 libcairo2 libglib2.0-0 \
    fonts-liberation xdg-utils \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /ani

COPY src /ani/src/
COPY package.json /ani/
COPY tsconfig.json /ani/

RUN npm install
RUN npm run build

ENV PORT=3001
EXPOSE 3001
CMD ["npm", "run", "start"]
