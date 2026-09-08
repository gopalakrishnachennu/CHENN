'use client';
import { useState } from 'react';
import { type Career } from '@/lib/career';
const definitions = {
  experience: { company: 'Company', title: 'Actual role title', location: 'Location', start: 'Start month', end: 'End month', current: 'Current role', responsibilities: 'Responsibilities (one per line)', achievements: 'Achievements (one per line)', technologies: 'Technologies used' },
  education: { institution: 'Institution', degree: 'Degree', field: 'Field of study', start: 'Start month', end: 'End month' },
  certifications: { name: 'Certification', issuer: 'Issuer', start: 'Issue month', end: 'Expiry month (optional)', url: 'Credential URL' },
  projects: { name: 'Project', contribution: 'Your contribution', technologies: 'Technologies', outcomes: 'Outcomes', url: 'GitHub or demo URL' },
};
export function CareerEditor({ value, onChange }: { value: Career; onChange: (v: Career) => void }) {
  const [tab, setTab] = useState<keyof Career>('experience');
  const rows = value[tab] as unknown as Record<string, string | boolean>[];
  const update = (next: Record<string, string | boolean>[]) => onChange({ ...value, [tab]: next } as Career);
  return <section className="wide-row col-span-full space-y-3 rounded border p-4">
    <h3 className="font-semibold">Career history</h3><p className="text-sm text-slate-600">Enter verified facts. Employment titles and dates are preserved in generated resumes. Optional sections can be left empty.</p>
    <div className="flex flex-wrap gap-2">{(Object.keys(definitions) as (keyof Career)[]).map(key => <button type="button" key={key} aria-pressed={key === tab} onClick={() => setTab(key)} className={`rounded border px-3 py-2 text-sm capitalize ${key === tab ? 'bg-slate-900 text-white' : ''}`}>{key} ({value[key].length})</button>)}</div>
    {rows.map((row, i) => <fieldset key={`${tab}-${i}`} className="grid gap-3 rounded border p-3 sm:grid-cols-2 lg:grid-cols-3"><legend className="px-2 text-sm capitalize">{tab} {i + 1}</legend>{Object.entries(definitions[tab]).map(([key, label]) => { const required = tab === 'experience' && ['company', 'title', 'start'].includes(key); return <label key={key} className="grid gap-1 text-sm">{label}{required ? ' *' : ''}{key === 'current' ? <input type="checkbox" checked={Boolean(row[key])} onChange={e => update(rows.map((r, n) => n === i ? { ...r, current: e.target.checked, ...(e.target.checked ? { end: '' } : {}) } : r))} /> : <input required={required} className="min-w-0 rounded border px-3 py-2" type={key === 'start' || key === 'end' ? 'month' : key === 'url' ? 'url' : 'text'} disabled={key === 'end' && Boolean(row.current)} value={String(row[key] ?? '')} onChange={e => update(rows.map((r, n) => n === i ? { ...r, [key]: e.target.value } : r))} />}</label>; })}<button type="button" className="text-left text-sm text-red-700" onClick={() => update(rows.filter((_, n) => n !== i))}>Remove entry</button></fieldset>)}
    <button type="button" className="rounded border px-3 py-2 text-sm" onClick={() => update([...rows, Object.fromEntries(Object.keys(definitions[tab]).map(key => [key, key === 'current' ? false : '']))])}>+ Add {tab === 'experience' ? 'experience' : tab === 'education' ? 'education' : tab === 'projects' ? 'project' : 'certification'}</button>
  </section>;
}
