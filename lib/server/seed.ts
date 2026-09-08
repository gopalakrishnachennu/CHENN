import { DEFAULT_SETTINGS } from '@/lib/default-settings';
import type { ResumeContent, SkillPlanItem } from '@/lib/types';

export { DEFAULT_SETTINGS } from '@/lib/default-settings';

const iso = (offsetHours = 0) => new Date(Date.now() + offsetHours * 3_600_000).toISOString();

function resumeContent(name: string, headline: string, email: string, location: string): ResumeContent {
  return {
    name,
    headline,
    contact: `${email} · ${location}`,
    summary: 'Cloud and platform engineer focused on reliable delivery, secure infrastructure, automation, and measurable operational improvements.',
    skills: ['AWS', 'Kubernetes', 'Jenkins', 'Python', 'Prometheus', 'Linux'],
    experience: [
      {
        title: 'Senior DevOps Engineer',
        company: 'Northstar Systems',
        location,
        dates: '2021 – Present',
        bullets: [
          'Operates AWS and Kubernetes platforms supporting customer-facing services.',
          'Improves CI/CD reliability through repeatable automation and operational standards.',
          'Partners with engineering teams on monitoring, incident response, and infrastructure reviews.',
        ],
      },
      {
        title: 'Cloud Infrastructure Engineer',
        company: 'Beacon Digital',
        location,
        dates: '2018 – 2021',
        bullets: [
          'Built infrastructure automation and supported Linux-based production workloads.',
          'Developed Python and Bash tooling for recurring operational work.',
        ],
      },
    ],
    education: ['B.S. Computer Science'],
  };
}

