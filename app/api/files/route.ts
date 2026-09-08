import { Document, HeadingLevel, Packer, Paragraph, TextRun } from 'docx';
import mammoth from 'mammoth';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { extractText as extractPdfText } from 'unpdf';
import { ACCEPTED_RESUME_TYPES, MAX_UPLOAD_BYTES } from '@/lib/constants';
import { getBindings } from '@/lib/server/env';
import { requireAdmin, requireAuth } from '@/lib/server/auth';
import { handleRouteError, HttpError, json, parseJson, requireSameOrigin } from '@/lib/server/http';
import type { PlatformSettings, ResumeContent } from '@/lib/types';
import { DEFAULT_SETTINGS } from '@/lib/server/seed';

function safeName(value: string) {
  return value.replace(/[^a-zA-Z0-9._ -]/g, '_').replace(/\s+/g, '_').slice(0, 120) || 'file';
}

function cleanPdfText(value: string) {
  return value
    .replace(/[–—]/g, '-')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[^\x20-\x7E\n]/g, '');
}

function wrap(text: string, max = 92) {
  const words = cleanPdfText(text).split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    if (`${line} ${word}`.trim().length > max && line) {
      lines.push(line);
      line = word;
    } else line = `${line} ${word}`.trim();
  }
  if (line) lines.push(line);
  return lines;
}

async function makePdf(content: ResumeContent) {
  const document = await PDFDocument.create();
  const regular = await document.embedFont(StandardFonts.Helvetica);
  const bold = await document.embedFont(StandardFonts.HelveticaBold);
  let page = document.addPage([612, 792]);
  let y = 744;
  const margin = 52;
  const ink = rgb(0.12, 0.16, 0.23);
  const muted = rgb(0.34, 0.39, 0.47);
  const accent = rgb(0.32, 0.33, 0.76);

  const ensure = (height: number) => {
    if (y - height < 46) {
      page = document.addPage([612, 792]);
      y = 744;
    }
  };
  const line = (text: string, size = 9, font = regular, color = muted, indent = 0) => {
    ensure(size + 7);
    page.drawText(cleanPdfText(text), { x: margin + indent, y, size, font, color });
    y -= size + 5;
  };
  const block = (text: string, size = 9, indent = 0) => {
    for (const row of wrap(text, indent ? 82 : 92)) line(row, size, regular, muted, indent);
  };
  const heading = (text: string) => {
    ensure(34);
    y -= 8;
    line(text.toUpperCase(), 10, bold, accent);
    page.drawLine({ start: { x: margin, y: y + 3 }, end: { x: 560, y: y + 3 }, thickness: 0.6, color: rgb(0.78, 0.8, 0.85) });
    y -= 5;
  };

  line(content.name, 22, bold, ink);
  line(content.headline, 12, bold, accent);
  line(content.contact, 8, regular, muted);
  heading('Professional summary');
  block(content.summary);
  heading('Core skills');
  block(content.skills.join('  •  '));
  if (content.experience.length) {
    heading('Experience');
    for (const role of content.experience) {
      line([role.title, role.company].filter(Boolean).join(' | '), 10, bold, ink);
      if (role.location || role.dates) line([role.location, role.dates].filter(Boolean).join(' | '), 8, regular, muted);
      for (const bullet of role.bullets) {
        for (const [index, row] of wrap(bullet, 84).entries()) line(`${index === 0 ? '• ' : '  '}${row}`, 8.5, regular, muted, 8);
      }
      y -= 4;
    }
  }
  if (content.education.length) {
    heading('Education');
    for (const item of content.education) line(item, 9, regular, muted);
  }
  return document.save();
}

async function makeDocx(content: ResumeContent) {
  const children: Paragraph[] = [
    new Paragraph({ text: content.name, heading: HeadingLevel.TITLE }),
    new Paragraph({ children: [new TextRun({ text: content.headline, bold: true, color: '5557C7', size: 26 })] }),
    new Paragraph({ text: content.contact }),
    new Paragraph({ text: 'PROFESSIONAL SUMMARY', heading: HeadingLevel.HEADING_1 }),
    new Paragraph({ text: content.summary }),
    new Paragraph({ text: 'CORE SKILLS', heading: HeadingLevel.HEADING_1 }),
    new Paragraph({ text: content.skills.join(' • ') }),
  ];
  if (content.experience.length) children.push(new Paragraph({ text: 'EXPERIENCE', heading: HeadingLevel.HEADING_1 }));
  for (const role of content.experience) {
    children.push(new Paragraph({ children: [new TextRun({ text: [role.title, role.company].filter(Boolean).join(' | '), bold: true })] }));
    if (role.location || role.dates) children.push(new Paragraph({ text: [role.location, role.dates].filter(Boolean).join(' | ') }));
    children.push(...role.bullets.map((bullet) => new Paragraph({ text: bullet, bullet: { level: 0 } })));
  }
  if (content.education.length) {
    children.push(new Paragraph({ text: 'EDUCATION', heading: HeadingLevel.HEADING_1 }));
    children.push(...content.education.map((item) => new Paragraph({ text: item })));
  }
  return Packer.toBuffer(new Document({ sections: [{ children }] }));
}

