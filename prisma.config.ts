import { config } from "dotenv";
import { resolve } from "node:path";
import { defineConfig } from "prisma/config";

// override: true — variáveis do Windows não devem ganhar sobre .env.local
config({ path: resolve(process.cwd(), ".env.local"), override: true });
config({ path: resolve(process.cwd(), ".env"), override: true });

// DIRECT_URL = session pooler :5432 (migrations / db pull). DATABASE_URL = transaction :6543 (app).
const url =
  process.env.DIRECT_URL ??
  process.env.DATABASE_URL ??
  "postgresql://placeholder:placeholder@127.0.0.1:5432/placeholder";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url,
  },
});