export async function ensureSeeded(db: D1Database, actorEmail: string) {
  const row = await db.prepare('SELECT COUNT(*) AS count FROM candidates').first<{ count: number }>();
  if ((row?.count ?? 0) > 0) return;

  const now = iso();
  const families = [
    ['family-devops', 'DevOps', 'Cloud, platform, SRE and delivery engineering.', ['DevOps Engineer', 'Platform Engineer', 'Site Reliability Engineer'], ['AWS', 'Azure', 'GCP', 'Terraform', 'Kubernetes', 'Docker', 'Jenkins', 'GitHub Actions', 'Prometheus', 'Grafana', 'Python', 'Bash', 'Linux', 'Ansible', 'Argo CD', 'Helm', 'CI/CD', 'SRE', 'Observability']],
    ['family-data', 'Data Engineering', 'Data platforms, pipelines and analytics infrastructure.', ['Data Engineer', 'Analytics Engineer', 'Data Platform Engineer'], ['SQL', 'Python', 'Snowflake', 'Databricks', 'Spark', 'Kafka', 'Airflow', 'dbt', 'AWS']],
    ['family-software', 'Software Engineering', 'Product and backend software engineering.', ['Software Engineer', 'Backend Engineer', 'Full Stack Engineer'], ['JavaScript', 'TypeScript', 'React', 'Node.js', 'Java', 'Go', 'C#', '.NET', 'SQL', 'AWS']],
    ['family-salesforce', 'Salesforce', 'Salesforce platform development and administration.', ['Salesforce Developer', 'Platform Developer', 'Salesforce Administrator'], ['Salesforce', 'Apex', 'JavaScript', 'CI/CD']],
    ['family-ml', 'AI / ML', 'Machine-learning and model platform engineering.', ['ML Engineer', 'ML Infrastructure Engineer', 'Data Scientist'], ['Python', 'Machine Learning', 'TensorFlow', 'PyTorch', 'MLOps', 'Kubernetes', 'AWS']],
  ] as const;

  const candidates = [
    ['candidate-john', 'john.carter@email.com', 'John', 'Carter', '+1 (206) 555-0188', 'Senior DevOps & Platform Engineer', 'Cloud infrastructure specialist with experience operating reliable AWS and Kubernetes platforms.', 'Seattle, WA', 'DevOps', 'Active'],
    ['candidate-priya', 'priya.shah@email.com', 'Priya', 'Shah', '+1 (512) 555-0172', 'Senior Data Engineer', 'Data engineer focused on dependable analytical platforms and production pipelines.', 'Austin, TX', 'Data Engineering', 'Active'],
    ['candidate-marcus', 'marcus.lee@email.com', 'Marcus', 'Lee', '+1 (312) 555-0134', 'Salesforce Platform Developer', 'Salesforce specialist building maintainable business platforms.', 'Chicago, IL', 'Salesforce', 'Active'],
    ['candidate-elena', 'elena.ruiz@email.com', 'Elena', 'Ruiz', '+1 (415) 555-0156', 'ML Infrastructure Engineer', 'Engineer focused on reliable model delivery and ML platforms.', 'San Francisco, CA', 'AI / ML', 'Active'],
    ['candidate-daniel', 'daniel.kim@email.com', 'Daniel', 'Kim', '+1 (617) 555-0103', 'Software Engineer', 'Product engineer building clear and reliable software.', 'Boston, MA', 'Software Engineering', 'Paused'],
  ] as const;

  const statements: D1PreparedStatement[] = [];
  for (const [id, name, description, roles, skills] of families) {
    statements.push(db.prepare('INSERT OR IGNORE INTO job_families (id,name,description,roles_json,skills_json,active,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)').bind(id, name, description, JSON.stringify(roles), JSON.stringify(skills), 1, now, now));
  }
  for (const rowData of candidates) {
    statements.push(db.prepare('INSERT OR IGNORE INTO candidates (id,email,first_name,last_name,phone,headline,summary,location,family,status,portal_enabled,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)').bind(...rowData, 1, now, now));
  }

  const skills = [
    ['skill-aws', 'AWS', 8, 'Advanced', '8 years across three cloud roles.'],
    ['skill-kubernetes', 'Kubernetes', 6, 'Advanced', 'Production operations and EKS platform ownership.'],
    ['skill-jenkins', 'Jenkins', 5, 'Advanced', 'CI/CD ownership in two roles.'],
    ['skill-python', 'Python', 7, 'Advanced', 'Automation scripts and internal tooling.'],
    ['skill-linux', 'Linux', 9, 'Advanced', 'Production Linux systems administration.'],
    ['skill-prometheus', 'Prometheus', 4, 'Experienced', 'Service and Kubernetes observability.'],
  ] as const;
  for (const [id, name, years, proficiency, evidence] of skills) {
    statements.push(db.prepare('INSERT OR IGNORE INTO candidate_skills (id,candidate_id,name,proficiency,years,evidence,source,created_at) VALUES (?,?,?,?,?,?,?,?)').bind(id, 'candidate-john', name, proficiency, years, evidence, 'Profile', now));
  }

  const jdAmazon = 'Amazon is hiring a Senior DevOps Engineer to design and operate secure, highly available AWS infrastructure. Build infrastructure as code with Terraform, own Kubernetes reliability, and improve CI/CD automation with Jenkins. Experience with Prometheus and Python is preferred. Lead incident response and partner with engineering teams.';
  const jdStripe = 'Build paved roads for software delivery as a Platform Engineer. Operate Kubernetes and AWS services, improve CI/CD with GitHub Actions, and strengthen observability. Go experience is preferred.';
  const jdDatadog = 'Operate distributed systems as a Site Reliability Engineer. Improve AWS and Kubernetes reliability using Terraform, Prometheus, measurable SLOs, incident response, and automation. Argo CD is preferred.';
  const jobs = [
    ['job-amazon', 'Amazon', 'Senior DevOps Engineer', 'Seattle, WA', 'Hybrid', '$165K–$210K', 'LinkedIn', 'https://www.amazon.jobs/', jdAmazon, ['AWS','Terraform','Kubernetes','Jenkins'], ['Prometheus','Python'], 'Senior DevOps Engineer', 'Seattle Metro', 'DevOps', 'Applied', 80, iso(-26), iso(-9)],
    ['job-stripe', 'Stripe', 'Platform Engineer', 'Remote', 'Remote', '$170K–$220K', 'Company site', 'https://stripe.com/jobs', jdStripe, ['Kubernetes','AWS','GitHub Actions'], ['Go','Observability'], 'Platform Engineer', 'United States · Remote', 'DevOps', 'Interview', 50, iso(-52), iso(-34)],
    ['job-datadog', 'Datadog', 'Site Reliability Engineer', 'New York, NY', 'Remote friendly', '$155K–$205K', 'Indeed', 'https://careers.datadoghq.com/', jdDatadog, ['AWS','Kubernetes','Terraform'], ['Argo CD','Prometheus'], 'Site Reliability Engineer', 'New York · Remote', 'DevOps', 'Pending', 63, iso(-78), null],
    ['job-github', 'GitHub', 'Infrastructure Engineer', 'Remote', 'Remote', 'Not listed', 'Company site', 'https://www.github.careers/', 'Improve global infrastructure reliability using Kubernetes, Terraform, Go, and GitHub Actions. Strong AWS experience required.', ['AWS','Kubernetes','Terraform','GitHub Actions'], ['Go'], 'Infrastructure Engineer', 'United States · Remote', 'DevOps', 'Rejected', 44, iso(-120), iso(-100)],
    ['job-cloudflare', 'Cloudflare', 'Platform Reliability Engineer', 'Austin, TX', 'Hybrid', 'Not listed', 'LinkedIn', 'https://www.cloudflare.com/careers/', 'Build reliable platforms using Linux, Kubernetes, Prometheus, Terraform and Python automation.', ['Linux','Kubernetes','Terraform','Python'], ['Prometheus'], 'Platform Reliability Engineer', 'Austin Metro', 'DevOps', 'Offer', 78, iso(-144), iso(-125)],
    ['job-vercel', 'Vercel', 'DevOps Engineer', 'Remote', 'Remote', 'Not listed', 'Referral', 'https://vercel.com/careers', 'Operate cloud infrastructure and delivery systems with AWS, Terraform, Kubernetes and CI/CD.', ['AWS','Terraform','Kubernetes','CI/CD'], [], 'DevOps Engineer', 'United States · Remote', 'DevOps', 'Failed', 50, iso(-168), null],
    ['job-hashicorp', 'HashiCorp', 'Cloud Platform Engineer', 'Remote', 'Remote', 'Not listed', 'Company site', 'https://www.hashicorp.com/careers', 'Design cloud platforms using Terraform, Kubernetes, AWS and operational automation.', ['Terraform','Kubernetes','AWS'], ['Go'], 'Cloud Platform Engineer', 'United States · Remote', 'DevOps', 'Selected', 57, iso(-4), null],
  ] as const;
  for (const [id, company, title, location, workType, salary, source, url, jd, mandatory, preferred, targetRole, targetLocation, family, status, match, discovered, applied] of jobs) {
    statements.push(db.prepare('INSERT OR IGNORE INTO jobs (id,candidate_id,company,title,location,work_type,salary,source,source_url,jd_text,mandatory_skills_json,preferred_skills_json,target_role,target_location,family,status,match_score,discovered_at,applied_at,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').bind(id, 'candidate-john', company, title, location, workType, salary, source, url, jd, JSON.stringify(mandatory), JSON.stringify(preferred), targetRole, targetLocation, family, status, match, discovered, applied, discovered, applied ?? discovered));
  }

  const amazonSkillPlan: SkillPlanItem[] = [
    { name: 'AWS', source: 'Profile', required: true, detail: '8 years across three cloud roles.' },
    { name: 'Terraform', source: 'JD + Family', required: true, detail: 'Relevant to the approved DevOps family, but not candidate evidence; excluded from resume claims.' },
    { name: 'Kubernetes', source: 'Profile', required: true, detail: 'Production operations and EKS platform ownership.' },
    { name: 'Jenkins', source: 'Profile', required: true, detail: 'CI/CD ownership in two roles.' },
    { name: 'Prometheus', source: 'Profile', required: false, detail: 'Service and Kubernetes observability.' },
    { name: 'Python', source: 'Profile', required: false, detail: 'Automation scripts and internal tooling.' },
  ];
  const stripeSkillPlan: SkillPlanItem[] = [
    { name: 'Kubernetes', source: 'Profile', required: true, detail: 'Production operations and EKS platform ownership.' },
    { name: 'AWS', source: 'Profile', required: true, detail: '8 years across three cloud roles.' },
    { name: 'GitHub Actions', source: 'JD + Family', required: true, detail: 'Relevant to the approved DevOps family, but not candidate evidence; excluded from resume claims.' },
    { name: 'Go', source: 'Supporting', required: false, detail: 'Preferred JD context only; excluded from resume claims.' },
    { name: 'Observability', source: 'JD + Family', required: false, detail: 'Relevant to the approved DevOps family, but not candidate evidence; excluded from resume claims.' },
  ];
  const datadogSkillPlan: SkillPlanItem[] = [
    { name: 'AWS', source: 'Profile', required: true, detail: '8 years across three cloud roles.' },
    { name: 'Kubernetes', source: 'Profile', required: true, detail: 'Production operations and EKS platform ownership.' },
    { name: 'Terraform', source: 'JD + Family', required: true, detail: 'Relevant to the approved DevOps family, but not candidate evidence; excluded from resume claims.' },
    { name: 'Argo CD', source: 'JD + Family', required: false, detail: 'Relevant to the approved DevOps family, but not candidate evidence; excluded from resume claims.' },
    { name: 'Prometheus', source: 'Profile', required: false, detail: 'Service and Kubernetes observability.' },
  ];
  const content = resumeContent('John Carter', 'Senior DevOps Engineer', 'john.carter@email.com', 'Seattle, WA');
  statements.push(db.prepare('INSERT OR IGNORE INTO resume_versions (id,candidate_id,job_id,parent_id,version,content_json,skill_plan_json,scores_json,template,status,engine,created_at,approved_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)').bind('resume-amazon-v4', 'candidate-john', 'job-amazon', null, 4, JSON.stringify(content), JSON.stringify(amazonSkillPlan), JSON.stringify({ jdMatch: 80, ats: 88, recruiterSafe: 98, evidence: 94 }), 'Modern ATS', 'Approved', 'grounded-fallback', iso(-9), iso(-8)));
  statements.push(db.prepare('INSERT OR IGNORE INTO resume_versions (id,candidate_id,job_id,parent_id,version,content_json,skill_plan_json,scores_json,template,status,engine,created_at,approved_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)').bind('resume-stripe-v3', 'candidate-john', 'job-stripe', null, 3, JSON.stringify({ ...content, headline: 'Platform Engineer' }), JSON.stringify(stripeSkillPlan), JSON.stringify({ jdMatch: 50, ats: 84, recruiterSafe: 98, evidence: 94 }), 'Modern ATS', 'Approved', 'grounded-fallback', iso(-34), iso(-33)));
  statements.push(db.prepare('INSERT OR IGNORE INTO resume_versions (id,candidate_id,job_id,parent_id,version,content_json,skill_plan_json,scores_json,template,status,engine,created_at,approved_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)').bind('resume-datadog-v2', 'candidate-john', 'job-datadog', null, 2, JSON.stringify({ ...content, headline: 'Site Reliability Engineer' }), JSON.stringify(datadogSkillPlan), JSON.stringify({ jdMatch: 63, ats: 84, recruiterSafe: 98, evidence: 94 }), 'Classic ATS', 'Ready for review', 'grounded-fallback', iso(-50), null));
  statements.push(db.prepare("UPDATE jobs SET applied_resume_id='resume-amazon-v4' WHERE id='job-amazon'"));
  statements.push(db.prepare("UPDATE jobs SET applied_resume_id='resume-stripe-v3' WHERE id='job-stripe'"));

  const events = [
    ['event-1', 'job-amazon', 'discovered', 'Job discovered', 'Imported from LinkedIn', iso(-26)],
    ['event-2', 'job-amazon', 'resume_generated', 'Resume generated', 'JD-first strategy · Version 4', iso(-10)],
    ['event-3', 'job-amazon', 'status', 'Application submitted', 'Status changed to Applied', iso(-9)],
    ['event-4', 'job-amazon', 'confirmation', 'Confirmation received', 'Amazon application confirmation recorded', iso(-8)],
    ['event-5', 'job-stripe', 'status', 'Interview scheduled', 'Application moved to Interview', iso(-4)],
  ] as const;
  for (const event of events) {
    statements.push(db.prepare('INSERT OR IGNORE INTO application_events (id,job_id,event_type,title,detail,created_at) VALUES (?,?,?,?,?,?)').bind(...event));
  }

  statements.push(db.prepare('INSERT OR IGNORE INTO prompts (id,name,scope,template,version,active,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)').bind('prompt-base', 'Base JD-first generation', 'Global', 'Start with the complete JD. Resolve every requirement. Use only candidate evidence or approved family capability. Never invent employers, dates, metrics, degrees, certifications, or prior hands-on experience.', 1, 1, now, now));
  statements.push(db.prepare('INSERT OR IGNORE INTO settings (key,value_json,updated_at,updated_by) VALUES (?,?,?,?)').bind('platform', JSON.stringify(DEFAULT_SETTINGS), now, actorEmail));
  statements.push(db.prepare('INSERT OR IGNORE INTO announcements (id,title,message,active,created_at) VALUES (?,?,?,?,?)').bind('announcement-welcome', 'Welcome to your career portal', 'Track every job, status change, and approved resume here. Your portal is always read only.', 1, now));
  statements.push(db.prepare('INSERT OR IGNORE INTO evaluations (id,name,status,score,results_json,created_at) VALUES (?,?,?,?,?,?)').bind('evaluation-seed', 'JD-first safety suite', 'Passed', 96, JSON.stringify({ factualSafety: 96, jdCoverage: 94, atsValidity: 98, cases: 24 }), now));
  statements.push(db.prepare('INSERT OR IGNORE INTO audit_logs (id,actor_email,action,entity_type,entity_id,details_json,created_at) VALUES (?,?,?,?,?,?,?)').bind(crypto.randomUUID(), actorEmail, 'workspace.seeded', 'system', 'resumeos', JSON.stringify({ candidates: candidates.length, jobs: jobs.length }), now));

  await db.batch(statements);
}
