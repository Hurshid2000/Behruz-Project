import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import { Decimal } from "@prisma/client/runtime/library";
import { prisma } from "../lib/prisma";
import { replyError } from "../lib/errors";

function toNumber(d: Decimal): number {
  return Number(d.toString());
}

const createWeighingSchema = z.object({
  carNumber: z.string().min(1).max(50),
  supplierId: z.string().optional().nullable(),
  grossWeight: z.number().positive(),
  tareCount: z.number().int().nonnegative(),
  tareWeight: z.number().nonnegative(),
  photoUrl: z.string().url().optional().nullable(),
  note: z.string().optional().nullable(),
});

const patchWeighingSchema = z.object({
  carNumber: z.string().min(1).max(50).optional(),
  supplierId: z.string().optional().nullable(),
  grossWeight: z.number().positive().optional(),
  tareCount: z.number().int().nonnegative().optional(),
  tareWeight: z.number().nonnegative().optional(),
  photoUrl: z.string().url().optional().nullable(),
  note: z.string().optional().nullable(),
});

const listQuerySchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
  supplierId: z.string().optional(),
  carNumber: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

function computeWeighingTotals(grossWeight: number, tareCount: number, tareWeight: number) {
  const tareTotal = tareCount * tareWeight;
  const netWeight = grossWeight - tareTotal;
  return { tareTotal, netWeight };
}

