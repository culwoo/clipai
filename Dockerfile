# Multi-stage build for production
FROM node:18-alpine AS builder

# Frontend build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# Backend build
WORKDIR /app/server
COPY server/package*.json ./
RUN npm install
COPY server/ .
RUN npm run build

# Production stage
FROM node:18-alpine AS production

# Install ffmpeg for video processing
RUN apk add --no-cache ffmpeg

WORKDIR /app

# Copy backend built files
COPY --from=builder /app/server/dist ./server/dist
COPY --from=builder /app/server/node_modules ./server/node_modules
COPY --from=builder /app/server/package*.json ./server/

# Copy frontend built files
COPY --from=builder /app/dist ./public

# Create necessary directories
RUN mkdir -p /app/uploads /app/data

# Expose port
EXPOSE 3002

# Start server
WORKDIR /app/server
CMD ["node", "dist/index.js"]