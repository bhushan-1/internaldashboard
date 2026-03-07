const path = require("path");

module.exports = {
  apps: [
    {
      name: "td-api",
      script: "server/index.cjs",
      cwd: __dirname,
      env_file: path.resolve(__dirname, ".env.production"),
      env: {
        NODE_ENV: "production",
      },
      instances: 1,
      autorestart: true,
      max_memory_restart: "500M",
      log_date_format: "YYYY-MM-DD HH:mm:ss",
      error_file: "logs/api-error.log",
      out_file: "logs/api-out.log",
      merge_logs: true,
    },
  ],
};
