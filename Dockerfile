# Multi-stage Dockerfile for AmourScans
# Optimized for Fly.io deployment with SQLite persistence

# Stage 1: Build
FROM node:20-alpine AS builder

# Set working directory
WORKDIR /app

# Install build dependencies (Python for better-sqlite3 native compilation)
RUN apk add --no-cache python3 make g++ sqlite

# Copy package files
COPY package*.json ./

# Install ALL dependencies (including devDependencies for build)
RUN npm ci

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Stage 2: Production
FROM node:20-alpine AS production

# Install runtime dependencies
RUN apk add --no-cache \
    dumb-init \
    sqlite \
    python3 \
    make \
    g++

# Create app user for security
RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001

# Set working directory
WORKDIR /app

# Copy package files and install production dependencies only
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

# Copy built application from builder stage
COPY --from=builder --chown=nodejs:nodejs /app/dist ./dist
COPY --from=builder --chown=nodejs:nodejs /app/scripts ./scripts
COPY --from=builder --chown=nodejs:nodejs /app/shared ./shared
COPY --from=builder --chown=nodejs:nodejs /app/server ./server

# Create data directory for SQLite database
# On Fly.io, /data will be mounted as a persistent volume
RUN mkdir -p /data && chown -R nodejs:nodejs /data

# Switch to non-root user
USER nodejs

# Expose port (Fly.io expects 8080 by default)
EXPOSE 8080

# Set environment variables for Fly.io
ENV NODE_ENV=production \
    PORT=8080 \
    DATABASE_PATH=/data/database.db \
    SESSIONS_PATH=/data/sessions.db

# Health check endpoint for Fly.io monitoring
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:8080/api/health', (r) => r.statusCode === 200 ? process.exit(0) : process.exit(1))"

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start the application
CMD ["npm", "start"]

# Fly.io deployment notes:
# - /data directory will be mounted as persistent volume
# - Port 8080 is automatically mapped to HTTPS
# - Environment variables set via fly secrets
# - Database persists across deployments
