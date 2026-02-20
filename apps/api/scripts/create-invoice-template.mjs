#!/usr/bin/env node
/**
 * Creates a minimal DOCX invoice template with placeholders.
 * Run: node scripts/create-invoice-template.mjs
 */
import PizZip from "pizzip";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const contentTypes = `<?xml version="1.0" encoding="UTF-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`;

const rels = `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;

const wordRels = `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/settings" Target="settings.xml"/>
</Relationships>`;

const settings = `<?xml version="1.0" encoding="UTF-8"?>
<w:settings xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"/>`;

const document = `<?xml version="1.0" encoding="UTF-8"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p><w:r><w:t>INVOICE / НАКЛАДНАЯ</w:t></w:r></w:p>
    <w:p><w:r><w:t>Car: {{car_number}}</w:t></w:r></w:p>
    <w:p><w:r><w:t>Supplier: {{supplier_name}}</w:t></w:r></w:p>
    <w:p><w:r><w:t>Gross: {{gross_weight}} | Tare: {{tare_count}} x {{tare_weight}} = {{tare_total}}</w:t></w:r></w:p>
    <w:p><w:r><w:t>Net weight: {{net_weight}}</w:t></w:r></w:p>
    <w:p><w:r><w:t>Date: {{date}} Time: {{time}}</w:t></w:r></w:p>
    <w:p><w:r><w:t>Operator: {{operator_name}}</w:t></w:r></w:p>
  </w:body>
</w:document>`;

const zip = new PizZip();
zip.file("[Content_Types].xml", contentTypes);
zip.file("_rels/.rels", rels);
zip.file("word/_rels/document.xml.rels", wordRels);
zip.file("word/document.xml", document);
zip.file("word/settings.xml", settings);

const outDir = path.join(__dirname, "../templates");
fs.mkdirSync(outDir, { recursive: true });
const outPath = path.join(outDir, "invoice_template.docx");
fs.writeFileSync(outPath, zip.generate({ type: "nodebuffer" }));
console.log("Created:", outPath);
