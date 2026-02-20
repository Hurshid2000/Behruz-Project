import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { createWriteStream } from "fs";
import { mkdir } from "fs/promises";
import { pipeline } from "stream/promises";
import { randomUUID } from "crypto";
import path from "path";
import { replyError } from "../lib/errors";

const UPLOAD_DIR = process.env.UPLOAD_DIR ?? "./uploads";
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

export default async function uploadRoutes(app: FastifyInstance) {
  app.post("/api/upload", {
    onRequest: [app.authenticate, app.requireRoles(["admin", "operator"])],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const data = await request.file();
    if (!data) {
      return replyError(reply, 400, { message: "No file uploaded", code: "NO_FILE" });
    }

    const contentType = data.mimetype;
    if (!ALLOWED_TYPES.includes(contentType)) {
      return replyError(reply, 400, {
        message: `Invalid file type. Allowed: ${ALLOWED_TYPES.join(", ")}`,
        code: "INVALID_TYPE",
      });
    }

    const ext = contentType === "image/jpeg" ? "jpg" : contentType === "image/png" ? "png" : "webp";
    const filename = `${randomUUID()}.${ext}`;
    const dir = path.resolve(process.cwd(), UPLOAD_DIR);
    const filepath = path.join(dir, filename);

    try {
      await mkdir(dir, { recursive: true });
      await pipeline(data.file, createWriteStream(filepath));
    } catch (e) {
      request.log.error(e, "Upload failed");
      return replyError(reply, 500, { message: "Upload failed", code: "UPLOAD_ERROR" });
    }

    const baseUrl = process.env.API_PUBLIC_URL ?? "http://localhost:4000";
    const photoUrl = `${baseUrl}/uploads/${filename}`;
    return reply.send({ photoUrl });
  });
}
