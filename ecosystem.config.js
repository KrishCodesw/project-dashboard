module.exports = {
  apps: [
    {
      name: "dashboard",
      cwd: __dirname,
      script: "node_modules/.bin/next",
      args: "start -p 4003",
      env: {
        NODE_ENV: "production",
      },
    },
  ],
};