# ============================================
# 贵金属期货交易系统 - 后端 Dockerfile
# ============================================

# 使用官方 Node.js 镜像作为基础
FROM node:20-alpine

# 设置工作目录
WORKDIR /app

# 复制 package 文件
COPY server/package*.json ./

# 安装生产依赖
RUN npm ci --only=production

# 复制源代码
COPY server/ ./

# 构建 TypeScript
RUN npm run build

# 创建非 root 用户
RUN addgroup -g nodejs && adduser -g nodejs -u nodejs
USER nodejs

# 暴露端口
EXPOSE 3001

# 健康检查
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3001/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1))"

# 启动应用
CMD ["node", "dist/index.js"]
