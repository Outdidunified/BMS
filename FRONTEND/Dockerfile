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

# Install dependencies (skip lefthook in Docker environment)
ENV CI=true LEFTHOOK=0
RUN pnpm install

# Copy source code
COPY . .

# Build the application
RUN pnpm run build

# Production stage
FROM nginx:alpine

# Copy built files to nginx
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy nginx configuration
COPY nginx.conf /etc/nginx/nginx.conf

EXPOSE 7777

CMD ["nginx", "-g", "daemon off;"]