module.exports = {
  apps: [
    {
      name: "dashboard",
      script: "npm",
      args: "start",
      env: {
        NODE_ENV: "production",
        PORT: 4003,
      },
    },
  ],
};