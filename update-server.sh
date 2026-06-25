#!/bin/bash
# 服务器一键更新脚本
# 用法：在服务器上执行 bash update-server.sh

set -e
cd /opt/health-page

echo "📦 拉取最新代码..."
git stash 2>/dev/null
git pull origin main

echo "📦 安装依赖..."
cd backend && npm install --production --omit=dev

echo "🔄 重启服务..."
pm2 restart health-tracker

echo "✅ 更新完成！"
pm2 logs health-tracker --lines 5 --nostream
