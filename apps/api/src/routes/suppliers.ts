import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { replyError } from "../lib/errors";

const createSupplierSchema = z.object({ name: z.string().min(1).max(255) });
const patchSupplierSchema = z.object({ name: z.string().min(1).max(255) });

export default async function suppliersRoutes(app: FastifyInstance) {
  app.get("/api/suppliers", {
    onRequest: [app.authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const suppliers = await prisma.supplier.findMany({
      orderBy: { name: "asc" },
    });
    return reply.send(suppliers);
  });

  app.post("/api/suppliers", {
    onRequest: [app.authenticate, app.requireRoles(["admin", "operator"])],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const parseResult = createSupplierSchema.safeParse(request.body);
    if (!parseResult.success) {
      return replyError(reply, 400, {
        message: "Invalid input",
        code: "VALIDATION_ERROR",
        details: parseResult.error.flatten(),
      });
    }
    const { name } = parseResult.data;

    try {
      const supplier = await prisma.supplier.create({ data: { name } });
      return reply.status(201).send(supplier);
    } catch (e) {
      if (e && typeof e === "object" && "code" in e && e.code === "P2002") {
        return replyError(reply, 409, { message: "Supplier with this name already exists", code: "CONFLICT" });
      }
      throw e;
    }
  });

  app.patch("/api/suppliers/:id", {
    onRequest: [app.authenticate, app.requireRoles(["admin", "operator"])],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const parseResult = patchSupplierSchema.safeParse(request.body);
    if (!parseResult.success) {
      return replyError(reply, 400, {
        message: "Invalid input",
        code: "VALIDATION_ERROR",
        details: parseResult.error.flatten(),
      });
    }
    const { name } = parseResult.data;
    const id = (request.params as { id: string }).id;

    try {
      const supplier = await prisma.supplier.update({
        where: { id },
        data: { name },
      });
      return reply.send(supplier);
    } catch (e) {
      if (e && typeof e === "object" && "code" in e) {
        if (e.code === "P2025") {
          return replyError(reply, 404, { message: "Supplier not found", code: "NOT_FOUND" });
        }
        if (e.code === "P2002") {
          return replyError(reply, 409, { message: "Supplier with this name already exists", code: "CONFLICT" });
        }
      }
      throw e;
    }
  });
}
