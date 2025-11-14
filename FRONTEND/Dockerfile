# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Install git (needed for lefthook)
RUN apk add --no-cache git

# Copy package files
COPY package*.json ./
COPY pnpm-lock.yaml ./

# Install pnpm
RUN npm install -g pnpm

# Disable all git hooks and lifecycle scripts for Docker build
ENV CI=true LEFTHOOK=0 HUSKY=0 PNPM_IGNORE_SCRIPTS=1
RUN pnpm install --ignore-scripts

# Copy source code
COPY . .

# Build the application (increase Node.js memory limit, skip TypeScript check)
ENV NODE_OPTIONS="--max-old-space-size=4096"
RUN export NODE_OPTIONS="--max-old-space-size=4096" && npx vite build --max-old-space-size=4096

# Production stage
FROM nginx:alpine

# Copy built files to nginx
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy nginx configuration
COPY nginx.conf /etc/nginx/nginx.conf

EXPOSE 7777

CMD ["nginx", "-g", "daemon off;"]