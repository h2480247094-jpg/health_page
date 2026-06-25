#!/bin/bash
# ==========================================
# 健康管理 App — 腾讯云服务器一键部署脚本
# 使用方法：在服务器上运行 bash deploy.sh
# ==========================================
set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${GREEN}====================================${NC}"
echo -e "${GREEN}  健康管理 App 部署脚本${NC}"
echo -e "${GREEN}====================================${NC}"

# ---------- 1. 基础环境 ----------
echo -e "\n${YELLOW}[1/6] 安装系统依赖...${NC}"
sudo apt update -y
sudo apt install -y nginx git curl

# Node.js 20 LTS（如果没装）
if ! command -v node &> /dev/null; then
    echo -e "${YELLOW}安装 Node.js...${NC}"
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt install -y nodejs
fi
echo "Node.js $(node -v), npm $(npm -v)"

# ---------- 2. 部署代码 ----------
echo -e "\n${YELLOW}[2/6] 部署项目代码...${NC}"
APP_DIR="/home/ubuntu/health-page"

if [ -d "$APP_DIR" ]; then
    echo "项目目录已存在，更新代码..."
    cd "$APP_DIR"
    git pull || echo "git pull 失败，使用现有代码"
else
    # 从 GitHub 拉取
    echo "克隆项目..."
    cd /home/ubuntu
    git clone https://github.com/h2480247094-jpg/health_page.git health-page || {
        echo -e "${RED}克隆失败！请确认仓库地址正确且服务器能访问 GitHub${NC}"
        echo "备用方案：手动上传文件到 $APP_DIR"
        exit 1
    }
fi

# ---------- 3. 后端依赖 ----------
echo -e "\n${YELLOW}[3/6] 安装后端依赖...${NC}"
cd "$APP_DIR/backend"

# 国内用 npmmirror 加速
npm config set registry https://registry.npmmirror.com
npm install --production

# 创建必要目录
mkdir -p data uploads/photos logs

# ---------- 4. 环境配置 ----------
echo -e "\n${YELLOW}[4/6] 配置环境变量...${NC}"
if [ ! -f ".env" ]; then
    if [ -f ".env.production" ]; then
        cp .env.production .env
    fi
fi

# 生成随机 JWT_SECRET
JWT_RANDOM=$(openssl rand -hex 32 2>/dev/null || node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
sed -i "s/change_me_to_a_random_64_char_string/$JWT_RANDOM/" .env

echo "JWT_SECRET 已自动生成"
echo "⚠️  请根据需要修改 .env 中的 DEEPSEEK_API_KEY"

# ---------- 5. Nginx 配置 ----------
echo -e "\n${YELLOW}[5/6] 配置 Nginx...${NC}"
sudo cp "$APP_DIR/nginx.conf" /etc/nginx/sites-available/health-tracker

# 替换路径占位符
sudo sed -i "s|/home/ubuntu/health-page|$APP_DIR|g" /etc/nginx/sites-available/health-tracker

# 启用站点
sudo ln -sf /etc/nginx/sites-available/health-tracker /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default

# 测试并重载 Nginx
sudo nginx -t && sudo systemctl reload nginx
echo "Nginx 配置完成"

# ---------- 6. PM2 启动 ----------
echo -e "\n${YELLOW}[6/6] 启动服务...${NC}"
cd "$APP_DIR/backend"

# 安装 PM2
if ! command -v pm2 &> /dev/null; then
    sudo npm install -g pm2
fi

# 启动/重启
pm2 delete health-tracker 2>/dev/null || true
pm2 start ecosystem.config.js
pm2 save
pm2 startup systemd -u ubuntu --hp /home/ubuntu 2>/dev/null || true

# ---------- 完成 ----------
echo -e "\n${GREEN}====================================${NC}"
echo -e "${GREEN}  🎉 部署完成！${NC}"
echo -e "${GREEN}====================================${NC}"
echo ""
echo "访问地址：http://$(curl -s ifconfig.me 2>/dev/null || echo '你的服务器IP')"
echo ""
echo "常用命令："
echo "  pm2 status          — 查看服务状态"
echo "  pm2 logs            — 查看日志"
echo "  pm2 restart health-tracker — 重启服务"
echo "  sudo nginx -s reload       — Nginx 重载配置"
