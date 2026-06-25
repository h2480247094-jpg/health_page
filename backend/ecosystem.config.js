// PM2 进程管理配置
module.exports = {
  apps: [{
    name: 'health-tracker',
    script: 'src/index.js',
    cwd: __dirname,
    env: {
      NODE_ENV: 'production',
      PORT: 3000,
    },
    // 自动重启
    autorestart: true,
    max_restarts: 10,
    // 内存超限自动重启
    max_memory_restart: '300M',
    // 日志
    error_file: './logs/error.log',
    out_file: './logs/out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss',
    // 开机自启
    instances: 1,
  }],
};
