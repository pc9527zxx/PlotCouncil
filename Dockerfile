# Build stage for frontend
FROM node:20-alpine AS frontend-builder

WORKDIR /app

# Copy package files
COPY package*.json ./
RUN npm ci

# Copy source code
COPY . .

# Set build-time environment variable for API URL
# Frontend will call same-origin /render endpoint
ENV VITE_RENDER_API_URL=/render

# Build frontend
RUN npm run build

# Python runtime stage
FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    g++ \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy Python requirements
COPY server/requirements.txt ./server/

# Install Python dependencies
RUN pip install --no-cache-dir -r server/requirements.txt

# Copy server code
COPY server/ ./server/

# Copy built frontend from builder stage
COPY --from=frontend-builder /app/dist ./dist

# Expose ports
EXPOSE 8032

# Set working directory to server
WORKDIR /app/server

# Run the application
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8032"]
