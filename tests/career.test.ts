import { expect, it } from 'vitest';
import { careerSchema, careerContent, emptyCareer } from '../lib/career';
it('preserves employer, actual title, timeline and evidence in resume content', () => {
  const career = emptyCareer();
  career.experience.push({ company: 'Acme', title: 'Engineer II', location: 'Austin', start: '2020-01', end: '', current: true, responsibilities: 'Built APIs', achievements: 'Reduced latency', technologies: 'Python' });
  career.projects.push({ name: 'Library', contribution: 'Author', technologies: 'Python', outcomes: '', url: 'https://github.com/example/library' });
  expect(careerContent(career).experience[0]).toMatchObject({ company: 'Acme', title: 'Engineer II', dates: '2020-01 – Present', bullets: ['Built APIs', 'Reduced latency', 'Technologies: Python'] });
  expect(careerContent(career).projects[0]).toContain('https://github.com/example/library');
  career.experience[0].end = '2019-01';
  expect(() => careerSchema.parse(career)).toThrow();
});
it('rejects unsafe links and retains compatibility for existing candidates', () => {
  expect(careerContent().experience).toEqual([]);
  expect(() => careerSchema.parse({ ...emptyCareer(), projects: [{ name: 'Test', contribution: '', technologies: '', outcomes: '', url: 'javascript:alert(1)' }] })).toThrow();
});
