import { z } from 'zod';
const text = z.string().trim().max(5000);
const month = z.string().regex(/^$|^\d{4}-(0[1-9]|1[0-2])$/);
const url = z.string().trim().refine(v => !v || /^https?:\/\//.test(v) && URL.canParse(v), 'Enter an HTTP or HTTPS URL');
const period = { start: month, end: month };
const ordered = (v: { start: string; end: string }) => !v.start || !v.end || v.end >= v.start;
export const careerSchema = z.object({
  experience: z.array(z.object({ company: text.min(1), title: text.min(1), location: text, ...period, current: z.boolean(), responsibilities: text, achievements: text, technologies: text }).refine(v => ordered(v) && !(v.current && v.end), 'Check employment dates')).max(50),
  education: z.array(z.object({ institution: text.min(1), degree: text.min(1), field: text, ...period }).refine(ordered, 'Check education dates')).max(30),
  certifications: z.array(z.object({ name: text.min(1), issuer: text.min(1), ...period, url }).refine(ordered, 'Check certification dates')).max(50),
  projects: z.array(z.object({ name: text.min(1), contribution: text, technologies: text, outcomes: text, url })).max(50),
});
export type Career = z.infer<typeof careerSchema>;
export const emptyCareer = (): Career => ({ experience: [], education: [], certifications: [], projects: [] });
export function careerContent(value?: Career) {
  const c = careerSchema.parse(value ?? emptyCareer());
  return {
    experience: c.experience.map(e => ({ company: e.company, title: e.title, location: e.location, dates: [e.start, e.current ? 'Present' : e.end].filter(Boolean).join(' – '), bullets: [e.responsibilities, e.achievements, e.technologies ? `Technologies: ${e.technologies}` : ''].flatMap(v => v.split('\n').map(s => s.trim()).filter(Boolean)) })),
    education: c.education.map(e => [e.institution, e.degree, e.field, [e.start, e.end].filter(Boolean).join(' – ')].filter(Boolean).join(' · ')),
    certifications: c.certifications.map(e => [e.name, e.issuer, e.start && `Issued ${e.start}`, e.end && `Expires ${e.end}`, e.url].filter(Boolean).join(' · ')),
    projects: c.projects.map(e => [e.name, e.contribution, e.technologies, e.outcomes, e.url].filter(Boolean).join(' · ')),
  };
}
