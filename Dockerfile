# ============================================================================
# Multi-Stage Dockerfile for Insurance AI Frontend
# ============================================================================

# Stage 1: Development with Hot-Reload
FROM node:18-alpine as development

WORKDIR /app

# Install dependencies separately for better caching
COPY package*.json ./
RUN npm install

# Copy application code
COPY . .

# Expose Vite default port
EXPOSE 5173

# Run Vite in host mode so it's accessible outside the container
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]

# Stage 2: Build for Production
FROM node:18-alpine as build

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

# Stage 3: Production Server (Nginx)
FROM nginx:stable-alpine as production

# Copy build artifacts to Nginx
COPY --from=build /app/dist /usr/share/nginx/html

# Expose Nginx port
EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
