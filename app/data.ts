export type ApplicationStatus =
  | 'Applied'
  | 'Pending'
  | 'Interview'
  | 'Rejected'
  | 'Offer'
  | 'Failed';

export type SkillSource = 'Profile' | 'JD + Family' | 'Supporting' | 'Missing';

export type Skill = {
  name: string;
  source: SkillSource;
  required?: boolean;
};

export type Application = {
  id: string;
  company: string;
  companyMark: string;
  companyTone: string;
  title: string;
  location: string;
  workType: string;
  salary: string;
  source: string;
  status: ApplicationStatus;
  match: number;
  discovered: string;
  applied: string;
  updated: string;
  family: string;
  targetLocation: string;
  version: string;
  summary: string;
  skills: Skill[];
};

export const applications: Application[] = [
  {
    id: 'amazon-devops',
    company: 'Amazon',
    companyMark: 'a',
    companyTone: 'bg-[#182033] text-white',
    title: 'Senior DevOps Engineer',
    location: 'Seattle, WA',
    workType: 'Hybrid',
    salary: '$165K–$210K',
    source: 'LinkedIn',
    status: 'Applied',
    match: 94,
    discovered: 'Sep 6, 2026',
    applied: 'Sep 7, 2026',
    updated: 'Today, 9:42 AM',
    family: 'DevOps',
    targetLocation: 'Seattle Metro',
    version: 'v4',
    summary:
      'Design, automate, and operate highly available cloud infrastructure for Amazon retail systems. Partner with engineering teams to improve deployment reliability, observability, and operational excellence at scale.',
    skills: [
      { name: 'AWS', source: 'Profile', required: true },
      { name: 'Terraform', source: 'JD + Family', required: true },
      { name: 'Kubernetes', source: 'Profile', required: true },
      { name: 'Jenkins', source: 'Profile', required: true },
      { name: 'Prometheus', source: 'Supporting' },
      { name: 'Python', source: 'Profile' },
    ],
  },
  {
    id: 'stripe-platform',
    company: 'Stripe',
    companyMark: 'S',
    companyTone: 'bg-[#635bff] text-white',
    title: 'Platform Engineer',
    location: 'Remote',
    workType: 'Remote',
    salary: '$170K–$220K',
    source: 'Company site',
    status: 'Interview',
    match: 91,
    discovered: 'Sep 5, 2026',
    applied: 'Sep 6, 2026',
    updated: 'Yesterday, 4:18 PM',
    family: 'DevOps',
    targetLocation: 'United States · Remote',
    version: 'v3',
    summary:
      'Build paved roads for software delivery and help product teams operate services safely at global scale. Improve CI/CD, developer tooling, and Kubernetes platform reliability.',
    skills: [
      { name: 'Kubernetes', source: 'Profile', required: true },
      { name: 'GitHub Actions', source: 'JD + Family', required: true },
      { name: 'AWS', source: 'Profile', required: true },
      { name: 'Go', source: 'Supporting' },
      { name: 'Observability', source: 'Supporting' },
    ],
  },
  {
    id: 'datadog-sre',
    company: 'Datadog',
    companyMark: 'D',
    companyTone: 'bg-[#632ca6] text-white',
    title: 'Site Reliability Engineer',
    location: 'New York, NY',
    workType: 'Remote friendly',
    salary: '$155K–$205K',
    source: 'Indeed',
    status: 'Pending',
    match: 87,
    discovered: 'Sep 4, 2026',
    applied: '—',
    updated: 'Sep 6, 11:20 AM',
    family: 'DevOps',
    targetLocation: 'New York · Remote',
    version: 'v2',
    summary:
      'Operate distributed systems that power observability workloads. Improve reliability through automation, measurable SLOs, and thoughtful incident response practices.',
    skills: [
      { name: 'AWS', source: 'Profile', required: true },
      { name: 'Kubernetes', source: 'Profile', required: true },
      { name: 'Terraform', source: 'JD + Family', required: true },
      { name: 'Argo CD', source: 'Missing' },
      { name: 'Prometheus', source: 'Supporting' },
    ],
  },
];

