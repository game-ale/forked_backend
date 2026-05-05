FROM node:20-bookworm-slim

WORKDIR /opt/render/project/src

COPY package.json package-lock.json ./
COPY prisma ./prisma

RUN npm ci && npm run prisma:generate

COPY src ./src
COPY tools ./tools
COPY scripts ./scripts

ENV APP_ENV=production \
    HOST=0.0.0.0 \
    PORT=10000

CMD ["npm", "start"]
