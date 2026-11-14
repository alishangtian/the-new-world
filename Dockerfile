# the-new-world · 平台容器镜像（零依赖：node:24-alpine + 纯 JS）
FROM node:24-alpine

LABEL org.opencontainers.image.title="the-new-world agent 平台"
LABEL org.opencontainers.image.description="考察世界上的 agent 平台知识，按规律持续构建自身。控制台 + MCP 双传输（stdio/HTTP）。"
LABEL org.opencontainers.image.source="https://github.com/alishangtian/the-new-world"

WORKDIR /app

# 运行所需：控制台、MCP（含调度器/验收门依赖的仓库资产）、知识库与账本
COPY . .

ENV PORT=3000
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/healthz || exit 1

CMD ["node", "platform/mcp/http.mjs"]
