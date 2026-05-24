### Multi-stage Dockerfile for BridgeMind (Cloud Run ready)
FROM node:20-alpine AS build
WORKDIR /app

# Install deps
COPY package.json package-lock.json* ./
RUN npm ci --only=production || npm install

# Copy sources and build
COPY . .
RUN npm run build

FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

# Copy only what's needed from build stage
COPY --from=build /app/dist ./dist
COPY --from=build /app/package.json ./package.json

EXPOSE 8080
ENV PORT=8080

CMD ["node", "dist/server.cjs"]