export default async function weighingsRoutes(app: FastifyInstance) {
  app.post("/api/weighings", {
    onRequest: [app.authenticate, app.requireRoles(["admin", "operator"])],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const parseResult = createWeighingSchema.safeParse(request.body);
    if (!parseResult.success) {
      return replyError(reply, 400, {
        message: "Invalid input",
        code: "VALIDATION_ERROR",
        details: parseResult.error.flatten(),
      });
    }
    const data = parseResult.data;
    const user = request.user as { sub: string };

    const { tareTotal, netWeight } = computeWeighingTotals(
      data.grossWeight,
      data.tareCount,
      data.tareWeight
    );

    const weighing = await prisma.weighing.create({
      data: {
        createdById: user.sub,
        carNumber: data.carNumber,
        supplierId: data.supplierId ?? undefined,
        grossWeight: new Decimal(data.grossWeight),
        tareCount: data.tareCount,
        tareWeight: new Decimal(data.tareWeight),
        tareTotal: new Decimal(tareTotal),
        netWeight: new Decimal(netWeight),
        photoUrl: data.photoUrl ?? undefined,
        note: data.note ?? undefined,
      },
      include: {
        supplier: true,
        createdBy: { select: { id: true, email: true } },
      },
    });

    return reply.status(201).send({
      ...weighing,
      grossWeight: toNumber(weighing.grossWeight),
      tareWeight: toNumber(weighing.tareWeight),
      tareTotal: toNumber(weighing.tareTotal),
      netWeight: toNumber(weighing.netWeight),
    });
  });

  app.get("/api/weighings", {
    onRequest: [app.authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const parseResult = listQuerySchema.safeParse(request.query);
    if (!parseResult.success) {
      return replyError(reply, 400, {
        message: "Invalid query",
        code: "VALIDATION_ERROR",
        details: parseResult.error.flatten(),
      });
    }
    const { from, to, supplierId, carNumber, page, pageSize } = parseResult.data;

    const where: { createdAt?: { gte?: Date; lte?: Date }; supplierId?: string; carNumber?: { contains: string; mode: "insensitive" } } = {};
    const fromDate = from ? new Date(from) : null;
    const toDate = to ? new Date(to) : null;
    const dateFilter: { gte?: Date; lte?: Date } = {};
    if (fromDate && !isNaN(fromDate.getTime())) dateFilter.gte = fromDate;
    if (toDate && !isNaN(toDate.getTime())) dateFilter.lte = toDate;
    if (Object.keys(dateFilter).length > 0) where.createdAt = dateFilter;
    if (supplierId) where.supplierId = supplierId;
    if (carNumber) where.carNumber = { contains: carNumber, mode: "insensitive" };

    const [items, total] = await Promise.all([
      prisma.weighing.findMany({
        where,
        include: {
          supplier: true,
          createdBy: { select: { id: true, email: true } },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.weighing.count({ where }),
    ]);

    return reply.send({
      items: items.map((w: { grossWeight: Decimal; tareWeight: Decimal; tareTotal: Decimal; netWeight: Decimal; [key: string]: unknown }) => ({
        ...w,
        grossWeight: toNumber(w.grossWeight),
        tareWeight: toNumber(w.tareWeight),
        tareTotal: toNumber(w.tareTotal),
        netWeight: toNumber(w.netWeight),
      })),
      total,
      page,
      pageSize,
    });
  });

  app.get("/api/weighings/:id", {
    onRequest: [app.authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const id = (request.params as { id: string }).id;
    const weighing = await prisma.weighing.findUnique({
      where: { id },
      include: {
        supplier: true,
        createdBy: { select: { id: true, email: true } },
      },
    });
    if (!weighing) {
      return replyError(reply, 404, { message: "Weighing not found", code: "NOT_FOUND" });
    }
    return reply.send({
      ...weighing,
      grossWeight: toNumber(weighing.grossWeight),
      tareWeight: toNumber(weighing.tareWeight),
      tareTotal: toNumber(weighing.tareTotal),
      netWeight: toNumber(weighing.netWeight),
    });
  });

  app.patch("/api/weighings/:id", {
    onRequest: [app.authenticate, app.requireRoles(["admin"])],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const parseResult = patchWeighingSchema.safeParse(request.body);
    if (!parseResult.success) {
      return replyError(reply, 400, {
        message: "Invalid input",
        code: "VALIDATION_ERROR",
        details: parseResult.error.flatten(),
      });
    }
    const partial = parseResult.data;

    const id = (request.params as { id: string }).id;
    const existing = await prisma.weighing.findUnique({ where: { id } });
    if (!existing) {
      return replyError(reply, 404, { message: "Weighing not found", code: "NOT_FOUND" });
    }

    const grossWeight = partial.grossWeight ?? toNumber(existing.grossWeight);
    const tareCount = partial.tareCount ?? existing.tareCount;
    const tareWeight = partial.tareWeight ?? toNumber(existing.tareWeight);
    const { tareTotal, netWeight } = computeWeighingTotals(grossWeight, tareCount, tareWeight);

    const updateData: {
      tareTotal: Decimal;
      netWeight: Decimal;
      carNumber?: string;
      supplierId?: string | null;
      grossWeight?: Decimal;
      tareCount?: number;
      tareWeight?: Decimal;
      photoUrl?: string | null;
      note?: string | null;
    } = {
      tareTotal: new Decimal(tareTotal),
      netWeight: new Decimal(netWeight),
    };
    if (partial.carNumber !== undefined) updateData.carNumber = partial.carNumber;
    if (partial.supplierId !== undefined) updateData.supplierId = partial.supplierId;
    if (partial.grossWeight !== undefined) updateData.grossWeight = new Decimal(partial.grossWeight);
    if (partial.tareCount !== undefined) updateData.tareCount = partial.tareCount;
    if (partial.tareWeight !== undefined) updateData.tareWeight = new Decimal(partial.tareWeight);
    if (partial.photoUrl !== undefined) updateData.photoUrl = partial.photoUrl;
    if (partial.note !== undefined) updateData.note = partial.note;

    const weighing = await prisma.weighing.update({
      where: { id },
      data: updateData,
      include: {
        supplier: true,
        createdBy: { select: { id: true, email: true } },
      },
    });

    return reply.send({
      ...weighing,
      grossWeight: toNumber(weighing.grossWeight),
      tareWeight: toNumber(weighing.tareWeight),
      tareTotal: toNumber(weighing.tareTotal),
      netWeight: toNumber(weighing.netWeight),
    });
  });

  app.delete("/api/weighings/:id", {
    onRequest: [app.authenticate, app.requireRoles(["admin"])],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const id = (request.params as { id: string }).id;
    try {
      await prisma.weighing.delete({ where: { id } });
      return reply.status(204).send();
    } catch (e) {
      if (e && typeof e === "object" && "code" in e && e.code === "P2025") {
        return replyError(reply, 404, { message: "Weighing not found", code: "NOT_FOUND" });
      }
      throw e;
    }
  });
}
