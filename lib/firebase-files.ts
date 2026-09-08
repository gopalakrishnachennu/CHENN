import { Document, HeadingLevel, Packer, Paragraph, TextRun } from 'docx';
import type { User } from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { getBlob, getStorage, ref, uploadBytes } from 'firebase/storage';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import {
  ACCEPTED_RESUME_TYPES,
  ADMIN_EMAIL,
  MAX_UPLOAD_BYTES,
} from './constants';
import { firebaseDb } from './firebase-backend';
import { firebaseApp } from './firebase';
import type {
  AppState,
  Candidate,
  PlatformSettings,
  ResumeContent,
  ResumeVersion,
} from './types';

type ActionResult = { ok: boolean; message?: string; [key: string]: unknown };
type StoredFile = {
  id: string;
  candidateId: string | null;
  candidateEmail: string | null;
  kind: 'base-resume' | 'logo';
  storagePath: string;
  originalName: string;
  mimeType: string;
  byteSize: number;
  createdAt: string;
};

const storage = getStorage(firebaseApp);

function requireAdmin(user: User) {
  if (user.email?.toLowerCase() !== ADMIN_EMAIL.toLowerCase())
    throw new Error('Administrator access is required.');
}

function safeName(value: string) {
  return (
    value
      .replace(/[^a-zA-Z0-9._ -]/g, '_')
      .replace(/\s+/g, '_')
      .slice(0, 120) || 'file'
  );
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

async function extractResumeText(
  file: File,
  bytes: ArrayBuffer,
  supplied: string,
) {
  const manual = supplied.trim();
  try {
    if (file.type === 'text/plain')
      return new TextDecoder().decode(bytes).trim();
    if (file.type === 'application/pdf') {
      const { extractText } = await import('unpdf');
      const result = await extractText(new Uint8Array(bytes), {
        mergePages: true,
      });
      if (result.text.trim()) return result.text.trim();
    }
    if (
      file.type ===
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ) {
      const mammoth = await import('mammoth');
      const result = await mammoth.extractRawText({ arrayBuffer: bytes });
      if (result.value.trim()) return result.value.trim();
    }
  } catch {
    // The verified-text field remains the supported fallback for scanned or unusual files.
  }
  if (manual) return manual;
  throw new Error(
    'No readable text was found. For a scanned PDF, paste verified resume text and upload again.',
  );
}

async function audit(
  user: User,
  action: string,
  entityType: string,
  entityId: string,
  details: Record<string, unknown> = {},
) {
  const id = crypto.randomUUID();
  await setDoc(doc(firebaseDb, 'logs', id), {
    id,
    actorEmail: user.email ?? ADMIN_EMAIL,
    action,
    entityType,
    entityId,
    details,
    createdAt: new Date().toISOString(),
  });
}

export async function uploadFirebaseFile(
  user: User,
  form: FormData,
): Promise<ActionResult> {
  requireAdmin(user);
  const purpose = String(form.get('purpose') ?? '');
  const uploaded = form.get('file');
  if (!(uploaded instanceof File)) throw new Error('Choose a file to upload.');
  if (uploaded.size <= 0 || uploaded.size > MAX_UPLOAD_BYTES)
    throw new Error('Files must be between 1 byte and 8 MB.');

  const id = crypto.randomUUID();
  const originalName = safeName(uploaded.name);
  const createdAt = new Date().toISOString();
  const bytes = await uploaded.arrayBuffer();

  if (purpose === 'base-resume') {
    const candidateId = String(form.get('candidateId') ?? '');
    if (!candidateId) throw new Error('Choose a candidate.');
    if (!(ACCEPTED_RESUME_TYPES as readonly string[]).includes(uploaded.type))
      throw new Error('Upload a PDF, DOCX, or TXT resume.');
    const candidateSnapshot = await getDoc(
      doc(firebaseDb, 'candidates', candidateId),
    );
    if (!candidateSnapshot.exists()) throw new Error('Candidate not found.');
    const candidate = candidateSnapshot.data() as Candidate;
    const version = (candidate.baseResume?.version ?? 0) + 1;
    const extractedText = await extractResumeText(
      uploaded,
      bytes,
      String(form.get('extractedText') ?? ''),
    );
    const storagePath = `candidate/${candidateId}/base/${id}/${originalName}`;
    await uploadBytes(ref(storage, storagePath), bytes, {
      contentType: uploaded.type,
      customMetadata: { candidateId, candidateEmail: candidate.email, purpose },
    });
    const metadata: StoredFile = {
      id,
      candidateId,
      candidateEmail: candidate.email,
      kind: 'base-resume',
      storagePath,
      originalName,
      mimeType: uploaded.type,
      byteSize: uploaded.size,
      createdAt,
    };
    await setDoc(doc(firebaseDb, 'files', id), metadata);
    await updateDoc(doc(firebaseDb, 'candidates', candidateId), {
      baseResume: {
        id,
        candidateId,
        version,
        originalName,
        mimeType: uploaded.type,
        byteSize: uploaded.size,
        extractedText: extractedText.slice(0, 150_000),
        createdAt,
      },
      updatedAt: createdAt,
    });
    await audit(user, 'base_resume.uploaded', 'candidate', candidateId, {
      fileId: id,
      version,
      originalName,
    });
    return {
      ok: true,
      message: `Base resume version ${version} uploaded and indexed.`,
      fileId: id,
    };
  }

  if (purpose === 'logo') {
    const allowed = ['image/png', 'image/jpeg', 'image/webp'];
    if (!allowed.includes(uploaded.type) || uploaded.size > 2 * 1024 * 1024)
      throw new Error('Upload a PNG, JPG, or WEBP logo up to 2 MB.');
    const storagePath = `branding/logo/${id}/${originalName}`;
    await uploadBytes(ref(storage, storagePath), bytes, {
      contentType: uploaded.type,
      customMetadata: { purpose },
    });
    const metadata: StoredFile = {
      id,
      candidateId: null,
      candidateEmail: null,
      kind: 'logo',
      storagePath,
      originalName,
      mimeType: uploaded.type,
      byteSize: uploaded.size,
      createdAt,
    };
    await setDoc(doc(firebaseDb, 'files', id), metadata);
    const settingsRef = doc(firebaseDb, 'settings', 'platform');
    const settingsSnapshot = await getDoc(settingsRef);
    const settings = (settingsSnapshot.data() ?? {}) as PlatformSettings;
    await setDoc(settingsRef, { ...settings, logoFileId: id });
    await audit(user, 'logo.uploaded', 'settings', 'platform', {
      fileId: id,
      originalName,
    });
    return {
      ok: true,
      message: 'Website logo uploaded and published.',
      fileId: id,
    };
  }

  throw new Error('Unknown upload purpose.');
}

async function storedFile(fileId: string) {
  const snapshot = await getDoc(doc(firebaseDb, 'files', fileId));
  if (!snapshot.exists()) throw new Error('File not found.');
  return snapshot.data() as StoredFile;
}

export async function getFirebaseFileUrl(_user: User, fileId: string) {
  const file = await storedFile(fileId);
  const blob = await getBlob(ref(storage, file.storagePath));
  return URL.createObjectURL(blob);
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
  const line = (
    text: string,
    size = 9,
    font = regular,
    color = muted,
    indent = 0,
  ) => {
    ensure(size + 7);
    page.drawText(cleanPdfText(text), {
      x: margin + indent,
      y,
      size,
      font,
      color,
    });
    y -= size + 5;
  };
  const block = (text: string, size = 9, indent = 0) => {
    for (const row of wrap(text, indent ? 82 : 92))
      line(row, size, regular, muted, indent);
  };
  const heading = (text: string) => {
    ensure(34);
    y -= 8;
    line(text.toUpperCase(), 10, bold, accent);
    page.drawLine({
      start: { x: margin, y: y + 3 },
      end: { x: 560, y: y + 3 },
      thickness: 0.6,
      color: rgb(0.78, 0.8, 0.85),
    });
    y -= 5;
  };
  line(content.name, 22, bold, ink);
  line(content.headline, 12, bold, accent);
  line(content.contact, 8, regular, muted);
  heading('Professional summary');
  block(content.summary);
  heading('Core skills');
  block(content.skills.join('  •  '));
  if (content.experience.length) heading('Experience');
  for (const role of content.experience) {
    line([role.title, role.company].filter(Boolean).join(' | '), 10, bold, ink);
    if (role.location || role.dates)
      line(
        [role.location, role.dates].filter(Boolean).join(' | '),
        8,
        regular,
        muted,
      );
    for (const bullet of role.bullets)
      for (const [index, row] of wrap(bullet, 84).entries())
        line(`${index === 0 ? '• ' : '  '}${row}`, 8.5, regular, muted, 8);
    y -= 4;
  }
  if (content.education.length) {
    heading('Education');
    for (const item of content.education) line(item, 9, regular, muted);
  }
  for (const section of ['certifications', 'projects'] as const) {
    if (content[section]?.length) { heading(section === 'projects' ? 'Projects' : 'Certifications'); for (const item of content[section]!) block(item); }
  }
  return document.save();
}

async function makeDocx(content: ResumeContent) {
  const children: Paragraph[] = [
    new Paragraph({ text: content.name, heading: HeadingLevel.TITLE }),
    new Paragraph({
      children: [
        new TextRun({
          text: content.headline,
          bold: true,
          color: '5557C7',
          size: 26,
        }),
      ],
    }),
    new Paragraph({ text: content.contact }),
    new Paragraph({
      text: 'PROFESSIONAL SUMMARY',
      heading: HeadingLevel.HEADING_1,
    }),
    new Paragraph({ text: content.summary }),
    new Paragraph({ text: 'CORE SKILLS', heading: HeadingLevel.HEADING_1 }),
    new Paragraph({ text: content.skills.join(' • ') }),
  ];
  if (content.experience.length)
    children.push(
      new Paragraph({ text: 'EXPERIENCE', heading: HeadingLevel.HEADING_1 }),
    );
  for (const role of content.experience) {
    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: [role.title, role.company].filter(Boolean).join(' | '),
            bold: true,
          }),
        ],
      }),
    );
    if (role.location || role.dates)
      children.push(
        new Paragraph({
          text: [role.location, role.dates].filter(Boolean).join(' | '),
        }),
      );
    children.push(
      ...role.bullets.map(
        (bullet) => new Paragraph({ text: bullet, bullet: { level: 0 } }),
      ),
    );
  }
  if (content.education.length) {
    children.push(
      new Paragraph({ text: 'EDUCATION', heading: HeadingLevel.HEADING_1 }),
    );
    children.push(
      ...content.education.map((item) => new Paragraph({ text: item })),
    );
  }
  for (const section of ['certifications', 'projects'] as const) {
    if (content[section]?.length) children.push(new Paragraph({ text: section.toUpperCase(), heading: HeadingLevel.HEADING_1 }), ...content[section]!.map(text => new Paragraph({ text })));
  }
  return Packer.toBlob(new Document({ sections: [{ children }] }));
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

