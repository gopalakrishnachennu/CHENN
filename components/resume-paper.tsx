import type { ResumeContent } from '@/lib/types';

export function ResumePaper({ content }: { content: ResumeContent }) {
  return (
    <article className="mx-auto min-h-[780px] w-full max-w-[720px] bg-white px-[7%] py-[7%] text-[#263044] shadow-[0_10px_32px_rgba(31,40,59,.12)]">
      <header className="border-b-2 border-[#303a4d] pb-4 text-center">
        <h1 className="text-[clamp(19px,3vw,29px)] font-bold uppercase tracking-[.08em]">{content.name}</h1>
        <p className="mt-1 text-[clamp(9px,1.4vw,12px)] font-semibold text-[#5557c7]">{content.headline}</p>
        <p className="mt-2 text-[clamp(7px,1.1vw,9px)] text-[#697386]">{content.contact}</p>
      </header>

      <section className="mt-5">
        <h2 className="resume-heading">PROFESSIONAL SUMMARY</h2>
        <p className="resume-copy">{content.summary}</p>
      </section>

      <section className="mt-5">
        <h2 className="resume-heading">CORE SKILLS</h2>
        <p className="resume-copy">{content.skills.join('  •  ')}</p>
      </section>

      {content.experience.length > 0 && (
        <section className="mt-5">
          <h2 className="resume-heading">PROFESSIONAL EXPERIENCE</h2>
          <div className="mt-3 space-y-4">
            {content.experience.map((role, index) => (
              <div key={`${role.company}-${role.title}-${index}`}>
                <div className="flex items-start justify-between gap-4">
                  <div><p className="resume-role">{role.title}</p>{(role.company || role.location) && <p className="resume-company">{[role.company, role.location].filter(Boolean).join(' · ')}</p>}</div>
                  <p className="resume-date">{role.dates}</p>
                </div>
                <ul className="resume-list">{role.bullets.map((bullet) => <li key={bullet}>{bullet}</li>)}</ul>
              </div>
            ))}
          </div>
        </section>
      )}

      {content.education.length > 0 && (
        <section className="mt-5">
          <h2 className="resume-heading">EDUCATION</h2>
          {content.education.map((item) => <p key={item} className="resume-copy">{item}</p>)}
        </section>
      )}
      {(['certifications', 'projects'] as const).map(section => content[section]?.length ? <section key={section} className="mt-5"><h2 className="resume-heading">{section.toUpperCase()}</h2>{content[section]!.map((item, i) => <p key={i} className="resume-copy">{item}</p>)}</section> : null)}
    </article>
  );
}
