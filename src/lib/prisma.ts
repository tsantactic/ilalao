import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});

const prismaClientAdapter = () => {
  return new PrismaClient({ adapter } as any);
};

declare const globalThis: {
  prismaGlobal: ReturnType<typeof prismaClientAdapter>;
} & typeof global;
const prisma = (globalThis as any).prismaGlobal ?? prismaClientAdapter();

export default prisma;
if (process.env.NODE_ENV !== "production") (globalThis as any).prismaGlobal = prisma;
