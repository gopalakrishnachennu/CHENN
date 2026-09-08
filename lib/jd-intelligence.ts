import type { JobFamily } from './types';

export type StructuredJobRequirements = {
  responsibilities: string[];
  education: string[];
  certifications: string[];
  minimumYears: number | null;
  authorization: string;
  clearance: string;
  travel: string;
  seniority: string;
};

const sentences = (value: string) =>
  value
    .split(/(?<=[.!?;\n])\s*/)
    .map((item) => item.replace(/^[•·▪◦*-]\s*/, '').trim())
    .filter(Boolean);

export function extractStructuredRequirements(jd: string): StructuredJobRequirements {
  const rows = sentences(jd);
  const first = (pattern: RegExp) => rows.find((row) => pattern.test(row)) ?? '';
  const years = [...jd.matchAll(/(\d{1,2})\s*\+?\s*(?:years?|yrs?)(?:\s+of)?\s+(?:professional\s+)?experience/gi)]
    .map((match) => Number(match[1]))
    .filter(Number.isFinite);
  const seniority = /\b(principal|staff)\b/i.test(jd)
    ? 'Staff / Principal'
    : /\b(senior|lead)\b/i.test(jd)
      ? 'Senior'
      : /\b(junior|entry[- ]level|associate)\b/i.test(jd)
        ? 'Entry / Junior'
        : '';
  return {
    responsibilities: rows
      .filter((row) => /\b(build|design|develop|lead|manage|operate|own|implement|maintain|deliver|create|support|collaborate)\b/i.test(row))
      .slice(0, 20),
    education: rows
      .filter((row) => /\b(bachelor|master|ph\.?d|degree|education)\b/i.test(row))
      .slice(0, 8),
    certifications: rows
      .filter((row) => /\b(certification|certified|certificate)\b/i.test(row))
      .slice(0, 8),
    minimumYears: years.length ? Math.max(...years) : null,
    authorization: first(/\b(work authorization|authorized to work|visa|sponsorship|citizen|permanent resident)\b/i),
    clearance: first(/\b(clearance|public trust|secret|top secret|ts\/sci)\b/i),
    travel: first(/\btravel\b|\d+%\s+travel/i),
    seniority,
  };
}

const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9+#.]/g, '');

export function classifyJobFamily(
  input: { title?: unknown; role?: unknown; jdText?: unknown; description?: unknown },
  families: JobFamily[],
) {
  const text = `${String(input.title ?? '')} ${String(input.role ?? '')} ${String(input.jdText ?? input.description ?? '')}`.toLowerCase();
  const ranked = families
    .filter((family) => family.active)
    .map((family) => {
      const roleHits = family.roles.filter((role) => text.includes(role.toLowerCase())).length;
      const skillHits = family.skills.filter((skill) => normalize(text).includes(normalize(skill))).length;
      return { family, score: roleHits * 5 + skillHits };
    })
    .sort((a, b) => b.score - a.score);
  const best = ranked[0];
  const second = ranked[1]?.score ?? 0;
  if (!best || best.score === 0) return { family: '', confidence: 0 };
  const confidence = Math.min(99, Math.round(55 + best.score * 6 + Math.max(0, best.score - second) * 4));
  return { family: best.family.name, confidence };
}
