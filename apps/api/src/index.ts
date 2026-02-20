import { config } from "dotenv";
import { resolve, join } from "path";

config({ path: resolve(__dirname, "../../.env") });
import Fastify from "fastify";
import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import fastifyStatic from "@fastify/static";
import jwt from "@fastify/jwt";
import authPlugin from "./plugins/auth";
import authRoutes from "./routes/auth";
import suppliersRoutes from "./routes/suppliers";
import weighingsRoutes from "./routes/weighings";
import uploadRoutes from "./routes/upload";
import exportRoutes from "./routes/export";
import statsRoutes from "./routes/stats";

const app = Fastify({ logger: true });

async function main() {
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    throw new Error("JWT_SECRET environment variable is required");
  }

  await app.register(cors, { origin: true });
  await app.register(multipart);
  const uploadDir = join(process.cwd(), process.env.UPLOAD_DIR ?? "uploads");
  await app.register(fastifyStatic, {
    root: uploadDir,
    prefix: "/uploads/",
  });
  await app.register(jwt, { secret: jwtSecret });
  await app.register(authPlugin);
  await app.register(authRoutes);
  await app.register(suppliersRoutes);
  await app.register(weighingsRoutes);
  await app.register(uploadRoutes);
  await app.register(exportRoutes);
  await app.register(statsRoutes);

  app.get("/api/health", async () => ({ ok: true }));

  const port = Number(process.env.PORT) || 4000;
  await app.listen({ port, host: "0.0.0.0" });
}

main().catch((err) => {
  app.log.error(err);
  process.exit(1);
});
