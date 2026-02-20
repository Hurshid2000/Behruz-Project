import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import ExcelJS from "exceljs";
import Docxtemplater from "docxtemplater";
import PizZip from "pizzip";
import { readFile } from "fs/promises";
import path from "path";
import { prisma } from "../lib/prisma";
import { replyError } from "../lib/errors";
import { Decimal } from "@prisma/client/runtime/library";

const listQuerySchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
  supplierId: z.string().optional(),
  carNumber: z.string().optional(),
});

function toNumber(d: Decimal): number {
  return Number(d.toString());
}

export default async function exportRoutes(app: FastifyInstance) {
  app.get("/api/export/excel", {
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
    const { from, to, supplierId, carNumber } = parseResult.data;

    const where: {
      createdAt?: { gte?: Date; lte?: Date };
      supplierId?: string;
      carNumber?: { contains: string; mode: "insensitive" };
    } = {};
    const fromDate = from ? new Date(from) : null;
    const toDate = to ? new Date(to) : null;
    const dateFilter: { gte?: Date; lte?: Date } = {};
    if (fromDate && !isNaN(fromDate.getTime())) dateFilter.gte = fromDate;
    if (toDate && !isNaN(toDate.getTime())) dateFilter.lte = toDate;
    if (Object.keys(dateFilter).length > 0) where.createdAt = dateFilter;
    if (supplierId) where.supplierId = supplierId;
    if (carNumber) where.carNumber = { contains: carNumber, mode: "insensitive" };

    const weighings = await prisma.weighing.findMany({
      where,
      include: { supplier: true, createdBy: { select: { email: true } } },
      orderBy: { createdAt: "desc" },
    });

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Weighings");
    sheet.columns = [
      { header: "Date", key: "date", width: 12 },
      { header: "Car", key: "carNumber", width: 15 },
      { header: "Supplier", key: "supplier", width: 20 },
      { header: "Gross", key: "gross", width: 10 },
      { header: "Tare Count", key: "tareCount", width: 10 },
      { header: "Tare Weight", key: "tareWeight", width: 12 },
      { header: "Tare Total", key: "tareTotal", width: 12 },
      { header: "Net", key: "net", width: 10 },
      { header: "Operator", key: "operator", width: 20 },
    ];
    type W = (typeof weighings)[number];
    sheet.addRows(
      weighings.map((w: W) => ({
        date: w.createdAt.toISOString().slice(0, 10),
        carNumber: w.carNumber,
        supplier: w.supplier?.name ?? "-",
        gross: toNumber(w.grossWeight),
        tareCount: w.tareCount,
        tareWeight: toNumber(w.tareWeight),
        tareTotal: toNumber(w.tareTotal),
        net: toNumber(w.netWeight),
        operator: w.createdBy.email,
      }))
    );

    const buffer = await workbook.xlsx.writeBuffer();
    reply
      .header("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
      .header("Content-Disposition", 'attachment; filename="weighings.xlsx"')
      .send(Buffer.from(buffer));
  });

  app.get("/api/weighings/:id/invoice.docx", {
    onRequest: [app.authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const id = (request.params as { id: string }).id;
    const weighing = await prisma.weighing.findUnique({
      where: { id },
      include: { supplier: true, createdBy: { select: { email: true } } },
    });
    if (!weighing) {
      return replyError(reply, 404, { message: "Weighing not found", code: "NOT_FOUND" });
    }

    const templatePath = path.join(__dirname, "../../templates/invoice_template.docx");
    let content: Buffer;
    try {
      content = await readFile(templatePath);
    } catch {
      return replyError(reply, 500, { message: "Invoice template not found", code: "TEMPLATE_ERROR" });
    }

    const zip = new PizZip(content);
    const doc = new Docxtemplater(zip, {
      delimiters: { start: "{{", end: "}}" },
      paragraphLoop: true,
      linebreaks: true,
    });

    const date = weighing.createdAt;
    doc.render({
      car_number: weighing.carNumber,
      supplier_name: weighing.supplier?.name ?? "-",
      gross_weight: toNumber(weighing.grossWeight),
      tare_count: weighing.tareCount,
      tare_weight: toNumber(weighing.tareWeight),
      tare_total: toNumber(weighing.tareTotal),
      net_weight: toNumber(weighing.netWeight),
      date: date.toISOString().slice(0, 10),
      time: date.toTimeString().slice(0, 8),
      operator_name: weighing.createdBy.email,
    });

    const buf = doc.getZip().generate({ type: "nodebuffer" });
    reply
      .header("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document")
      .header("Content-Disposition", `attachment; filename="invoice_${weighing.carNumber}.docx"`)
      .send(buf);
  });
}
