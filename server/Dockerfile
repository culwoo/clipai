# Backend Dockerfile
FROM node:18-alpine

# Install ffmpeg for video processing
RUN apk add --no-cache ffmpeg python3 make g++

WORKDIR /app

# Copy package files
COPY package*.json ./
RUN npm install

# Copy source code
COPY . .

# Build TypeScript
RUN npm run build

# Create necessary directories
RUN mkdir -p /app/uploads /app/data

# Expose port
EXPOSE 3002

# Start server
CMD ["node", "dist/index.js"]