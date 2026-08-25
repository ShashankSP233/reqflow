module.exports = {
  apps: [
    {
      name: "reqflow-api",
      script: "cmd.exe",
      args: "/c pnpm --filter @workspace/api-server run dev",
      cwd: "D:\\reqflow",
      env: {
        PORT: 8080,
      },
    },
    {
      name: "reqflow-web",
      script: "cmd.exe",
      args: "/c pnpm --filter @workspace/requisition run dev",
      cwd: "D:\\reqflow",
      env: {
        PORT: 21455,
        BASE_PATH: "/",
      },
    },
  ],
};