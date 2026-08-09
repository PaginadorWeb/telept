FROM node:22-slim

WORKDIR /app

COPY package.json package-lock.json* ./

RUN npm install --omit=dev \
    && npx playwright install --with-deps chromium \
    && npm cache clean --force

COPY . .

RUN mkdir -p /app/data

ENV PORT=3000
EXPOSE 3000

CMD ["node", "entrypoint.mjs"]