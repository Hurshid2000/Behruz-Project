import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { replyError } from "../lib/errors";
import { Decimal } from "@prisma/client/runtime/library";

const querySchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
});

function toNum(d: Decimal): number {
  return Number(d.toString());
}

export default async function statsRoutes(app: FastifyInstance) {
  app.get("/api/stats/summary", {
    onRequest: [app.authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const parseResult = querySchema.safeParse(request.query);
    if (!parseResult.success) {
      return replyError(reply, 400, {
        message: "Invalid query",
        code: "VALIDATION_ERROR",
        details: parseResult.error.flatten(),
      });
    }
    const { from, to } = parseResult.data;

    const where: { createdAt?: { gte?: Date; lte?: Date } } = {};
    const fromDate = from ? new Date(from) : null;
    const toDate = to ? new Date(to) : null;
    const dateFilter: { gte?: Date; lte?: Date } = {};
    if (fromDate && !isNaN(fromDate.getTime())) dateFilter.gte = fromDate;
    if (toDate && !isNaN(toDate.getTime())) dateFilter.lte = toDate;
    if (Object.keys(dateFilter).length > 0) where.createdAt = dateFilter;

    const weighings = await prisma.weighing.findMany({
      where,
      select: {
        grossWeight: true,
        netWeight: true,
        createdAt: true,
        supplier: { select: { name: true } },
      },
    });

    type W = (typeof weighings)[number];
    const totalCars = weighings.length;
    const totalGross = weighings.reduce((s: number, w: W) => s + toNum(w.grossWeight), 0);
    const totalNet = weighings.reduce((s: number, w: W) => s + toNum(w.netWeight), 0);

    const byDate = new Map<string, { cars: number; net: number }>();
    for (const w of weighings) {
      const d = w.createdAt.toISOString().slice(0, 10);
      const cur = byDate.get(d) ?? { cars: 0, net: 0 };
      cur.cars += 1;
      cur.net += toNum(w.netWeight);
      byDate.set(d, cur);
    }
    const dailySeries = Array.from(byDate.entries())
      .map(([date, { cars, net }]) => ({ date, cars, net }))
      .sort((a, b) => a.date.localeCompare(b.date));

    const bySupplier = new Map<string, { net: number; cars: number }>();
    for (const w of weighings) {
      const name = w.supplier?.name ?? "—";
      const cur = bySupplier.get(name) ?? { net: 0, cars: 0 };
      cur.cars += 1;
      cur.net += toNum(w.netWeight);
      bySupplier.set(name, cur);
    }
    const topSuppliers = Array.from(bySupplier.entries())
      .map(([supplierName, { net, cars }]) => ({ supplierName, net, cars }))
      .sort((a, b) => b.net - a.net)
      .slice(0, 10);

    return reply.send({
      totals: { totalCars, totalNet, totalGross },
      dailySeries,
      topSuppliers,
    });
  });
}
