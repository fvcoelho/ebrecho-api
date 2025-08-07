# Use Alpine Linux for smaller image and better sharp support
FROM node:18-alpine AS base

# Install required libraries for Prisma, sharp, and health checks
RUN apk add --no-cache \
    openssl \
    ca-certificates \
    curl \
    vips-dev \
    python3 \
    make \
    g++

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install --production

# Copy source code
COPY . .

# Generate Prisma client for correct platform
RUN npx prisma generate --generator client

# Remove dev dependencies (but keep tsx for runtime)
RUN npm install --production tsx

# Expose port
EXPOSE 3001

# Create non-root user (Alpine commands)
RUN addgroup -g 1001 -S nodejs
RUN adduser -S -u 1001 -G nodejs -h /home/nextjs -s /bin/sh nextjs

# Change ownership of app directory
RUN chown -R nextjs:nodejs /app
USER nextjs

# Set HOME environment variable
ENV HOME=/home/nextjs

# Start the application
CMD ["npx", "tsx", "src/server.ts"]