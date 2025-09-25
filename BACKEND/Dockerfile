# FROM node:18-alpine
# WORKDIR /app
# COPY . .
# RUN npm install
# EXPOSE 3003
# CMD ["npm", "start"]

# ===== Base Stage =====
FROM node:18-alpine AS base
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .

# ===== UAT Stage =====
FROM base AS uat
ENV NODE_ENV=uat
RUN npm run build || echo "No UAT build step"
EXPOSE 8070
CMD ["npm", "start"]

# ===== Production Stage =====
FROM base AS production
ENV NODE_ENV=production
RUN npm run build || echo "No production build step"
EXPOSE 8070
CMD ["npm", "start"]

