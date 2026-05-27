module.exports = {
  apps: [
    {
      name: 'threemode-api',
      cwd: './backend',
      script: 'dist/main.js',
      instances: 2,
      exec_mode: 'cluster',
      watch: false,
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'production',
      },
      // 日志
      error_file: '/var/log/threemode/error.log',
      out_file: '/var/log/threemode/out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      // 重启策略
      min_uptime: '10s',
      max_restarts: 10,
      restart_delay: 4000,
      // 优雅关闭
      kill_timeout: 5000,
      listen_timeout: 10000,
    },
  ],
}
