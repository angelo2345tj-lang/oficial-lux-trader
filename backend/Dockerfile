FROM node:22-alpine
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev 2>/dev/null || npm install --omit=dev
COPY backend ./backend
WORKDIR /app/backend
RUN npm ci --omit=dev 2>/dev/null || npm install --omit=dev
RUN npm run build
EXPOSE 3001
ENV NODE_ENV=production
CMD ["npm", "run", "start:prod"]
