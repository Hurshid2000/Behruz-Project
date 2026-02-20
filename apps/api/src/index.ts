import Fastify from "fastify";
import cors from "@fastify/cors";

const app = Fastify({ logger: true });

async function main() {
  await app.register(cors, { origin: true });
  app.get("/api/health", async () => ({ ok: true }));

  const port = Number(process.env.PORT) || 4000;
  await app.listen({ port, host: "0.0.0.0" });
}

main().catch((err) => {
  app.log.error(err);
  process.exit(1);
});
