module.exports = {
  apps: [
    {
      name: "dashboard",
      script: "node",
      args: ".next/standalone/server.js",
      env: {
        NODE_ENV: "production",
        PORT: 4003,
      },
    },
  ],
};