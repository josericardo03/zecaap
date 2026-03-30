import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export function getPrisma(): PrismaClient {
  if (globalForPrisma.prisma) return globalForPrisma.prisma;

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL em falta. Adiciona a connection string (pooler) no .env.local."
    );
  }

  const adapter = new PrismaPg({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });

  const client = new PrismaClient({ adapter });
  globalForPrisma.prisma = client;
  return client;
}
