export interface SkillItem {
  id: string;
  name: string;
  category: "Technical" | "Leadership" | "Domain" | "Operational";
  level: "Foundational" | "Proficient" | "Advanced" | "Expert";
  verifiedScore: number;
  evidence: string;
}

export interface EducationItem {
  degree: string;
  institution: string;
  year: string;
  score?: string;
}

export interface ProjectItem {
  title: string;
  techStack: string[];
  description: string;
  impact?: string;
}

export interface ExperienceItem {
  role: string;
  company: string;
  duration: string;
  highlights: string[];
}

export interface CertificationItem {
  name: string;
  issuer: string;
  year?: string;
}

export interface ExtractedSkillsResponse {
  candidateName: string;
  email?: string;
  phone?: string;
  location?: string;
  summary?: string;
  targetRole?: string;
  targetCompany?: string;
  workMode?: string;
  careerBreakYears?: number;
  breakContext?: string;
  breakNeutralityScore?: number;
  extractedSkills: SkillItem[];
  education?: EducationItem[];
  projects?: ProjectItem[];
  experience?: ExperienceItem[];
  certifications?: CertificationItem[];
  achievements?: string[];
  readinessRating: number;
  topStrengths: string[];
}

export interface JobMatchResponse {
  jobId: number;
  jobTitle: string;
  company: string;
  overallFitScore: number;
  skillAlignmentScore: number;
  breakImpactScore?: number;
  breakNeutralityExplanation?: string;
  matchSummary?: string;
  matchingStrengths: string[];
  transferableStrengths?: string[];
  evidenceHighlights?: string[];
  skillGaps: string[];
  threeWeekBoostProjected: number;
  sapLearningHubModules: {
    week: number;
    title: string;
    courseUrl: string;
    competencyGained: string;
    hoursRequired: number;
  }[];
}

export interface BiasAuditResponse {
  totalCandidatesEvaluated: number;
  breakDurationPenaltyApplied?: number;
  pedigreeWeight: number;
  demonstratedSkillsWeight: number;
  practicalEvidenceWeight: number;
  fairnessIndex: number | null;
  auditStatus: "PASSED_FAIRNESS_VERIFICATION" | "INSUFFICIENT_DATA";
  notes: string;
}
