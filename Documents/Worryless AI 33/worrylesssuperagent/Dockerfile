# Stage 1: Build the Vite application
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
COPY bun.lock* ./
RUN npm ci
COPY . .

# VITE_ vars must be passed as build arguments (baked into JS bundle at build time)
ARG VITE_API_URL
ARG VITE_LOGTO_ENDPOINT
ARG VITE_LOGTO_APP_ID
ARG VITE_LOGTO_API_RESOURCE
ARG VITE_VAPID_PUBLIC_KEY
ARG VITE_LANGGRAPH_URL

RUN npm run build

# Stage 2: Serve with Nginx
FROM nginx:1.27-alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
