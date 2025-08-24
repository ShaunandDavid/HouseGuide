declare namespace NodeJS {
  interface ProcessEnv {
    JWT_SECRET: string;
    FRONTEND_URL: string;
    NODE_ENV?: "development" | "production" | "test";
  }
}
