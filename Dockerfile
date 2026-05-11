FROM node:22-bookworm-slim
WORKDIR /app
COPY package.json package-lock.json* tsconfig.base.json ./
COPY server ./server
COPY client ./client
RUN npm install \
  && npm run build -w @syt/shared \
  && npm run build -w @syt/gateway \
  && npm run build -w @syt/auth-service \
  && npm run build -w @syt/employee-service \
  && npm run build -w @syt/department-service \
  && npm run build -w @syt/location-service \
  && npm run build -w @syt/schedule-service \
  && npm run build -w @syt/notification-service \
  && npm run build -w @syt/ai-recommendation-service \
  && npm run build -w @syt/report-service \
  && npm prune --omit=dev
