import { config } from "dotenv";
import { resolve } from "path";

config({ path: resolve(__dirname, "../../.env") });
import Fastify from "fastify";
import cors from "@fastify/cors";
import jwt from "@fastify/jwt";
import authPlugin from "./plugins/auth";
import authRoutes from "./routes/auth";
import suppliersRoutes from "./routes/suppliers";
import weighingsRoutes from "./routes/weighings";

const app = Fastify({ logger: true });

async function main() {
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    throw new Error("JWT_SECRET environment variable is required");
  }

  await app.register(cors, { origin: true });
  await app.register(jwt, { secret: jwtSecret });
  await app.register(authPlugin);
  await app.register(authRoutes);
  await app.register(suppliersRoutes);
  await app.register(weighingsRoutes);

  app.get("/api/health", async () => ({ ok: true }));

  const port = Number(process.env.PORT) || 4000;
  await app.listen({ port, host: "0.0.0.0" });
}

main().catch((err) => {
  app.log.error(err);
  process.exit(1);
});