export const candidateRecords = [
  { name: 'John Carter', initials: 'JC', email: 'john.carter@email.com', family: 'DevOps', location: 'Seattle, WA', resumes: 18, activeJobs: 27, status: 'Active', tone: 'avatar--violet' },
  { name: 'Priya Shah', initials: 'PS', email: 'priya.shah@email.com', family: 'Data Engineering', location: 'Austin, TX', resumes: 12, activeJobs: 19, status: 'Active', tone: 'avatar--teal' },
  { name: 'Marcus Lee', initials: 'ML', email: 'marcus.lee@email.com', family: 'Salesforce', location: 'Chicago, IL', resumes: 9, activeJobs: 14, status: 'Active', tone: 'avatar--blue' },
  { name: 'Elena Ruiz', initials: 'ER', email: 'elena.ruiz@email.com', family: 'AI / ML', location: 'San Francisco, CA', resumes: 15, activeJobs: 21, status: 'Active', tone: 'avatar--orange' },
  { name: 'Daniel Kim', initials: 'DK', email: 'daniel.kim@email.com', family: 'Software Engineering', location: 'Boston, MA', resumes: 6, activeJobs: 8, status: 'Paused', tone: 'avatar--blue' },
];

export const resumeHistory = [
  { candidate: 'John Carter', target: 'Senior DevOps Engineer', company: 'Amazon', version: 'v4', score: 94, state: 'Ready for review', date: 'Sep 7, 9:36 AM' },
  { candidate: 'Priya Shah', target: 'Senior Data Engineer', company: 'Snowflake', version: 'v3', score: 91, state: 'Approved', date: 'Sep 7, 9:10 AM' },
  { candidate: 'Marcus Lee', target: 'Platform Developer', company: 'Salesforce', version: 'v2', score: 86, state: 'Generating', date: 'Sep 7, 8:40 AM' },
  { candidate: 'Elena Ruiz', target: 'ML Infrastructure Engineer', company: 'Anthropic', version: 'v5', score: 89, state: 'Approved', date: 'Sep 7, 7:52 AM' },
  { candidate: 'John Carter', target: 'Platform Engineer', company: 'Stripe', version: 'v3', score: 91, state: 'Approved', date: 'Sep 6, 4:02 PM' },
];

export const amazonTimeline = [
  { date: 'Sep 6', title: 'Job discovered', detail: 'Imported from LinkedIn' },
  { date: 'Sep 6', title: 'Resume generated', detail: 'JD-first strategy · Version 4' },
  { date: 'Sep 7', title: 'Application submitted', detail: 'Submitted at 9:38 AM' },
  { date: 'Sep 7', title: 'Confirmation received', detail: 'Amazon application ID · AMZ-88241' },
];

export const fullJobDescription = {
  overview:
    'As a Senior DevOps Engineer, you will design and operate secure, highly available cloud platforms that support customer-facing systems at global scale. You will partner with software engineers to make delivery faster, safer, and easier to observe.',
  responsibilities: [
    'Design, build, and maintain production infrastructure on AWS using infrastructure as code.',
    'Own Kubernetes platform reliability, capacity planning, deployment automation, and operational readiness.',
    'Build and improve CI/CD pipelines with Jenkins and modern delivery practices.',
    'Create monitoring, alerting, and observability standards using Prometheus and related tooling.',
    'Lead incident response, write clear post-incident reviews, and automate recurring operational work.',
  ],
  qualifications: [
    '7+ years of experience in DevOps, SRE, cloud infrastructure, or platform engineering.',
    'Deep hands-on experience with AWS, Terraform, Kubernetes, Linux, and CI/CD systems.',
    'Proficiency in a scripting language such as Python or Bash.',
    'Strong written communication and a track record of working across engineering teams.',
  ],
};
