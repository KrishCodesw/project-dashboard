module.exports = {
  apps: [
    {
      name: "dashboard",
      cwd: __dirname,
      script: "npm",
      args: "start",
      env: {
        PORT: "4003",
        NODE_ENV: "production",
      },
    },
  ],
};