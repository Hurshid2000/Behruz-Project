import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import { compare } from "bcryptjs";
import { prisma } from "../lib/prisma";
import { replyError } from "../lib/errors";

const loginBodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export default async function authRoutes(app: FastifyInstance) {
  app.post("/api/auth/login", async (request: FastifyRequest, reply: FastifyReply) => {
    const parseResult = loginBodySchema.safeParse(request.body);
    if (!parseResult.success) {
      return replyError(reply, 400, {
        message: "Invalid input",
        code: "VALIDATION_ERROR",
        details: parseResult.error.flatten(),
      });
    }
    const { email, password } = parseResult.data;

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return replyError(reply, 401, { message: "Invalid email or password", code: "INVALID_CREDENTIALS" });
    }

    const valid = await compare(password, user.passwordHash);
    if (!valid) {
      return replyError(reply, 401, { message: "Invalid email or password", code: "INVALID_CREDENTIALS" });
    }

    const token = app.jwt.sign(
      { sub: user.id, role: user.role },
      { expiresIn: process.env.JWT_EXPIRES_IN ?? "7d" }
    );

    return reply.send({
      token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
      },
    });
  });

  app.get("/api/auth/me", {
    onRequest: [app.authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const payload = request.user as { sub: string };
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, email: true, role: true },
    });
    if (!user) {
      return replyError(reply, 404, { message: "User not found", code: "NOT_FOUND" });
    }
    return reply.send(user);
  });
}
