import { AlignmentType, Document, LevelFormat, Paragraph, TextRun, type IParagraphOptions } from 'docx';
import type { ResumeContent } from './types';
import { highlightRuns } from './resume-format';

// Word uses half-points: 18 = 9 pt. Apply explicitly to every run, including headings.
export const WORD_RESUME_STYLE = { font: 'Aptos', size: 18, sizeComplexScript: 18 } as const;
export function resumeDocxDocument(content: ResumeContent) {
  const run = (text: string, bold = false) => new TextRun({ ...WORD_RESUME_STYLE, text, bold });
  const rich = (text: string) => highlightRuns(text, content.highlights).map(r => run(r.text, r.bold));
  const paragraph = (children: TextRun[], options: IParagraphOptions = {}) => new Paragraph({
    spacing: { after: 80, line: 240 }, ...options, alignment: AlignmentType.JUSTIFIED, children,
  });
  const heading = (text: string) => paragraph([run(text, true)], { keepNext: true, spacing: { before: 180, after: 80 } });
  const children = [heading(content.name), paragraph([run(content.headline, true)]), paragraph([run(content.contact)]),
    heading('PROFESSIONAL SUMMARY'), ...content.summary.split('\n').filter(Boolean).map(text => paragraph(rich(text))),
    heading('TECHNICAL SKILLS'),
    ...(content.skillCategories?.length
      ? content.skillCategories.map(group => paragraph([run(group.category + ': ', true), run(group.skills.join(', '))]))
      : [paragraph([run(content.skills.join(', '))])]),
  ];
  if (content.experience.length) children.push(heading('PROFESSIONAL EXPERIENCE'));
  for (const role of content.experience) {
    children.push(paragraph([run([role.title, role.company].filter(Boolean).join(' | '), true)], { keepNext: true }));
    if (role.location || role.dates) children.push(paragraph([run([role.location, role.dates].filter(Boolean).join(' | '))], { keepNext: true }));
    for (const text of role.bullets) children.push(paragraph(rich(text), { numbering: { reference: 'resume-bullets', level: 0 } }));
  }
  for (const section of ['education', 'certifications', 'projects'] as const) {
    if (content[section]?.length) children.push(heading(section.toUpperCase()), ...content[section]!.map(text => paragraph([run(text)])));
  }
  return new Document({
    styles: { default: { document: { run: WORD_RESUME_STYLE, paragraph: { alignment: AlignmentType.JUSTIFIED } } } },
    numbering: { config: [{ reference: 'resume-bullets', levels: [{ level: 0, format: LevelFormat.BULLET, text: '•', alignment: AlignmentType.LEFT,
      style: { run: WORD_RESUME_STYLE, paragraph: { indent: { left: 240, hanging: 160 } } } }] }] },
    sections: [{ properties: { page: { margin: { top: 720, bottom: 720, left: 720, right: 720 } } }, children }],
  });
}