async function extractResumeText(file: File, bytes: ArrayBuffer, supplied: string) {
  const manual = supplied.trim();
  try {
    if (file.type === 'text/plain') return new TextDecoder().decode(bytes).trim();
    if (file.type === 'application/pdf') {
      const result = await extractPdfText(new Uint8Array(bytes), { mergePages: true });
      const value = result.text.trim();
      if (value) return value;
    }
    if (file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      const result = await mammoth.extractRawText({ arrayBuffer: bytes });
      if (result.value.trim()) return result.value.trim();
    }
  } catch (error) {
    console.error('Resume text extraction failed', error instanceof Error ? error.message : 'Unknown extraction error');
  }
  if (manual) return manual;
  throw new HttpError(400, 'No readable text was found. For a scanned PDF, paste verified resume text and upload again.', 'resume_text_missing');
}

async function exportResume(request: Request, db: D1Database, auth: Awaited<ReturnType<typeof requireAuth>>, resumeId: string, format: string) {
  const row = await db.prepare('SELECT r.content_json,r.candidate_id,r.status,j.company,j.title,j.applied_resume_id FROM resume_versions r JOIN jobs j ON j.id=r.job_id WHERE r.id=?').bind(resumeId).first<{ content_json: string; candidate_id: string; status: string; company: string; title: string; applied_resume_id: string | null }>();
  if (!row) throw new HttpError(404, 'Resume not found.', 'not_found');
  if (auth.role === 'candidate') {
    if (row.candidate_id !== auth.candidateId || (row.status !== 'Approved' && row.applied_resume_id !== resumeId)) throw new HttpError(404, 'Resume not found.', 'not_found');
    const settingRow = await db.prepare("SELECT value_json FROM settings WHERE key='platform'").first<{ value_json: string }>();
    const settings = parseJson<Partial<PlatformSettings>>(settingRow?.value_json, {});
    if ((settings.visibility?.resumeDownloads ?? DEFAULT_SETTINGS.visibility.resumeDownloads) === false) {
      throw new HttpError(403, 'Resume downloads are currently disabled.', 'downloads_disabled');
    }
  }
  const content = parseJson<ResumeContent>(row.content_json, { name: '', headline: '', contact: '', summary: '', skills: [], experience: [], education: [] });
  const base = safeName(`${content.name}_${row.company}_${row.title}`);
  if (format === 'pdf') {
    const bytes = await makePdf(content);
    return new Response(bytes as BodyInit, { headers: { 'content-type': 'application/pdf', 'content-disposition': `attachment; filename="${base}.pdf"`, 'cache-control': 'private, no-store' } });
  }
  if (format === 'docx') {
    const bytes = await makeDocx(content);
    return new Response(bytes as BodyInit, { headers: { 'content-type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'content-disposition': `attachment; filename="${base}.docx"`, 'cache-control': 'private, no-store' } });
  }
  throw new HttpError(400, 'Choose PDF or DOCX.', 'invalid_format');
}

export async function GET(request: Request) {
  try {
    const { DB, FILES } = getBindings();
    const auth = await requireAuth(request, DB);
    const url = new URL(request.url);
    const resumeId = url.searchParams.get('resumeId');
    if (resumeId) return exportResume(request, DB, auth, resumeId, url.searchParams.get('format') ?? 'pdf');

    const id = url.searchParams.get('id');
    if (!id) throw new HttpError(400, 'A file id is required.', 'validation_error');
    const file = await DB.prepare('SELECT * FROM files WHERE id=?').bind(id).first<{ candidate_id: string | null; kind: string; r2_key: string; original_name: string; mime_type: string }>();
    if (!file) throw new HttpError(404, 'File not found.', 'not_found');
    if (auth.role === 'candidate' && file.kind !== 'logo' && file.candidate_id !== auth.candidateId) throw new HttpError(404, 'File not found.', 'not_found');
    const object = await FILES.get(file.r2_key);
    if (!object) throw new HttpError(404, 'Stored file not found.', 'not_found');
    return new Response(object.body, { headers: { 'content-type': file.mime_type, 'content-disposition': `${url.searchParams.get('inline') === '1' ? 'inline' : 'attachment'}; filename="${safeName(file.original_name)}"`, 'cache-control': 'private, max-age=300', 'x-content-type-options': 'nosniff' } });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    const { DB, FILES } = getBindings();
    const auth = await requireAuth(request, DB);
    requireAdmin(auth);
    const form = await request.formData();
    const purpose = String(form.get('purpose') ?? '');
    const uploaded = form.get('file');
    if (!(uploaded instanceof File)) throw new HttpError(400, 'Choose a file to upload.', 'validation_error');
    if (uploaded.size <= 0 || uploaded.size > MAX_UPLOAD_BYTES) throw new HttpError(400, 'Files must be between 1 byte and 8 MB.', 'invalid_file_size');
    const now = new Date().toISOString();
    const id = crypto.randomUUID();
    const originalName = safeName(uploaded.name);
    const bytes = await uploaded.arrayBuffer();

    if (purpose === 'base-resume') {
      const candidateId = String(form.get('candidateId') ?? '');
      if (!candidateId) throw new HttpError(400, 'Choose a candidate.', 'validation_error');
      if (!(ACCEPTED_RESUME_TYPES as readonly string[]).includes(uploaded.type)) throw new HttpError(400, 'Upload a PDF, DOCX, or TXT resume.', 'invalid_file_type');
      const versionRow = await DB.prepare('SELECT MAX(version) AS version FROM base_resumes WHERE candidate_id=?').bind(candidateId).first<{ version: number | null }>();
      const version = (versionRow?.version ?? 0) + 1;
      const extractedText = await extractResumeText(uploaded, bytes, String(form.get('extractedText') ?? ''));
      const r2Key = `candidate/${candidateId}/base/${id}/${originalName}`;
      await FILES.put(r2Key, bytes, { httpMetadata: { contentType: uploaded.type }, customMetadata: { candidateId, purpose } });
      await DB.batch([
        DB.prepare('UPDATE base_resumes SET is_current=0 WHERE candidate_id=?').bind(candidateId),
        DB.prepare('INSERT INTO base_resumes (id,candidate_id,version,file_key,original_name,mime_type,byte_size,extracted_text,is_current,created_at) VALUES (?,?,?,?,?,?,?,?,?,?)').bind(id, candidateId, version, r2Key, originalName, uploaded.type, uploaded.size, extractedText.slice(0, 150000), 1, now),
        DB.prepare('INSERT INTO files (id,candidate_id,resume_version_id,kind,r2_key,original_name,mime_type,byte_size,created_at) VALUES (?,?,?,?,?,?,?,?,?)').bind(id, candidateId, null, 'base-resume', r2Key, originalName, uploaded.type, uploaded.size, now),
        DB.prepare('INSERT INTO audit_logs (id,actor_email,action,entity_type,entity_id,details_json,created_at) VALUES (?,?,?,?,?,?,?)').bind(crypto.randomUUID(), auth.email, 'base_resume.uploaded', 'candidate', candidateId, JSON.stringify({ fileId: id, version, originalName }), now),
      ]);
      return json({ ok: true, message: `Base resume version ${version} uploaded and indexed.`, fileId: id });
    }

    if (purpose === 'logo') {
      const allowed = ['image/png', 'image/jpeg', 'image/webp'];
      if (!allowed.includes(uploaded.type) || uploaded.size > 2 * 1024 * 1024) throw new HttpError(400, 'Upload a PNG, JPG, or WEBP logo up to 2 MB.', 'invalid_logo');
      const r2Key = `branding/logo/${id}/${originalName}`;
      await FILES.put(r2Key, bytes, { httpMetadata: { contentType: uploaded.type }, customMetadata: { purpose } });
      const row = await DB.prepare("SELECT value_json FROM settings WHERE key='platform'").first<{ value_json: string }>();
      const settings = parseJson<PlatformSettings>(row?.value_json, {} as PlatformSettings);
      settings.logoFileId = id;
      await DB.batch([
        DB.prepare('INSERT INTO files (id,candidate_id,resume_version_id,kind,r2_key,original_name,mime_type,byte_size,created_at) VALUES (?,?,?,?,?,?,?,?,?)').bind(id, null, null, 'logo', r2Key, originalName, uploaded.type, uploaded.size, now),
        DB.prepare("UPDATE settings SET value_json=?,updated_at=?,updated_by=? WHERE key='platform'").bind(JSON.stringify(settings), now, auth.email),
        DB.prepare('INSERT INTO audit_logs (id,actor_email,action,entity_type,entity_id,details_json,created_at) VALUES (?,?,?,?,?,?,?)').bind(crypto.randomUUID(), auth.email, 'logo.uploaded', 'settings', 'platform', JSON.stringify({ fileId: id, originalName }), now),
      ]);
      return json({ ok: true, message: 'Website logo uploaded and published.', fileId: id });
    }

    throw new HttpError(400, 'Unknown upload purpose.', 'invalid_purpose');
  } catch (error) {
    return handleRouteError(error);
  }
}
