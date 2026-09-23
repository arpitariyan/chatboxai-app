# Production Dockerfile for ChatBox AI Mobile API
FROM node:22-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies including tsx
RUN npm install

# Copy application source
COPY tsconfig.json ./
COPY src/server ./src/server

ENV PORT=3001
ENV NODE_ENV=production

EXPOSE 3001

CMD ["npx", "tsx", "src/server/index.ts"]
