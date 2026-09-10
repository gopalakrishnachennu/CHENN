import { readFileSync } from 'node:fs';

const project = 'chennu4169';
const database = 'chenn';
const configPath = `${process.env.HOME}/.config/configstore/firebase-tools.json`;
const config = JSON.parse(readFileSync(configPath, 'utf8'));
const token = config.tokens?.access_token;
if (!token) throw new Error('Run `firebase projects:list` first to refresh Firebase CLI credentials.');

const api = `https://firestore.googleapis.com/v1/projects/${project}/databases/${database}/documents:commit`;
const value = (input) => {
  if (input === null) return { nullValue: null };
  if (typeof input === 'string') return { stringValue: input };
  if (typeof input === 'boolean') return { booleanValue: input };
  if (typeof input === 'number' && Number.isInteger(input)) return { integerValue: String(input) };
  if (typeof input === 'number') return { doubleValue: input };
  if (Array.isArray(input)) return { arrayValue: { values: input.map(value) } };
  return { mapValue: { fields: Object.fromEntries(Object.entries(input).map(([key, item]) => [key, value(item)])) } };
};
const document = (path, fields) => ({ update: { name: `projects/${project}/databases/${database}/documents/${path}`, fields: Object.fromEntries(Object.entries(fields).map(([key, item]) => [key, value(item)])) } });
const now = new Date().toISOString();
const families = [
  ['DevOps', ['DevOps Engineer', 'Platform Engineer', 'Site Reliability Engineer'], ['AWS', 'Terraform', 'Kubernetes', 'Docker', 'Jenkins', 'Python']],
  ['Data Engineering', ['Data Engineer', 'Analytics Engineer', 'Data Platform Engineer'], ['SQL', 'Python', 'Spark', 'Airflow', 'Kafka', 'Snowflake']],
  ['Software Engineering', ['Software Engineer', 'Backend Engineer', 'Full Stack Engineer'], ['TypeScript', 'React', 'Node.js', 'Java', 'Go', 'SQL']],
];
const candidateNames = [
  ['Aarav', 'Sharma', 'DevOps'], ['Ananya', 'Iyer', 'Data Engineering'], ['Vihaan', 'Patel', 'Software Engineering'],
  ['Diya', 'Reddy', 'DevOps'], ['Arjun', 'Nair', 'Data Engineering'], ['Meera', 'Joshi', 'Software Engineering'],
  ['Rohan', 'Kapoor', 'DevOps'], ['Ishita', 'Menon', 'Data Engineering'], ['Aditya', 'Bose', 'Software Engineering'], ['Kavya', 'Rao', 'DevOps'],
];
const writes = [];
for (let i = 0; i < candidateNames.length; i++) {
  const [firstName, lastName, family] = candidateNames[i];
  const familySkills = families.find(item => item[0] === family)[2];
  const years = i % 2 === 0 ? 6 + (i % 3) : 5;
  const role = families.find(item => item[0] === family)[1][i % 3];
  const id = `demo-candidate-${String(i + 1).padStart(2, '0')}`;
  const career = { experience: [{ company: `Demo ${family.split(' ')[0]} Labs`, title: role, location: 'Bengaluru, India', start: `${2026 - years}-01`, end: '', current: true, responsibilities: `Verified ${years}+ years delivering ${familySkills.slice(0, 3).join(', ')} in production environments.`, achievements: 'Improved reliability, delivery speed, and operational visibility for business-critical systems.', technologies: familySkills.join(', ') }], education: [{ institution: 'Demo Institute of Technology', degree: "Bachelor's", field: 'Computer Science', start: '2014-06', end: '2018-05' }], certifications: [], projects: [] };
  const skills = familySkills.map((skill, index) => ({ id: `${id}-skill-${index}`, name: skill, proficiency: index < 3 ? 'Advanced' : 'Experienced', years, evidence: `Verified ${skill} delivery in the candidate's ${role} experience.`, source: 'Career' }));
  writes.push(document(`candidates/${id}`, { id, email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}.${i + 1}@example.com`, firstName, lastName, name: `${firstName} ${lastName}`, initials: `${firstName[0]}${lastName[0]}`, phone: `+91 90000 ${String(10000 + i)}`, headline: role, summary: '', location: 'Bengaluru, India', family, status: 'Active', portalEnabled: false, skills, career, matchPreferences: { secondaryFamilies: [], targetRoles: [role], locations: ['Any'], workTypes: ['Any'], authorizations: ['Any'], seniorities: ['Any'], yearsExperience: years, minimumSalary: null, currency: 'USD', minimumScore: 70, dailyLimit: 10 }, createdAt: now, updatedAt: now }));
}
const companies = ['Infosys', 'TCS', 'Wipro', 'HCLTech', 'Tech Mahindra', 'Flipkart', 'Razorpay', 'Myntra', 'Freshworks', 'Zoho'];
for (let i = 0; i < 50; i++) {
  const [family, roles, skills] = families[i % families.length];
  const role = roles[i % roles.length];
  const company = companies[i % companies.length];
  const location = i % 4 === 0 ? 'Remote' : ['Bengaluru, India', 'Hyderabad, India', 'Pune, India'][i % 3];
  const id = `demo-job-${String(i + 1).padStart(2, '0')}`;
  const jdText = `${company} is hiring a ${role}. Build and operate reliable systems using ${skills.slice(0, 3).join(', ')}. Collaborate with engineering teams, improve automation and production quality, and document operational practices. ${skills.slice(3).join(', ')} are preferred.`;
  writes.push(document(`catalogJobs/${id}`, { id, company: `[DEMO] ${company}`, title: `${role} ${i + 1}`, family, role, familyConfidence: 100, mandatorySkills: skills.slice(0, 3), preferredSkills: skills.slice(3), criticalSkills: [skills[0]], seniority: i % 3 === 0 ? 'Senior' : 'Mid-level', minimumYears: i % 3 === 0 ? 6 : 5, location, workType: i % 4 === 0 ? 'Remote' : 'Hybrid', authorization: 'Any', salary: '$120,000–$180,000', salaryMax: 180000, currency: 'USD', source: 'Demo fixture', sourceUrl: `https://example.com/demo-jobs/${id}`, jdText, status: 'Open', expiresAt: new Date(Date.now() + 30 * 86400000).toISOString(), createdAt: now, updatedAt: now }));
  for (let candidateIndex = 0; candidateIndex < candidateNames.length; candidateIndex++) {
    if (candidateNames[candidateIndex][2] !== family) continue;
    const candidateId = `demo-candidate-${String(candidateIndex + 1).padStart(2, '0')}`;
    const candidateEmail = `${candidateNames[candidateIndex][0].toLowerCase()}.${candidateNames[candidateIndex][1].toLowerCase()}.${candidateIndex + 1}@example.com`;
    const applicationId = `${id}_${candidateId}`;
    writes.push(document(`jobs/${applicationId}`, { id: applicationId, catalogId: id, candidateId, company: `[DEMO] ${company}`, title: `${role} ${i + 1}`, location, workType: i % 4 === 0 ? 'Remote' : 'Hybrid', salary: '$120,000–$180,000', source: 'Demo fixture', sourceUrl: `https://example.com/demo-jobs/${id}`, jdText, mandatorySkills: skills.slice(0, 3), preferredSkills: skills.slice(3), targetRole: role, targetLocation: location, family, status: 'Selected', matchScore: 80 + (candidateIndex % 15), discoveredAt: now, appliedAt: null, appliedResumeId: null, createdAt: now, updatedAt: now }));
    writes.push(document(`candidateCatalogAccess/${candidateEmail}/jobs/${id}`, { candidateId }));
  }
}
const response = await fetch(api, { method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: JSON.stringify({ writes }) });
if (!response.ok) throw new Error(`Firestore seed failed (${response.status}): ${await response.text()}`);
console.log(JSON.stringify({ candidates: candidateNames.length, jobs: 50, families: families.length, demoPrefix: '[DEMO]', written: writes.length }));
