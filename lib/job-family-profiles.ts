export type JobSubFamilyProfile = {
  name: string;
  roles: string[];
  responsibilities: string[];
  skills: string[];
  tools: string[];
  combinations: string[][];
  adjacentSkills: Array<{ skill: string; when: string[]; confidence: number; reason: string }>;
  terminology: Record<string, string[]>;
  seniority: Record<string, string[]>;
  domains: Record<string, string[]>;
};

export type JobFamilyKnowledge = {
  family: string;
  description: string;
  subFamilies: JobSubFamilyProfile[];
};

export const JOB_FAMILY_KNOWLEDGE: JobFamilyKnowledge[] = [
  {
    family: 'Cloud / DevOps',
    description: 'Cloud platforms, delivery automation, infrastructure, reliability, and production operations.',
    subFamilies: [
      {
        name: 'DevOps Engineer',
        roles: ['devops engineer', 'cloud devops engineer', 'release engineer', 'build engineer'],
        responsibilities: ['automate delivery pipelines', 'manage infrastructure as code', 'operate cloud platforms', 'improve deployment reliability'],
        skills: ['AWS', 'Azure', 'Google Cloud', 'Terraform', 'Kubernetes', 'Docker', 'Linux', 'Python', 'Bash', 'CI/CD'],
        tools: ['Jenkins', 'GitHub Actions', 'GitLab CI', 'Ansible', 'Helm', 'Argo CD'],
        combinations: [['Terraform', 'AWS'], ['Kubernetes', 'Helm'], ['CI/CD', 'GitHub Actions']],
        adjacentSkills: [
          { skill: 'Helm', when: ['Kubernetes'], confidence: 0.82, reason: 'Common Kubernetes release and packaging tool.' },
          { skill: 'Argo CD', when: ['Kubernetes', 'CI/CD'], confidence: 0.78, reason: 'Common GitOps delivery tool for Kubernetes environments.' },
          { skill: 'Prometheus', when: ['Kubernetes'], confidence: 0.74, reason: 'Common monitoring stack for container platforms.' },
          { skill: 'Bash', when: ['Linux'], confidence: 0.72, reason: 'Frequently used for Linux operations automation.' },
        ],
        terminology: { 'CI/CD': ['continuous integration', 'continuous delivery', 'continuous deployment', 'delivery pipeline'], 'Google Cloud': ['GCP', 'Google Cloud Platform'], Kubernetes: ['K8s'], Terraform: ['infrastructure as code', 'IaC'] },
        seniority: { Junior: ['assist', 'support', 'learn', 'troubleshoot'], Mid: ['build', 'implement', 'maintain', 'automate'], Senior: ['design', 'own', 'lead', 'mentor'], Lead: ['define strategy', 'govern', 'drive standards', 'lead teams'] },
        domains: { fintech: ['PCI DSS', 'financial services'], healthcare: ['HIPAA', 'healthcare'], SaaS: ['multi-tenant', 'SaaS'] },
      },
      {
        name: 'Site Reliability Engineer',
        roles: ['site reliability engineer', 'sre', 'reliability engineer', 'production engineer'],
        responsibilities: ['define service objectives', 'improve reliability', 'lead incident response', 'reduce operational toil'],
        skills: ['SRE', 'Linux', 'Kubernetes', 'Python', 'Go', 'Observability', 'Distributed Systems'],
        tools: ['Prometheus', 'Grafana', 'Datadog', 'PagerDuty', 'OpenTelemetry'],
        combinations: [['Prometheus', 'Grafana'], ['SRE', 'Observability'], ['Kubernetes', 'OpenTelemetry']],
        adjacentSkills: [
          { skill: 'Grafana', when: ['Prometheus'], confidence: 0.88, reason: 'Frequently paired with Prometheus for visualization.' },
          { skill: 'OpenTelemetry', when: ['Observability'], confidence: 0.76, reason: 'Common vendor-neutral telemetry standard.' },
          { skill: 'PagerDuty', when: ['incident response'], confidence: 0.68, reason: 'Common on-call and incident management platform.' },
        ],
        terminology: { SRE: ['site reliability engineering', 'site reliability engineer'], Observability: ['monitoring', 'telemetry', 'tracing'], SLO: ['service level objective'], SLI: ['service level indicator'] },
        seniority: { Junior: ['support incidents', 'monitor', 'troubleshoot'], Mid: ['implement', 'automate', 'operate'], Senior: ['design', 'own reliability', 'lead incidents', 'mentor'], Lead: ['set reliability strategy', 'govern SLOs', 'drive standards'] },
        domains: { fintech: ['financial services', 'PCI DSS'], healthcare: ['HIPAA'], SaaS: ['multi-tenant', 'SaaS'] },
      },
      {
        name: 'Platform Engineer',
        roles: ['platform engineer', 'developer platform engineer', 'infrastructure platform engineer'],
        responsibilities: ['build internal developer platforms', 'create paved roads', 'standardize infrastructure', 'improve developer experience'],
        skills: ['Kubernetes', 'Terraform', 'Cloud Platforms', 'Platform Engineering', 'Developer Experience', 'CI/CD'],
        tools: ['Backstage', 'Crossplane', 'Argo CD', 'Helm', 'GitHub Actions'],
        combinations: [['Kubernetes', 'Terraform'], ['Backstage', 'Developer Experience'], ['Argo CD', 'Helm']],
        adjacentSkills: [{ skill: 'Backstage', when: ['developer experience', 'internal developer platform'], confidence: 0.75, reason: 'Common internal developer portal platform.' }],
        terminology: { 'Platform Engineering': ['internal developer platform', 'IDP'], 'Developer Experience': ['DevEx', 'DX'], 'CI/CD': ['delivery pipeline'] },
        seniority: { Junior: ['support', 'maintain'], Mid: ['build', 'implement'], Senior: ['design', 'own', 'lead'], Lead: ['define platform strategy', 'drive adoption', 'govern'] },
        domains: { enterprise: ['enterprise', 'shared services'], SaaS: ['SaaS', 'multi-tenant'] },
      },
      {
        name: 'Cloud Engineer',
        roles: ['cloud engineer', 'cloud infrastructure engineer', 'cloud operations engineer'],
        responsibilities: ['design cloud infrastructure', 'manage cloud services', 'automate provisioning', 'secure cloud workloads'],
        skills: ['AWS', 'Azure', 'Google Cloud', 'Terraform', 'Networking', 'IAM', 'Linux'],
        tools: ['CloudFormation', 'Azure DevOps', 'Ansible', 'Vault'],
        combinations: [['AWS', 'Terraform'], ['Azure', 'Terraform'], ['IAM', 'Cloud Platforms']],
        adjacentSkills: [{ skill: 'Vault', when: ['Terraform', 'IAM'], confidence: 0.66, reason: 'Common secrets-management companion for infrastructure automation.' }],
        terminology: { 'Google Cloud': ['GCP', 'Google Cloud Platform'], IAM: ['identity and access management'], Terraform: ['IaC', 'infrastructure as code'] },
        seniority: { Junior: ['support', 'provision'], Mid: ['implement', 'operate'], Senior: ['architect', 'design', 'lead'], Lead: ['define cloud strategy', 'govern', 'optimize portfolio'] },
        domains: { fintech: ['PCI DSS'], healthcare: ['HIPAA'], government: ['FedRAMP'] },
      },
      {
        name: 'Infrastructure Engineer',
        roles: ['infrastructure engineer', 'systems engineer', 'infrastructure automation engineer'],
        responsibilities: ['design compute and network infrastructure', 'automate provisioning', 'manage operating systems', 'improve infrastructure resilience'],
        skills: ['Linux', 'Networking', 'Terraform', 'Python', 'Bash', 'High Availability'], tools: ['Ansible', 'Packer', 'VMware', 'Vault'], combinations: [['Linux', 'Ansible'], ['Terraform', 'Packer']],
        adjacentSkills: [{ skill: 'Packer', when: ['Terraform', 'infrastructure automation'], confidence: 0.67, reason: 'Common image-building companion to infrastructure as code.' }],
        terminology: { 'High Availability': ['HA', 'resilience'], Terraform: ['IaC', 'infrastructure as code'] }, seniority: { Junior: ['support', 'provision'], Mid: ['build', 'automate'], Senior: ['design', 'own', 'lead'], Lead: ['define standards', 'govern', 'drive modernization'] }, domains: { enterprise: ['data center', 'enterprise'], cloud: ['cloud infrastructure'] },
      },
      {
        name: 'Release Engineer',
        roles: ['release engineer', 'build and release engineer', 'release manager'],
        responsibilities: ['manage software releases', 'automate build pipelines', 'coordinate deployments', 'govern release controls'],
        skills: ['CI/CD', 'Release Management', 'Build Automation', 'Git', 'Scripting'], tools: ['Jenkins', 'GitHub Actions', 'GitLab CI', 'Artifactory'], combinations: [['CI/CD', 'Jenkins'], ['Build Automation', 'Artifactory']],
        adjacentSkills: [{ skill: 'Artifactory', when: ['release', 'build'], confidence: 0.7, reason: 'Common artifact repository in release pipelines.' }],
        terminology: { 'Release Management': ['release engineering'], 'Build Automation': ['build pipeline'], 'CI/CD': ['continuous delivery'] }, seniority: { Junior: ['support releases', 'maintain builds'], Mid: ['automate', 'coordinate'], Senior: ['design', 'own', 'lead'], Lead: ['define release strategy', 'govern controls'] }, domains: { enterprise: ['change management'], SaaS: ['continuous delivery'] },
      },
      {
        name: 'Observability Engineer',
        roles: ['observability engineer', 'monitoring engineer', 'telemetry engineer'],
        responsibilities: ['design telemetry platforms', 'standardize monitoring', 'improve alert quality', 'enable service diagnostics'],
        skills: ['Observability', 'Metrics', 'Logging', 'Tracing', 'SRE'], tools: ['Prometheus', 'Grafana', 'OpenTelemetry', 'Datadog', 'Splunk'], combinations: [['Prometheus', 'Grafana'], ['OpenTelemetry', 'Tracing']],
        adjacentSkills: [{ skill: 'OpenTelemetry', when: ['observability', 'tracing'], confidence: 0.86, reason: 'Standard framework for collecting metrics, logs, and traces.' }],
        terminology: { Observability: ['monitoring', 'telemetry'], Tracing: ['distributed tracing'] }, seniority: { Junior: ['monitor', 'support'], Mid: ['implement', 'operate'], Senior: ['design', 'own', 'lead'], Lead: ['define observability strategy', 'govern standards'] }, domains: { SaaS: ['multi-tenant'], enterprise: ['enterprise monitoring'] },
      },
    ],
  },
  {
    family: 'Database Engineering',
    description: 'Database administration, engineering, reliability, performance, migration, and data platform operations.',
    subFamilies: [
      {
        name: 'PostgreSQL DBA',
        roles: ['postgresql dba', 'postgres dba', 'database administrator', 'senior database administrator'],
        responsibilities: ['administer PostgreSQL', 'tune database performance', 'design backup and recovery', 'manage replication', 'lead database migrations'],
        skills: ['PostgreSQL', 'SQL', 'Database Administration', 'Performance Tuning', 'High Availability', 'Backup and Recovery', 'Replication'],
        tools: ['pgAdmin', 'Patroni', 'pgBackRest', 'AWS RDS', 'Aurora PostgreSQL', 'Ansible'],
        combinations: [['PostgreSQL', 'Patroni'], ['PostgreSQL', 'pgBackRest'], ['AWS RDS', 'PostgreSQL']],
        adjacentSkills: [
          { skill: 'Patroni', when: ['PostgreSQL', 'high availability'], confidence: 0.78, reason: 'Common PostgreSQL high-availability orchestration tool.' },
          { skill: 'pgBackRest', when: ['PostgreSQL', 'backup'], confidence: 0.74, reason: 'Common PostgreSQL backup and restore tool.' },
          { skill: 'AWS RDS', when: ['PostgreSQL', 'AWS'], confidence: 0.72, reason: 'Common managed PostgreSQL platform on AWS.' },
        ],
        terminology: { PostgreSQL: ['Postgres', 'Aurora PostgreSQL'], 'High Availability': ['HA', 'failover'], 'Backup and Recovery': ['backup/restore', 'disaster recovery', 'DR'], Replication: ['streaming replication', 'logical replication'] },
        seniority: { Junior: ['monitor', 'support', 'execute backups'], Mid: ['administer', 'tune', 'automate'], Senior: ['design', 'own', 'lead migrations', 'mentor'], Lead: ['define database strategy', 'govern standards', 'drive modernization'] },
        domains: { fintech: ['transaction processing', 'financial services'], healthcare: ['healthcare data', 'HIPAA'], ecommerce: ['high-volume transactions', 'e-commerce'] },
      },
      {
        name: 'Database Engineer',
        roles: ['database engineer', 'database reliability engineer', 'data platform engineer'],
        responsibilities: ['design database platforms', 'automate database operations', 'improve reliability', 'optimize data access'],
        skills: ['SQL', 'PostgreSQL', 'MySQL', 'Database Design', 'Performance Tuning', 'Automation'],
        tools: ['Terraform', 'Ansible', 'Datadog', 'AWS RDS'],
        combinations: [['SQL', 'Performance Tuning'], ['Terraform', 'AWS RDS']],
        adjacentSkills: [{ skill: 'Datadog', when: ['database reliability', 'monitoring'], confidence: 0.64, reason: 'Common database monitoring and observability platform.' }],
        terminology: { 'Database Design': ['data modeling', 'schema design'], Automation: ['database automation', 'DBOps'] },
        seniority: { Junior: ['support', 'monitor'], Mid: ['build', 'automate'], Senior: ['design', 'own', 'lead'], Lead: ['set strategy', 'govern', 'drive modernization'] },
        domains: { fintech: ['financial services'], SaaS: ['multi-tenant'] },
      },
      {
        name: 'Oracle DBA', roles: ['oracle dba', 'oracle database administrator'], responsibilities: ['administer Oracle databases', 'tune SQL and workloads', 'manage backup and recovery', 'operate clustered databases'], skills: ['Oracle Database', 'SQL', 'Performance Tuning', 'High Availability', 'Backup and Recovery'], tools: ['RMAN', 'Oracle RAC', 'Data Guard', 'OEM'], combinations: [['Oracle Database', 'RMAN'], ['Oracle RAC', 'Data Guard']], adjacentSkills: [{ skill: 'Data Guard', when: ['Oracle', 'disaster recovery'], confidence: 0.82, reason: 'Common Oracle disaster-recovery and standby technology.' }], terminology: { 'Oracle Database': ['Oracle DB'], 'Oracle RAC': ['RAC'], 'Backup and Recovery': ['RMAN backup', 'disaster recovery'] }, seniority: { Junior: ['monitor', 'support'], Mid: ['administer', 'tune'], Senior: ['design', 'own', 'lead'], Lead: ['define strategy', 'govern'] }, domains: { enterprise: ['enterprise'], fintech: ['financial services'] },
      },
      {
        name: 'SQL Server DBA', roles: ['sql server dba', 'mssql dba', 'sql server database administrator'], responsibilities: ['administer SQL Server', 'tune T-SQL', 'manage backup and recovery', 'operate availability groups'], skills: ['SQL Server', 'T-SQL', 'Performance Tuning', 'High Availability', 'Backup and Recovery'], tools: ['SSMS', 'Always On', 'Azure SQL', 'PowerShell'], combinations: [['SQL Server', 'Always On'], ['T-SQL', 'SSMS']], adjacentSkills: [{ skill: 'PowerShell', when: ['SQL Server', 'automation'], confidence: 0.72, reason: 'Common automation language in Microsoft database environments.' }], terminology: { 'SQL Server': ['MSSQL', 'Microsoft SQL Server'], 'High Availability': ['Always On', 'availability groups'] }, seniority: { Junior: ['monitor', 'support'], Mid: ['administer', 'tune'], Senior: ['design', 'own', 'lead'], Lead: ['define strategy', 'govern'] }, domains: { enterprise: ['enterprise'], healthcare: ['healthcare'] },
      },
      {
        name: 'MySQL DBA', roles: ['mysql dba', 'mysql database administrator'], responsibilities: ['administer MySQL', 'tune queries', 'manage replication', 'design backup and recovery'], skills: ['MySQL', 'SQL', 'Replication', 'Performance Tuning', 'Backup and Recovery'], tools: ['Percona Toolkit', 'MySQL Workbench', 'AWS RDS', 'Aurora MySQL'], combinations: [['MySQL', 'Percona Toolkit'], ['MySQL', 'AWS RDS']], adjacentSkills: [{ skill: 'Percona Toolkit', when: ['MySQL', 'performance'], confidence: 0.78, reason: 'Common MySQL diagnostics and operations toolkit.' }], terminology: { MySQL: ['Aurora MySQL'], Replication: ['read replicas'] }, seniority: { Junior: ['monitor', 'support'], Mid: ['administer', 'tune'], Senior: ['design', 'own', 'lead'], Lead: ['define strategy', 'govern'] }, domains: { ecommerce: ['e-commerce'], SaaS: ['SaaS'] },
      },
      {
        name: 'MongoDB DBA', roles: ['mongodb dba', 'mongodb database administrator', 'mongodb engineer'], responsibilities: ['administer MongoDB', 'manage replica sets', 'design sharding', 'tune document workloads'], skills: ['MongoDB', 'NoSQL', 'Replication', 'Sharding', 'Performance Tuning'], tools: ['MongoDB Atlas', 'Ops Manager', 'Compass'], combinations: [['MongoDB', 'MongoDB Atlas'], ['Replication', 'Sharding']], adjacentSkills: [{ skill: 'MongoDB Atlas', when: ['MongoDB', 'cloud'], confidence: 0.8, reason: 'Common managed MongoDB platform.' }], terminology: { MongoDB: ['Mongo DB'], Replication: ['replica sets'] }, seniority: { Junior: ['monitor', 'support'], Mid: ['administer', 'tune'], Senior: ['design', 'own', 'lead'], Lead: ['define strategy', 'govern'] }, domains: { SaaS: ['SaaS'], ecommerce: ['e-commerce'] },
      },
      {
        name: 'Cloud Database Engineer', roles: ['cloud database engineer', 'cloud dba', 'database cloud engineer'], responsibilities: ['operate managed database services', 'automate database provisioning', 'design cloud resilience', 'optimize database cost and performance'], skills: ['Cloud Databases', 'SQL', 'Terraform', 'High Availability', 'Database Migration'], tools: ['AWS RDS', 'Azure SQL', 'Cloud SQL', 'DMS'], combinations: [['AWS RDS', 'Terraform'], ['Cloud SQL', 'Database Migration']], adjacentSkills: [{ skill: 'DMS', when: ['database migration', 'AWS'], confidence: 0.7, reason: 'Common managed database migration service.' }], terminology: { 'Cloud Databases': ['managed databases', 'DBaaS'], 'Database Migration': ['cloud migration'] }, seniority: { Junior: ['support', 'monitor'], Mid: ['build', 'automate'], Senior: ['architect', 'own', 'lead'], Lead: ['define cloud database strategy', 'govern'] }, domains: { SaaS: ['SaaS'], fintech: ['financial services'] },
      },
    ],
  },
  {
    family: 'Software Engineering',
    description: 'Application, service, API, frontend, and full-stack software delivery.',
    subFamilies: [
      {
        name: 'Software Engineer',
        roles: ['software engineer', 'software developer', 'full stack engineer', 'backend engineer', 'frontend engineer'],
        responsibilities: ['design software', 'develop services', 'build user experiences', 'review code', 'test and operate applications'],
        skills: ['JavaScript', 'TypeScript', 'React', 'Node.js', 'Java', 'Python', 'Go', 'SQL', 'API Design'],
        tools: ['GitHub', 'Docker', 'Jest', 'Cypress'],
        combinations: [['TypeScript', 'React'], ['Node.js', 'API Design'], ['Java', 'Spring Boot']],
        adjacentSkills: [{ skill: 'Jest', when: ['JavaScript', 'TypeScript'], confidence: 0.66, reason: 'Common JavaScript and TypeScript testing framework.' }],
        terminology: { 'Node.js': ['NodeJS', 'Node JS'], 'API Design': ['REST API', 'RESTful services'], JavaScript: ['JS'], TypeScript: ['TS'] },
        seniority: { Junior: ['implement', 'test', 'support'], Mid: ['develop', 'design', 'review'], Senior: ['architect', 'own', 'mentor', 'lead'], Lead: ['define technical direction', 'drive standards', 'lead teams'] },
        domains: { fintech: ['financial services'], healthcare: ['healthcare'], ecommerce: ['e-commerce'] },
      },
    ],
  },
];
