FROM node:22-alpine AS builder

WORKDIR /app

# Install native build tools required by argon2 and node-gyp
RUN apk add --no-cache python3 make g++

COPY package*.json ./
COPY prisma ./prisma/

RUN npm install

COPY . .

# Generate Prisma Client BEFORE compiling TypeScript
RUN npx prisma generate
RUN npm run build

# Production Runner Stage
FROM node:22-alpine

WORKDIR /app

# Prisma engine on Alpine requires OpenSSL
RUN apk add --no-cache openssl

COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma

EXPOSE 5000

CMD ["npm", "start"]
