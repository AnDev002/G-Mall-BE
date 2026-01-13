// Backend-Lovegifts/ecosystem.config.js
module.exports = {
  apps: [
    {
      name: 'lovegifts-backend',
      script: 'dist/main.js', // Đường dẫn đến file build
      instances: 'max',       // Chạy số lượng process tối đa theo số nhân CPU
      exec_mode: 'cluster',   // Chế độ Cluster
      env: {
        NODE_ENV: 'development',
      },
      env_production: {
        NODE_ENV: 'production',
      },
    },
  ],
};