import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import fp from "fastify-plugin";
import { replyError } from "../lib/errors";
import type { RoleType } from "../lib/auth";

declare module "fastify" {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    requireRoles: (allowedRoles: RoleType[]) => (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

async function authPlugin(app: FastifyInstance) {
  app.decorate("authenticate", async function (request: FastifyRequest, reply: FastifyReply) {
    try {
      await request.jwtVerify();
    } catch {
      replyError(reply, 401, { message: "Unauthorized", code: "UNAUTHORIZED" });
    }
  });

  app.decorate(
    "requireRoles",
    (allowedRoles: RoleType[]) => async (request: FastifyRequest, reply: FastifyReply) => {
      const user = request.user as { role: string } | undefined;
      if (!user) {
        return replyError(reply, 401, { message: "Unauthorized", code: "UNAUTHORIZED" });
      }
      if (!allowedRoles.includes(user.role as RoleType)) {
        return replyError(reply, 403, { message: "Forbidden", code: "FORBIDDEN" });
      }
    }
  );
}

export default fp(authPlugin, { name: "auth-plugin" });
