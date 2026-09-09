'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import type { Candidate, Job } from '@/lib/types';

type Item = { kind: 'skill' | 'certification'; name: string; evidence: string; issuer: string; experienceIndex: number | null };
export function QualificationReview({ candidate, job, save, busy }: { candidate: Candidate; job: Pick<Job, 'jdProfile' | 'mandatorySkills' | 'preferredSkills'>; save: (items: Item[]) => Promise<void>; busy: boolean }) {
  const [items, setItems] = useState<Item[]>([]); const [confirmed, setConfirmed] = useState(false);
  const suggestions: Array<Pick<Item, 'kind' | 'name'>> = [
    ...[...new Set([...(job.jdProfile?.mandatory_skills ?? job.mandatorySkills), ...(job.jdProfile?.required_skills ?? []), ...(job.jdProfile?.preferred_skills ?? job.preferredSkills)])].filter(name => !candidate.skills.some(s => s.name.toLowerCase() === name.toLowerCase() && s.evidence.trim())).map(name => ({ kind: 'skill' as const, name })),
    ...[...new Set([...(job.jdProfile?.mandatory_certifications ?? []), ...(job.jdProfile?.preferred_certifications ?? [])])].filter(name => !candidate.career?.certifications.some(c => c.name.toLowerCase() === name.toLowerCase())).map(name => ({ kind: 'certification' as const, name })),
  ];
  const add = (kind: Item['kind'], name = '') => { if (name && items.some(i => i.kind === kind && i.name === name)) return; setItems([...items, { kind, name, evidence: '', issuer: '', experienceIndex: null }]); setConfirmed(false); };
  const update = (index: number, patch: Partial<Item>) => { setItems(items.map((item, i) => i === index ? { ...item, ...patch } : item)); setConfirmed(false); };
  return <details className="mb-4 border bg-white p-4"><summary className="cursor-pointer text-sm font-semibold">Confirm candidate skills & certifications</summary>
    <p className="my-3 text-sm text-slate-600">Add qualifications the candidate holds. Link skills to the correct employer when you want them included in that employer’s bullets. General skills stay in the summary and skills section.</p>
    <div className="flex flex-wrap gap-2">{suggestions.map(item => <Button key={`${item.kind}:${item.name}`} size="sm" variant="outline" onClick={() => add(item.kind, item.name)}>+ {item.name}</Button>)}<Button size="sm" variant="outline" onClick={() => add('skill')}>Other skill</Button><Button size="sm" variant="outline" onClick={() => add('certification')}>Other certification</Button></div>
    {items.length > 0 && <form onSubmit={async e => { e.preventDefault(); try { await save(items); setItems([]); setConfirmed(false); } catch { /* Parent displays the error; keep entered evidence. */ } }} className="mt-4 space-y-3">
      {items.map((item, index) => <fieldset key={index} className="grid gap-3 border p-3 md:grid-cols-2"><legend className="text-sm font-semibold">{item.kind === 'skill' ? 'Skill' : 'Certification'} {index + 1}</legend>
        <label className="text-sm">Name *<input className="mt-1 w-full border p-2" required value={item.name} onChange={e => update(index, { name: e.target.value })} /></label>
        {item.kind === 'certification' ? <label className="text-sm">Issuer *<input className="mt-1 w-full border p-2" required value={item.issuer} onChange={e => update(index, { issuer: e.target.value })} /></label> : <label className="text-sm">Used at employer<select className="mt-1 w-full border bg-white p-2" value={item.experienceIndex ?? ''} onChange={e => update(index, { experienceIndex: e.target.value === '' ? null : Number(e.target.value) })}><option value="">General skill — no employer claim</option>{candidate.career?.experience.map((role, i) => <option key={i} value={i}>{role.company} · {role.title}</option>)}</select></label>}
        <label className="text-sm md:col-span-2">Evidence / candidate confirmation *<textarea required minLength={5} className="mt-1 w-full border p-2" value={item.evidence} onChange={e => update(index, { evidence: e.target.value })} placeholder={item.kind === 'skill' ? 'What the candidate did with this skill, and where you verified it.' : 'Credential or candidate confirmation you reviewed.'} /></label>
        <Button type="button" size="sm" variant="outline" onClick={() => { setItems(items.filter((_, i) => i !== index)); setConfirmed(false); }}>Remove</Button>
      </fieldset>)}
      <label className="flex gap-2 text-sm"><input type="checkbox" required checked={confirmed} onChange={e => setConfirmed(e.target.checked)} />I confirm this candidate holds these qualifications and the employer associations are correct.</label>
      <Button type="submit" disabled={busy || !confirmed}>Save confirmed qualifications</Button>
    </form>}
  </details>;
}