export async function downloadFirebaseAsset(
  user: User,
  params: {
    fileId?: string;
    resumeId?: string;
    format?: 'pdf' | 'docx';
    inline?: boolean;
  },
  state: AppState | null,
) {
  if (params.fileId) {
    const file = await storedFile(params.fileId);
    triggerDownload(
      await getBlob(ref(storage, file.storagePath)),
      file.originalName,
    );
    return;
  }
  if (!params.resumeId || !state)
    throw new Error('Choose a resume to download.');
  const resume = state.resumes.find((item) => item.id === params.resumeId) as
    | ResumeVersion
    | undefined;
  if (!resume) throw new Error('Resume not found.');
  if (state.role === 'candidate' && !state.settings.visibility.resumeDownloads)
    throw new Error('Resume downloads are currently disabled.');
  const job = state.jobs.find((item) => item.id === resume.jobId);
  const base = safeName(
    `${resume.content.name}_${job?.company ?? 'Resume'}_${job?.title ?? resume.content.headline}`,
  );
  if ((params.format ?? 'pdf') === 'docx') {
    triggerDownload(await makeDocx(resume.content), `${base}.docx`);
  } else {
    const bytes = await makePdf(resume.content);
    triggerDownload(
      new Blob([bytes as BlobPart], { type: 'application/pdf' }),
      `${base}.pdf`,
    );
  }
  void user;
}
