import { type ReactNode, createContext, useContext, useEffect, useMemo, useState, useRef } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { ClerkProvider, SignIn, SignUp, useAuth, useClerk, useUser } from '@clerk/react';
import { publishableKeyFromHost } from '@clerk/react/internal';
import { shadcn } from '@clerk/themes';
import {
  AlertCircle, ArrowLeft, ArrowRight, Award, BarChart3, Bell, BookOpen, BriefcaseBusiness, Building2, Check,
  CheckCircle2, ChevronDown, ChevronRight, Clock3, Code, Compass, CreditCard,
  Download, FileCheck2, FileText, Filter, Gauge, GraduationCap, Heart, Inbox, Info,
  LayoutDashboard, Lightbulb, LineChart, ListFilter, LockKeyhole, LogOut, Menu, MessageCircle,
  MoreHorizontal, Network, Pencil, Play, Plus, Radar, RefreshCcw, Search,
  Send, Settings, ShieldCheck, Sparkles, Star, Target, ThumbsUp, TrendingUp, Trophy, Upload,
  UserRound, UsersRound, X, Zap
} from 'lucide-react';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Link, Route, Switch, Router as WouterRouter, useLocation, useParams } from 'wouter';
import NotFound from '@/pages/not-found';
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.mjs?url';

if (typeof window !== 'undefined' && pdfjsLib.GlobalWorkerOptions) {
  pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;
}

const queryClient = new QueryClient();

// VITE_CLERK_PUBLISHABLE_KEY must be set in .env — no hardcoded fallback.
const rawClerkKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
if (!rawClerkKey) {
  throw new Error(
    "VITE_CLERK_PUBLISHABLE_KEY is not set. Add it to your .env file and restart the dev server."
  );
}
const clerkPubKey = (typeof window !== 'undefined' ? publishableKeyFromHost(window.location.hostname, rawClerkKey) : null) || rawClerkKey;
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;
const basePath = (import.meta.env.BASE_URL || '/').replace(/\/$/, '');


function stripBase(path: string) {
  return basePath && path.startsWith(basePath) ? path.slice(basePath.length) || '/' : path;
}

const clerkAppearance = {
  theme: shadcn,
  cssLayerName: 'clerk',
  options: {
    logoPlacement: 'inside' as const,
    logoLinkUrl: basePath || '/',
    logoImageUrl: `${window.location.origin}${basePath}/logo.svg`,
    socialButtonsPlacement: 'top' as const,
    socialButtonsVariant: 'blockButton' as const,
  },
  variables: {
    colorPrimary: '#8B5CF6',
    colorForeground: '#F7F5F2',
    colorMutedForeground: '#A7AEC0',
    colorDanger: '#FB7185',
    colorBackground: '#10131C',
    colorInput: '#161A26',
    colorInputForeground: '#F7F5F2',
    colorNeutral: '#292E40',
    fontFamily: 'Manrope, ui-sans-serif, sans-serif',
    borderRadius: '0.75rem',
  },
  elements: {
    rootBox: 'w-full flex justify-center',
    cardBox: 'bg-[#10131C] rounded-2xl w-[440px] max-w-full overflow-hidden border border-[#292E40] shadow-2xl',
    card: '!shadow-none !border-0 !bg-transparent !rounded-none',
    footer: '!shadow-none !border-0 !bg-transparent !rounded-none',
    headerTitle: 'text-[#F7F5F2] font-semibold',
    headerSubtitle: 'text-[#A7AEC0]',
    socialButtonsBlockButtonText: 'text-[#F7F5F2]',
    formFieldLabel: 'text-[#F7F5F2]',
    footerActionLink: 'text-[#C4B5FD] hover:text-[#22D3EE]',
    footerActionText: 'text-[#A7AEC0]',
    dividerText: 'text-[#A7AEC0]',
    identityPreviewEditButton: 'text-[#C4B5FD]',
    formFieldSuccessText: 'text-[#86EFAC]',
    alertText: 'text-[#F7F5F2]',
    logoBox: 'h-10',
    logoImage: 'h-8 w-8',
    socialButtonsBlockButton: 'border-[#292E40] bg-[#161A26] hover:bg-[#1C2030]',
    formButtonPrimary: 'bg-gradient-to-r from-[#8B5CF6] via-[#3B82F6] to-[#22D3EE] hover:brightness-110',
    formFieldInput: 'border-[#292E40] bg-[#161A26] text-[#F7F5F2]',
    footerAction: 'border-t border-[#292E40]',
    dividerLine: 'bg-[#292E40]',
    alert: 'border-[#FB7185]/30 bg-[#FB7185]/10',
    otpCodeFieldInput: 'border-[#292E40] bg-[#161A26] text-[#F7F5F2]',
    formFieldRow: 'gap-2',
    main: 'gap-5',
  },
};

type Candidate = { id: number; name: string; title: string; location: string; fit: number; skills: string[]; lastRole: string; break: string; verified: number; initials: string; color: string };
type Job = { id: number; title: string; company: string; location: string; mode: string; fit: number; posted: string; salary: string; skills: string[]; blurb: string };
export type CandidateProfileData = {
  id?: string;
  name: string;
  email?: string;
  phone?: string;
  location?: string;
  summary?: string;
  targetRole: string;
  targetCompany: string;
  workMode: string;
  careerBreakYears: number;
  breakContext: string;
  readinessRating: number;
  skillEvidence?: number;
  readinessTier?: string;
  fit: number;
  skills: string[];
  education?: Array<{ degree: string; institution: string; year: string; score?: string }>;
  projects?: Array<{ title: string; techStack: string[]; description: string; impact?: string }>;
  experience?: Array<{ role: string; company: string; duration: string; highlights: string[] }>;
  certifications?: Array<{ name: string; issuer: string; year?: string }>;
  achievements?: string[];
  topStrengths?: string[];
  latestMatch?: any;
};

export const createCleanProfile = (name = '', email = ''): CandidateProfileData => ({
  name,
  email,
  phone: '',
  location: '',
  summary: '',
  targetRole: '',
  targetCompany: '',
  workMode: 'Hybrid',
  careerBreakYears: 0,
  breakContext: '',
  readinessRating: 0,
  skillEvidence: 0,
  readinessTier: 'Not Started',
  fit: 80,
  skills: [],
  education: [],
  projects: [],
  experience: [],
  certifications: [],
  achievements: [],
  topStrengths: []
});

/**
 * Calculates genuine profile completeness and skill evidence depth based on real candidate data
 */
export function calculateRealReadiness(profile: Partial<CandidateProfileData>) {
  const skillsList = Array.isArray(profile?.skills) ? profile.skills : [];
  const skillsCount = skillsList.length;
  const projectsCount = Array.isArray(profile?.projects) ? profile.projects.length : 0;
  const educationCount = Array.isArray(profile?.education) ? profile.education.length : 0;
  const certsCount = (Array.isArray(profile?.certifications) ? profile.certifications.length : 0) +
                     (Array.isArray(profile?.achievements) ? profile.achievements.length : 0);

  // 1. Profile Signal (Real Completeness Score: 0 to 100%)
  let signal = 0;
  if (profile?.name && profile.name.trim().length > 0 && profile.name !== 'Candidate') signal += 15;
  if (profile?.email && profile.email.includes('@')) signal += 15;
  if (profile?.phone && profile.phone.trim().length > 4) signal += 10;
  if (profile?.location && profile.location.trim().length > 0) signal += 10;
  if (profile?.targetRole && profile.targetRole.trim().length > 0) signal += 15;
  if (profile?.targetCompany && profile.targetCompany.trim().length > 0) signal += 10;
  if (profile?.summary && profile.summary.trim().length > 15) signal += 10;
  if (skillsCount >= 3) signal += 15;
  const profileSignal = Math.min(100, Math.max(0, signal));

  // 2. Skill Evidence Strength (Real Evidence Depth: 0 to 100%)
  let evidence = 0;
  if (skillsCount > 0) {
    evidence += 40; // Base verified technical foundation
    evidence += Math.min(25, skillsCount * 3); // Skills breadth
    evidence += Math.min(25, projectsCount * 12); // Real project demonstrations
    evidence += Math.min(10, educationCount * 5); // Academic degree
    evidence += Math.min(8, certsCount * 4); // Certifications & achievements
  }
  const skillEvidence = Math.min(98, Math.max(skillsCount > 0 ? 55 : 0, evidence));

  // 3. Dynamic Readiness Tier
  let readinessTier = 'Not Started';
  if (skillsCount >= 5 && projectsCount >= 2 && educationCount >= 1) {
    readinessTier = 'Industry Ready';
  } else if (skillsCount >= 3 && (projectsCount >= 1 || certsCount >= 1)) {
    readinessTier = 'High Potential';
  } else if (skillsCount > 0) {
    readinessTier = 'Emerging Talent';
  } else if (profile?.name) {
    readinessTier = 'Building Foundation';
  }

  return {
    profileSignal,
    skillEvidence,
    readinessTier
  };
}

export const defaultProfile: CandidateProfileData = createCleanProfile();

async function safeDecompress(bytes: Uint8Array, format: 'deflate' | 'deflate-raw' = 'deflate-raw'): Promise<string> {
  if (typeof DecompressionStream === 'undefined' || bytes.length < 4) return '';
  try {
    const ds = new DecompressionStream(format);
    const blob = new Blob([bytes as any]);
    const stream = blob.stream().pipeThrough(ds);
    const reader = stream.getReader();
    const chunks: Uint8Array[] = [];
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) chunks.push(value);
      }
      const totalLen = chunks.reduce((acc, c) => acc + c.length, 0);
      const merged = new Uint8Array(totalLen);
      let offset = 0;
      for (const c of chunks) {
        merged.set(c, offset);
        offset += c.length;
      }
      return new TextDecoder('utf-8', { fatal: false }).decode(merged);
    } catch {
      return '';
    }
  } catch {
    return '';
  }
}

/**
 * Extracts plain text from DOCX (ZIP archive containing word/document.xml)
 */
async function extractDocxText(uint8: Uint8Array): Promise<string> {
  try {
    let i = 0;
    while (i < uint8.length - 30) {
      // Look for ZIP Local File Header signature: PK\x03\x04
      if (uint8[i] === 0x50 && uint8[i + 1] === 0x4b && uint8[i + 2] === 0x03 && uint8[i + 3] === 0x04) {
        const compMethod = uint8[i + 8] | (uint8[i + 9] << 8);
        const compSize = uint8[i + 18] | (uint8[i + 19] << 8) | (uint8[i + 20] << 16) | (uint8[i + 21] << 24);
        const fnLen = uint8[i + 26] | (uint8[i + 27] << 8);
        const extraLen = uint8[i + 28] | (uint8[i + 29] << 8);
        const fnBytes = uint8.subarray(i + 30, i + 30 + fnLen);
        const filename = new TextDecoder('utf-8').decode(fnBytes);
        const dataStart = i + 30 + fnLen + extraLen;

        if (filename === 'word/document.xml' || filename.endsWith('/document.xml')) {
          const slice = uint8.subarray(dataStart, compSize > 0 ? dataStart + compSize : uint8.length);
          let xml = '';
          if (compMethod === 8) {
            xml = await safeDecompress(slice, 'deflate-raw');
          } else if (compMethod === 0) {
            xml = new TextDecoder('utf-8', { fatal: false }).decode(slice);
          }
          if (xml) {
            return xml
              .replace(/<w:p[ >]/g, '\n')
              .replace(/<w:tab\/>/g, ' ')
              .replace(/<w:br\/>/g, '\n')
              .replace(/<[^>]+>/g, '')
              .replace(/&amp;/g, '&')
              .replace(/&lt;/g, '<')
              .replace(/&gt;/g, '>')
              .replace(/&quot;/g, '"')
              .replace(/&apos;/g, "'")
              .replace(/\n\s*\n/g, '\n')
              .trim();
          }
        }
        i = dataStart + (compSize > 0 ? compSize : 1);
      } else {
        i++;
      }
    }
  } catch (err) {
    console.warn('DOCX extraction warning:', err);
  }
  return '';
}

/**
 * Extracts plain text from PDF bytes directly on the client using Mozilla's pdfjs-dist
 */
async function extractPdfText(uint8: Uint8Array): Promise<string> {
  // 1. Primary: Use pdfjs-dist directly in browser
  try {
    const loadingTask = pdfjsLib.getDocument({
      data: uint8,
      useSystemFonts: true,
      disableFontFace: true,
    });
    const doc = await loadingTask.promise;
    let fullText = '';
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      const pageStrings = content.items
        .map((item: any) => (item.str ? item.str : ''))
        .filter(Boolean);
      fullText += pageStrings.join(' ') + '\n';
    }
    const clean = fullText
      .replace(/[^\x20-\x7E\n\r\t\u00C0-\u024F]/g, ' ')
      .replace(/[ \t]{3,}/g, '  ')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
    if (clean.length > 20) {
      return clean;
    }
  } catch (err) {
    console.warn('pdfjs-dist client extraction failed, falling back:', err);
  }

  // 2. Fallback: manual decompression
  const textPieces: string[] = [];
  try {
    const rawLatin = new TextDecoder('latin1').decode(uint8);

    // 1. Scan and decompress stream blocks
    const streamRegex = /stream[\r\n]+([\s\S]*?)[\r\n]+endstream/g;
    let streamMatch: RegExpExecArray | null;

    while ((streamMatch = streamRegex.exec(rawLatin)) !== null) {
      const streamStr = streamMatch[1];
      if (!streamStr || streamStr.length < 8) continue;

      const streamBytes = new Uint8Array(streamStr.length);
      for (let s = 0; s < streamStr.length; s++) {
        streamBytes[s] = streamStr.charCodeAt(s) & 0xff;
      }

      let decompressed = await safeDecompress(streamBytes, 'deflate');
      if (!decompressed) {
        decompressed = await safeDecompress(streamBytes, 'deflate-raw');
      }
      if (!decompressed && streamBytes[0] === 0x78) {
        decompressed = await safeDecompress(streamBytes.subarray(2), 'deflate-raw');
      }
      const streamText = decompressed || streamStr;

      // Extract (text) Tj
      const tjMatches = streamText.match(/\(((?:[^()\\]|\\.)*)\)\s*Tj/g) || [];
      for (const m of tjMatches) {
        const inner = m.match(/^\(((?:[^()\\]|\\.)*)\)\s*Tj$/);
        if (inner && inner[1]) {
          const clean = inner[1]
            .replace(/\\([()\\])/g, '$1')
            .replace(/\\n/g, ' ')
            .replace(/\\r/g, ' ')
            .replace(/\\t/g, ' ')
            .replace(/\\[0-7]{1,3}/g, ' ')
            .trim();
          if (clean.length > 0) textPieces.push(clean);
        }
      }

      // Extract [(text)] TJ
      const tjArrMatches = streamText.match(/\[([\s\S]*?)\]\s*TJ/g) || [];
      for (const m of tjArrMatches) {
        const inners = m.match(/\(((?:[^()\\]|\\.)*)\)/g) || [];
        const combined = inners.map(s => s.slice(1, -1).replace(/\\([()\\])/g, '$1').replace(/\\n/g, ' ')).join('');
        if (combined.trim().length > 0) textPieces.push(combined.trim());
      }
    }

    // 2. Uncompressed parenthesis text chunks
    const parenMatches = rawLatin.match(/\(([^\r\n()]{3,200})\)/g) || [];
    for (const p of parenMatches) {
      const cleaned = p.slice(1, -1)
        .replace(/\\([()\\])/g, '$1')
        .replace(/\\n/g, ' ')
        .replace(/\\r/g, ' ')
        .trim();
      if (cleaned.length > 2 && /[a-zA-Z0-9]/.test(cleaned) && !cleaned.startsWith('/') && !cleaned.startsWith('Font')) {
        textPieces.push(cleaned);
      }
    }

    // 3. Extract readable alphanumeric words fallback
    if (textPieces.length < 5) {
      const words = rawLatin.match(/[a-zA-Z0-9@:/.#+_-]{3,}/g) || [];
      const cleanWords = words.filter(w => !/^(obj|endobj|stream|endstream|xref|trailer|startxref|Filter|FlateDecode|Length)$/i.test(w));
      if (cleanWords.length > 10) {
        textPieces.push(...cleanWords);
      }
    }
  } catch (err) {
    console.warn('PDF parser fallback:', err);
  }

  if (textPieces.length > 0) {
    const unique = Array.from(new Set(textPieces));
    return unique.join(' ').replace(/\s+/g, ' ').trim();
  }
  return '';
}

export async function extractTextFromFile(file: File): Promise<string> {
  const extension = file.name.split('.').pop()?.toLowerCase() || '';

  // 1. Direct Plain Text / Markdown / RTF / JSON / CSV
  if (extension === 'txt' || extension === 'md' || extension === 'rtf' || extension === 'json' || extension === 'csv') {
    return await file.text();
  }

  try {
    const arrayBuffer = await file.arrayBuffer();
    const uint8 = new Uint8Array(arrayBuffer);

    // 2. DOCX Word Document Extraction via ZIP Unpacking
    if (extension === 'docx' || file.type.includes('wordprocessingml')) {
      const docxText = await extractDocxText(uint8);
      if (docxText && docxText.length > 15) {
        return docxText;
      }
    }

    // 3. PDF Document Extraction
    if (extension === 'pdf' || file.type === 'application/pdf') {
      const pdfText = await extractPdfText(uint8);
      if (pdfText && pdfText.length > 15) {
        return pdfText;
      }
    }

    // 4. Fallback: UTF-8 readable words extraction
    const utf8 = new TextDecoder('utf-8', { fatal: false }).decode(uint8);
    const words = utf8.match(/[a-zA-Z0-9.,@:/\-+_#&]{2,}/g) || [];
    if (words.length > 10) {
      return words.join(' ');
    }
  } catch (err) {
    console.warn('File extraction fallback:', err);
  }

  return `Resume document: ${file.name}`;
}

type ProductState = {
  fit: number; completedLearning: boolean; savedJobs: number[]; applications: number[];
  shortlist: number[]; analysis: 'idle' | 'analyzing' | 'ready'; plan: string; toast: string;
  profile: CandidateProfileData;
  latestMatch?: any;
  setLatestMatch: (match: any) => void;
  isOnboarded: boolean;
  setIsOnboarded: (val: boolean) => void;
  updateProfile: (data: Partial<CandidateProfileData>) => Promise<void>;
  setFit: (fit: number) => void; setCompletedLearning: (value: boolean) => void;
  toggleSaved: (id: number) => void; apply: (id: number) => void; toggleShortlist: (id: number) => void;
  setAnalysis: (value: 'idle' | 'analyzing' | 'ready') => void; setPlan: (value: string) => void; notify: (value: string) => void;
};
const ProductContext = createContext<ProductState | null>(null);
function useProduct() {
  const value = useContext(ProductContext);
  if (!value) throw new Error('SensAI context missing');
  return value;
}

const candidates: Candidate[] = [
  { id: 1, name: 'Maya Chen', title: 'Senior Product Operations Lead', location: 'Austin, TX', fit: 84, skills: ['Program strategy', 'SQL', 'Change management'], lastRole: 'Product Ops, Northstar', break: '2022–2024 · Family care', verified: 91, initials: 'MC', color: '#d98459' },
  { id: 2, name: 'Jon Bell', title: 'Data & Insights Manager', location: 'Chicago, IL', fit: 88, skills: ['Power BI', 'Forecasting', 'Python'], lastRole: 'Insights, Matterhorn', break: '2021–2023 · Relocation', verified: 96, initials: 'JB', color: '#5d8c89' },
  { id: 3, name: 'Priya Raman', title: 'Customer Experience Strategist', location: 'New York, NY', fit: 82, skills: ['Journey mapping', 'Research', 'Service design'], lastRole: 'CX, Arclight', break: '2020–2022 · Caregiving', verified: 88, initials: 'PR', color: '#9b7a9d' },
  { id: 4, name: 'Lena Ortiz', title: 'Senior Program Manager', location: 'Denver, CO', fit: 79, skills: ['Roadmaps', 'Risk', 'Agile delivery'], lastRole: 'Programs, Fieldline', break: '2023–2024 · Health reset', verified: 84, initials: 'LO', color: '#6c8db5' },
  { id: 5, name: 'Amir Okafor', title: 'RevOps Analyst', location: 'Atlanta, GA', fit: 86, skills: ['Salesforce', 'SQL', 'Process design'], lastRole: 'RevOps, Vela', break: '2022–2023 · Study', verified: 93, initials: 'AO', color: '#b17d5c' },
  { id: 6, name: 'Sofia Petrov', title: 'Product Marketing Manager', location: 'Boston, MA', fit: 81, skills: ['Positioning', 'Research', 'Launch'], lastRole: 'Marketing, Orbit', break: '2021–2024 · Family care', verified: 90, initials: 'SP', color: '#688c7c' },
  { id: 7, name: 'Theo Martin', title: 'Implementation Consultant', location: 'Seattle, WA', fit: 77, skills: ['ERP', 'Enablement', 'Client success'], lastRole: 'Delivery, Truss', break: '2020–2022 · Venture', verified: 83, initials: 'TM', color: '#8c7898' },
  { id: 8, name: 'Nia Williams', title: 'Operations Excellence Lead', location: 'Raleigh, NC', fit: 85, skills: ['Lean', 'Analytics', 'Facilitation'], lastRole: 'Ops, Common Thread', break: '2022–2023 · Relocation', verified: 92, initials: 'NW', color: '#c4865d' },
  { id: 9, name: 'Eli Navarro', title: 'Product Designer', location: 'Portland, OR', fit: 74, skills: ['Figma', 'Systems thinking', 'Research'], lastRole: 'Design, Atlas Works', break: '2023–2024 · Caregiving', verified: 79, initials: 'EN', color: '#6389a0' },
  { id: 10, name: 'Grace Kim', title: 'People Analytics Partner', location: 'San Diego, CA', fit: 89, skills: ['People data', 'Storytelling', 'Statistics'], lastRole: 'People, Juniper', break: '2021–2023 · Study', verified: 97, initials: 'GK', color: '#9d8268' },
  { id: 11, name: 'Ravi Shah', title: 'Technical Account Manager', location: 'Jersey City, NJ', fit: 80, skills: ['Cloud', 'Escalations', 'Advisory'], lastRole: 'TAM, Clearpath', break: '2022–2024 · Family care', verified: 87, initials: 'RS', color: '#6b958d' },
  { id: 12, name: 'Clara Evans', title: 'Business Systems Analyst', location: 'Minneapolis, MN', fit: 83, skills: ['Workday', 'Process mapping', 'UAT'], lastRole: 'Systems, Alder', break: '2020–2021 · Relocation', verified: 89, initials: 'CE', color: '#bc7f79' },
  { id: 13, name: 'Marco Silva', title: 'Growth Strategy Manager', location: 'Miami, FL', fit: 76, skills: ['Go-to-market', 'Pricing', 'Research'], lastRole: 'Growth, Tidepool', break: '2022–2023 · Study', verified: 82, initials: 'MS', color: '#7d8fae' },
  { id: 14, name: 'June Park', title: 'Learning Experience Lead', location: 'San Francisco, CA', fit: 87, skills: ['Curriculum', 'Facilitation', 'LMS'], lastRole: 'L&D, Parable', break: '2021–2022 · Caregiving', verified: 94, initials: 'JP', color: '#ae8b61' },
  { id: 15, name: 'Samira Adeyemi', title: 'Finance Transformation Lead', location: 'Charlotte, NC', fit: 90, skills: ['ERP Systems', 'Controls', 'Transformation'], lastRole: 'Finance, Meridian', break: '2022–2024 · Relocation', verified: 98, initials: 'SA', color: '#658c87' },
];
const jobs: Job[] = [
  { id: 1, title: 'Product Operations Lead', company: 'enterprise companies', location: 'Palo Alto, CA', mode: 'Hybrid', fit: 84, posted: '2 days ago', salary: '$128k–$154k', skills: ['Program strategy', 'Stakeholder alignment', 'SQL'], blurb: 'Build the operating rhythm behind products that make work more human.' },
  { id: 2, title: 'Workforce Insights Manager', company: 'Northstar Health', location: 'Remote · US', mode: 'Remote', fit: 78, posted: '4 days ago', salary: '$118k–$142k', skills: ['People analytics', 'Power BI', 'Storytelling'], blurb: 'Turn workforce signals into decisions leaders can act on.' },
  { id: 3, title: 'Senior Program Manager, Trust', company: 'Harborline', location: 'New York, NY', mode: 'Hybrid', fit: 73, posted: '1 week ago', salary: '$135k–$165k', skills: ['Risk', 'Roadmaps', 'Change management'], blurb: 'Shape the systems that help customers trust what comes next.' },
  { id: 4, title: 'Business Systems Partner', company: 'Mosaic Commerce', location: 'Austin, TX', mode: 'Flexible', fit: 80, posted: '1 week ago', salary: '$110k–$134k', skills: ['Workday', 'Process mapping', 'UAT'], blurb: 'Make the invisible infrastructure of a growing team work beautifully.' },
  { id: 5, title: 'Customer Strategy Director', company: 'Cedar & Co.', location: 'Chicago, IL', mode: 'Hybrid', fit: 76, posted: '2 weeks ago', salary: '$142k–$176k', skills: ['Research', 'Service design', 'Leadership'], blurb: 'Give every customer moment a clear point of view.' },
  { id: 6, title: 'RevOps Strategy Manager', company: 'Vela Systems', location: 'Remote · US', mode: 'Remote', fit: 86, posted: '2 weeks ago', salary: '$121k–$149k', skills: ['Salesforce', 'SQL', 'Forecasting'], blurb: 'Design the connective tissue between revenue teams and growth.' },
  { id: 7, title: 'Learning Programs Lead', company: 'Juniper Group', location: 'Boston, MA', mode: 'Hybrid', fit: 79, posted: '3 weeks ago', salary: '$105k–$128k', skills: ['Curriculum', 'Facilitation', 'LMS'], blurb: 'Help people build careers that have room for the whole person.' },
  { id: 8, title: 'Finance Transformation Principal', company: 'Meridian Works', location: 'Charlotte, NC', mode: 'On-site', fit: 82, posted: '3 weeks ago', salary: '$156k–$188k', skills: ['ERP Systems', 'Controls', 'Transformation'], blurb: 'Lead thoughtful change across finance, data, and enterprise systems.' },
];
const mockApplications: Job[] = jobs.concat([
  { ...jobs[0], id: 9, title: 'Operations Strategy Partner', company: 'Brightwell', posted: '1 month ago' },
  { ...jobs[1], id: 10, title: 'Senior People Insights Lead', company: 'Kite & Finch', posted: '1 month ago' },
]);
const skillCatalog = ['Program strategy', 'SQL', 'Change management', 'Power BI', 'Forecasting', 'Python', 'Journey mapping', 'Research', 'Service design', 'Roadmaps', 'Risk', 'Agile delivery', 'Salesforce', 'Process design', 'Positioning', 'Launch', 'ERP', 'Enablement', 'Client success', 'Lean', 'Analytics', 'Facilitation', 'Figma', 'Systems thinking', 'People data', 'Storytelling', 'Statistics', 'Cloud', 'Workday', 'Process mapping', 'UAT', 'Go-to-market', 'Pricing', 'Curriculum', 'LMS', 'ERP Systems', 'Controls', 'Transformation', 'Stakeholder alignment'];
const modules = [
  { id: 1, title: 'SQL for decision makers', provider: 'Learning Hub', duration: '4h 20m', kind: 'Course', color: '#d98459' },
  { id: 2, title: 'Influence without authority', provider: 'SensAI Studio', duration: '2h 10m', kind: 'Workshop', color: '#5d8c89' },
  { id: 3, title: 'Modern operating rhythms', provider: 'Learning Hub', duration: '3h 40m', kind: 'Course', color: '#9b7a9d' },
  { id: 4, title: 'Tell your return story', provider: 'SensAI Studio', duration: '55m', kind: 'Practice', color: '#c4865d' },
  { id: 5, title: 'Power BI essentials', provider: 'Learning Hub', duration: '5h 15m', kind: 'Course', color: '#688c7c' },
  { id: 6, title: 'Stakeholder mapping lab', provider: 'SensAI Studio', duration: '1h 30m', kind: 'Lab', color: '#6c8db5' },
  { id: 7, title: 'Responsible AI at work', provider: 'Learning Hub', duration: '2h', kind: 'Course', color: '#ae8b61' },
  { id: 8, title: 'Resume evidence clinic', provider: 'SensAI Studio', duration: '45m', kind: 'Practice', color: '#bc7f79' },
  { id: 9, title: 'Forecasting in practice', provider: 'Learning Hub', duration: '3h 10m', kind: 'Course', color: '#7d8fae' },
  { id: 10, title: 'Interview rehearsal', provider: 'SensAI Studio', duration: '1h', kind: 'Practice', color: '#658c87' },
];

function usePageMeta(title: string, description: string) {
  useEffect(() => {
    document.title = `${title} · SensAI Career Coach`;
    const meta = document.querySelector('meta[name="description"]') || document.createElement('meta');
    meta.setAttribute('name', 'description'); meta.setAttribute('content', description); document.head.appendChild(meta);
  }, [title, description]);
}
type AuthRole = 'candidate' | 'recruiter';
function getStoredRole(): AuthRole {
  return localStorage.getItem('rp-role') === 'recruiter' ? 'recruiter' : 'candidate';
}
function getPendingRole(): AuthRole {
  return localStorage.getItem('rp-pending-role') === 'recruiter' ? 'recruiter' : getStoredRole();
}
function setPendingRole(role: AuthRole) {
  localStorage.setItem('rp-pending-role', role);
}
function AuthRolePage({ role }: { role: AuthRole }) {
  const [, setLocation] = useLocation();
  const candidate = role === 'candidate';
  usePageMeta(candidate ? 'Candidate access' : 'Recruiter access', 'Sign in or create your SensAI Career Coach account.');
  const continueToAuth = (mode: 'sign-in' | 'sign-up') => {
    setPendingRole(role);
    setLocation(`/${mode}`);
  };
  return <div className="noise min-h-[100dvh]"><PublicNav /><main className="mx-auto grid max-w-6xl items-center gap-12 px-5 py-16 lg:grid-cols-[.85fr_1.15fr] lg:px-8 lg:py-24">
    <section><p className={`eyebrow ${candidate ? 'text-[hsl(var(--cyan))]' : 'text-[hsl(var(--accent))]'}`}>{candidate ? 'Candidate workspace' : 'Recruiter workspace'}</p><h1 className="mt-4 max-w-xl font-display text-5xl leading-[1.02]">{candidate ? 'Make your capability easier to see.' : 'Make better hiring decisions with more context.'}</h1><p className="mt-6 max-w-lg text-base leading-7 text-[hsl(var(--muted-foreground))]">{candidate ? 'Build a skills passport, find roles that fit, and turn your next step into a clear plan.' : 'Review evidence, understand recommendations, and keep human judgment at the center of every shortlist.'}</p><div className="mt-8 flex flex-wrap gap-2">{(candidate ? ['Skills passport', 'Explainable matches', 'Skill bridge'] : ['Evidence-first review', 'Fairness monitor', 'Human decision trace']).map(item => <Badge key={item} tone={candidate ? 'default' : 'warm'}>{item}</Badge>)}</div></section>
    <section className="surface rounded-[28px] p-6 sm:p-9"><div className="flex items-center gap-3"><div className={`grid h-11 w-11 place-items-center rounded-xl ${candidate ? 'bg-[hsl(var(--cyan))]/15 text-[hsl(var(--cyan))]' : 'bg-[hsl(var(--accent))]/15 text-[hsl(var(--accent))]'}`}>{candidate ? <UserRound size={21} /> : <Building2 size={21} />}</div><div><p className="text-sm font-semibold">{candidate ? 'For candidates' : 'For hiring teams'}</p><p className="text-xs text-[hsl(var(--muted-foreground))]">Secure access to your workspace</p></div></div><div className="mt-8 grid gap-3"><Button onClick={() => continueToAuth('sign-in')} data-testid={`button-${role}-sign-in`} className="w-full">Sign in as {candidate ? 'candidate' : 'recruiter'} <ArrowRight size={15} /></Button><Button onClick={() => continueToAuth('sign-up')} data-testid={`button-${role}-sign-up`} variant="outline" className="w-full">Create a {candidate ? 'candidate' : 'recruiter'} account</Button></div><div className="mt-7 flex items-start gap-2 border-t border-[hsl(var(--border))] pt-5 text-xs leading-5 text-[hsl(var(--muted-foreground))]"><ShieldCheck size={15} className="mt-0.5 shrink-0 text-[hsl(var(--accent))]" /><span>Your account is managed securely. SensAI only uses your role to open the right workspace.</span></div></section>
  </main><PublicFooter /></div>;
}
function AuthPage({ mode }: { mode: 'sign-in' | 'sign-up' }) {
  const role = getPendingRole();
  const p = useProduct();
  // Returning candidates signing in go directly to /candidate workspace.
  // Only new sign-ups who have not onboarded yet go to /candidate/onboarding.
  const redirectTarget = role === 'candidate'
    ? (mode === 'sign-in' || p.isOnboarded ? `${basePath}/candidate` : `${basePath}/candidate/onboarding`)
    : `${basePath}/${role}`;
  usePageMeta(mode === 'sign-in' ? 'Sign in' : 'Create your account', `${mode === 'sign-in' ? 'Sign in' : 'Create'} your ${role} SensAI Career Coach account.`);
  return <div className="noise flex min-h-[100dvh] flex-col bg-[hsl(var(--background))]"><PublicNav /><main className="flex flex-1 items-center justify-center px-4 py-12"><div className="w-full max-w-[440px]"><div className="mb-5 text-center"><p className={`eyebrow ${role === 'candidate' ? 'text-[hsl(var(--cyan))]' : 'text-[hsl(var(--accent))]'}`}>{role === 'candidate' ? 'Candidate access' : 'Recruiter access'}</p><p className="mt-2 text-sm text-[hsl(var(--muted-foreground))]">Continue to your {role} workspace.</p></div>{mode === 'sign-in' ? <SignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} forceRedirectUrl={redirectTarget} fallbackRedirectUrl={redirectTarget} /> : <SignUp routing="path" path={`${basePath}/sign-up`} signInUrl={`${basePath}/sign-in`} forceRedirectUrl={redirectTarget} fallbackRedirectUrl={redirectTarget} />}</div></main></div>;
}
function AuthSessionSync() {
  const { isLoaded, isSignedIn } = useAuth();
  const { user } = useUser();
  const p = useProduct();

  useEffect(() => {
    if (!isLoaded) return;

    if (!isSignedIn) {
      // User signed out: clear active user context
      const activeUserId = localStorage.getItem('rp-active-user-id');
      if (activeUserId) {
        localStorage.removeItem('rp-active-user-id');
        localStorage.removeItem('rp-profile');
        localStorage.removeItem('rp-onboarded');
        localStorage.removeItem('rp-fit');
        localStorage.removeItem('rp-latest-match');
        localStorage.removeItem('rp-saved');
        localStorage.removeItem('rp-applications');
        localStorage.removeItem('rp-shortlist');
        localStorage.removeItem('rp-learning');
      }
      return;
    }

    const role = getPendingRole();
    localStorage.setItem('rp-role', role);
    localStorage.removeItem('rp-pending-role');

    if (user?.id) {
      // Multi-candidate isolation: If a different candidate signs into this browser, wipe previous candidate's cache
      const activeUserId = localStorage.getItem('rp-active-user-id');
      if (activeUserId && activeUserId !== user.id) {
        localStorage.removeItem('rp-profile');
        localStorage.removeItem('rp-onboarded');
        localStorage.removeItem('rp-fit');
        localStorage.removeItem('rp-latest-match');
        localStorage.removeItem('rp-saved');
        localStorage.removeItem('rp-applications');
        localStorage.removeItem('rp-shortlist');
        localStorage.removeItem('rp-learning');

        p.setFit(0);
        p.setLatestMatch(null);
        p.setIsOnboarded(false);
      }
      localStorage.setItem('rp-active-user-id', user.id);

      // Fetch user's own profile strictly tied to their authenticated session
      fetch('/api/candidate/profile')
        .then(r => r.json())
        .then(data => {
          if (data?.profile && data.profile.name && (data.profile.skills?.length > 0 || data.profile.targetRole)) {
            p.setIsOnboarded(true);
            p.updateProfile(data.profile);
            if (typeof data.profile.fit === 'number' && data.profile.fit > 0) {
              p.setFit(data.profile.fit);
            }
            if (data.profile.latestMatch) {
              p.setLatestMatch(data.profile.latestMatch);
            }
          } else {
            // Fresh candidate profile with zero cross-user pollution
            p.setIsOnboarded(false);
            p.setFit(0);
            p.setLatestMatch(null);
            if (user.fullName || user.firstName) {
              p.updateProfile({
                name: user.fullName || user.firstName || '',
                email: user.primaryEmailAddress?.emailAddress || '',
                targetRole: '',
                skills: [],
                projects: [],
                fit: 0
              });
            }
          }
        })
        .catch(() => {
          if (localStorage.getItem('rp-onboarded') === 'true') {
            p.setIsOnboarded(true);
          }
        });
    }
  }, [isLoaded, isSignedIn, user?.id]);

  return null;
}
function AuthControls() {
  return null;
}
function HomeRoute() {
  const { isLoaded, isSignedIn } = useAuth();
  const [, setLocation] = useLocation();
  useEffect(() => {
    if (isLoaded && isSignedIn) setLocation(`/${getStoredRole()}`);
  }, [isLoaded, isSignedIn, setLocation]);
  return <Landing />;
}
function AccessRestricted({ expectedRole }: { expectedRole: AuthRole }) {
  const [, setLocation] = useLocation();
  const { signOut } = useClerk();
  return <div className="noise flex min-h-[100dvh] items-center justify-center px-5"><section className="surface max-w-md rounded-2xl p-8 text-center"><div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-[hsl(var(--warning))]/15 text-[hsl(var(--warning))]"><LockKeyhole size={21} /></div><h1 className="mt-5 font-display text-3xl">Workspace access is restricted.</h1><p className="mt-3 text-sm leading-6 text-[hsl(var(--muted-foreground))]">This account is set up for the {getStoredRole()} workspace. Switch accounts to view the {expectedRole} experience.</p><Button onClick={() => signOut({ redirectUrl: `${basePath}/auth/${expectedRole}` })} className="mt-6">Sign out and switch workspace</Button></section></div>;
}
function Logo({ light = false }: { light?: boolean }) {
  return <Link href="/" data-testid="link-logo" className={`inline-flex items-center gap-2.5 font-semibold tracking-tight ${light ? 'text-[hsl(var(--sidebar-foreground))]' : ''}`}><span className="grid h-8 w-8 place-items-center rounded-[10px] bg-[hsl(var(--accent))] text-[hsl(var(--foreground))]"><Compass size={18} strokeWidth={2.5} /></span><span>SensAI <span className="font-display italic">Career Coach</span></span></Link>;
}
function Button({ children, variant = 'primary', size = 'md', className = '', ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'outline' | 'ghost' | 'soft'; size?: 'sm' | 'md' | 'lg' }) {
  const sizeStyles = { sm: 'min-h-8 px-3 text-xs', md: 'min-h-10 px-4 text-sm', lg: 'min-h-12 px-6 text-base' };
  const styles = { primary: 'gradient-button text-[hsl(var(--primary-foreground))] hover:brightness-110', outline: 'glass-button hover:border-[hsl(var(--primary))]/60 hover:bg-[hsl(var(--muted))]', ghost: 'hover:bg-[hsl(var(--muted))]', soft: 'bg-[hsl(var(--secondary))] text-[hsl(var(--secondary-foreground))] hover:brightness-110' };
  return <button {...props} className={`inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition duration-200 ${sizeStyles[size]} ${styles[variant]} ${className}`}>{children}</button>;
}
function Badge({ children, tone = 'default' }: { children: ReactNode; tone?: 'default' | 'good' | 'warm' | 'quiet' | 'dark' }) {
  const styles = { default: 'status-info', good: 'status-good', warm: 'status-warm', quiet: 'status-quiet', dark: 'status-dark' };
  return <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold ${styles[tone]}`}>{children}</span>;
}
function Score({ value = 84, size = 'md' }: { value?: number; size?: 'sm' | 'md' | 'lg' }) {
  const safeVal = Number.isFinite(value) ? Math.min(Math.max(value, 0), 100) : 84;
  const dims = size === 'lg' ? 'h-28 w-28 text-3xl' : size === 'sm' ? 'h-12 w-12 text-sm' : 'h-16 w-16 text-xl';
  return <div className={`relative grid place-items-center rounded-full font-data font-medium ${dims}`} style={{ background: `conic-gradient(hsl(var(--primary)) ${safeVal * 3.6}deg, hsl(var(--muted)) 0deg)` }}><div className="absolute inset-[5px] grid place-items-center rounded-full bg-[hsl(var(--card))]">{safeVal}%</div></div>;
}
function Progress({ value = 0, color = 'bg-[hsl(var(--primary))]' }: { value?: number; color?: string }) {
  const safeVal = Number.isFinite(value) ? Math.min(Math.max(value, 0), 100) : 0;
  return <div className="h-2 overflow-hidden rounded-full bg-[hsl(var(--muted))]"><div className={`h-full rounded-full transition-all duration-500 ${color}`} style={{ width: `${safeVal}%` }} /></div>;
}
function PublicNav() {
  const [open, setOpen] = useState(false);
  return (
    <header className="border-b border-[hsl(var(--border))] bg-[hsl(var(--background))]/90 backdrop-blur">
      <div className="mx-auto flex h-[72px] max-w-7xl items-center justify-between px-5 lg:px-8">
        <Logo />
        <nav className="hidden items-center gap-7 text-sm text-[hsl(var(--muted-foreground))] md:flex">
          <Link href="/how-it-works" data-testid="link-how-it-works" className="hover:text-[hsl(var(--foreground))]">How it works</Link>
          <Link href="/about" data-testid="link-about" className="hover:text-[hsl(var(--foreground))]">Our point of view</Link>
          <Link href="/pricing" data-testid="link-pricing" className="hover:text-[hsl(var(--foreground))]">Pricing</Link>
        </nav>
        <div className="hidden items-center gap-3 md:flex">
          <Link href="/auth/candidate" data-testid="link-sign-in" className="inline-flex min-h-10 items-center rounded-lg bg-[hsl(var(--primary))] px-4 text-sm font-semibold text-[hsl(var(--primary-foreground))] hover:brightness-105 transition-all">
            Sign in
          </Link>
        </div>
        <button onClick={() => setOpen(!open)} data-testid="button-mobile-menu" className="rounded-lg p-2 md:hidden">
          <Menu size={22} />
        </button>
      </div>
      {open && (
        <div className="border-t border-[hsl(var(--border))] p-5 md:hidden">
          <div className="grid gap-3 text-sm">
            <Link href="/how-it-works" data-testid="mobile-link-how">How it works</Link>
            <Link href="/about" data-testid="mobile-link-about">Our point of view</Link>
            <Link href="/pricing" data-testid="mobile-link-pricing">Pricing</Link>
            <Link href="/auth/candidate" data-testid="mobile-link-sign-in" className="inline-flex min-h-10 items-center justify-center rounded-lg bg-[hsl(var(--primary))] px-4 text-sm font-semibold text-[hsl(var(--primary-foreground))]">
              Sign in
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
function PublicFooter() {
  return <footer className="border-t border-[hsl(var(--border))] bg-[hsl(var(--sidebar))] px-5 py-12 text-[hsl(var(--sidebar-foreground))] lg:px-8"><div className="mx-auto grid max-w-7xl gap-10 md:grid-cols-[1.5fr_1fr_1fr_1fr]"><div><Logo light /><p className="mt-5 max-w-xs text-sm leading-6 text-[hsl(var(--sidebar-foreground))]/65">A clearer next step for people returning to work — and the teams ready to see their capability.</p></div><div><p className="eyebrow text-[hsl(var(--sidebar-foreground))]/50">Explore</p><div className="mt-4 grid gap-3 text-sm text-[hsl(var(--sidebar-foreground))]/75"><Link href="/how-it-works" data-testid="footer-link-how">How it works</Link><Link href="/architecture" data-testid="footer-link-architecture">Architecture</Link><Link href="/pricing" data-testid="footer-link-pricing">Pricing</Link></div></div><div><p className="eyebrow text-[hsl(var(--sidebar-foreground))]/50">Workspaces</p><div className="mt-4 grid gap-3 text-sm text-[hsl(var(--sidebar-foreground))]/75"><Link href="/candidate" data-testid="footer-link-candidate">Candidate workspace</Link><Link href="/recruiter" data-testid="footer-link-recruiter">Recruiter workspace</Link><Link href="/recruiter/bias-audit" data-testid="footer-link-audit">Fairness monitor</Link></div></div><div><p className="eyebrow text-[hsl(var(--sidebar-foreground))]/50">Principle</p><p className="mt-4 text-sm leading-6 text-[hsl(var(--sidebar-foreground))]/75">AI recommends. Recruiter decides.</p></div></div><div className="mx-auto mt-12 max-w-7xl border-t border-[hsl(var(--sidebar-foreground))]/15 pt-5 text-xs text-[hsl(var(--sidebar-foreground))]/45">© 2025 SensAI Career Coach · Built for capability, not chronology.</div></footer>;
}

function Landing() {
  usePageMeta('Your next step, made clear', 'SensAI Career Coach helps career returners and employers make capability visible.');
  return <div className="noise"><PublicNav /><main>
    <section className="relative overflow-hidden border-b border-[hsl(var(--border))]"><div className="mx-auto grid max-w-7xl gap-12 px-5 pb-20 pt-20 lg:grid-cols-[1.05fr_.95fr] lg:items-center lg:px-8 lg:pb-28 lg:pt-28"><div className="stagger"><p className="eyebrow text-[hsl(var(--primary))]">Workforce intelligence for the return journey</p><h1 className="mt-5 max-w-3xl font-display text-5xl leading-[.98] tracking-[-.04em] sm:text-6xl lg:text-[78px]">Your next step,<br /><span className="text-[hsl(var(--primary))]">made clear.</span></h1><p className="mt-7 max-w-xl text-lg leading-8 text-[hsl(var(--muted-foreground))]">A career break should not erase capability. SensAI Career Coach gives people a grounded way back — and gives hiring teams a sharper, fairer way forward.</p><div className="mt-9 flex flex-wrap gap-3"><Link href="/candidate/onboarding" data-testid="link-hero-start" className="inline-flex min-h-12 items-center rounded-lg bg-[hsl(var(--primary))] px-5 text-sm font-semibold text-[hsl(var(--primary-foreground))]">Find your next step <ArrowRight size={16} className="ml-2" /></Link><Link href="/recruiter" data-testid="link-hero-recruiter" className="inline-flex min-h-12 items-center rounded-lg border border-[hsl(var(--border))] px-5 text-sm font-semibold">For hiring teams</Link></div><div className="mt-9 flex items-center gap-3 text-xs text-[hsl(var(--muted-foreground))]"><ShieldCheck size={17} className="text-[hsl(var(--primary))]" /> Built around transparent, human-reviewed recommendations</div></div><div className="relative min-h-[390px]"><div className="absolute right-0 top-0 h-full w-[92%] rounded-[28px] bg-[hsl(var(--sidebar))] p-6 text-[hsl(var(--sidebar-foreground))] shadow-[var(--shadow-md)] sm:p-8"><div className="flex items-center justify-between"><div><p className="eyebrow text-[hsl(var(--sidebar-foreground))]/50">Maya's return map</p><p className="mt-2 font-display text-2xl">A plan that sees the whole picture.</p></div><div className="rounded-full border border-[hsl(var(--sidebar-foreground))]/20 p-2"><Radar size={19} /></div></div><div className="mt-8 grid grid-cols-[auto_1fr] gap-5"><Score value={84} size="lg" /><div><p className="text-sm font-semibold">Product Operations Lead</p><p className="mt-1 text-xs text-[hsl(var(--sidebar-foreground))]/55">Palo Alto · Hybrid</p><div className="mt-5 space-y-3"><div><div className="mb-1 flex justify-between text-[11px]"><span className="text-[hsl(var(--sidebar-foreground))]/65">Verified skills</span><span>91%</span></div><Progress value={91} color="bg-[hsl(var(--accent))]" /></div><div><div className="mb-1 flex justify-between text-[11px]"><span className="text-[hsl(var(--sidebar-foreground))]/65">Role alignment</span><span>84%</span></div><Progress value={84} color="bg-[#7bb3a4]" /></div></div></div></div><div className="mt-8 rounded-xl border border-[hsl(var(--sidebar-foreground))]/15 bg-[hsl(var(--sidebar-foreground))]/5 p-4"><div className="flex items-center gap-2 text-xs"><CheckCircle2 size={15} className="text-[hsl(var(--accent))]" /> Career break treated neutrally</div><div className="mt-3 flex items-center gap-2 text-xs"><CheckCircle2 size={15} className="text-[hsl(var(--accent))]" /> Three-week path to close the signal gap</div></div></div><div className="absolute -bottom-3 left-0 w-52 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4 shadow-[var(--shadow-md)]"><p className="eyebrow">Next best action</p><p className="mt-2 text-sm font-semibold">Complete SQL practice</p><p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">+7 fit points projected</p></div></div></div></section>
    <section className="mx-auto max-w-7xl px-5 py-20 lg:px-8"><div className="grid gap-10 lg:grid-cols-[.8fr_1.2fr]"><div><p className="eyebrow">A different kind of intelligence</p><h2 className="mt-4 max-w-md font-display text-4xl leading-tight">The gap is in the record. Not in the person.</h2></div><div className="grid gap-4 sm:grid-cols-2"><div className="surface rounded-2xl p-6"><div className="mb-5 grid h-10 w-10 place-items-center rounded-xl bg-[#e1f0ea] text-[hsl(var(--primary))]"><FileCheck2 size={19} /></div><h3 className="font-semibold">Capability, made visible</h3><p className="mt-2 text-sm leading-6 text-[hsl(var(--muted-foreground))]">Skill evidence, context, and progress create a fuller signal than a timeline alone.</p></div><div className="surface rounded-2xl p-6"><div className="mb-5 grid h-10 w-10 place-items-center rounded-xl bg-[#f8e6cf] text-[#925d26]"><UsersRound size={19} /></div><h3 className="font-semibold">Human judgment, intact</h3><p className="mt-2 text-sm leading-6 text-[hsl(var(--muted-foreground))]">Recommendations show their work. People make the call.</p></div></div></div></section>
    <section className="bg-[#dfe9e4] px-5 py-20 lg:px-8"><div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-[1.15fr_.85fr] lg:items-end"><div><p className="eyebrow text-[hsl(var(--primary))]">The return journey</p><h2 className="mt-4 max-w-2xl font-display text-4xl leading-tight lg:text-5xl">From “where do I start?” to “I know why this fits.”</h2></div><div className="grid gap-3"><div className="flex gap-4 border-l-2 border-[hsl(var(--primary))] pl-5"><span className="font-data text-xs text-[hsl(var(--primary))]">01</span><div><p className="font-semibold">See your signal</p><p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">A skills passport that values evidence over recency.</p></div></div><div className="flex gap-4 border-l-2 border-[hsl(var(--primary))]/35 pl-5"><span className="font-data text-xs text-[hsl(var(--primary))]">02</span><div><p className="font-semibold">Build the bridge</p><p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">A focused learning path tied to a real role you want.</p></div></div><div className="flex gap-4 border-l-2 border-[hsl(var(--primary))]/35 pl-5"><span className="font-data text-xs text-[hsl(var(--primary))]">03</span><div><p className="font-semibold">Move with proof</p><p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">A clearer resume, a stronger application, and a recruiter who can explain the fit.</p></div></div></div></div></section>
    <section className="mx-auto max-w-7xl px-5 py-20 lg:px-8"><div className="rounded-[28px] bg-[hsl(var(--sidebar))] px-6 py-12 text-center text-[hsl(var(--sidebar-foreground))] sm:px-12"><p className="eyebrow text-[hsl(var(--accent))]">Ready when you are</p><h2 className="mx-auto mt-4 max-w-2xl font-display text-4xl leading-tight">Your experience did not disappear. Let’s give it a better signal.</h2><Link href="/candidate/onboarding" data-testid="link-bottom-start" className="mt-8 inline-flex min-h-12 items-center rounded-lg bg-[hsl(var(--accent))] px-5 text-sm font-semibold text-[hsl(var(--foreground))]">Build my return map <ArrowRight size={16} className="ml-2" /></Link></div></section>
  </main><PublicFooter /></div>;
}

function PublicPage({ kind }: { kind: 'pricing' | 'about' | 'how' | 'architecture' }) {
  const content = {
    pricing: { title: 'A fairer way to move forward.', kicker: 'Plans for every side of the table', intro: 'Start with clarity. Add the intelligence your team needs when you are ready.', },
    about: { title: 'We believe the record is not the person.', kicker: 'Our point of view', intro: 'SensAI exists because career paths are lived in seasons, not straight lines.', },
    how: { title: 'Make the next step legible.', kicker: 'How SensAI works', intro: 'One connected workspace for the person returning, the recruiter deciding, and the employer preparing.', },
    architecture: { title: 'Trust is a system property.', kicker: 'The SensAI architecture', intro: 'A transparent intelligence layer that keeps people, evidence, and accountability connected.', },
  }[kind];
  usePageMeta(content.title, content.intro);
  if (kind === 'pricing') return <PricingPage />;
  if (kind === 'architecture') return <ArchitecturePage />;
  return <div className="noise"><PublicNav /><main><section className="mx-auto max-w-7xl px-5 pb-16 pt-20 lg:px-8 lg:pt-28"><p className="eyebrow text-[hsl(var(--primary))]">{content.kicker}</p><h1 className="mt-5 max-w-3xl font-display text-5xl leading-[1.02] tracking-[-.04em] sm:text-7xl">{content.title}</h1><p className="mt-7 max-w-2xl text-lg leading-8 text-[hsl(var(--muted-foreground))]">{content.intro}</p></section>{kind === 'about' ? <AboutContent /> : <HowContent />}</main><PublicFooter /></div>;
}
function AboutContent() {
  return <><section className="bg-[#dfe9e4] px-5 py-20 lg:px-8"><div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-2"><div><p className="eyebrow">The conviction</p><h2 className="mt-4 font-display text-4xl leading-tight">A career break should not erase capability.</h2></div><div className="space-y-5 text-[hsl(var(--muted-foreground))]"><p>Most hiring systems treat time away as a blank. We treat it as context — one signal among many, never a penalty hidden inside a score.</p><p>We build tools for people who are returning, and for teams that want to see the whole candidate without asking them to defend their life.</p><p className="font-semibold text-[hsl(var(--foreground))]">AI recommends. Recruiter decides. That is not a footnote. It is the product.</p></div></div></section><section className="mx-auto max-w-7xl px-5 py-20 lg:px-8"><div className="grid gap-4 md:grid-cols-3"><div className="surface rounded-2xl p-6"><LockKeyhole className="text-[hsl(var(--primary))]" /><h3 className="mt-5 font-semibold">Explainable by default</h3><p className="mt-2 text-sm leading-6 text-[hsl(var(--muted-foreground))]">Every recommendation is paired with evidence, confidence, and what it does not consider.</p></div><div className="surface rounded-2xl p-6"><Heart className="text-[hsl(var(--primary))]" /><h3 className="mt-5 font-semibold">Human in the loop</h3><p className="mt-2 text-sm leading-6 text-[hsl(var(--muted-foreground))]">The final decision belongs to a person with context, not a score with authority.</p></div><div className="surface rounded-2xl p-6"><Network className="text-[hsl(var(--primary))]" /><h3 className="mt-5 font-semibold">Designed for both sides</h3><p className="mt-2 text-sm leading-6 text-[hsl(var(--muted-foreground))]">Candidate confidence and recruiter velocity should reinforce each other.</p></div></div></section></>;
}
function HowContent() {
  return <section className="mx-auto max-w-7xl px-5 pb-24 lg:px-8"><div className="grid gap-5 lg:grid-cols-3"><div className="surface rounded-2xl p-7 lg:translate-y-8"><span className="font-data text-xs text-[hsl(var(--primary))]">01 / ORIENT</span><h3 className="mt-12 font-display text-3xl">Start with the whole story.</h3><p className="mt-4 text-sm leading-6 text-[hsl(var(--muted-foreground))]">Import your experience, name your direction, and keep your career break in its proper place: context, not a character judgment.</p></div><div className="surface rounded-2xl bg-[hsl(var(--sidebar))] p-7 text-[hsl(var(--sidebar-foreground))]"><span className="font-data text-xs text-[hsl(var(--accent))]">02 / BRIDGE</span><h3 className="mt-12 font-display text-3xl">Close only the gaps that matter.</h3><p className="mt-4 text-sm leading-6 text-[hsl(var(--sidebar-foreground))]/65">Match your real skills to a real role, then get a focused path with a finish line you can see.</p></div><div className="surface rounded-2xl p-7 lg:translate-y-8"><span className="font-data text-xs text-[hsl(var(--primary))]">03 / MOVE</span><h3 className="mt-12 font-display text-3xl">Apply with evidence.</h3><p className="mt-4 text-sm leading-6 text-[hsl(var(--muted-foreground))]">Optimise the story, show the proof, and hand the recruiter an explainable reason to keep the conversation going.</p></div></div><div className="mt-24 flex flex-wrap items-center justify-between gap-5 border-y border-[hsl(var(--border))] py-8"><p className="font-display text-2xl">One principle runs through every screen.</p><p className="text-sm font-semibold text-[hsl(var(--primary))]">AI recommends. Recruiter decides.</p></div></section>;
}
function PricingPage() {
  const [selected, setSelected] = useState('Returner');
  usePageMeta('Pricing', 'Simple plans for returners and hiring teams.');
  return <div className="noise"><PublicNav /><main className="mx-auto max-w-7xl px-5 py-20 lg:px-8 lg:py-28"><p className="eyebrow text-[hsl(var(--primary))]">Plans for every side of the table</p><h1 className="mt-5 max-w-2xl font-display text-5xl leading-tight">A fairer way to move forward.</h1><p className="mt-6 max-w-xl text-lg text-[hsl(var(--muted-foreground))]">Start with clarity. Add the intelligence your team needs when you are ready.</p><div className="mt-10 inline-flex rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-1"><button onClick={() => setSelected('Returner')} data-testid="button-pricing-returner" className={`rounded-md px-4 py-2 text-sm font-semibold ${selected === 'Returner' ? 'bg-[hsl(var(--sidebar))] text-white' : ''}`}>For returners</button><button onClick={() => setSelected('Employer')} data-testid="button-pricing-employer" className={`rounded-md px-4 py-2 text-sm font-semibold ${selected === 'Employer' ? 'bg-[hsl(var(--sidebar))] text-white' : ''}`}>For employers</button></div><div className="mt-10 grid gap-4 lg:grid-cols-3">{(selected === 'Returner' ? [{ name: 'Open Door', price: 'Free', copy: 'A thoughtful place to begin.', features: ['Skills passport', 'Role fit signals', 'Three saved roles'] }, { name: 'SensAI Plus', price: '$12', copy: 'For a focused return.', features: ['Everything in Open Door', 'Guided learning paths', 'Resume evidence clinic'] }, { name: 'Co-pilot', price: '$29', copy: 'A deeper practice partner.', features: ['Everything in Plus', 'Interview rehearsal', 'Priority support'] }] : [{ name: 'Pilot', price: '$0', copy: 'See the signal in a small team.', features: ['Up to 10 open roles', 'Candidate explainability', 'Fairness snapshot'] }, { name: 'Workforce', price: '$1,850', copy: 'Move faster without losing care.', features: ['Unlimited roles', 'Bias audit workspace', 'Hiring analytics'] }, { name: 'Enterprise', price: 'Let’s talk', copy: 'Built around your governance.', features: ['Platform architecture review', 'Custom readiness program', 'Dedicated success partner'] }]).map((plan, i) => <div key={plan.name} className={`surface rounded-2xl p-7 ${i === 1 ? 'border-2 border-[hsl(var(--primary))] shadow-[var(--shadow-md)]' : ''}`}><div className="flex items-start justify-between"><div><h2 className="font-display text-2xl">{plan.name}</h2><p className="mt-2 text-sm text-[hsl(var(--muted-foreground))]">{plan.copy}</p></div>{i === 1 && <Badge tone="good">Most chosen</Badge>}</div><p className="mt-8 font-data text-3xl">{plan.price}<span className="font-sans text-sm text-[hsl(var(--muted-foreground))]">{plan.price.startsWith('$') && plan.price !== '$0' && plan.price !== '$1,850' ? ' / month' : ''}</span></p><div className="my-7 border-t border-[hsl(var(--border))]" /><div className="grid gap-3 text-sm">{plan.features.map(f => <div key={f} className="flex items-center gap-2"><Check size={15} className="text-[hsl(var(--primary))]" />{f}</div>)}</div><Button onClick={() => window.alert(`${plan.name} selected for this prototype`)} data-testid={`button-select-plan-${i}`} variant={i === 1 ? 'primary' : 'outline'} className="mt-8 w-full">{plan.price === 'Let’s talk' ? 'Talk with us' : 'Choose plan'}</Button></div>)}</div></main><PublicFooter /></div>;
}
function ArchitecturePage() {
  return <div className="noise"><PublicNav /><main className="mx-auto max-w-7xl px-5 py-20 lg:px-8 lg:py-28"><p className="eyebrow text-[hsl(var(--primary))]">The SensAI architecture</p><h1 className="mt-5 max-w-3xl font-display text-5xl leading-tight">Trust is a system property.</h1><p className="mt-6 max-w-2xl text-lg leading-8 text-[hsl(var(--muted-foreground))]">A transparent intelligence layer that keeps people, evidence, and accountability connected.</p><div className="mt-14 grid gap-4 lg:grid-cols-[.8fr_1.2fr]"><div className="rounded-2xl bg-[hsl(var(--sidebar))] p-7 text-[hsl(var(--sidebar-foreground))]"><p className="eyebrow text-[hsl(var(--accent))]">Decision boundary</p><h2 className="mt-4 font-display text-3xl">AI recommends.<br />Recruiter decides.</h2><p className="mt-5 text-sm leading-6 text-[hsl(var(--sidebar-foreground))]/65">Signals are inspectable. Career breaks are excluded from fit scoring. Every shortlist action leaves a human review trace.</p></div><div className="surface rounded-2xl p-7"><div className="grid gap-3 sm:grid-cols-2">{[['Candidate signal', 'Skills passport + intent', UserRound], ['Fit engine', 'Evidence-weighted match', Radar], ['Learning bridge', 'Role-specific path', GraduationCap], ['Human review', 'Reason + decision trace', ShieldCheck], ['Fairness monitor', 'Outcome parity checks', BarChart3], ['Employer readiness', 'Team context + access', Building2]].map(([title, desc, Icon]) => { const I = Icon as typeof UserRound; return <div key={title as string} className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] p-4"><I size={18} className="text-[hsl(var(--primary))]" /><p className="mt-4 text-sm font-semibold">{title as string}</p><p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">{desc as string}</p></div>; })}</div></div></div><div className="mt-10 rounded-2xl border border-[hsl(var(--border))] p-7"><p className="eyebrow">Data flow · mock environment</p><div className="mt-7 flex flex-wrap items-center justify-center gap-3 text-sm">{['Experience', 'Signal extraction', 'Fit + gaps', 'Human review', 'Next step'].map((item, i) => <div key={item} className="flex items-center gap-3"><div className={`rounded-lg px-4 py-3 font-semibold ${i === 4 ? 'bg-[hsl(var(--accent))]' : 'bg-[hsl(var(--secondary))]'}`}>{item}</div>{i < 4 && <ArrowRight size={15} className="text-[hsl(var(--muted-foreground))]" />}</div>)}</div></div></main><PublicFooter /></div>;
}

const candidateNav = [
  ['/candidate', 'Overview', LayoutDashboard],
  ['/candidate/onboarding', 'Onboarding & Return Map', Compass],
  ['/candidate/profile', 'My profile', UserRound],
  ['/candidate/skill-passport', 'Skill passport', Network],
  ['/candidate/background-check', 'Background check', FileCheck2],
  ['/candidate/jobs', 'Explore roles', BriefcaseBusiness],
  ['/candidate/skill-gap', 'Skill bridge', Target],
  ['/candidate/learning', 'Learning path', GraduationCap],
  ['/candidate/applications', 'Applications', Inbox],
  ['/candidate/resume', 'Resume studio', FileText],
  ['/candidate/assistant', 'SensAI assistant', MessageCircle]
] as const;
const recruiterNav = [['/recruiter', 'Overview', LayoutDashboard], ['/recruiter/jobs', 'Jobs', BriefcaseBusiness], ['/recruiter/candidates', 'Candidates', UsersRound], ['/recruiter/shortlist', 'Shortlist', Star], ['/recruiter/bias-audit', 'Fairness monitor', ShieldCheck], ['/recruiter/analytics', 'Analytics', LineChart], ['/recruiter/billing', 'Billing', CreditCard], ['/recruiter/settings', 'Settings', Settings]] as const;
function WorkspaceShell({ role, children }: { role: 'candidate' | 'recruiter'; children: ReactNode }) {
  const p = useProduct();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [serverRole, setServerRole] = useState<AuthRole | 'loading' | 'error'>('loading');
  const [location, setLocation] = useLocation();
  const { isLoaded, isSignedIn } = useAuth();
  const { signOut } = useClerk();
  const { user } = useUser();
  const nav = role === 'candidate' 
    ? candidateNav.filter(([href]) => href !== '/candidate/onboarding' || !p.isOnboarded)
    : recruiterNav;

  useEffect(() => {
    if (!isSignedIn) {
      setServerRole('loading');
      return;
    }

    let cancelled = false;
    const resolveRole = async () => {
      const current = await fetch('/api/auth/me');
      if (!current.ok) throw new Error('Unable to verify workspace access.');
      let data = await current.json() as { role?: AuthRole };

      // The recruiter sign-up flow is self-service: a signed-in user who selected
      // recruiter access receives a persisted recruiter role before the workspace loads.
      if (role === 'recruiter' && data.role === 'candidate' && getStoredRole() === 'recruiter') {
        const enrollment = await fetch('/api/auth/enroll', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ role: 'recruiter' }),
        });
        if (!enrollment.ok) throw new Error('Unable to create recruiter access.');
        data = await enrollment.json() as { role?: AuthRole };
      }

      if (cancelled || (data.role !== 'candidate' && data.role !== 'recruiter')) return;
      localStorage.setItem('rp-role', data.role);
      setServerRole(data.role);
    };

    void resolveRole().catch(() => {
      if (!cancelled) setServerRole('error');
    });

    return () => { cancelled = true; };
  }, [isSignedIn, role]);

  useEffect(() => {
    if (isLoaded && !isSignedIn) setLocation(`/auth/${role}`);
  }, [isLoaded, isSignedIn, role, setLocation]);

  if (!isLoaded || serverRole === 'loading') return <div className="grid min-h-[100dvh] place-items-center bg-[hsl(var(--background))]"><RefreshCcw size={20} className="animate-spin text-[hsl(var(--primary))]" aria-label="Loading account" /></div>;
  if (!isSignedIn) return null;
  if (serverRole !== role) return <AccessRestricted expectedRole={role} />;

  const displayName = role === 'candidate' 
    ? (user?.fullName || user?.firstName || (p.profile?.name && p.profile.name.trim() ? p.profile.name : 'Candidate'))
    : (user?.fullName || user?.firstName || 'Hiring Team');
  
  const initials = user?.firstName
    ? `${user.firstName[0]}${user.lastName ? user.lastName[0] : ''}`
    : (role === 'candidate' ? (p.profile?.name ? p.profile.name.slice(0, 2).toUpperCase() : 'CD') : 'HT');

  return <div className="min-h-[100dvh] bg-[hsl(var(--background))]"><aside className={`fixed inset-y-0 left-0 z-30 w-[245px] bg-[hsl(var(--sidebar))] p-5 text-[hsl(var(--sidebar-foreground))] transition-transform duration-200 ${mobileOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0`}><div className="flex items-center justify-between"><Logo light /><button onClick={() => setMobileOpen(false)} data-testid="button-close-sidebar" className="md:hidden"><X size={18} /></button></div><div className="mt-10"><p className="eyebrow text-[hsl(var(--sidebar-foreground))]/45">{role === 'candidate' ? 'My workspace' : 'Talent workspace'}</p><nav className="mt-3 grid gap-1">{nav.map(([href, label, Icon]) => <Link href={href} key={href} onClick={() => setMobileOpen(false)} data-testid={`nav-${label.toLowerCase().replaceAll(' ', '-')}`} className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition ${location === href ? 'bg-[hsl(var(--sidebar-foreground))]/12 text-[hsl(var(--accent))]' : 'text-[hsl(var(--sidebar-foreground))]/65 hover:bg-[hsl(var(--sidebar-foreground))]/8 hover:text-[hsl(var(--sidebar-foreground))]'}`}><Icon size={17} />{label}</Link>)}</nav></div><div className="absolute bottom-5 left-5 right-5 space-y-2"><div className="rounded-xl border border-[hsl(var(--sidebar-foreground))]/12 bg-[hsl(var(--sidebar-foreground))]/5 p-3"><div className="flex items-center gap-2 text-xs"><ShieldCheck size={15} className="text-[hsl(var(--accent))]" /> <span>AI-Verified</span></div><p className="mt-2 text-[11px] leading-4 text-[hsl(var(--sidebar-foreground))]/45">100% Skills-First & Bias Neutral.</p></div><button onClick={() => signOut({ redirectUrl: basePath || '/' })} data-testid="sidebar-button-sign-out" className="flex w-full items-center justify-center gap-2 rounded-lg border border-[hsl(var(--sidebar-foreground))]/15 bg-[hsl(var(--sidebar-foreground))]/5 py-2 text-xs font-semibold text-[hsl(var(--sidebar-foreground))]/70 transition hover:bg-[hsl(var(--sidebar-foreground))]/10 hover:text-white"><LogOut size={14} /><span>Sign out</span></button></div></aside><div className="md:pl-[245px]"><header className="sticky top-0 z-20 flex h-[68px] items-center justify-between border-b border-[hsl(var(--border))] bg-[hsl(var(--background))]/90 px-5 backdrop-blur lg:px-8"><button onClick={() => setMobileOpen(true)} data-testid="button-open-sidebar" className="rounded-lg p-2 md:hidden"><Menu size={21} /></button><div className="hidden md:block"><p className="eyebrow">{role === 'candidate' ? 'Candidate workspace · Skills Hub' : 'Recruiter workspace · SensAI Platform'}</p></div><div className="ml-auto flex items-center gap-3"><button data-testid="button-notifications" className="rounded-lg p-2 text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))] hover:text-[hsl(var(--foreground))]"><Bell size={18} /></button><div className="flex items-center gap-2 border-l border-[hsl(var(--border))] pl-3">{user?.imageUrl ? <img src={user.imageUrl} alt={displayName} className="h-8 w-8 rounded-full border border-[hsl(var(--border))]" /> : <div className="grid h-8 w-8 place-items-center rounded-full bg-[#d98459] text-xs font-semibold text-white">{initials}</div>}<span className="hidden text-sm font-semibold sm:block">{displayName}</span></div><button onClick={() => signOut({ redirectUrl: basePath || '/' })} data-testid="button-sign-out" title="Sign out" className="ml-1 flex items-center gap-1.5 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))]/80 px-2.5 py-1.5 text-xs font-semibold text-[hsl(var(--muted-foreground))] transition hover:border-[hsl(var(--destructive))]/40 hover:bg-[hsl(var(--destructive))]/10 hover:text-[hsl(var(--destructive))]"><LogOut size={14} /><span className="hidden sm:inline">Sign out</span></button></div></header><main className="mx-auto max-w-[1440px] px-5 py-8 lg:px-9 lg:py-10">{children}</main></div></div>;
}
function getTimeGreeting(): string {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return 'Good morning';
  if (hour >= 12 && hour < 17) return 'Good afternoon';
  return 'Good evening';
}

function useTimeGreeting(): string {
  const [greeting, setGreeting] = useState(getTimeGreeting);
  useEffect(() => {
    const interval = setInterval(() => {
      setGreeting(getTimeGreeting());
    }, 60000);
    return () => clearInterval(interval);
  }, []);
  return greeting;
}

function PageTitle({ eyebrow, title, description, action }: { eyebrow?: string; title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="mb-8 flex flex-wrap items-start justify-between gap-5">
      <div>
        {eyebrow ? <p className="eyebrow text-[hsl(var(--primary))]">{eyebrow}</p> : null}
        <h1 className={`${eyebrow ? 'mt-2' : ''} font-display text-4xl leading-tight tracking-[-.03em]`}>{title}</h1>
        {description && <p className="mt-3 max-w-2xl text-sm leading-6 text-[hsl(var(--muted-foreground))]">{description}</p>}
      </div>
      {action}
    </div>
  );
}
function EmptyState({ icon: Icon, title, body, action }: { icon: typeof Inbox; title: string; body: string; action?: ReactNode }) {
  return <div className="surface rounded-2xl p-10 text-center"><div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-[hsl(var(--secondary))] text-[hsl(var(--primary))]"><Icon size={21} /></div><h3 className="mt-4 font-display text-2xl">{title}</h3><p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-[hsl(var(--muted-foreground))]">{body}</p>{action && <div className="mt-5">{action}</div>}</div>;
}
function CandidateHome() {
  const p = useProduct(); 
  const { user } = useUser();
  const greeting = useTimeGreeting();
  const [syncing, setSyncing] = useState(false);
  usePageMeta('Candidate overview', 'Your SensAI career workspace.');

  const profile = p.profile || createCleanProfile(user?.fullName || user?.firstName || '', user?.primaryEmailAddress?.emailAddress || '');
  const candidateName = profile.name || user?.fullName || user?.firstName || 'Candidate';
  const firstName = user?.firstName || (candidateName && candidateName !== 'Candidate' ? candidateName.split(' ')[0] : 'Candidate');
  const skills = profile.skills || [];
  const projects = profile.projects || [];
  const experience = profile.experience || [];
  const education = profile.education || [];
  const certifications = profile.certifications || [];
  const hasData = skills.length > 0 || projects.length > 0 || Boolean(profile.targetRole);

  const syncBackend = async () => {
    setSyncing(true);
    try {
      const res = await fetch('/api/candidate/profile');
      const data = await res.json();
      if (data?.profile && data.profile.name) {
        await p.updateProfile(data.profile);
        if (typeof data.profile.fit === 'number' && data.profile.fit > 0) {
          p.setFit(data.profile.fit);
        }
        if (data.profile.latestMatch) {
          p.setLatestMatch(data.profile.latestMatch);
        }
      }

      // If match is not yet populated in the profile, fetch stored match from database
      if (!p.latestMatch && !data?.profile?.latestMatch) {
        try {
          const matchRes = await fetch('/api/candidate/match');
          const matchData = await matchRes.json();
          if (matchData?.match) {
            p.setLatestMatch(matchData.match);
            if (typeof matchData.match.overallFitScore === 'number') {
              p.setFit(matchData.match.overallFitScore);
            }
          }
        } catch {}
      }

      p.notify('Synced capability signals with Skills Intelligence Platform.');
    } catch {
      p.notify('Connected to local verified profile.');
    } finally {
      setSyncing(false);
    }
  };

  const [, setLocation] = useLocation();

  useEffect(() => {
    syncBackend();
  }, [user?.id]);

  useEffect(() => {
    const localOnboarded = localStorage.getItem('rp-onboarded') === 'true';
    if (user?.id && !p.isOnboarded && !localOnboarded && !hasData && !syncing) {
      setLocation('/candidate/onboarding');
    }
  }, [user?.id, p.isOnboarded, hasData, syncing, setLocation]);

  const realMetrics = useMemo(() => {
    return calculateRealReadiness(profile);
  }, [profile]);

  const currentMatch = p.latestMatch;
  const currentFitScore = p.fit || currentMatch?.overallFitScore || (hasData ? 84 : 0);
  const boostProjected = currentMatch?.threeWeekBoostProjected ? `${currentMatch.threeWeekBoostProjected}%` : (hasData ? '91%' : '—');

  return <WorkspaceShell role="candidate">
    {!p.isOnboarded && (
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-[hsl(var(--accent))]/40 bg-[hsl(var(--accent))]/10 p-5">
        <div className="flex items-center gap-3.5">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[hsl(var(--accent))] text-black">
            <Compass size={22} />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-[hsl(var(--accent))]">Personalized Capability Map</p>
            <h2 className="text-base font-semibold">Build or calibrate your talent profile across 3 pathways</h2>
            <p className="text-xs text-[hsl(var(--muted-foreground))]">Targeting {profile.targetRole || 'Product Operations'} at {profile.targetCompany || 'enterprise companies'}. Choose from Resume Upload, AI Coach, or Form.</p>
          </div>
        </div>
        <Link href="/candidate/onboarding" data-testid="link-banner-onboarding" className="inline-flex min-h-10 items-center rounded-lg bg-[hsl(var(--accent))] px-4 text-xs font-bold text-black shadow transition hover:brightness-110">
          Launch Capability Onboarding <ArrowRight size={14} className="ml-1.5" />
        </Link>
      </div>
    )}

    <PageTitle 
      title={`${greeting}, ${firstName}.`} 
      description="Your verified capabilities, real-world projects, and match signals are synced live with Cloud Database." 
      action={
        <Link href="/candidate/jobs" data-testid="link-explore-from-home" className="inline-flex min-h-10 items-center rounded-lg bg-[hsl(var(--primary))] px-4 text-xs font-semibold text-[hsl(var(--primary-foreground))]">
          Explore roles <ArrowRight size={14} className="ml-1.5" />
        </Link>
      } 
    />

    {/* Top Summary Cards */}
    <div className="grid gap-5 lg:grid-cols-[1.35fr_.65fr]">
      <section className="rounded-2xl bg-[hsl(var(--sidebar))] p-6 text-[hsl(var(--sidebar-foreground))] sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div>
            <div className="flex items-center gap-2">
              <p className="eyebrow text-[hsl(var(--accent))]">AI Skills Match</p>
              <Badge tone={hasData ? 'good' : 'quiet'}>{hasData ? `${realMetrics.profileSignal}% Capability Verified` : 'Awaiting Setup'}</Badge>
            </div>
            <h2 className="mt-3 font-display text-3xl">{profile.targetRole || currentMatch?.jobTitle || 'Discover Your Best Fit Role'}</h2>
            <p className="mt-2 text-sm text-[hsl(var(--sidebar-foreground))]/60">
              {profile.targetCompany || currentMatch?.company || 'Top Employers'} · {profile.workMode || 'Hybrid'} {profile.location ? `· ${profile.location}` : ''}
            </p>
            {currentMatch?.matchSummary ? (
              <p className="mt-3 max-w-xl text-xs leading-relaxed text-[hsl(var(--sidebar-foreground))]/80">
                {currentMatch.matchSummary}
              </p>
            ) : profile.summary ? (
              <p className="mt-3 max-w-xl text-xs leading-relaxed text-[hsl(var(--sidebar-foreground))]/75">
                {profile.summary}
              </p>
            ) : (
              <p className="mt-3 max-w-xl text-xs leading-relaxed text-[hsl(var(--sidebar-foreground))]/60">
                Upload your resume or chat with your AI Coach to extract your core technical skills, verified achievements, and matching roles.
              </p>
            )}

            {currentMatch?.matchingStrengths?.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-1.5">
                {currentMatch.matchingStrengths.slice(0, 3).map((st: string, i: number) => (
                  <span key={i} className="inline-flex items-center rounded-md bg-[hsl(var(--sidebar-foreground))]/10 px-2 py-0.5 text-[11px] text-[hsl(var(--sidebar-foreground))]/90">
                    <CheckCircle2 size={11} className="mr-1 text-[hsl(var(--accent))]" /> {st}
                  </span>
                ))}
              </div>
            )}
          </div>
          <Score value={currentFitScore} />
        </div>

        <div className="mt-8 grid gap-3 border-t border-[hsl(var(--sidebar-foreground))]/15 pt-5 sm:grid-cols-3">
          <div>
            <p className="text-xs text-[hsl(var(--sidebar-foreground))]/55">Current fit</p>
            <p className="mt-1 font-data text-xl">{currentFitScore}%</p>
          </div>
          <div>
            <p className="text-xs text-[hsl(var(--sidebar-foreground))]/55">After skill bridge</p>
            <p className="mt-1 font-data text-xl text-[hsl(var(--accent))]">{boostProjected}</p>
          </div>
          <div>
            <p className="text-xs text-[hsl(var(--sidebar-foreground))]/55">Verified readiness</p>
            <p className="mt-1 text-xs font-semibold text-[#86efac]">
              {hasData ? `${realMetrics.skillEvidence}% ${realMetrics.readinessTier}` : 'Pending Onboarding'}
            </p>
          </div>
        </div>

        {(currentMatch?.breakNeutralityExplanation && Number(profile.careerBreakYears) > 0) ? (
          <div className="mt-4 rounded-xl border border-[hsl(var(--sidebar-foreground))]/15 bg-[hsl(var(--sidebar-foreground))]/5 p-3 text-xs text-[hsl(var(--sidebar-foreground))]/80">
            <span className="font-semibold text-[hsl(var(--accent))]">Inclusive Matching Agent: </span>
            {currentMatch.breakNeutralityExplanation}
          </div>
        ) : null}

        <div className="mt-7 flex flex-wrap gap-3">
          <Link href={hasData ? "/candidate/skill-gap" : "/candidate/onboarding"} data-testid="link-see-skill-gap" className="inline-flex min-h-10 items-center rounded-lg bg-[hsl(var(--accent))] px-4 text-xs font-bold text-black shadow transition hover:brightness-110">
            {hasData ? 'See 3-Week Skill Bridge' : 'Launch Onboarding Map'} <ArrowRight size={14} className="ml-1.5" />
          </Link>
          <Link href="/candidate/jobs" data-testid="link-view-match" className="inline-flex min-h-10 items-center rounded-lg border border-[hsl(var(--sidebar-foreground))]/20 px-4 text-xs font-semibold hover:bg-white/5">
            Explore All Open Roles
          </Link>
        </div>
      </section>

      <section className="surface rounded-2xl p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="eyebrow">Talent readiness</p>
            <p className="mt-2 font-display text-2xl">{hasData ? realMetrics.readinessTier : 'Not Started'}</p>
          </div>
          <Gauge size={22} className="text-[hsl(var(--primary))]" />
        </div>
        <div className="mt-7">
          <div className="flex justify-between text-sm">
            <span>Profile Signal</span>
            <span className="font-data">{realMetrics.profileSignal}%</span>
          </div>
          <Progress value={realMetrics.profileSignal} />
          <p className="mt-2 text-xs text-[hsl(var(--muted-foreground))]">
            {hasData ? `${skills.length} skills · ${profile.projects?.length || 0} projects · ${profile.education?.length || 0} degrees verified` : 'Complete onboarding to generate signal'}
          </p>
        </div>
        <div className="mt-6">
          <div className="flex justify-between text-sm">
            <span>Skill Evidence</span>
            <span className="font-data">
              {p.completedLearning ? Math.min(100, realMetrics.skillEvidence + 7) : realMetrics.skillEvidence}%
            </span>
          </div>
          <Progress 
            value={p.completedLearning ? Math.min(100, realMetrics.skillEvidence + 7) : realMetrics.skillEvidence} 
            color="bg-[hsl(var(--accent))]" 
          />
          <p className="mt-2 text-xs text-[hsl(var(--muted-foreground))]">
            {hasData ? `${profile.projects?.length || 0} portfolio projects backing technical capabilities` : 'Attach project evidence to elevate signal'}
          </p>
        </div>
        <div className="mt-7 flex items-center justify-between border-t border-[hsl(var(--border))] pt-4">
          <span className="text-xs text-[hsl(var(--muted-foreground))]">Talent Hub Evaluation</span>
          <Badge tone="good">100% Skills-First</Badge>
        </div>
      </section>
    </div>

    {/* Verified Skills Cloud from Backend */}
    <div className="mt-6 surface rounded-2xl p-6 sm:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="eyebrow text-[hsl(var(--primary))]">Demonstrated & Verified Competencies</p>
          <h3 className="mt-1 font-display text-2xl">Skills Stored in Skills Hub ({skills.length})</h3>
        </div>
        <Link href="/candidate/skill-passport" className="text-xs font-semibold text-[hsl(var(--primary))] hover:underline">
          Explore Skill Galaxy <ArrowRight size={12} className="inline ml-1" />
        </Link>
      </div>

      {skills.length > 0 ? (
        <div className="mt-5 flex flex-wrap gap-2">
          {skills.map((skill, index) => (
            <span 
              key={`${skill}-${index}`} 
              className="inline-flex items-center gap-1.5 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 py-1.5 text-xs font-semibold transition hover:border-[hsl(var(--primary))]"
            >
              <CheckCircle2 size={13} className="text-[#86efac]" />
              {skill}
            </span>
          ))}
        </div>
      ) : (
        <div className="mt-5 rounded-xl border border-dashed border-[hsl(var(--border))] p-6 text-center text-xs text-[hsl(var(--muted-foreground))]">
          <Network size={20} className="mx-auto text-[hsl(var(--muted-foreground))]/60 mb-2" />
          <p className="font-semibold text-sm text-[hsl(var(--foreground))]">No verified skills mapped yet</p>
          <p className="mt-1">Upload your resume or launch the onboarding assistant to map your skills into Skills Hub.</p>
        </div>
      )}
    </div>

    {/* Projects and Work Experience from Backend Database */}
    <div className="mt-6 grid gap-6 lg:grid-cols-2">
      {/* Projects */}
      <section className="surface rounded-2xl p-6 sm:p-7">
        <div className="flex items-center justify-between border-b border-[hsl(var(--border))] pb-4">
          <div className="flex items-center gap-2.5">
            <div className="grid h-8 w-8 place-items-center rounded-lg bg-[hsl(var(--primary))]/15 text-[hsl(var(--primary))]">
              <Network size={16} />
            </div>
            <div>
              <h3 className="font-display text-xl font-bold">Featured Projects</h3>
              <p className="text-xs text-[hsl(var(--muted-foreground))]">Loaded from database</p>
            </div>
          </div>
          <Badge tone="good">{projects.length} Projects</Badge>
        </div>

        <div className="mt-5 space-y-4">
          {projects.length > 0 ? (
            projects.map((proj, idx) => (
              <div key={idx} className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--background))]/50 p-4 transition hover:border-[hsl(var(--primary))]/50">
                <div className="flex items-start justify-between gap-3">
                  <h4 className="text-sm font-semibold">{proj.title}</h4>
                  <span className="rounded bg-[hsl(var(--muted))] px-2 py-0.5 text-[10px] text-[hsl(var(--muted-foreground))] font-data">Outcome Verified</span>
                </div>
                <p className="mt-2 text-xs leading-relaxed text-[hsl(var(--muted-foreground))]">{proj.description}</p>
                {proj.impact && (
                  <p className="mt-2 text-xs font-medium text-[#86efac]">
                    ⚡ Impact: {proj.impact}
                  </p>
                )}
                {proj.techStack && proj.techStack.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {proj.techStack.map((tech, tIdx) => (
                      <span key={tIdx} className="rounded bg-[hsl(var(--secondary))] px-2 py-0.5 text-[10px] text-[hsl(var(--muted-foreground))]">
                        {tech}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))
          ) : (
            <p className="text-xs text-[hsl(var(--muted-foreground))]">No projects recorded yet. Complete onboarding or edit profile to add projects.</p>
          )}
        </div>
      </section>

      {/* Experience & Education */}
      <section className="surface rounded-2xl p-6 sm:p-7">
        <div className="flex items-center justify-between border-b border-[hsl(var(--border))] pb-4">
          <div className="flex items-center gap-2.5">
            <div className="grid h-8 w-8 place-items-center rounded-lg bg-[hsl(var(--accent))]/15 text-[hsl(var(--accent))]">
              <GraduationCap size={16} />
            </div>
            <div>
              <h3 className="font-display text-xl font-bold">Experience & Education</h3>
              <p className="text-xs text-[hsl(var(--muted-foreground))]">Track record & credentials</p>
            </div>
          </div>
          <Badge tone="quiet">Verified Record</Badge>
        </div>

        <div className="mt-5 space-y-4">
          {/* Work Experience */}
          {experience.map((exp, idx) => (
            <div key={idx} className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--background))]/50 p-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold">{exp.role}</p>
                <span className="text-xs text-[hsl(var(--muted-foreground))] font-data">{exp.duration}</span>
              </div>
              <p className="mt-0.5 text-xs text-[hsl(var(--accent))]">{exp.company}</p>
              {exp.highlights && (
                <ul className="mt-2 space-y-1 text-xs text-[hsl(var(--muted-foreground))]">
                  {exp.highlights.map((h, hIdx) => (
                    <li key={hIdx} className="flex items-start gap-1.5">
                      <span className="text-[hsl(var(--primary))]">•</span> {h}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}

          {/* Education */}
          {education.map((edu, idx) => (
            <div key={`edu-${idx}`} className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--background))]/50 p-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold">{edu.degree}</p>
                <span className="text-xs text-[hsl(var(--muted-foreground))] font-data">{edu.year}</span>
              </div>
              <p className="mt-0.5 text-xs text-[hsl(var(--muted-foreground))]">{edu.institution}</p>
              {edu.score && <p className="mt-1 text-xs font-semibold text-[#86efac]">Score: {edu.score}</p>}
            </div>
          ))}

          {/* Certifications */}
          {certifications.length > 0 && (
            <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--background))]/50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-[hsl(var(--primary))]">Certifications</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {certifications.map((cert, cIdx) => (
                  <span key={cIdx} className="rounded-md bg-[hsl(var(--muted))] px-2.5 py-1 text-xs text-[hsl(var(--foreground))]">
                    {cert.name} ({cert.issuer})
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>
    </div>

    {/* Bottom Actions Row */}
    <div className="mt-6 grid gap-5 lg:grid-cols-3">
      <section className="surface rounded-2xl p-6">
        <div className="flex items-center justify-between">
          <p className="eyebrow">Next Best Action</p>
          <Zap size={17} className="text-[hsl(var(--accent))]" />
        </div>
        <h3 className="mt-4 font-display text-2xl">{p.completedLearning ? 'Optimise your portfolio' : 'Complete SQL for decision makers'}</h3>
        <p className="mt-2 text-sm leading-6 text-[hsl(var(--muted-foreground))]">
          {p.completedLearning ? 'Your fit moved to 91%. Make your skill evidence easy to find.' : 'A focused 4h 20m module could move this match from 84% to 91%.'}
        </p>
        <Link href={p.completedLearning ? '/candidate/resume' : '/candidate/learning'} data-testid="link-next-action" className="mt-5 inline-flex items-center text-sm font-semibold text-[hsl(var(--primary))]">
          Continue <ArrowRight size={15} className="ml-2" />
        </Link>
      </section>

      <section className="surface rounded-2xl p-6">
        <p className="eyebrow">Applications</p>
        <div className="mt-4 flex items-end justify-between">
          <p className="font-data text-4xl">{p.applications?.length || 0}</p>
          <Badge tone="good">{(p.applications?.length || 0) > 0 ? `${p.applications.length} moving` : 'Ready to apply'}</Badge>
        </div>
        <div className="mt-5 flex gap-1">
          {['Applied', 'Review', 'Conversation', 'Decision'].map((s, i) => (
            <div key={s} className={`h-1.5 flex-1 rounded-full ${i < 2 ? 'bg-[hsl(var(--primary))]' : 'bg-[hsl(var(--muted))]'}`} />
          ))}
        </div>
        <Link href="/candidate/applications" data-testid="link-view-applications" className="mt-5 inline-flex items-center text-sm font-semibold text-[hsl(var(--primary))]">
          View your applications <ArrowRight size={15} className="ml-2" />
        </Link>
      </section>

      <section className="rounded-2xl bg-[#f8e6cf] p-6">
        <p className="eyebrow text-[#925d26]">AI Career Coach</p>
        <p className="mt-4 font-display text-2xl leading-tight">
          “Your {profile.targetRole || 'target role'} capability is grounded in verified evidence.”
        </p>
        <Link href="/candidate/assistant" data-testid="link-open-assistant" className="mt-5 inline-flex items-center text-sm font-semibold text-[#925d26]">
          Talk with Coach <MessageCircle size={15} className="ml-2" />
        </Link>
      </section>
    </div>
  </WorkspaceShell>;
}

function SkillPassport() {
  const p = useProduct();
  const [active, setActive] = useState(0);
  const profile = p.profile;
  const rawSkills = profile.skills || [];
  const skillsList = rawSkills.map((name, i) => ({
    name,
    level: 85 + (i % 12),
    evidence: `Demonstrated in ${profile.targetRole || 'engineering & product problem solving'}`,
    relevance: `Direct match for ${profile.targetCompany || 'enterprise roles'}`,
    color: ['#d98459', '#22d3ee', '#a78bfa', '#34d399', '#f59e0b', '#ec4899'][i % 6]
  }));
  const skill = skillsList[active] || skillsList[0] || null;
  const positions = [['18%', '20%'], ['68%', '16%'], ['14%', '68%'], ['70%', '67%'], ['40%', '82%'], ['82%', '45%']];

  if (!skill || rawSkills.length === 0) {
    return (
      <WorkspaceShell role="candidate">
        <PageTitle eyebrow="Skill passport" title="The work behind the words." description="A living map of demonstrated capability, with evidence you can carry into your next opportunity." />
        <EmptyState
          icon={Network}
          title="No verified skills mapped yet"
          body="Upload your resume or launch the onboarding assistant to map and verify your capabilities in the Skills Hub."
          action={
            <Link href="/candidate/onboarding" className="inline-flex min-h-10 items-center rounded-lg bg-[hsl(var(--primary))] px-4 text-sm font-semibold text-[hsl(var(--primary-foreground))]">
              Launch Onboarding <ArrowRight size={15} className="ml-2" />
            </Link>
          }
        />
      </WorkspaceShell>
    );
  }

  return <WorkspaceShell role="candidate"><PageTitle eyebrow="Skill passport" title="The work behind the words." description="A living map of demonstrated capability, with evidence you can carry into your next opportunity." /><div className="grid gap-5 lg:grid-cols-[1.2fr_.8fr]"><section className="surface rounded-2xl p-6 sm:p-8"><div className="flex items-center justify-between"><div><p className="eyebrow">Skill galaxy</p><h2 className="mt-2 font-display text-2xl">Connected capability</h2></div><Badge tone="good"><CheckCircle2 size={12} className="mr-1" /> {profile.readinessRating || 90}% verified</Badge></div><div className="relative mt-8 min-h-[340px] overflow-hidden rounded-2xl border border-[hsl(var(--border))] bg-[radial-gradient(circle_at_center,#25213b,transparent_52%),hsl(var(--background))]"><div className="absolute left-1/2 top-1/2 grid h-28 w-28 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-[hsl(var(--primary))]/55 bg-[hsl(var(--primary))]/15 text-center shadow-[0_0_55px_rgba(139,92,246,.25)]"><div><Network size={22} className="mx-auto text-[hsl(var(--primary))]" /><p className="mt-2 text-xs font-semibold">Verified<br />Capability</p></div></div>{skillsList.slice(0, 6).map((item, i) => <button key={item.name} onClick={() => setActive(i)} aria-label={`Inspect ${item.name}`} className={`absolute -translate-x-1/2 -translate-y-1/2 rounded-xl border px-3 py-2 text-left text-xs transition ${active === i ? 'border-white/60 bg-white/10 shadow-lg' : 'border-[hsl(var(--border))] bg-[hsl(var(--card))]'}`} style={{ left: positions[i % positions.length][0], top: positions[i % positions.length][1] }}><span className="flex items-center gap-2 font-semibold"><span className="h-2 w-2 rounded-full" style={{ background: item.color }} />{item.name}</span><span className="mt-1 block text-[10px] text-[hsl(var(--muted-foreground))]">{item.level}% demonstrated</span></button>)}</div><div className="mt-5 flex flex-wrap gap-2">{['Technical skills', 'Transferable skills', 'Projects', 'Certifications'].map((label, i) => <Badge key={label} tone={i === 1 ? 'good' : 'quiet'}>{label}</Badge>)}</div></section><aside className="surface rounded-2xl p-6"><p className="eyebrow">Selected signal</p><div className="mt-3 flex items-center gap-3"><span className="h-3 w-3 rounded-full" style={{ background: skill.color }} /><h2 className="font-display text-2xl">{skill.name}</h2></div><div className="mt-6"><div className="flex justify-between text-sm"><span>Proficiency</span><span className="font-data">{skill.level}%</span></div><Progress value={skill.level} /></div><div className="mt-6 border-t border-[hsl(var(--border))] pt-5"><p className="eyebrow">Evidence</p><p className="mt-2 text-sm leading-6">{skill.evidence}</p><p className="mt-5 eyebrow">Role relevance</p><p className="mt-2 text-sm leading-6 text-[hsl(var(--muted-foreground))]">{skill.relevance}</p></div><Link href="/candidate/resume" className="mt-6 inline-flex items-center text-sm font-semibold text-[hsl(var(--primary))]">Add more evidence <ArrowRight size={15} className="ml-2" /></Link></aside></div></WorkspaceShell>;
}
function BackgroundCheck() {
  const [status, setStatus] = useState<'not_started' | 'checking' | 'ready'>('not_started');
  useEffect(() => { if (status !== 'checking') return; const timer = window.setTimeout(() => setStatus('ready'), 1600); return () => window.clearTimeout(timer); }, [status]);
  const rows = [['Identity confirmation', 'Confirms the profile belongs to you'], ['Employment context', 'Keeps timeline context separate from fit'], ['Consent and privacy', 'You choose what to share with a hiring team']];
  return <WorkspaceShell role="candidate"><PageTitle eyebrow="Background check" title="Trust, with your consent." description="A transparent, simulated verification flow for the demo. Nothing is sent to an external service." action={<Badge tone={status === 'ready' ? 'good' : 'warm'}>{status === 'ready' ? 'Ready to review' : status === 'checking' ? 'Checking…' : 'Not started'}</Badge>} /><div className="grid gap-5 lg:grid-cols-[1fr_.8fr]"><section className="surface rounded-2xl p-6 sm:p-8"><div className="flex items-center gap-4"><div className="grid h-14 w-14 place-items-center rounded-2xl bg-[hsl(var(--secondary))] text-[hsl(var(--primary))]"><FileCheck2 size={25} /></div><div><h2 className="font-display text-2xl">A clear, limited check</h2><p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">Only signals you approve are shared.</p></div></div><div className="mt-8 grid gap-3">{rows.map(([title, body], i) => <div key={title} className="flex gap-3 rounded-xl bg-[hsl(var(--muted))] p-4"><span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[hsl(var(--success))]/15 text-xs text-[#86efac]">{status === 'ready' || i === 0 && status === 'checking' ? <Check size={13} /> : i + 1}</span><div><p className="text-sm font-semibold">{title}</p><p className="mt-1 text-xs leading-5 text-[hsl(var(--muted-foreground))]">{body}</p></div></div>)}</div>{status !== 'ready' ? <Button onClick={() => setStatus('checking')} disabled={status === 'checking'} data-testid="button-start-background-check" className="mt-7">{status === 'checking' ? <><RefreshCcw size={15} className="animate-spin" /> Checking securely…</> : <><ShieldCheck size={15} /> Start simulated check</>}</Button> : <div className="mt-7 rounded-xl border border-[hsl(var(--success))]/25 bg-[hsl(var(--success))]/10 p-4 text-sm text-[#86efac]"><CheckCircle2 size={16} className="mr-2 inline" /> Check complete. Your verified profile is ready for human review.</div>}</section><aside className="rounded-2xl bg-[hsl(var(--sidebar))] p-6 text-[hsl(var(--sidebar-foreground))]"><p className="eyebrow text-[hsl(var(--accent))]">Privacy promise</p><h2 className="mt-4 font-display text-2xl">Context is not a penalty.</h2><p className="mt-3 text-sm leading-6 text-[hsl(var(--sidebar-foreground))]/65">Career breaks remain context only. This prototype never uses them to reduce your match or rank.</p><div className="mt-7 border-t border-[hsl(var(--sidebar-foreground))]/15 pt-5 text-xs leading-5 text-[hsl(var(--sidebar-foreground))]/60"><p>Demo mode · mock verification</p><p className="mt-2">No documents leave this browser.</p></div></aside></div></WorkspaceShell>;
}
function ResumeSyncModal({
  open,
  onClose,
  currentProfile,
  onApply
}: {
  open: boolean;
  onClose: () => void;
  currentProfile: CandidateProfileData;
  onApply: (merged: CandidateProfileData) => Promise<void>;
}) {
  const { user } = useUser();
  const [stage, setStage] = useState<'upload' | 'analyzing' | 'review'>('upload');
  const [dragActive, setDragActive] = useState(false);
  const [showPaste, setShowPaste] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [loading, setLoading] = useState(false);
  const [extractedData, setExtractedData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  // Granular selection state
  const [applyIdentity, setApplyIdentity] = useState(true);
  const [applySummary, setApplySummary] = useState(true);
  const [applyTarget, setApplyTarget] = useState(true);
  const [applyBreak, setApplyBreak] = useState(true);
  const [selectedSkills, setSelectedSkills] = useState<Set<string>>(new Set());
  const [selectedProjects, setSelectedProjects] = useState<Set<number>>(new Set());
  const [selectedExperience, setSelectedExperience] = useState<Set<number>>(new Set());
  const [selectedEducation, setSelectedEducation] = useState<Set<number>>(new Set());
  const [selectedCerts, setSelectedCerts] = useState<Set<number>>(new Set());
  const [selectedAchievements, setSelectedAchievements] = useState<Set<number>>(new Set());

  const resetState = () => {
    setStage('upload');
    setPasteText('');
    setShowPaste(false);
    setExtractedData(null);
    setError(null);
  };

  const handleScan = async (fileOrText: File | string) => {
    setLoading(true);
    setStage('analyzing');
    setError(null);
    try {
      let rawText = '';
      let filename = 'resume.pdf';
      let fileBase64 = '';

      if (typeof fileOrText === 'string') {
        rawText = fileOrText;
        filename = 'pasted-resume.txt';
      } else {
        filename = fileOrText.name;
        try {
          rawText = await extractTextFromFile(fileOrText);
        } catch (err) {
          console.warn('Client extraction error:', err);
        }

        try {
          const buffer = await fileOrText.arrayBuffer();
          const bytes = new Uint8Array(buffer);
          let binary = '';
          const len = bytes.byteLength;
          for (let i = 0; i < len; i++) {
            binary += String.fromCharCode(bytes[i]);
          }
          fileBase64 = btoa(binary);
        } catch (err) {
          console.warn('Base64 encoding error:', err);
        }
      }

      if ((!rawText || rawText.trim().length < 5) && !fileBase64) {
        setError('The provided file or text is too short or unreadable. Please provide a valid resume.');
        setStage('upload');
        setLoading(false);
        return;
      }

      const res = await fetch('/api/candidate/profile/sync-resume', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: rawText,
          fileBase64,
          currentProfile,
          filename
        })
      });

      const resData = await res.json().catch(() => null);

      if (!res.ok || (resData && resData.success === false)) {
        const errorMsg = resData?.error || `Extraction service error (${res.status})`;
        setError(errorMsg);
        setStage('upload');
        setLoading(false);
        return;
      }

      const parsed: any = resData?.extracted || resData?.data;

      if (!parsed) {
        setError('No structured information could be extracted from this document.');
        setStage('upload');
        setLoading(false);
        return;
      }

      setExtractedData(parsed);

      // Normalize skills list
      const allSkills: string[] = (parsed.extractedSkills || [])
        .map((s: any) => (typeof s === 'string' ? s : s.name))
        .filter(Boolean);
      const combinedSkillsList = allSkills.length > 0 ? allSkills : (parsed.skills || []);

      // Pre-select all extracted items
      setSelectedSkills(new Set(combinedSkillsList));
      setSelectedProjects(new Set((parsed.projects || []).map((_: any, i: number) => i)));
      setSelectedExperience(new Set((parsed.experience || []).map((_: any, i: number) => i)));
      setSelectedEducation(new Set((parsed.education || []).map((_: any, i: number) => i)));
      setSelectedCerts(new Set((parsed.certifications || []).map((_: any, i: number) => i)));
      setSelectedAchievements(new Set((parsed.achievements || []).map((_: any, i: number) => i)));

      setApplyIdentity(true);
      setApplySummary(true);
      setApplyTarget(true);
      setApplyBreak(true);

      setStage('review');
    } catch (e: any) {
      console.error('Resume sync error:', e);
      setError(e.message || 'Error occurred while analyzing resume document.');
      setStage('upload');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmMerge = async () => {
    if (!extractedData) return;
    setLoading(true);
    try {
      const skillsList: string[] = (extractedData.extractedSkills || [])
        .map((s: any) => (typeof s === 'string' ? s : s.name))
        .filter(Boolean);
      const chosenSkills = (skillsList.length > 0 ? skillsList : (extractedData.skills || []))
        .filter((s: string) => selectedSkills.has(s));

      const chosenProjects = (extractedData.projects || []).filter((_: any, i: number) => selectedProjects.has(i));
      const chosenExperience = (extractedData.experience || []).filter((_: any, i: number) => selectedExperience.has(i));
      const chosenEducation = (extractedData.education || []).filter((_: any, i: number) => selectedEducation.has(i));
      const chosenCerts = (extractedData.certifications || []).filter((_: any, i: number) => selectedCerts.has(i));
      const chosenAchievements = (extractedData.achievements || []).filter((_: any, i: number) => selectedAchievements.has(i));

      // Combine existing with chosen new entries (deduplicating)
      const mergedSkills = Array.from(new Set([...(currentProfile.skills || []), ...chosenSkills]));
      const mergedProjects = [...(currentProfile.projects || []), ...chosenProjects];
      const mergedExperience = [...(currentProfile.experience || []), ...chosenExperience];
      const mergedEducation = [...(currentProfile.education || []), ...chosenEducation];
      const mergedCerts = [...(currentProfile.certifications || []), ...chosenCerts];
      const mergedAchievements = Array.from(new Set([...(currentProfile.achievements || []), ...chosenAchievements]));

      const finalProfile: CandidateProfileData = {
        ...currentProfile,
        name: applyIdentity && extractedData.candidateName && extractedData.candidateName !== 'Candidate' ? extractedData.candidateName : currentProfile.name || user?.fullName || '',
        email: applyIdentity && extractedData.email ? extractedData.email : currentProfile.email || user?.primaryEmailAddress?.emailAddress || '',
        phone: applyIdentity && extractedData.phone ? extractedData.phone : currentProfile.phone || '',
        location: applyIdentity && extractedData.location ? extractedData.location : currentProfile.location || '',
        summary: applySummary && extractedData.summary ? extractedData.summary : currentProfile.summary,
        targetRole: applyTarget && extractedData.targetRole ? extractedData.targetRole : currentProfile.targetRole,
        targetCompany: applyTarget && extractedData.targetCompany ? extractedData.targetCompany : currentProfile.targetCompany,
        workMode: applyTarget && extractedData.workMode ? extractedData.workMode : currentProfile.workMode,
        careerBreakYears: applyBreak && extractedData.careerBreakYears !== undefined ? extractedData.careerBreakYears : currentProfile.careerBreakYears,
        breakContext: applyBreak && extractedData.breakContext ? extractedData.breakContext : currentProfile.breakContext,
        skills: mergedSkills,
        projects: mergedProjects,
        experience: mergedExperience,
        education: mergedEducation,
        certifications: mergedCerts,
        achievements: mergedAchievements,
        readinessRating: Math.max(currentProfile.readinessRating || 85, extractedData.readinessRating || 88),
        fit: Math.max(currentProfile.fit || 80, 84)
      };

      await onApply(finalProfile);
      resetState();
      onClose();
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  const rawSkills: string[] = (extractedData?.extractedSkills || [])
    .map((s: any) => (typeof s === 'string' ? s : s.name))
    .filter(Boolean);
  const displaySkillsList = rawSkills.length > 0 ? rawSkills : (extractedData?.skills || []);

  const totalExtractedItems =
    displaySkillsList.length +
    (extractedData?.projects?.length || 0) +
    (extractedData?.experience?.length || 0) +
    (extractedData?.education?.length || 0) +
    (extractedData?.certifications?.length || 0) +
    (extractedData?.achievements?.length || 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="relative max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-3xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6 shadow-2xl sm:p-8">
        <button
          onClick={() => { resetState(); onClose(); }}
          className="absolute right-5 top-5 rounded-lg p-2 text-[hsl(var(--muted-foreground))] transition hover:bg-[hsl(var(--muted))] hover:text-[hsl(var(--foreground))]"
        >
          <X size={18} />
        </button>

        {stage === 'upload' && (
          <div>
            <div className="flex items-center gap-3">
              <div className="grid h-12 w-12 place-items-center rounded-2xl bg-[hsl(var(--primary))]/15 text-[hsl(var(--primary))]">
                <FileText size={24} />
              </div>
              <div>
                <h3 className="font-display text-2xl font-bold">Sync Profile with Resume</h3>
                <p className="text-xs text-[hsl(var(--muted-foreground))]">
                  Extract verified capabilities, projects, education, and work history. Select what to add without overwriting your verified profile.
                </p>
              </div>
            </div>

            {error && (
              <div className="mt-4 flex items-start gap-3 rounded-xl border border-[hsl(var(--destructive))]/40 bg-[hsl(var(--destructive))]/10 p-3.5 text-xs text-[hsl(var(--destructive))]">
                <AlertCircle size={16} className="mt-0.5 shrink-0 text-[hsl(var(--destructive))]" />
                <div className="flex-1">
                  <p className="font-semibold">Extraction Failed</p>
                  <p className="mt-0.5 leading-relaxed">{error}</p>
                </div>
                <button type="button" onClick={() => setError(null)} className="font-bold opacity-70 hover:opacity-100">✕</button>
              </div>
            )}

            <div
              onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
              onDragLeave={() => setDragActive(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragActive(false);
                const file = e.dataTransfer.files?.[0];
                if (file) handleScan(file);
              }}
              className={`mt-6 rounded-2xl border-2 border-dashed p-8 text-center transition ${dragActive ? 'border-[hsl(var(--primary))] bg-[hsl(var(--primary))]/10' : 'border-[hsl(var(--border))] bg-[hsl(var(--muted))]/30'}`}
            >
              <Upload size={38} className="mx-auto text-[hsl(var(--primary))]" />
              <p className="mt-3 font-semibold text-sm">Drop your resume document here</p>
              <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">Supports PDF, DOCX (Word), TXT, and MD formats</p>
              <label className="mt-5 inline-flex min-h-10 cursor-pointer items-center rounded-xl bg-[hsl(var(--primary))] px-6 text-xs font-semibold text-[hsl(var(--primary-foreground))] shadow transition hover:opacity-95">
                <input
                  type="file"
                  accept=".pdf,.doc,.docx,.txt,.md"
                  className="sr-only"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    e.target.value = '';
                    if (file) handleScan(file);
                  }}
                />
                Browse from Device
              </label>
            </div>

            <div className="mt-4 flex justify-center">
              <button
                type="button"
                onClick={() => setShowPaste(!showPaste)}
                className="text-xs font-semibold text-[hsl(var(--primary))] hover:underline"
              >
                {showPaste ? '▲ Hide direct text input' : '📋 Or paste resume text directly'}
              </button>
            </div>

            {showPaste && (
              <div className="mt-4 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] p-4">
                <textarea
                  value={pasteText}
                  onChange={(e) => setPasteText(e.target.value)}
                  placeholder="Paste your resume text here (Skills, Projects, Work Experience, Education)..."
                  className="min-h-32 w-full bg-transparent text-xs text-[hsl(var(--foreground))] focus:outline-none"
                />
                <div className="mt-3 flex justify-end">
                  <Button
                    onClick={() => handleScan(pasteText)}
                    disabled={!pasteText.trim() || loading}
                    size="sm"
                  >
                    Extract Capabilities <ArrowRight size={14} className="ml-1" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {stage === 'analyzing' && (
          <div className="py-16 text-center">
            <RefreshCcw size={42} className="mx-auto animate-spin text-[hsl(var(--primary))]" />
            <h3 className="mt-5 font-display text-2xl font-bold">Skills Discovery Agent at Work</h3>
            <p className="mt-2 text-xs text-[hsl(var(--muted-foreground))] max-w-md mx-auto leading-relaxed">
              Extracting demonstrable competencies, project artifacts, academic credentials, and certifying zero career gap penalty...
            </p>
          </div>
        )}

        {stage === 'review' && extractedData && (
          <div>
            <div className="flex flex-wrap items-center justify-between border-b border-[hsl(var(--border))] pb-4 gap-2">
              <div>
                <span className="eyebrow text-[hsl(var(--primary))]">Extracted Capability Signals</span>
                <h3 className="font-display text-2xl font-bold">Select Extracted Info to Sync</h3>
              </div>
              <Badge tone="good">✓ {totalExtractedItems} Items Discovered</Badge>
            </div>

            <p className="mt-3 text-xs leading-relaxed text-[hsl(var(--muted-foreground))]">
              Review everything extracted from your resume. Uncheck any items you don't want to add, then click <strong>"Save & Apply to Profile"</strong> to store in the database.
            </p>

            <div className="mt-5 space-y-4 max-h-[55vh] overflow-y-auto pr-1.5">
              {/* 1. Identity & Target Role Card */}
              <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] p-4">
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={applyIdentity && applyTarget}
                      onChange={(e) => {
                        setApplyIdentity(e.target.checked);
                        setApplyTarget(e.target.checked);
                      }}
                      className="h-4 w-4 accent-[hsl(var(--primary))]"
                    />
                    <span className="text-xs font-bold uppercase tracking-wider text-[hsl(var(--primary))]">
                      Candidate Identity & Target Direction
                    </span>
                  </label>
                  <Badge tone="quiet">{extractedData.workMode || 'Hybrid'}</Badge>
                </div>
                <div className="mt-3 grid gap-2 sm:grid-cols-2 text-xs">
                  <div className="rounded bg-[hsl(var(--muted))] p-2">
                    <span className="text-[10px] text-[hsl(var(--muted-foreground))]">Candidate Name:</span>
                    <p className="font-semibold">{extractedData.candidateName || user?.fullName || 'Candidate'}</p>
                  </div>
                  <div className="rounded bg-[hsl(var(--muted))] p-2">
                    <span className="text-[10px] text-[hsl(var(--muted-foreground))]">Target Role & Company:</span>
                    <p className="font-semibold">{extractedData.targetRole || 'Software Engineer'} @ {extractedData.targetCompany || 'your target company'}</p>
                  </div>
                  <div className="rounded bg-[hsl(var(--muted))] p-2">
                    <span className="text-[10px] text-[hsl(var(--muted-foreground))]">Contact Info:</span>
                    <p className="font-medium text-[hsl(var(--muted-foreground))]">{extractedData.email || user?.primaryEmailAddress?.emailAddress} {extractedData.phone ? `· ${extractedData.phone}` : ''}</p>
                  </div>
                  <div className="rounded bg-[hsl(var(--muted))] p-2">
                    <span className="text-[10px] text-[hsl(var(--muted-foreground))]">Location:</span>
                    <p className="font-semibold">{extractedData.location || 'India (Hybrid)'}</p>
                  </div>
                </div>
              </div>

              {/* 2. Executive Professional Summary */}
              {extractedData.summary && (
                <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] p-4">
                  <label className="flex items-start gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={applySummary}
                      onChange={(e) => setApplySummary(e.target.checked)}
                      className="mt-1 h-4 w-4 accent-[hsl(var(--primary))]"
                    />
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wider text-[hsl(var(--primary))]">Executive Professional Summary</p>
                      <p className="mt-1.5 text-xs leading-relaxed text-[hsl(var(--foreground))]">
                        "{extractedData.summary}"
                      </p>
                    </div>
                  </label>
                </div>
              )}

              {/* 3. Skills & Technologies */}
              {displaySkillsList.length > 0 && (
                <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-[hsl(var(--primary))] flex items-center gap-1.5">
                      <Sparkles size={14} /> Demonstrated Skills ({displaySkillsList.length})
                    </h4>
                    <button
                      type="button"
                      onClick={() => {
                        if (selectedSkills.size === displaySkillsList.length) {
                          setSelectedSkills(new Set());
                        } else {
                          setSelectedSkills(new Set(displaySkillsList));
                        }
                      }}
                      className="text-[11px] font-semibold text-[hsl(var(--primary))] hover:underline"
                    >
                      {selectedSkills.size === displaySkillsList.length ? 'Deselect all' : 'Select all'}
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {displaySkillsList.map((skill: string) => {
                      const isChecked = selectedSkills.has(skill);
                      return (
                        <button
                          key={skill}
                          type="button"
                          onClick={() => {
                            const next = new Set(selectedSkills);
                            if (isChecked) next.delete(skill);
                            else next.add(skill);
                            setSelectedSkills(next);
                          }}
                          className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${isChecked ? 'border-[hsl(var(--primary))] bg-[hsl(var(--primary))]/15 text-[hsl(var(--primary))]' : 'border-[hsl(var(--border))] bg-[hsl(var(--card))] text-[hsl(var(--muted-foreground))] opacity-50'}`}
                        >
                          <CheckCircle2 size={13} className={isChecked ? 'text-[hsl(var(--primary))]' : 'text-transparent'} />
                          {skill}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* 4. Projects & Technical Artifacts */}
              {extractedData.projects && extractedData.projects.length > 0 && (
                <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-[hsl(var(--primary))] flex items-center gap-1.5">
                      <Code size={14} /> Projects & Technical Artifacts ({extractedData.projects.length})
                    </h4>
                    <button
                      type="button"
                      onClick={() => {
                        if (selectedProjects.size === extractedData.projects.length) setSelectedProjects(new Set());
                        else setSelectedProjects(new Set(extractedData.projects.map((_: any, i: number) => i)));
                      }}
                      className="text-[11px] font-semibold text-[hsl(var(--primary))] hover:underline"
                    >
                      {selectedProjects.size === extractedData.projects.length ? 'Deselect all' : 'Select all'}
                    </button>
                  </div>
                  <div className="space-y-3">
                    {extractedData.projects.map((proj: any, idx: number) => {
                      const isChecked = selectedProjects.has(idx);
                      return (
                        <label
                          key={idx}
                          className={`flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition ${isChecked ? 'border-[hsl(var(--primary))]/60 bg-[hsl(var(--card))]' : 'border-[hsl(var(--border))] bg-[hsl(var(--muted))]/20 opacity-50'}`}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              const next = new Set(selectedProjects);
                              if (e.target.checked) next.add(idx);
                              else next.delete(idx);
                              setSelectedProjects(next);
                            }}
                            className="mt-1 h-4 w-4 accent-[hsl(var(--primary))]"
                          />
                          <div className="flex-1">
                            <p className="text-xs font-bold text-[hsl(var(--foreground))]">{proj.title}</p>
                            <p className="mt-1 text-[11px] leading-relaxed text-[hsl(var(--muted-foreground))]">{proj.description}</p>
                            {proj.impact && <p className="mt-1 text-[11px] font-semibold text-[#86efac]">⚡ {proj.impact}</p>}
                            {proj.techStack && (
                              <div className="mt-2 flex flex-wrap gap-1">
                                {proj.techStack.map((t: string, tIdx: number) => (
                                  <span key={tIdx} className="rounded bg-[hsl(var(--secondary))] px-2 py-0.5 text-[10px] font-medium">{t}</span>
                                ))}
                              </div>
                            )}
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* 5. Work Experience */}
              {extractedData.experience && extractedData.experience.length > 0 && (
                <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-[hsl(var(--primary))] flex items-center gap-1.5">
                      <BriefcaseBusiness size={14} /> Work & Leadership Experience ({extractedData.experience.length})
                    </h4>
                    <button
                      type="button"
                      onClick={() => {
                        if (selectedExperience.size === extractedData.experience.length) setSelectedExperience(new Set());
                        else setSelectedExperience(new Set(extractedData.experience.map((_: any, i: number) => i)));
                      }}
                      className="text-[11px] font-semibold text-[hsl(var(--primary))] hover:underline"
                    >
                      {selectedExperience.size === extractedData.experience.length ? 'Deselect all' : 'Select all'}
                    </button>
                  </div>
                  <div className="space-y-3">
                    {extractedData.experience.map((exp: any, idx: number) => {
                      const isChecked = selectedExperience.has(idx);
                      return (
                        <label
                          key={idx}
                          className={`flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition ${isChecked ? 'border-[hsl(var(--primary))]/60 bg-[hsl(var(--card))]' : 'border-[hsl(var(--border))] bg-[hsl(var(--muted))]/20 opacity-50'}`}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              const next = new Set(selectedExperience);
                              if (e.target.checked) next.add(idx);
                              else next.delete(idx);
                              setSelectedExperience(next);
                            }}
                            className="mt-1 h-4 w-4 accent-[hsl(var(--primary))]"
                          />
                          <div className="flex-1">
                            <div className="flex items-center justify-between">
                              <p className="text-xs font-bold text-[hsl(var(--foreground))]">{exp.role}</p>
                              <span className="text-[10px] text-[hsl(var(--muted-foreground))] font-data">{exp.duration}</span>
                            </div>
                            <p className="text-[11px] font-medium text-[hsl(var(--primary))]">{exp.company}</p>
                            {exp.highlights && (
                              <ul className="mt-1 space-y-0.5 text-[11px] text-[hsl(var(--muted-foreground))]">
                                {exp.highlights.map((h: string, hIdx: number) => (
                                  <li key={hIdx}>• {h}</li>
                                ))}
                              </ul>
                            )}
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* 6. Education & Academics */}
              {extractedData.education && extractedData.education.length > 0 && (
                <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-[hsl(var(--primary))] flex items-center gap-1.5">
                      <GraduationCap size={14} /> Education & Academic Credentials ({extractedData.education.length})
                    </h4>
                    <button
                      type="button"
                      onClick={() => {
                        if (selectedEducation.size === extractedData.education.length) setSelectedEducation(new Set());
                        else setSelectedEducation(new Set(extractedData.education.map((_: any, i: number) => i)));
                      }}
                      className="text-[11px] font-semibold text-[hsl(var(--primary))] hover:underline"
                    >
                      {selectedEducation.size === extractedData.education.length ? 'Deselect all' : 'Select all'}
                    </button>
                  </div>
                  <div className="space-y-2">
                    {extractedData.education.map((edu: any, idx: number) => {
                      const isChecked = selectedEducation.has(idx);
                      return (
                        <label key={idx} className={`flex items-center gap-2.5 rounded-lg border p-3 text-xs cursor-pointer transition ${isChecked ? 'border-[hsl(var(--primary))]/60 bg-[hsl(var(--card))]' : 'border-[hsl(var(--border))] bg-[hsl(var(--muted))]/20 opacity-50'}`}>
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              const next = new Set(selectedEducation);
                              if (e.target.checked) next.add(idx);
                              else next.delete(idx);
                              setSelectedEducation(next);
                            }}
                            className="h-4 w-4 accent-[hsl(var(--primary))]"
                          />
                          <div className="flex-1 flex items-center justify-between">
                            <div>
                              <p className="font-bold text-[hsl(var(--foreground))]">{edu.degree}</p>
                              <p className="text-[11px] text-[hsl(var(--muted-foreground))]">{edu.institution} {edu.score ? `· ${edu.score}` : ''}</p>
                            </div>
                            <span className="font-mono text-[11px] text-[hsl(var(--muted-foreground))]">{edu.year}</span>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* 7. Certifications & Achievements */}
              {((extractedData.certifications && extractedData.certifications.length > 0) || (extractedData.achievements && extractedData.achievements.length > 0)) && (
                <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] p-4">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-[hsl(var(--primary))] flex items-center gap-1.5 mb-3">
                    <Award size={14} /> Certifications & Achievements
                  </h4>
                  <div className="space-y-2">
                    {(extractedData.certifications || []).map((cert: any, idx: number) => {
                      const isChecked = selectedCerts.has(idx);
                      return (
                        <label key={`cert-${idx}`} className={`flex items-center gap-2.5 rounded-lg border p-2.5 text-xs cursor-pointer ${isChecked ? 'border-[hsl(var(--primary))]/60 bg-[hsl(var(--card))]' : 'border-[hsl(var(--border))] opacity-50'}`}>
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              const next = new Set(selectedCerts);
                              if (e.target.checked) next.add(idx);
                              else next.delete(idx);
                              setSelectedCerts(next);
                            }}
                            className="h-4 w-4 accent-[hsl(var(--primary))]"
                          />
                          <div className="flex-1 flex items-center justify-between">
                            <div>
                              <span className="font-bold">{cert.name}</span>
                              <span className="text-[11px] text-[hsl(var(--muted-foreground))] ml-2">({cert.issuer})</span>
                            </div>
                            {cert.year && <span className="font-mono text-[11px] text-[hsl(var(--muted-foreground))]">{cert.year}</span>}
                          </div>
                        </label>
                      );
                    })}
                    {(extractedData.achievements || []).map((ach: string, idx: number) => {
                      const isChecked = selectedAchievements.has(idx);
                      return (
                        <label key={`ach-${idx}`} className={`flex items-center gap-2.5 rounded-lg border p-2.5 text-xs cursor-pointer ${isChecked ? 'border-[hsl(var(--accent))]/60 bg-[hsl(var(--accent))]/5' : 'border-[hsl(var(--border))] opacity-50'}`}>
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              const next = new Set(selectedAchievements);
                              if (e.target.checked) next.add(idx);
                              else next.delete(idx);
                              setSelectedAchievements(next);
                            }}
                            className="h-4 w-4 accent-[hsl(var(--accent))]"
                          />
                          <Trophy size={14} className="text-[hsl(var(--accent))]" />
                          <span className="font-medium text-[hsl(var(--foreground))]">{ach}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            <div className="mt-6 flex flex-wrap items-center justify-between border-t border-[hsl(var(--border))] pt-4 gap-3">
              <button
                type="button"
                onClick={() => setStage('upload')}
                className="text-xs font-semibold text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
              >
                ← Scan different resume file
              </button>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => { resetState(); onClose(); }}>
                  Cancel
                </Button>
                <Button size="sm" onClick={handleConfirmMerge} disabled={loading}>
                  {loading ? 'Saving to Skills Hub...' : 'Save & Apply to Profile'} <Check size={14} className="ml-1" />
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function CandidateProfile() {
  const p = useProduct();
  const { user } = useUser();
  const [editing, setEditing] = useState(false); 
  const [saved, setSaved] = useState(false);
  const [syncModalOpen, setSyncModalOpen] = useState(false);
  const [form, setForm] = useState<CandidateProfileData>(p.profile);

  useEffect(() => {
    setForm(p.profile);
  }, [p.profile]);

  useEffect(() => {
    if (user?.id) {
      fetch('/api/candidate/profile')
        .then(r => r.json())
        .then(data => {
          if (data?.profile && data.profile.name) {
            setForm(data.profile);
            p.updateProfile(data.profile);
          }
        })
        .catch(() => {});
    }
  }, [user?.id]);

  const name = form.name || user?.fullName || user?.firstName || '';
  const email = form.email || user?.primaryEmailAddress?.emailAddress || '';
  const initials = user?.firstName ? `${user.firstName[0]}${user.lastName ? user.lastName[0] : ''}` : (name ? name.slice(0, 2).toUpperCase() : 'CD');

  const [recalculatingFit, setRecalculatingFit] = useState(false);

  const handleRecalculateFit = async () => {
    setRecalculatingFit(true);
    try {
      const realMetrics = calculateRealReadiness(form);
      const updatedForm = {
        ...form,
        readinessRating: realMetrics.profileSignal,
        skillEvidence: realMetrics.skillEvidence,
        readinessTier: realMetrics.readinessTier,
      };
      await p.updateProfile(updatedForm);
      const res = await fetch('/api/candidate/match/recalculate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await res.json();
      if (data?.match) {
        p.setLatestMatch(data.match);
        if (typeof data.match.overallFitScore === 'number') {
          p.setFit(data.match.overallFitScore);
          const finalProfile = {
            ...updatedForm,
            fit: data.match.overallFitScore,
            latestMatch: data.match,
          };
          setForm(finalProfile);
          await p.updateProfile(finalProfile);
        }
        p.notify(`Fit score updated to ${data.match.overallFitScore}% based on your latest capabilities!`);
      } else {
        p.notify(data?.error || 'Unable to update fit score at this time.');
      }
    } catch {
      p.notify('Failed to reach AI Skills Matching Agent.');
    } finally {
      setRecalculatingFit(false);
    }
  };

  const handleSave = async () => {
    const realMetrics = calculateRealReadiness(form);
    const updated = {
      ...form,
      readinessRating: realMetrics.profileSignal,
      skillEvidence: realMetrics.skillEvidence,
      readinessTier: realMetrics.readinessTier
    };
    setForm(updated);
    await p.updateProfile(updated);
    setSaved(true);
    setEditing(false);
    p.notify('Comprehensive profile saved to Skills Intelligence Platform.');
  };

  return (
    <WorkspaceShell role="candidate">
      <ResumeSyncModal
        open={syncModalOpen}
        onClose={() => setSyncModalOpen(false)}
        currentProfile={form}
        onApply={async (updated) => {
          const realMetrics = calculateRealReadiness(updated);
          const finalProfile = {
            ...updated,
            readinessRating: realMetrics.profileSignal,
            skillEvidence: realMetrics.skillEvidence,
            readinessTier: realMetrics.readinessTier,
          };
          setForm(finalProfile);
          await p.updateProfile(finalProfile);
          p.notify('Profile successfully updated from resume.');
        }}
      />
      <PageTitle
        eyebrow="My profile · Skills Intelligence Platform"
        title="Comprehensive Capability Profile"
        description="Every project, skill, and achievement is verified without timeline penalties. Keep your career story human and accurate."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setSyncModalOpen(true)}
              className="inline-flex min-h-9 items-center rounded-lg border border-[hsl(var(--primary))]/40 bg-[hsl(var(--primary))]/10 px-3 text-xs font-semibold text-[hsl(var(--primary))] transition hover:bg-[hsl(var(--primary))]/20 shadow-sm"
            >
              <Sparkles size={14} className="mr-1.5 text-[hsl(var(--primary))]" /> Sync with Resume
            </button>
            <Button
              onClick={handleRecalculateFit}
              disabled={recalculatingFit}
              className="bg-[hsl(var(--primary))] text-white shadow-sm"
              data-testid="button-recalculate-fit-top"
            >
              <RefreshCcw size={14} className={recalculatingFit ? "animate-spin mr-1.5" : "mr-1.5"} />
              {recalculatingFit ? "Recalculating..." : "Update Fit Score"}
            </Button>
            <Button onClick={() => setEditing(!editing)} data-testid="button-edit-profile" variant="outline">
              <Pencil size={15} /> {editing ? 'Cancel' : 'Edit profile'}
            </Button>
            {editing && (
              <Button onClick={handleSave} data-testid="button-save-profile">
                {saved ? 'Saved' : 'Save all changes'}
              </Button>
            )}
          </div>
        }
      />

      {/* Dedicated AI Skills Matching Agent Fit Banner */}
      <section className="mb-6 surface rounded-2xl border-2 border-[hsl(var(--primary))]/20 bg-gradient-to-r from-[hsl(var(--primary))]/10 via-[hsl(var(--card))] to-transparent p-5 sm:p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[hsl(var(--primary))]/15 text-[hsl(var(--primary))]">
              <Radar size={24} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <p className="eyebrow text-[hsl(var(--primary))]">AI Skills Matching Agent</p>
                <Badge tone="good"><CheckCircle2 size={12} className="mr-1" /> Locked & Persisted</Badge>
                {Number(form.careerBreakYears) > 0 ? (
                  <Badge tone="quiet">0% Break Penalty</Badge>
                ) : (
                  <Badge tone="good">100% Skills-First</Badge>
                )}
              </div>
              <h3 className="mt-1 font-display text-2xl">
                Capability Fit Score: <span className="text-[hsl(var(--primary))]">{p.fit || p.latestMatch?.overallFitScore || form.fit || 84}%</span>
              </h3>
              <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">
                Stored in Cloud Database. Score is preserved across page reloads and only updates when you explicitly calibrate with new skills or projects.
              </p>
            </div>
          </div>
          <Button
            onClick={handleRecalculateFit}
            disabled={recalculatingFit}
            size="lg"
            className="bg-[hsl(var(--primary))] text-white shadow transition hover:brightness-105"
            data-testid="button-recalculate-fit-card"
          >
            <RefreshCcw size={15} className={recalculatingFit ? "animate-spin mr-2" : "mr-2"} />
            {recalculatingFit ? "Calibrating Capability Fit..." : "Update Fit Score"}
          </Button>
        </div>
        {p.latestMatch?.breakNeutralityExplanation && Number(form.careerBreakYears) > 0 && (
          <div className="mt-4 rounded-xl border border-[hsl(var(--primary))]/15 bg-[hsl(var(--primary))]/5 p-3 text-xs text-[hsl(var(--muted-foreground))]">
            <span className="font-semibold text-[hsl(var(--primary))]">Inclusive Workforce Protocol: </span>
            {p.latestMatch.breakNeutralityExplanation}
          </div>
        )}
      </section>

      <div className="grid gap-6 lg:grid-cols-[1fr_.95fr]">
        {/* Left Column: Core Identity, Summary, Target & Break Context */}
        <div className="space-y-6">
          {/* Identity & Summary Card */}
          <section className="surface rounded-2xl p-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                {user?.imageUrl ? (
                  <img src={user.imageUrl} alt={name} className="h-16 w-16 rounded-full border border-[hsl(var(--border))]" />
                ) : (
                  <div className="grid h-16 w-16 place-items-center rounded-full bg-[#d98459] font-semibold text-xl text-white">
                    {initials}
                  </div>
                )}
                <div>
                  <h2 className="font-display text-2xl">{name}</h2>
                  <p className="text-sm font-medium text-[hsl(var(--primary))]">{form.targetRole || 'Software Engineer / Capability Explorer'}</p>
                  <p className="mt-0.5 text-xs text-[hsl(var(--muted-foreground))]">
                    📍 {form.location || 'Bangalore (Hybrid)'} · ✉️ {email} {form.phone ? `· 📞 ${form.phone}` : ''}
                  </p>
                </div>
              </div>
              <div className="flex flex-col items-end gap-1.5">
                <Badge tone="good">
                  <CheckCircle2 size={13} className="mr-1" /> Verified Talent Passport
                </Badge>
                <span className="text-[11px] font-semibold text-[hsl(var(--primary))]">
                  🎯 {form.readinessRating || 88}% Readiness Rating
                </span>
              </div>
            </div>

            <div className="mt-6 border-t border-[hsl(var(--border))] pt-5">
              <p className="eyebrow">Professional Summary</p>
              {editing ? (
                <textarea
                  value={form.summary || ''}
                  onChange={e => setForm({ ...form, summary: e.target.value })}
                  placeholder="Enter a brief summary of your expertise, background, and goals..."
                  className="mt-2 min-h-20 w-full rounded-lg border border-[hsl(var(--input))] bg-transparent p-3 text-sm"
                />
              ) : (
                <p className="mt-2 text-sm leading-6 text-[hsl(var(--muted-foreground))]">
                  {form.summary || `${name} brings demonstrable problem solving, collaborative execution, and verified technical capabilities targeted towards ${form.targetRole || 'engineering roles'}.`}
                </p>
              )}
            </div>

            {/* Core Strengths Chips */}
            {form.topStrengths && form.topStrengths.length > 0 && (
              <div className="mt-5 border-t border-[hsl(var(--border))] pt-4">
                <p className="eyebrow text-xs">Core Strengths</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {form.topStrengths.map((str, i) => (
                    <span key={i} className="inline-flex items-center gap-1 rounded-full bg-[hsl(var(--primary))]/10 px-3 py-1 text-xs font-semibold text-[hsl(var(--primary))]">
                      <Star size={12} className="text-[#b8783d]" /> {str}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-6 grid gap-4 border-t border-[hsl(var(--border))] pt-5 sm:grid-cols-3">
              <div>
                <p className="text-xs text-[hsl(var(--muted-foreground))]">Target Role</p>
                {editing ? (
                  <input
                    value={form.targetRole}
                    onChange={e => setForm({ ...form, targetRole: e.target.value })}
                    className="mt-1 w-full rounded border border-[hsl(var(--input))] bg-transparent p-1.5 text-xs"
                  />
                ) : (
                  <p className="mt-1 text-sm font-semibold">{form.targetRole || 'Not specified'}</p>
                )}
              </div>
              <div>
                <p className="text-xs text-[hsl(var(--muted-foreground))]">Target Company</p>
                {editing ? (
                  <input
                    value={form.targetCompany}
                    onChange={e => setForm({ ...form, targetCompany: e.target.value })}
                    className="mt-1 w-full rounded border border-[hsl(var(--input))] bg-transparent p-1.5 text-xs"
                  />
                ) : (
                  <p className="mt-1 text-sm font-semibold">{form.targetCompany || 'Flexible / enterprise companies'}</p>
                )}
              </div>
              <div>
                <p className="text-xs text-[hsl(var(--muted-foreground))]">Work Mode</p>
                {editing ? (
                  <input
                    value={form.workMode}
                    onChange={e => setForm({ ...form, workMode: e.target.value })}
                    className="mt-1 w-full rounded border border-[hsl(var(--input))] bg-transparent p-1.5 text-xs"
                  />
                ) : (
                  <p className="mt-1 text-sm font-semibold">{form.workMode || 'Hybrid'}</p>
                )}
              </div>
            </div>
          </section>

          {/* Experience & Leadership History */}
          <section className="surface rounded-2xl p-6">
            <div className="flex items-center justify-between">
              <p className="eyebrow">Work & Leadership Experience</p>
              <BriefcaseBusiness size={16} className="text-[hsl(var(--primary))]" />
            </div>
            {form.experience && form.experience.length > 0 ? (
              <div className="mt-4 space-y-4">
                {form.experience.map((exp, idx) => (
                  <div key={idx} className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h3 className="font-semibold text-sm">{exp.role}</h3>
                      <span className="text-xs font-medium text-[hsl(var(--muted-foreground))]">{exp.duration}</span>
                    </div>
                    <p className="mt-0.5 text-xs font-medium text-[hsl(var(--primary))]">{exp.company}</p>
                    <ul className="mt-2.5 list-disc pl-4 space-y-1 text-xs text-[hsl(var(--muted-foreground))]">
                      {(exp.highlights || []).map((h, i) => (
                        <li key={i}>{h}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-4 rounded-xl border border-dashed border-[hsl(var(--border))] p-6 text-center text-xs text-[hsl(var(--muted-foreground))]">
                <BriefcaseBusiness size={20} className="mx-auto text-[hsl(var(--muted-foreground))]/60 mb-2" />
                <p className="font-semibold text-sm text-[hsl(var(--foreground))]">No prior corporate experience listed</p>
                <p className="mt-1">For students or recent graduates, project artifacts and skills demonstrate capability.</p>
              </div>
            )}
          </section>

          {/* Education & Academic Credentials */}
          <section className="surface rounded-2xl p-6">
            <div className="flex items-center justify-between">
              <p className="eyebrow">Education & Academics</p>
              <GraduationCap size={16} className="text-[hsl(var(--primary))]" />
            </div>
            {form.education && form.education.length > 0 ? (
              <div className="mt-4 space-y-3">
                {form.education.map((edu, idx) => (
                  <div key={idx} className="flex items-start justify-between rounded-xl bg-[hsl(var(--muted))] p-3.5 text-xs">
                    <div>
                      <p className="font-semibold text-sm text-[hsl(var(--foreground))]">{edu.degree}</p>
                      <p className="mt-0.5 text-[hsl(var(--muted-foreground))]">{edu.institution}</p>
                      {edu.score && <span className="mt-1 inline-block text-[11px] font-semibold text-[hsl(var(--primary))]">Grade: {edu.score}</span>}
                    </div>
                    <span className="rounded bg-[hsl(var(--card))] px-2 py-1 font-mono text-[11px]">{edu.year}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-4 rounded-xl border border-dashed border-[hsl(var(--border))] p-6 text-center text-xs text-[hsl(var(--muted-foreground))]">
                <GraduationCap size={20} className="mx-auto text-[hsl(var(--muted-foreground))]/60 mb-2" />
                <p className="font-semibold text-sm text-[hsl(var(--foreground))]">No academic history listed yet</p>
                <p className="mt-1">Upload your resume or chat with your AI Coach to discover your degrees and coursework.</p>
              </div>
            )}
          </section>
        </div>

        {/* Right Column: Projects, Skills, Certifications & Achievements */}
        <div className="space-y-6">
          {/* Projects & Technical Artifacts */}
          <section className="surface rounded-2xl p-6">
            <div className="flex items-center justify-between">
              <p className="eyebrow">Projects & Technical Artifacts</p>
              <Code size={16} className="text-[hsl(var(--primary))]" />
            </div>
            {form.projects && form.projects.length > 0 ? (
              <div className="mt-4 space-y-4">
                {form.projects.map((proj, idx) => (
                  <div key={idx} className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] p-4">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold text-sm">{proj.title}</h3>
                      <Badge tone="good">Demonstrated</Badge>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {(proj.techStack || []).map((tech, tIdx) => (
                        <span key={tIdx} className="rounded bg-[hsl(var(--secondary))] px-2 py-0.5 text-[11px] font-medium text-[hsl(var(--secondary-foreground))]">
                          {tech}
                        </span>
                      ))}
                    </div>
                    <p className="mt-2.5 text-xs leading-5 text-[hsl(var(--muted-foreground))]">{proj.description}</p>
                    {proj.impact && (
                      <div className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-[hsl(var(--primary))]">
                        <Zap size={12} /> Impact: {proj.impact}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-4 rounded-xl border border-dashed border-[hsl(var(--border))] p-6 text-center text-xs text-[hsl(var(--muted-foreground))]">
                <Code size={20} className="mx-auto text-[hsl(var(--muted-foreground))]/60 mb-2" />
                <p className="font-semibold text-sm text-[hsl(var(--foreground))]">No technical projects listed yet</p>
                <p className="mt-1">Projects provide the strongest evidence for recruiters in the Skills Intelligence Platform.</p>
              </div>
            )}
          </section>

          {/* Demonstrated Skills & Tools */}
          <section className="surface rounded-2xl p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="eyebrow">Skills Intelligence Platform</p>
                <h2 className="mt-1 font-display text-xl">Demonstrated Capabilities</h2>
              </div>
              <Badge tone="good"><CheckCircle2 size={12} className="mr-1" /> 91% Verified</Badge>
            </div>
            {form.skills && form.skills.length > 0 ? (
              <div className="mt-5 flex flex-wrap gap-2">
                {form.skills.map(skill => (
                  <span key={skill} className="inline-flex items-center gap-1.5 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-2 text-xs font-medium">
                    <CheckCircle2 size={13} className="text-[hsl(var(--primary))]" />
                    {skill}
                  </span>
                ))}
              </div>
            ) : (
              <div className="mt-5 rounded-xl border border-dashed border-[hsl(var(--border))] p-6 text-center text-xs text-[hsl(var(--muted-foreground))]">
                <p className="font-semibold text-sm text-[hsl(var(--foreground))]">No verified skills mapped yet</p>
                <p className="mt-1">Launch onboarding or upload your resume to map your skills ontology.</p>
              </div>
            )}
          </section>

          {/* Certifications & Achievements */}
          <section className="surface rounded-2xl p-6">
            <div className="flex items-center justify-between">
              <p className="eyebrow">Certifications & Achievements</p>
              <Award size={16} className="text-[hsl(var(--accent))]" />
            </div>

            {(form.certifications && form.certifications.length > 0) || (form.achievements && form.achievements.length > 0) ? (
              <div className="mt-4 space-y-3">
                {(form.certifications || []).map((cert, idx) => (
                  <div key={idx} className="flex items-center justify-between rounded-xl bg-[hsl(var(--muted))] p-3 text-xs">
                    <div>
                      <p className="font-semibold text-[hsl(var(--foreground))]">{cert.name}</p>
                      <p className="text-[hsl(var(--muted-foreground))]">{cert.issuer}</p>
                    </div>
                    {cert.year && <span className="font-mono text-[11px] text-[hsl(var(--muted-foreground))]">{cert.year}</span>}
                  </div>
                ))}

                {(form.achievements || []).map((ach, idx) => (
                  <div key={idx} className="flex items-center gap-2.5 rounded-xl border border-[hsl(var(--accent))]/20 bg-[hsl(var(--accent))]/5 p-3 text-xs">
                    <Trophy size={15} className="shrink-0 text-[hsl(var(--accent))]" />
                    <span className="font-medium text-[hsl(var(--foreground))]">{ach}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-4 rounded-xl border border-dashed border-[hsl(var(--border))] p-6 text-center text-xs text-[hsl(var(--muted-foreground))]">
                <Trophy size={20} className="mx-auto text-[hsl(var(--muted-foreground))]/60 mb-2" />
                <p className="font-semibold text-sm text-[hsl(var(--foreground))]">No certifications or honors listed yet</p>
                <p className="mt-1">Add your certifications, licenses, hackathon wins, or publications.</p>
              </div>
            )}
          </section>
        </div>
      </div>
    </WorkspaceShell>
  );
}
function CandidateOnboarding() {
  const { user } = useUser();
  const { isLoaded, isSignedIn } = useAuth();
  const [, setLocation] = useLocation();
  const p = useProduct();

  // Mode: null (selector) | 'resume' | 'chat' | 'form' | 'reveal'
  const [mode, setMode] = useState<'select' | 'resume' | 'chat' | 'form' | 'reveal'>('select');
  const [loading, setLoading] = useState(false);

  // Profile data collected across any pathway — initialized cleanly with logged-in user data
  const [profile, setProfile] = useState<CandidateProfileData>(() => {
    // Purge mock phone or mock caregiving summary from previous sessions
    if (p.profile.phone?.includes('98765') || p.profile.summary?.includes('caregiving') || p.profile.summary?.includes('Strategic Product Operations')) {
      return createCleanProfile(user?.fullName || user?.firstName || '', user?.primaryEmailAddress?.emailAddress || '');
    }
    if (p.profile.name && p.profile.name.trim().length > 0 && p.profile.name !== 'Candidate') return p.profile;
    return createCleanProfile(user?.fullName || user?.firstName || '', user?.primaryEmailAddress?.emailAddress || '');
  });

  const [isChatComplete, setIsChatComplete] = useState(false);

  // Separately store extracted data so review always shows fresh extraction, not stale context profile
  const [extractedProfile, setExtractedProfile] = useState<CandidateProfileData | null>(null);

  // Resume Upload State
  const [resumeText, setResumeText] = useState('');
  const [uploadStage, setUploadStage] = useState<'idle' | 'parsing' | 'review' | 'target'>('idle');
  const [dragActive, setDragActive] = useState(false);
  const [showPasteArea, setShowPasteArea] = useState(false);
  const [pasteInput, setPasteInput] = useState('');
  const [onboardError, setOnboardError] = useState<string | null>(null);

  // AI Coach Onboarding State
  const [chatMessages, setChatMessages] = useState<Array<{ role: 'assistant' | 'user'; content: string }>>([
    {
      role: 'assistant',
      content: `Hi ${user?.firstName || 'there'}! I'm SensAI, your AI career coach. Let's build your verified capability profile together.\n\nTo get started, what's your full name and current city/location?`
    }
  ]);
  const [chatInput, setChatInput] = useState('');

  // Form Step State
  const [formStep, setFormStep] = useState(1);

  useEffect(() => {
    if (isLoaded && !isSignedIn) {
      setLocation('/auth/candidate');
    } else if (isLoaded && isSignedIn && (p.isOnboarded || localStorage.getItem('rp-onboarded') === 'true') && (p.profile.skills?.length > 0 || p.profile.targetRole)) {
      setLocation('/candidate');
    }
  }, [isLoaded, isSignedIn, p.isOnboarded, p.profile.skills?.length, p.profile.targetRole, setLocation]);

  if (!isLoaded) {
    return <div className="grid min-h-[100dvh] place-items-center bg-[#dfe9e4]"><RefreshCcw size={22} className="animate-spin text-[hsl(var(--primary))]" /></div>;
  }
  if (!isSignedIn) return null;

  // Handle Resume Parsing with full File & PDF text extraction support
  async function handleResumeParse(fileOrText?: File | string) {
    setLoading(true);
    setUploadStage('parsing');
    setOnboardError(null);
    try {
      let textToSend = '';
      let fileName = 'resume.pdf';
      let fileBase64 = '';

      if (fileOrText instanceof File) {
        fileName = fileOrText.name;
        try {
          textToSend = await extractTextFromFile(fileOrText);
        } catch (e) {
          console.warn('Client-side file text extraction error:', e);
        }

        try {
          const buffer = await fileOrText.arrayBuffer();
          const bytes = new Uint8Array(buffer);
          let binary = '';
          const len = bytes.byteLength;
          for (let i = 0; i < len; i++) {
            binary += String.fromCharCode(bytes[i]);
          }
          fileBase64 = btoa(binary);
        } catch (bErr) {
          console.warn('Base64 encoding error:', bErr);
        }
      } else if (typeof fileOrText === 'string' && fileOrText.trim()) {
        textToSend = fileOrText.trim();
        fileName = 'pasted-text.txt';
      } else if (resumeText.trim()) {
        textToSend = resumeText.trim();
      }

      if ((!textToSend || textToSend.trim().length < 5) && !fileBase64) {
        setOnboardError('Please provide a readable resume file or paste at least a few sentences of profile details.');
        setUploadStage('idle');
        setLoading(false);
        return;
      }

      const res = await fetch('/api/candidate/onboarding/resume', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: textToSend,
          filename: fileName,
          fileBase64,
        })
      });
      const json = await res.json().catch(() => null);

      if (!res.ok || (json && json.success === false)) {
        const errMsg = json?.error || `Extraction failed with status ${res.status}`;
        setOnboardError(errMsg);
        setUploadStage('idle');
        setLoading(false);
        return;
      }

      if (json?.data) {
        const d = json.data;
        const updated: CandidateProfileData = {
          ...createCleanProfile(
            d.candidateName && d.candidateName !== 'Candidate' ? d.candidateName : (user?.fullName || user?.firstName || ''),
            d.email || user?.primaryEmailAddress?.emailAddress || ''
          ),
          phone: d.phone || '',
          location: d.location || 'India',
          summary: d.summary || '',
          targetRole: d.targetRole || 'Software Engineer',
          targetCompany: d.targetCompany || 'your target company',
          workMode: d.workMode || 'Hybrid',
          careerBreakYears: 0,
          breakContext: '',
          skills: d.extractedSkills && d.extractedSkills.length > 0
            ? d.extractedSkills.map((s: any) => typeof s === 'string' ? s : s.name).filter(Boolean)
            : (d.skills && d.skills.length > 0 ? d.skills : []),
          education: d.education && d.education.length > 0 ? d.education : [],
          projects: d.projects && d.projects.length > 0 ? d.projects : [],
          experience: d.experience && d.experience.length > 0 ? d.experience : [],
          certifications: d.certifications && d.certifications.length > 0 ? d.certifications : [],
          achievements: d.achievements && d.achievements.length > 0 ? d.achievements : [],
          topStrengths: d.topStrengths && d.topStrengths.length > 0 ? d.topStrengths : []
        };
        // Store separately so the review stage always shows fresh extracted data
        setExtractedProfile(updated);
        setProfile(updated);
        await p.updateProfile(updated);
      } else {
        setOnboardError('The server returned a successful response but no extracted profile data was found. Please try again or paste your resume text.');
        setUploadStage('idle');
        setLoading(false);
        return;
      }
      setUploadStage('review');
    } catch (e: any) {
      setOnboardError(e.message || 'An error occurred during resume extraction.');
      setUploadStage('idle');
    } finally {
      setLoading(false);
    }
  }

  function handlePasteParse() {
    if (!pasteInput.trim()) {
      setOnboardError('Please paste some resume or career profile text before extracting.');
      return;
    }
    handleResumeParse(pasteInput);
  }

  // Handle AI Coach Onboarding Chat
  async function sendChatMessage(preset?: string) {
    const userMsg = (preset || chatInput).trim();
    if (!userMsg || loading) return;
    setChatMessages(m => [...m, { role: 'user', content: userMsg }]);
    if (!preset) setChatInput('');
    setLoading(true);

    try {
      const res = await fetch('/api/candidate/onboarding/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMsg,
          history: chatMessages,
          currentProfile: profile
        })
      });
      const data = await res.json().catch(() => null);

      if (!res.ok || (data && data.success === false)) {
        const errMsg = data?.error || `AI agent error (${res.status})`;
        setChatMessages(m => [...m, { role: 'assistant', content: `⚠️ Error: ${errMsg}` }]);
        return;
      }

      if (data?.reply) {
        setChatMessages(m => [...m, { role: 'assistant', content: data.reply }]);
      }
      if (data?.updatedProfile) {
        setProfile(data.updatedProfile);
        await p.updateProfile(data.updatedProfile);
      }
      if (data?.isComplete) {
        setIsChatComplete(true);
      }
    } catch (err: any) {
      setChatMessages(m => [...m, { role: 'assistant', content: `⚠️ Connection Error: ${err.message || 'Unable to reach the assistant.'}` }]);
    } finally {
      setLoading(false);
    }
  }

  const [setupProgress, setSetupProgress] = useState<number | null>(null);
  const [setupStatus, setSetupStatus] = useState<string>('');

  // Finalize Onboarding and enter candidate workspace with dashboard calibration loader
  async function finishOnboarding() {
    setLoading(true);
    setSetupProgress(15);
    setSetupStatus('Calibrating verified capabilities with Skills Intelligence Platform...');

    const timer1 = window.setTimeout(() => {
      setSetupProgress(40);
      setSetupStatus(Number(profile.careerBreakYears) > 0 
        ? 'Evaluating career break with 0% penalty policy...' 
        : 'Mapping skills to enterprise capability framework...');
    }, 450);

    const timer2 = window.setTimeout(() => {
      setSetupProgress(70);
      setSetupStatus('Personalizing your 3-week learning pathway...');
    }, 900);

    try {
      const realMetrics = calculateRealReadiness(profile);
      const profileToSave = {
        ...profile,
        readinessRating: realMetrics.profileSignal,
        skillEvidence: realMetrics.skillEvidence,
        readinessTier: realMetrics.readinessTier,
      };
      await p.updateProfile(profileToSave);
      const res = await fetch('/api/candidate/onboarding/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profileToSave)
      });
      const data = await res.json();
      window.clearTimeout(timer1);
      window.clearTimeout(timer2);
      setSetupProgress(90);
      setSetupStatus('Persisting candidate capability signals to Cloud Database...');

      if (data?.match) {
        p.setLatestMatch(data.match);
        if (typeof data.match.overallFitScore === 'number') {
          p.setFit(data.match.overallFitScore);
          profileToSave.fit = data.match.overallFitScore;
          profileToSave.latestMatch = data.match;
          await p.updateProfile(profileToSave);
        }
      }

      window.setTimeout(() => {
        setSetupProgress(100);
        setSetupStatus('Ready! Launching your personalized workspace...');
        window.setTimeout(() => {
          p.setIsOnboarded(true);
          p.notify('Welcome! Your verified talent profile is ready.');
          setLocation('/candidate');
        }, 550);
      }, 400);
    } catch {
      window.clearTimeout(timer1);
      window.clearTimeout(timer2);
      p.setIsOnboarded(true);
      setLocation('/candidate');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-[100dvh] bg-[#dfe9e4]">
      <header className="mx-auto flex h-[72px] max-w-6xl items-center justify-between px-5 lg:px-8">
        <Logo />
      </header>

      <main className="mx-auto max-w-3xl px-5 py-8 lg:py-14">
        {setupProgress !== null ? (
          <div className="surface mx-auto max-w-xl rounded-3xl border border-[hsl(var(--primary))]/25 p-8 sm:p-10 text-center shadow-xl">
            <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-[hsl(var(--primary))]/15 text-[hsl(var(--primary))] animate-pulse">
              <Radar size={32} />
            </div>
            <p className="eyebrow mt-5 text-[hsl(var(--primary))]">Skills Intelligence Platform</p>
            <h1 className="mt-2 font-display text-3xl font-semibold">Setting up your dashboard...</h1>
            <p className="mt-2 text-sm text-[hsl(var(--muted-foreground))]">
              The AI Skills Matching Agent is calibrating your capability signals and personalizing your 3-week skill bridge.
            </p>

            <div className="mt-8">
              <div className="flex justify-between text-xs font-semibold text-[hsl(var(--muted-foreground))] mb-2">
                <span>Calibration Progress</span>
                <span className="font-data text-[hsl(var(--primary))]">{setupProgress}%</span>
              </div>
              <Progress value={setupProgress} color="bg-[hsl(var(--primary))]" />
              <p className="mt-3 text-xs font-medium text-[hsl(var(--primary))] animate-pulse">
                {setupStatus}
              </p>
            </div>

            <div className="mt-8 grid gap-3 text-left border-t border-[hsl(var(--border))] pt-6">
              <div className="flex items-center gap-3 text-xs font-medium">
                <div className={`grid h-5 w-5 place-items-center rounded-full ${setupProgress >= 20 ? 'bg-emerald-500 text-white' : 'bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]'}`}>
                  <CheckCircle2 size={12} />
                </div>
                <span>Demonstrated capabilities & projects indexed</span>
              </div>
              <div className="flex items-center gap-3 text-xs font-medium">
                <div className={`grid h-5 w-5 place-items-center rounded-full ${setupProgress >= 40 ? 'bg-emerald-500 text-white' : 'bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]'}`}>
                  <CheckCircle2 size={12} />
                </div>
                <span>Zero-penalty career break policy applied</span>
              </div>
              <div className="flex items-center gap-3 text-xs font-medium">
                <div className={`grid h-5 w-5 place-items-center rounded-full ${setupProgress >= 70 ? 'bg-emerald-500 text-white' : 'bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]'}`}>
                  <CheckCircle2 size={12} />
                </div>
                <span>Personalized 3-week learning pathway curated</span>
              </div>
              <div className="flex items-center gap-3 text-xs font-medium">
                <div className={`grid h-5 w-5 place-items-center rounded-full ${setupProgress >= 95 ? 'bg-emerald-500 text-white' : 'bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]'}`}>
                  <CheckCircle2 size={12} />
                </div>
                <span>Candidate dashboard persisted in Cloud Database</span>
              </div>
            </div>
          </div>
        ) : (
          <>
            {/* Pathway Selector Screen */}
            {mode === 'select' && (
          <div>
            <p className="eyebrow text-[hsl(var(--primary))]">SensAI Career Coach · Welcome</p>
            <h1 className="mt-4 font-display text-4xl leading-tight sm:text-5xl">How would you like to build your talent profile?</h1>
            <p className="mt-4 text-base leading-7 text-[hsl(var(--muted-foreground))]">
              Choose the path that fits best. Your profile is evaluated with 100% objectivity and skills-first intelligence.
            </p>

            <div className="mt-8 grid gap-4 sm:grid-cols-3">
              {/* Option 1: Resume Upload */}
              <button
                onClick={() => setMode('resume')}
                className="surface group flex flex-col justify-between rounded-2xl p-6 text-left transition hover:-translate-y-1 hover:border-[hsl(var(--primary))] hover:shadow-[var(--shadow-md)]"
              >
                <div>
                  <div className="grid h-12 w-12 place-items-center rounded-xl bg-[hsl(var(--secondary))] text-[hsl(var(--primary))] group-hover:bg-[hsl(var(--primary))] group-hover:text-white transition">
                    <Upload size={22} />
                  </div>
                  <h2 className="mt-5 font-display text-xl font-semibold">Upload Resume</h2>
                  <p className="mt-2 text-xs leading-5 text-[hsl(var(--muted-foreground))]">
                    Drop your PDF/DOCX. Our AI extracts capabilities, projects, and credentials in seconds.
                  </p>
                </div>
                <div className="mt-6 flex items-center gap-1 text-xs font-semibold text-[hsl(var(--primary))]">
                  <span>Fastest (~15s)</span> <ArrowRight size={13} />
                </div>
              </button>

              {/* Option 2: AI Coach Chat */}
              <button
                onClick={() => setMode('chat')}
                className="surface group flex flex-col justify-between rounded-2xl p-6 text-left transition hover:-translate-y-1 hover:border-[hsl(var(--accent))] hover:shadow-[var(--shadow-md)]"
              >
                <div>
                  <div className="grid h-12 w-12 place-items-center rounded-xl bg-[hsl(var(--accent))]/20 text-[hsl(var(--accent))] group-hover:bg-[hsl(var(--accent))] group-hover:text-black transition">
                    <Sparkles size={22} />
                  </div>
                  <h2 className="mt-5 font-display text-xl font-semibold">Chat with AI Coach</h2>
                  <p className="mt-2 text-xs leading-5 text-[hsl(var(--muted-foreground))]">
                    No resume needed. Tell the AI Coach about your work, skills, and goals in a guided conversation.
                  </p>
                </div>
                <div className="mt-6 flex items-center gap-1 text-xs font-semibold text-[hsl(var(--accent))]">
                  <span>Guided (~2m)</span> <ArrowRight size={13} />
                </div>
              </button>

              {/* Option 3: Structured Form */}
              <button
                onClick={() => setMode('form')}
                className="surface group flex flex-col justify-between rounded-2xl p-6 text-left transition hover:-translate-y-1 hover:border-[hsl(var(--primary))] hover:shadow-[var(--shadow-md)]"
              >
                <div>
                  <div className="grid h-12 w-12 place-items-center rounded-xl bg-[#e1f0ea] text-[#23614e] group-hover:bg-[#23614e] group-hover:text-white transition">
                    <FileText size={22} />
                  </div>
                  <h2 className="mt-5 font-display text-xl font-semibold">Step-by-Step Form</h2>
                  <p className="mt-2 text-xs leading-5 text-[hsl(var(--muted-foreground))]">
                    Prefer structured fields? Enter your target direction, experience, and skills at your own pace.
                  </p>
                </div>
                <div className="mt-6 flex items-center gap-1 text-xs font-semibold text-[#23614e]">
                  <span>Full Control (~3m)</span> <ArrowRight size={13} />
                </div>
              </button>
            </div>
          </div>
        )}

        {/* Pathway 1: Resume Upload & Smart Enrich Screen */}
        {mode === 'resume' && (
          <div>
            <div className="mb-6 flex items-center justify-between">
              <button onClick={() => setMode('select')} className="inline-flex items-center gap-1.5 text-xs font-semibold text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]">
                <ArrowLeft size={14} /> Back to options
              </button>
              <Badge tone="good"><Sparkles size={11} className="mr-1" /> Skills Discovery Agent</Badge>
            </div>

            {uploadStage === 'idle' && (
              <section className="surface rounded-2xl p-6 sm:p-8">
                <h1 className="font-display text-3xl">Upload your resume</h1>
                <p className="mt-2 text-sm text-[hsl(var(--muted-foreground))]">
                  We parse your demonstrated outcomes and verify skills into the Skills Intelligence Platform ontology.
                </p>

                {onboardError && (
                  <div className="mt-4 flex items-start gap-3 rounded-xl border border-[hsl(var(--destructive))]/40 bg-[hsl(var(--destructive))]/10 p-3.5 text-xs text-[hsl(var(--destructive))]">
                    <AlertCircle size={16} className="mt-0.5 shrink-0 text-[hsl(var(--destructive))]" />
                    <div className="flex-1">
                      <p className="font-semibold">Extraction Failed</p>
                      <p className="mt-0.5 leading-relaxed">{onboardError}</p>
                    </div>
                    <button type="button" onClick={() => setOnboardError(null)} className="font-bold opacity-70 hover:opacity-100">✕</button>
                  </div>
                )}

                <div
                  onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
                  onDragLeave={() => setDragActive(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragActive(false);
                    const file = e.dataTransfer.files?.[0];
                    if (file) handleResumeParse(file);
                  }}
                  className={`mt-6 rounded-2xl border-2 border-dashed p-8 text-center transition ${dragActive ? 'border-[hsl(var(--primary))] bg-[hsl(var(--primary))]/15' : 'border-[hsl(var(--primary))]/40 bg-[#e1f0ea]'}`}
                >
                  <Upload size={36} className="mx-auto text-[hsl(var(--primary))]" />
                  <p className="mt-4 font-semibold text-base">Drag & drop your resume file</p>
                  <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">Supports PDF, DOCX, DOC, and TXT documents</p>

                  <label className="mt-5 inline-flex min-h-11 cursor-pointer items-center rounded-xl bg-[hsl(var(--primary))] px-6 text-sm font-semibold text-[hsl(var(--primary-foreground))] shadow transition hover:opacity-95">
                    <input
                      type="file"
                      accept=".pdf,.doc,.docx,.txt"
                      className="sr-only"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        e.target.value = '';
                        if (file) handleResumeParse(file);
                      }}
                    />
                    Browse files from computer
                  </label>

                  <div className="mt-6 flex flex-wrap items-center justify-center gap-4 border-t border-[hsl(var(--border))]/50 pt-5 text-xs">
                    <button
                      type="button"
                      onClick={() => setShowPasteArea(!showPasteArea)}
                      className="font-semibold text-[hsl(var(--primary))] hover:underline"
                    >
                      {showPasteArea ? '▲ Hide text input' : '📋 Or paste resume / profile text'}
                    </button>
                  </div>
                </div>

                {showPasteArea && (
                  <div className="mt-5 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5 shadow-sm">
                    <p className="text-xs font-semibold text-[hsl(var(--foreground))]">Paste your resume, career summary, or project experience:</p>
                    <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">Our Skills Discovery Agent will parse all technical skills, projects, and achievements.</p>
                    <textarea
                      value={pasteInput}
                      onChange={(e) => setPasteInput(e.target.value)}
                      placeholder="Paste your resume or bio here..."
                      className="mt-2 min-h-32 w-full rounded-xl border border-[hsl(var(--input))] bg-transparent p-3 text-xs"
                    />
                    <Button onClick={handlePasteParse} className="mt-3 w-full" size="sm">
                      Extract Profile Information <Sparkles size={14} className="ml-1.5" />
                    </Button>
                  </div>
                )}
              </section>
            )}

            {uploadStage === 'parsing' && (
              <section className="surface rounded-2xl p-10 text-center">
                <RefreshCcw size={32} className="mx-auto animate-spin text-[hsl(var(--primary))]" />
                <h2 className="mt-4 font-display text-2xl font-semibold">Extracting & Verifying Capabilities</h2>
                <p className="mt-2 text-xs text-[hsl(var(--muted-foreground))]">
                  Evaluating skills, projects, and background...
                </p>
              </section>
            )}

            {uploadStage === 'review' && extractedProfile && (
              <section className="surface rounded-2xl p-6 sm:p-8">
                <div className="flex items-center justify-between">
                  <div>
                    <Badge tone="good"><CheckCircle2 size={12} className="mr-1" /> Profile Extracted</Badge>
                    <h2 className="mt-2 font-display text-2xl font-semibold">Review Extracted Profile</h2>
                    <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">
                      Confirm the details extracted from your resume are correct before continuing.
                    </p>
                  </div>
                  <button
                    onClick={() => setUploadStage('idle')}
                    className="text-xs text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
                  >
                    Re-upload
                  </button>
                </div>

                <div className="mt-6 space-y-5">
                  {/* Identity */}
                  <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--muted))]/40 p-4 space-y-1">
                    <p className="text-xs font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wide">Candidate Identity</p>
                    <p className="font-semibold text-lg">{extractedProfile.name}</p>
                    {extractedProfile.email && <p className="text-xs text-[hsl(var(--muted-foreground))]">📧 {extractedProfile.email}</p>}
                    {extractedProfile.phone && <p className="text-xs text-[hsl(var(--muted-foreground))]">📞 {extractedProfile.phone}</p>}
                    {extractedProfile.location && <p className="text-xs text-[hsl(var(--muted-foreground))]">📍 {extractedProfile.location}</p>}
                  </div>

                  <label className="grid gap-2 text-xs font-semibold">
                    Professional Summary
                    <textarea
                      value={extractedProfile.summary || extractedProfile.breakContext}
                      onChange={e => { const u = { ...extractedProfile, summary: e.target.value, breakContext: e.target.value }; setExtractedProfile(u); setProfile(u); }}
                      className="min-h-20 rounded-lg border border-[hsl(var(--input))] bg-transparent p-3 text-sm font-normal"
                    />
                  </label>

                  {/* Skills */}
                  {extractedProfile.skills && extractedProfile.skills.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold">Extracted Verified Skills ({extractedProfile.skills.length})</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {extractedProfile.skills.map((s, i) => (
                          <Badge key={`${s}-${i}`} tone="good">
                            <Check size={11} className="mr-1" /> {s}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Projects */}
                  {extractedProfile.projects && extractedProfile.projects.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-[hsl(var(--muted-foreground))]">Extracted Projects &amp; Artifacts ({extractedProfile.projects.length})</p>
                      <div className="mt-2 grid gap-2 sm:grid-cols-2">
                        {extractedProfile.projects.map((proj, i) => (
                          <div key={i} className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-2.5 text-xs">
                            <p className="font-semibold text-sm">{proj.title}</p>
                            {proj.techStack && proj.techStack.length > 0 && (
                              <p className="mt-0.5 text-[10px] text-[hsl(var(--primary))]">{proj.techStack.join(', ')}</p>
                            )}
                            <p className="mt-1 text-[11px] text-[hsl(var(--muted-foreground))]">{proj.description}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Education */}
                  {extractedProfile.education && extractedProfile.education.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-[hsl(var(--muted-foreground))]">Extracted Academic Education</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {extractedProfile.education.map((edu, i) => (
                          <div key={i} className="rounded-lg bg-[hsl(var(--muted))] px-3 py-1.5 text-xs">
                            <span className="font-semibold">{edu.degree}</span> · {edu.institution} ({edu.year}){edu.score ? ` · ${edu.score}` : ''}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Certifications */}
                  {extractedProfile.certifications && extractedProfile.certifications.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-[hsl(var(--muted-foreground))]">Certifications</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {extractedProfile.certifications.map((cert, i) => (
                          <div key={i} className="rounded-lg bg-[hsl(var(--secondary))] px-3 py-1.5 text-xs">
                            <span className="font-semibold">{cert.name}</span>
                            {cert.issuer ? ` · ${cert.issuer}` : ''}{cert.year ? ` (${cert.year})` : ''}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Achievements */}
                  {extractedProfile.achievements && extractedProfile.achievements.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-[hsl(var(--muted-foreground))]">Achievements</p>
                      <ul className="mt-2 space-y-1">
                        {extractedProfile.achievements.map((ach, i) => (
                          <li key={i} className="flex items-start gap-2 text-xs">
                            <span className="mt-0.5 text-[hsl(var(--primary))]">✦</span>
                            <span>{ach}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>

                <div className="mt-8 flex justify-end gap-3 border-t border-[hsl(var(--border))] pt-6">
                  <Button onClick={() => setUploadStage('target')} className="min-w-40">
                    Next <ArrowRight size={15} />
                  </Button>
                </div>
              </section>
            )}

            {/* Step 2: Target Company and Target Job Profile */}
            {uploadStage === 'target' && (
              <section className="surface rounded-2xl p-6 sm:p-8">
                <div className="mb-6 flex items-center justify-between border-b border-[hsl(var(--border))] pb-4">
                  <div>
                    <p className="eyebrow text-[hsl(var(--primary))]">Step 2 of 2 · Career Goals</p>
                    <h2 className="mt-1 font-display text-2xl font-semibold">Target Job Profile &amp; Company</h2>
                    <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">
                      Specify the role and company you are targeting to personalize your talent profile.
                    </p>
                  </div>
                  <Badge tone="good"><Sparkles size={11} className="mr-1" /> Final Step</Badge>
                </div>

                <div className="space-y-5">
                  <label className="grid gap-2 text-xs font-semibold">
                    Target Job Profile / Role <span className="text-[hsl(var(--destructive))]">*</span>
                    <input
                      value={profile.targetRole || ''}
                      onChange={e => {
                        const val = e.target.value;
                        setProfile(prev => ({ ...prev, targetRole: val }));
                        if (extractedProfile) setExtractedProfile(prev => prev ? ({ ...prev, targetRole: val }) : null);
                      }}
                      placeholder="e.g. Software Development Engineer, Full Stack Developer, Data Analyst..."
                      className="h-11 rounded-lg border border-[hsl(var(--input))] bg-transparent px-3 text-sm font-normal"
                    />
                  </label>

                  <label className="grid gap-2 text-xs font-semibold">
                    Target Company <span className="text-[hsl(var(--destructive))]">*</span>
                    <input
                      value={profile.targetCompany || ''}
                      onChange={e => {
                        const val = e.target.value;
                        setProfile(prev => ({ ...prev, targetCompany: val }));
                        if (extractedProfile) setExtractedProfile(prev => prev ? ({ ...prev, targetCompany: val }) : null);
                      }}
                      placeholder="e.g. your target company, Google, Microsoft, Amazon..."
                      className="h-11 rounded-lg border border-[hsl(var(--input))] bg-transparent px-3 text-sm font-normal"
                    />
                  </label>

                  <label className="grid gap-2 text-xs font-semibold">
                    Preferred Work Mode
                    <select
                      value={profile.workMode || 'Hybrid'}
                      onChange={e => {
                        const val = e.target.value as 'Hybrid' | 'Remote' | 'On-site';
                        setProfile(prev => ({ ...prev, workMode: val }));
                        if (extractedProfile) setExtractedProfile(prev => prev ? ({ ...prev, workMode: val }) : null);
                      }}
                      className="h-11 rounded-lg border border-[hsl(var(--input))] bg-[hsl(var(--card))] px-3 text-sm font-normal"
                    >
                      <option value="Hybrid">Hybrid</option>
                      <option value="Remote">Remote</option>
                      <option value="On-site">On-site</option>
                    </select>
                  </label>
                </div>

                <div className="mt-8 flex items-center justify-between border-t border-[hsl(var(--border))] pt-6">
                  <Button onClick={() => setUploadStage('review')} variant="outline">
                    <ArrowLeft size={15} /> Back
                  </Button>
                  <Button onClick={finishOnboarding} disabled={loading} className="min-w-44">
                    {loading ? (
                      <span className="flex items-center gap-2">
                        <RefreshCcw size={14} className="animate-spin" /> Generating Profile…
                      </span>
                    ) : (
                      <span className="flex items-center gap-2">
                        Generate My Profile <ArrowRight size={15} />
                      </span>
                    )}
                  </Button>
                </div>
              </section>
            )}
          </div>
        )}

        {/* Pathway 2: Conversational AI Coach Onboarding */}
        {mode === 'chat' && (
          <div>
            <div className="mb-6 flex items-center justify-between">
              <button onClick={() => setMode('select')} className="inline-flex items-center gap-1.5 text-xs font-semibold text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]">
                <ArrowLeft size={14} /> Back to options
              </button>
              <Badge tone="good"><Sparkles size={11} className="mr-1" /> AI Career Coach</Badge>
            </div>

            <section className="surface overflow-hidden rounded-2xl">
              <div className="flex items-center gap-3 border-b border-[hsl(var(--border))] p-5">
                <div className="grid h-10 w-10 place-items-center rounded-xl bg-[hsl(var(--accent))] text-black">
                  <Sparkles size={18} />
                </div>
                <div>
                  <h2 className="font-semibold text-sm">AI Coach Onboarding</h2>
                  <p className="text-xs text-[hsl(var(--muted-foreground))]">Grounded in Skills Intelligence Platform</p>
                </div>
              </div>

              <div className="min-h-[320px] max-h-[420px] overflow-y-auto space-y-4 bg-[hsl(var(--background))] p-5">
                {chatMessages.map((m, i) => (
                  <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${m.role === 'user' ? 'bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]' : 'bg-[hsl(var(--card))] border border-[hsl(var(--border))] shadow-sm'}`}>
                      {m.content}
                    </div>
                  </div>
                ))}
                {loading && (
                  <div className="flex justify-start">
                    <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-4 py-2.5 text-xs text-[hsl(var(--muted-foreground))] flex items-center gap-2">
                      <RefreshCcw size={13} className="animate-spin text-[hsl(var(--primary))]" />
                      AI Coach is thinking…
                    </div>
                  </div>
                )}
              </div>

              {/* Live Discovered Capability Badges */}
              {(profile.name || profile.targetRole || (profile.skills && profile.skills.length > 0)) && (
                <div className="border-t border-[hsl(var(--border))] bg-[hsl(var(--card))] px-5 py-3 text-xs">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-semibold text-[hsl(var(--primary))] flex items-center gap-1.5">
                      <ShieldCheck size={14} /> Auto-Saved to Skills Intelligence Platform
                    </span>
                    <Badge tone="good"><CheckCircle2 size={11} className="mr-1" /> Verified</Badge>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {profile.name && <span className="rounded bg-[hsl(var(--muted))] px-2.5 py-1 text-[11px] font-medium">👤 {profile.name}</span>}
                    {profile.location && <span className="rounded bg-[hsl(var(--muted))] px-2.5 py-1 text-[11px] font-medium">📍 {profile.location}</span>}
                    {profile.targetRole && <span className="rounded bg-[hsl(var(--primary))]/15 text-[hsl(var(--primary))] px-2.5 py-1 text-[11px] font-semibold">🎯 {profile.targetRole}</span>}
                    {profile.skills && profile.skills.slice(0, 5).map((s) => (
                      <span key={s} className="rounded bg-[hsl(var(--success))]/15 text-[#86efac] px-2.5 py-1 text-[11px] font-medium">✓ {s}</span>
                    ))}
                  </div>
                </div>
              )}

              {/* Quick Suggestion Chips */}
              <div className="border-t border-[hsl(var(--border))] bg-[hsl(var(--muted))]/40 px-5 py-3">
                <p className="text-[11px] font-semibold text-[hsl(var(--muted-foreground))] mb-2">Quick reply suggestions:</p>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    `${user?.fullName || user?.firstName || 'Aman Sharma'} · Bangalore`,
                    'Full Stack Developer targeting enterprise companies',
                    'React, TypeScript, Node.js, and SQL',
                    'B.Tech in Computer Science · 2024 Graduate',
                    'Cloud and Enterprise application engineering'
                  ].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => sendChatMessage(preset)}
                      disabled={loading}
                      className="rounded-full border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 py-1 text-xs text-[hsl(var(--foreground))] transition hover:border-[hsl(var(--primary))] hover:bg-[hsl(var(--primary))]/10"
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>

              <div className="border-t border-[hsl(var(--border))] p-4">
                <div className="flex gap-2">
                  <input
                    value={chatInput}
                    onChange={e => setChatInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && sendChatMessage()}
                    placeholder="Type your response…"
                    className="h-11 flex-1 rounded-lg border border-[hsl(var(--input))] bg-[hsl(var(--card))] px-3 text-sm"
                    disabled={loading}
                  />
                  <Button onClick={() => sendChatMessage()} className="w-11 px-0" disabled={loading}>
                    <Send size={16} />
                  </Button>
                </div>

                <div className="mt-4 flex items-center justify-between border-t border-[hsl(var(--border))] pt-3">
                  <span className="text-xs text-[hsl(var(--muted-foreground))]">
                    {isChatComplete ? "🎉 Onboarding complete! Ready to view profile:" : "Ready to see your verified profile?"}
                  </span>
                  <Button onClick={finishOnboarding} size="sm" className="bg-[hsl(var(--primary))]">
                    Finish Onboarding & View Match <ArrowRight size={14} />
                  </Button>
                </div>
              </div>
            </section>
          </div>
        )}

        {/* Pathway 3: Structured Step-by-Step Form */}
        {mode === 'form' && (
          <div>
            <div className="mb-6 flex items-center justify-between">
              <button onClick={() => setMode('select')} className="inline-flex items-center gap-1.5 text-xs font-semibold text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]">
                <ArrowLeft size={14} /> Back to options
              </button>
              <div className="flex gap-1.5">
                {[1, 2, 3].map(i => (
                  <div key={i} className={`h-2 w-7 rounded-full ${i <= formStep ? 'bg-[hsl(var(--primary))]' : 'bg-[hsl(var(--border))]'}`} />
                ))}
              </div>
            </div>

            <section className="surface rounded-2xl p-6 sm:p-8">
              {formStep === 1 && (
                <div>
                  <p className="eyebrow">Step 1 of 3 · Target Direction</p>
                  <h1 className="mt-2 font-display text-3xl">Where are you heading?</h1>
                  <p className="mt-2 text-sm text-[hsl(var(--muted-foreground))]">Tell us the role and company you want to unlock.</p>

                  <div className="mt-6 grid gap-4">
                    <label className="grid gap-2 text-xs font-semibold">
                      Target Role Title
                      <input
                        value={profile.targetRole}
                        onChange={e => setProfile({ ...profile, targetRole: e.target.value })}
                        className="h-11 rounded-lg border border-[hsl(var(--input))] bg-transparent px-3 text-sm font-normal"
                      />
                    </label>
                    <label className="grid gap-2 text-xs font-semibold">
                      Target Company
                      <input
                        value={profile.targetCompany}
                        onChange={e => setProfile({ ...profile, targetCompany: e.target.value })}
                        className="h-11 rounded-lg border border-[hsl(var(--input))] bg-transparent px-3 text-sm font-normal"
                      />
                    </label>
                  </div>
                  <Button onClick={() => setFormStep(2)} className="mt-6">Continue <ArrowRight size={15} /></Button>
                </div>
              )}

              {formStep === 2 && (
                <div>
                  <p className="eyebrow">Step 2 of 3 · Professional Summary</p>
                  <h1 className="mt-2 font-display text-3xl">Tell us your background.</h1>
                  <p className="mt-2 text-sm text-[hsl(var(--muted-foreground))]">Share your core expertise, recent projects, or educational background.</p>

                  <div className="mt-6 grid gap-4">
                    <label className="grid gap-2 text-xs font-semibold">
                      Location / Preferred Work Mode
                      <input
                        value={profile.location || 'Bangalore (Hybrid)'}
                        onChange={e => setProfile({ ...profile, location: e.target.value })}
                        className="h-11 rounded-lg border border-[hsl(var(--input))] bg-transparent px-3 text-sm font-normal"
                      />
                    </label>
                    <label className="grid gap-2 text-xs font-semibold">
                      Summary & Career Objectives
                      <textarea
                        value={profile.summary || profile.breakContext}
                        onChange={e => setProfile({ ...profile, summary: e.target.value, breakContext: e.target.value })}
                        placeholder="Brief summary of your background, technical interests, and goals..."
                        className="min-h-20 rounded-lg border border-[hsl(var(--input))] bg-transparent p-3 text-sm font-normal"
                      />
                    </label>
                  </div>
                  <div className="mt-6 flex gap-3">
                    <Button onClick={() => setFormStep(1)} variant="outline"><ArrowLeft size={15} /> Back</Button>
                    <Button onClick={() => setFormStep(3)}>Continue <ArrowRight size={15} /></Button>
                  </div>
                </div>
              )}

              {formStep === 3 && (
                <div>
                  <p className="eyebrow">Step 3 of 3 · Verified Capabilities</p>
                  <h1 className="mt-2 font-display text-3xl">Select your demonstrated skills</h1>
                  <div className="mt-6 flex flex-wrap gap-2">
                    {skillCatalog.slice(0, 14).map(s => {
                      const selected = profile.skills.includes(s);
                      return (
                        <button
                          key={s}
                          onClick={() => {
                            setProfile(prev => ({
                              ...prev,
                              skills: selected ? prev.skills.filter(x => x !== s) : [...prev.skills, s]
                            }));
                          }}
                          className={`rounded-full border px-3.5 py-2 text-xs font-medium transition ${selected ? 'border-[hsl(var(--primary))] bg-[hsl(var(--primary))] text-white' : 'border-[hsl(var(--border))] bg-[hsl(var(--card))]'}`}
                        >
                          {selected ? '✓ ' : '+ '}{s}
                        </button>
                      );
                    })}
                  </div>
                  <div className="mt-8 flex gap-3">
                    <Button onClick={() => setFormStep(2)} variant="outline"><ArrowLeft size={15} /> Back</Button>
                    <Button onClick={finishOnboarding} disabled={loading}>{loading ? 'Generating Profile…' : 'Generate My Profile'} <ArrowRight size={15} /></Button>
                  </div>
                </div>
              )}
            </section>
          </div>
        )}
          </>
        )}
      </main>
    </div>
  );
}

function JobCard({ job }: { job: Job }) {
  const p = useProduct(); const saved = p.savedJobs.includes(job.id);
  return <article className="surface rounded-2xl p-5 transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-md)]"><div className="flex items-start justify-between gap-3"><div className="flex gap-3"><div className="grid h-10 w-10 place-items-center rounded-xl bg-[hsl(var(--secondary))] text-[hsl(var(--primary))]"><Building2 size={18} /></div><div><Link href={`/candidate/jobs/${job.id}`} data-testid={`link-job-${job.id}`} className="font-semibold hover:text-[hsl(var(--primary))]">{job.title}</Link><p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">{job.company} · {job.location}</p></div></div><button onClick={() => p.toggleSaved(job.id)} data-testid={`button-save-job-${job.id}`} className={`rounded-lg p-2 ${saved ? 'text-[#b8783d]' : 'text-[hsl(var(--muted-foreground))]'}`} aria-label={saved ? 'Unsave job' : 'Save job'}>{saved ? <Heart size={18} fill="currentColor" /> : <Heart size={18} />}</button></div><div className="mt-5 flex items-end justify-between"><div><Badge tone={job.fit >= 84 ? 'good' : 'default'}>{job.fit}% fit</Badge><span className="ml-2 text-xs text-[hsl(var(--muted-foreground))]">{job.mode}</span></div><span className="text-xs text-[hsl(var(--muted-foreground))]">{job.posted}</span></div><div className="mt-4 flex flex-wrap gap-1.5">{job.skills.map(s => <span key={s} className="rounded-md bg-[hsl(var(--muted))] px-2 py-1 text-[11px] text-[hsl(var(--muted-foreground))]">{s}</span>)}</div></article>;
}
function CandidateJobs() {
  const [query, setQuery] = useState(''); const filtered = jobs.filter(j => `${j.title} ${j.company} ${j.skills.join(' ')}`.toLowerCase().includes(query.toLowerCase()));
  return <WorkspaceShell role="candidate"><PageTitle eyebrow="Explore roles" title="Roles with a reason." description="Every match shows its work. Save what feels promising, then make it yours." /><div className="mb-6 flex flex-wrap gap-3"><label className="relative flex min-w-[260px] flex-1 items-center"><Search size={17} className="absolute left-3 text-[hsl(var(--muted-foreground))]" /><input value={query} onChange={e => setQuery(e.target.value)} data-testid="input-job-search" placeholder="Search roles, skills, companies" className="h-11 w-full rounded-lg border border-[hsl(var(--input))] bg-[hsl(var(--card))] pl-10 pr-3 text-sm" /></label><Button data-testid="button-job-filter" variant="outline"><Filter size={15} /> Filters <ChevronDown size={14} /></Button></div>{filtered.length ? <div className="grid gap-4 md:grid-cols-2">{filtered.map(job => <JobCard key={job.id} job={job} />)}</div> : <EmptyState icon={Search} title="No roles found yet." body="Try a broader search. Your next step may use a different title than the one you started with." action={<Button onClick={() => setQuery('')} data-testid="button-clear-job-search">Clear search</Button>} />}</WorkspaceShell>;
}
function CandidateJobDetail() {
  const { id } = useParams<{ id: string }>(); const p = useProduct(); const job = jobs.find(j => j.id === Number(id)) || jobs[0]; const applied = p.applications.includes(job.id);
  return <WorkspaceShell role="candidate"><Link href="/candidate/jobs" data-testid="link-back-jobs" className="mb-7 inline-flex items-center gap-2 text-sm font-semibold text-[hsl(var(--primary))]"><ArrowLeft size={15} /> All roles</Link><div className="grid gap-5 lg:grid-cols-[1.15fr_.85fr]"><section className="surface rounded-2xl p-6 sm:p-8"><div className="flex items-start gap-4"><div className="grid h-14 w-14 place-items-center rounded-2xl bg-[hsl(var(--secondary))] text-[hsl(var(--primary))]"><Building2 size={24} /></div><div><p className="eyebrow">{job.company}</p><h1 className="mt-2 font-display text-4xl">{job.title}</h1><p className="mt-2 text-sm text-[hsl(var(--muted-foreground))]">{job.location} · {job.mode} · {job.salary}</p></div></div><div className="mt-9 border-t border-[hsl(var(--border))] pt-7"><h2 className="font-display text-2xl">Why this could fit</h2><p className="mt-3 leading-7 text-[hsl(var(--muted-foreground))]">{job.blurb} Your experience in program strategy and stakeholder alignment maps directly to the team’s operating model.</p><h3 className="mt-8 text-sm font-semibold">What the team needs</h3><div className="mt-3 flex flex-wrap gap-2">{job.skills.map(s => <Badge key={s} tone={(p.profile.skills || []).includes(s) ? 'good' : 'quiet'}>{s}</Badge>)}</div></div><div className="mt-9 flex flex-wrap gap-3"><Button onClick={() => p.apply(job.id)} disabled={applied} data-testid="button-apply-job">{applied ? <><Check size={16} /> Applied</> : <><Send size={16} /> Apply with my SensAI profile</>}</Button><Button onClick={() => p.toggleSaved(job.id)} data-testid="button-save-job-detail" variant="outline"><Heart size={16} /> {p.savedJobs.includes(job.id) ? 'Saved' : 'Save role'}</Button></div></section><aside className="grid content-start gap-5"><div className="surface rounded-2xl p-6"><div className="flex items-center justify-between"><div><p className="eyebrow">Your fit</p><p className="mt-2 font-display text-3xl">{p.fit}%</p></div><Score value={p.fit} /></div><p className="mt-5 text-sm leading-6 text-[hsl(var(--muted-foreground))]">Strong match on operating rhythm and cross-functional leadership. One skill bridge could move this to <span className="font-semibold text-[hsl(var(--foreground))]">91%</span>.</p><Link href="/candidate/skill-gap" data-testid="link-job-skill-gap" className="mt-5 inline-flex items-center text-sm font-semibold text-[hsl(var(--primary))]">See the evidence <ArrowRight size={15} className="ml-2" /></Link></div><div className="rounded-2xl bg-[#f8e6cf] p-6"><p className="eyebrow text-[#925d26]">Candidate note</p><p className="mt-3 text-sm leading-6">Your career break is shown for context and excluded from this fit signal.</p></div></aside></div></WorkspaceShell>;
}

function SkillGap() {
  const p = useProduct();
  const match = p.latestMatch;
  const targetRole = p.profile.targetRole || match?.jobTitle || "Product Operations Lead";
  const targetCompany = p.profile.targetCompany || match?.company || "enterprise";
  const currentFit = p.fit || match?.overallFitScore || 84;
  const projectedFit = match?.threeWeekBoostProjected || 91;

  const defaultModules = [
    { week: 1, title: 'SQL & Relational Data Modeling for Enterprise Decision Makers', competencyGained: 'SQL Analytics & Data Insights', hoursRequired: 5, courseUrl: 'https://www.coursera.org/learn/sql-for-data-science' },
    { week: 2, title: 'Cross-Functional Operating Models & Stakeholder Alignment', competencyGained: 'Cross-Functional Leadership', hoursRequired: 4, courseUrl: 'https://www.coursera.org/learn/agile-development' },
    { week: 3, title: 'Enterprise Product Strategy & Agile Execution (Agile Framework)', competencyGained: 'Agile Governance', hoursRequired: 5, courseUrl: 'https://www.coursera.org' }
  ];

  const modulesToDisplay = (Array.isArray(match?.learningModules) && match.learningModules.length > 0)
    ? match.learningModules
    : defaultModules;

  return <WorkspaceShell role="candidate"><PageTitle eyebrow="Skill Bridge" title="A personalized bridge to your target role." description={`Curated by the AI Skills Matching Agent for ${targetRole} at ${targetCompany}. Zero penalty for your career break — purely focused on capability acceleration.`} /><div className="grid gap-5 lg:grid-cols-[1.2fr_.8fr]"><section className="surface rounded-2xl p-6 sm:p-8"><div className="flex flex-wrap items-end justify-between gap-5"><div><p className="eyebrow">Target role · {targetCompany}</p><h2 className="mt-2 font-display text-3xl">{currentFit}% <span className="font-sans text-base text-[hsl(var(--muted-foreground))]">today</span> → <span className="text-[hsl(var(--primary))]">{projectedFit}%</span></h2></div><Badge tone="good"><TrendingUp size={13} className="mr-1" /> High leverage</Badge></div><div className="mt-8 space-y-5">{modulesToDisplay.map((m: any, idx: number) => {
    const isWeek1 = idx === 0;
    const isComplete = isWeek1 && p.completedLearning;
    const bgStyles = ['bg-[#f8e6cf] text-[#925d26]', 'bg-[#e1f0ea] text-[hsl(var(--primary))]', 'bg-[hsl(var(--muted))] text-[hsl(var(--foreground))]'];

    return <div key={idx} className="rounded-xl border border-[hsl(var(--border))] p-5"><div className="flex items-start justify-between gap-4"><div><div className="flex items-center gap-2"><span className={`grid h-7 w-7 place-items-center rounded-full text-xs font-semibold ${bgStyles[idx % 3]}`}>0{m.week || idx + 1}</span><h3 className="font-semibold">{m.title}</h3></div><p className="mt-2 text-sm leading-6 text-[hsl(var(--muted-foreground))]">Competency: <span className="font-medium text-[hsl(var(--foreground))]">{m.competencyGained}</span> · {m.hoursRequired || 5}h of learning.</p></div><Badge tone={isComplete ? 'good' : (isWeek1 ? 'warm' : 'quiet')}>{isComplete ? 'Complete' : (isWeek1 ? `+${projectedFit - currentFit} fit` : `Week ${m.week || idx + 1}`)}</Badge></div>{isWeek1 && !p.completedLearning && <div className="mt-4 flex flex-wrap items-center gap-3"><Button onClick={() => { p.setCompletedLearning(true); p.setFit(projectedFit); p.notify(`Skill bridge complete — your fit moved to ${projectedFit}%.`); }} data-testid="button-complete-skill-bridge"><CheckCircle2 size={15} /> Mark module complete</Button><a href={m.courseUrl || 'https://www.coursera.org'} target="_blank" rel="noreferrer" className="inline-flex min-h-10 items-center rounded-lg border border-[hsl(var(--border))] px-3 text-xs font-semibold hover:bg-[hsl(var(--muted))]">Open Course ↗</a></div>}</div>;
  })}</div></section><aside className="space-y-5"><div className="surface rounded-2xl p-6"><p className="eyebrow">Path progress</p><div className="mt-4 flex items-end justify-between"><span className="font-data text-3xl">{p.completedLearning ? '33' : '0'}%</span><span className="text-sm text-[hsl(var(--muted-foreground))]">1 of 3 weeks</span></div><Progress value={p.completedLearning ? 33 : 0} color="bg-[hsl(var(--accent))]" /><div className="mt-5 grid gap-3 text-sm"><div className="flex items-center gap-2"><CheckCircle2 size={15} className={p.completedLearning ? 'text-[hsl(var(--primary))]' : 'text-[hsl(var(--muted-foreground))]'} /> Evidence reviewed</div><div className="flex items-center gap-2"><Clock3 size={15} /> {modulesToDisplay[0]?.hoursRequired || 5}h this week</div><div className="flex items-center gap-2"><Target size={15} /> Role-specific outcome</div></div></div><div className="rounded-2xl bg-[hsl(var(--sidebar))] p-6 text-[hsl(var(--sidebar-foreground))]"><Sparkles size={19} className="text-[hsl(var(--accent))]" /><p className="mt-4 font-display text-2xl">The goal is not to catch up.</p><p className="mt-2 text-sm leading-6 text-[hsl(var(--sidebar-foreground))]/60">It is to make the capability you already have easier to see.</p></div></aside></div></WorkspaceShell>;
}
function Learning() {
  const p = useProduct(); const [filter, setFilter] = useState('All');
  return <WorkspaceShell role="candidate"><PageTitle eyebrow="Learning path" title="Learning with a finish line." description="Ten short modules, chosen for the roles you are considering. No busywork." action={<Button onClick={() => setFilter(filter === 'All' ? 'Practice' : 'All')} data-testid="button-learning-filter" variant="outline"><ListFilter size={15} /> {filter === 'All' ? 'Show practice' : 'Show all'}</Button>} /><div className="mb-7 rounded-2xl bg-[#dfe9e4] p-6"><div className="flex flex-wrap items-center justify-between gap-5"><div><p className="eyebrow text-[hsl(var(--primary))]">Your active path</p><h2 className="mt-2 font-display text-2xl">Product Operations Lead · 3 weeks</h2></div><div className="min-w-[200px]"><div className="mb-2 flex justify-between text-xs"><span>{p.completedLearning ? '1 of 3 milestones' : '0 of 3 milestones'}</span><span>{p.completedLearning ? '33%' : '0%'}</span></div><Progress value={p.completedLearning ? 33 : 0} /></div></div></div><div className="grid gap-4 md:grid-cols-2">{modules.filter(m => filter === 'All' || m.kind === filter).map((m, i) => <article key={m.id} className="surface rounded-2xl p-5"><div className="flex items-start justify-between"><div className="grid h-10 w-10 place-items-center rounded-xl text-white" style={{ background: m.color }}>{m.kind === 'Course' ? <BookOpen size={18} /> : <Play size={17} fill="currentColor" />}</div><Badge tone={i === 0 && p.completedLearning ? 'good' : 'quiet'}>{i === 0 && p.completedLearning ? 'Complete' : m.kind}</Badge></div><h3 className="mt-5 font-semibold">{m.title}</h3><p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">{m.provider} · {m.duration}</p><Button onClick={() => { if (m.id === 1) { p.setCompletedLearning(true); p.setFit(91); p.notify('SQL module complete — fit updated.'); } }} data-testid={`button-start-module-${m.id}`} variant="soft" className="mt-5 w-full">{i === 0 && p.completedLearning ? 'Review module' : 'Start module'} <ArrowRight size={14} /></Button></article>)}</div></WorkspaceShell>;
}
function Applications() {
  const p = useProduct(); const items = p.applications.map(id => jobs.find(j => j.id === id)).filter(Boolean) as Job[];
  return <WorkspaceShell role="candidate"><PageTitle eyebrow="Applications" title="Keep the momentum visible." description="A clear place for every conversation, decision, and next action." action={<Link href="/candidate/jobs" data-testid="link-find-more-roles" className="inline-flex min-h-10 items-center rounded-lg bg-[hsl(var(--primary))] px-4 text-sm font-semibold text-[hsl(var(--primary-foreground))]"><Plus size={15} className="mr-2" /> Find another role</Link>} />{items.length ? <div className="grid gap-4">{items.map((job, i) => <div key={job.id} className="surface flex flex-wrap items-center justify-between gap-5 rounded-2xl p-5"><div className="flex items-center gap-4"><div className="grid h-11 w-11 place-items-center rounded-xl bg-[hsl(var(--secondary))] text-[hsl(var(--primary))]"><Building2 size={19} /></div><div><h3 className="font-semibold">{job.title}</h3><p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">{job.company} · Applied {i === 0 ? 'today' : '8 days ago'}</p></div></div><div className="flex items-center gap-5"><div className="hidden text-right sm:block"><p className="text-xs text-[hsl(var(--muted-foreground))]">Next action</p><p className="mt-1 text-sm font-semibold">{i === 0 ? 'Prepare for review' : 'Waiting for team'}</p></div><Badge tone={i === 0 ? 'good' : 'quiet'}>{i === 0 ? 'In review' : 'Applied'}</Badge><ChevronRight size={17} className="text-[hsl(var(--muted-foreground))]" /></div></div>)}</div> : <EmptyState icon={Inbox} title="Your application story starts here." body="When a role feels right, apply with your SensAI profile and keep every next step in one place." action={<Link href="/candidate/jobs" data-testid="link-empty-find-role" className="inline-flex min-h-10 items-center rounded-lg bg-[hsl(var(--primary))] px-4 text-sm font-semibold text-[hsl(var(--primary-foreground))]">Explore roles</Link>} />}</WorkspaceShell>;
}
function generateResumeHtml(data: {
  name: string;
  targetRole?: string;
  targetCompany?: string;
  email?: string;
  phone?: string;
  location?: string;
  summary?: string;
  readinessRating?: number;
  skills?: string[];
  experience?: Array<{ role: string; company: string; duration: string; highlights: string[] }>;
  projects?: Array<{ title: string; techStack: string[]; description: string; impact?: string }>;
  education?: Array<{ degree: string; institution: string; year: string; score?: string }>;
  certifications?: Array<{ name: string; issuer: string; year?: string }>;
  careerBreakYears?: number;
  breakContext?: string;
}): string {
  const safeName = data.name || 'Candidate';
  const safeRole = data.targetRole || '';
  const safeEmail = data.email || '';
  const safePhone = data.phone || '';
  const safeLocation = data.location || '';
  const safeSummary = data.summary || '';
  const safeSkills = data.skills || [];
  const safeExp = data.experience || [];
  const safeProj = data.projects || [];
  const safeEdu = data.education || [];
  const safeCerts = data.certifications || [];
  const hasBreak = (data.careerBreakYears != null && data.careerBreakYears > 0) || Boolean(data.breakContext && data.breakContext.trim().length > 0);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${safeName} - Resume</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=DM+Mono:wght@400;500&display=swap');
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      color: #0f172a;
      background: #f1f5f9;
      padding: 36px 16px;
      line-height: 1.5;
    }
    .toolbar {
      max-width: 820px;
      margin: 0 auto 20px auto;
      display: flex;
      justify-content: flex-end;
      align-items: center;
    }
    .btn-print {
      background: #4f46e5;
      color: #ffffff;
      border: none;
      padding: 8px 18px;
      border-radius: 6px;
      font-weight: 600;
      font-size: 13px;
      cursor: pointer;
    }
    .btn-print:hover {
      background: #4338ca;
    }
    .sheet {
      max-width: 820px;
      margin: 0 auto;
      background: #ffffff;
      padding: 48px 52px;
      border-radius: 12px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.06);
      border: 1px solid #e2e8f0;
    }
    .header {
      border-bottom: 2px solid #0f172a;
      padding-bottom: 18px;
      margin-bottom: 22px;
    }
    .name {
      font-size: 30px;
      font-weight: 800;
      color: #0f172a;
      letter-spacing: -0.03em;
    }
    .role {
      font-size: 17px;
      font-weight: 600;
      color: #4f46e5;
      margin-top: 4px;
      margin-bottom: 8px;
    }
    .contact-row {
      display: flex;
      flex-wrap: wrap;
      gap: 16px;
      font-size: 12.5px;
      color: #475569;
      font-weight: 500;
    }
    .section {
      margin-bottom: 22px;
    }
    .section-title {
      font-size: 13px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: #0f172a;
      border-bottom: 1.5px solid #e2e8f0;
      padding-bottom: 4px;
      margin-bottom: 10px;
    }
    .summary {
      font-size: 13px;
      color: #334155;
      line-height: 1.65;
    }
    .skills-wrap {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }
    .skill-pill {
      background: #f8fafc;
      color: #334155;
      border: 1px solid #cbd5e1;
      padding: 3px 9px;
      border-radius: 5px;
      font-size: 12px;
      font-weight: 600;
    }
    .entry {
      margin-bottom: 14px;
    }
    .entry-header {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      margin-bottom: 2px;
    }
    .entry-title {
      font-size: 14px;
      font-weight: 700;
      color: #0f172a;
    }
    .entry-date {
      font-size: 12px;
      font-weight: 600;
      color: #64748b;
      font-family: 'DM Mono', monospace;
    }
    .entry-sub {
      font-size: 12.5px;
      font-weight: 600;
      color: #4f46e5;
      margin-bottom: 4px;
    }
    .bullets {
      list-style-type: disc;
      padding-left: 18px;
      font-size: 12.5px;
      color: #334155;
      line-height: 1.55;
    }
    .bullets li {
      margin-bottom: 3px;
    }
    .break-note {
      background: #f8fafc;
      border-left: 3px solid #6366f1;
      padding: 10px 14px;
      border-radius: 0 6px 6px 0;
      margin-bottom: 14px;
    }
    .break-title {
      font-size: 12.5px;
      font-weight: 700;
      color: #1e293b;
      margin-bottom: 2px;
    }
    .break-text {
      font-size: 12px;
      color: #475569;
      line-height: 1.5;
    }
    .edu-item, .cert-item {
      display: flex;
      justify-content: space-between;
      font-size: 12.5px;
      margin-bottom: 6px;
    }
    .edu-degree {
      font-weight: 700;
      color: #0f172a;
    }
    .edu-school {
      color: #64748b;
    }
    @media print {
      body {
        background: #ffffff;
        padding: 0;
      }
      .toolbar {
        display: none !important;
      }
      .sheet {
        box-shadow: none;
        border: none;
        padding: 0;
        max-width: 100%;
        border-radius: 0;
      }
      @page {
        margin: 14mm 16mm;
        size: A4 portrait;
      }
    }
  </style>
</head>
<body>
  <div class="toolbar">
    <button class="btn-print" onclick="window.print()">Print / Save as PDF</button>
  </div>
  <div class="sheet">
    <header class="header">
      <h1 class="name">${safeName}</h1>
      ${safeRole ? `<p class="role">${safeRole} ${data.targetCompany ? `· ${data.targetCompany}` : ''}</p>` : ''}
      <div class="contact-row">
        ${safeEmail ? `<span>✉️ ${safeEmail}</span>` : ''}
        ${safePhone ? `<span>📞 ${safePhone}</span>` : ''}
        ${safeLocation ? `<span>📍 ${safeLocation}</span>` : ''}
      </div>
    </header>

    ${safeSummary ? `
    <section class="section">
      <h2 class="section-title">Professional Summary</h2>
      <p class="summary">${safeSummary}</p>
    </section>
    ` : ''}

    ${safeSkills.length > 0 ? `
    <section class="section">
      <h2 class="section-title">Core Competencies & Skills</h2>
      <div class="skills-wrap">
        ${safeSkills.map(s => `<span class="skill-pill">${s}</span>`).join('')}
      </div>
    </section>
    ` : ''}

    ${hasBreak ? `
    <section class="section">
      <h2 class="section-title">Career Transition & Upskilling</h2>
      <div class="break-note">
        <p class="break-title">Career Break${data.careerBreakYears && data.careerBreakYears > 0 ? ` (${data.careerBreakYears} ${data.careerBreakYears === 1 ? 'Year' : 'Years'})` : ''}</p>
        ${data.breakContext ? `<p class="break-text">${data.breakContext}</p>` : ''}
      </div>
    </section>
    ` : ''}

    ${safeExp.length > 0 ? `
    <section class="section">
      <h2 class="section-title">Professional Experience</h2>
      ${safeExp.map(exp => `
        <div class="entry">
          <div class="entry-header">
            <div class="entry-title">${exp.role}</div>
            ${exp.duration ? `<div class="entry-date">${exp.duration}</div>` : ''}
          </div>
          ${exp.company ? `<div class="entry-sub">${exp.company}</div>` : ''}
          ${exp.highlights && exp.highlights.length > 0 ? `
            <ul class="bullets">
              ${exp.highlights.map(h => `<li>${h}</li>`).join('')}
            </ul>
          ` : ''}
        </div>
      `).join('')}
    </section>
    ` : ''}

    ${safeProj.length > 0 ? `
    <section class="section">
      <h2 class="section-title">Projects & Key Work</h2>
      ${safeProj.map(proj => `
        <div class="entry">
          <div class="entry-header">
            <div class="entry-title">${proj.title}</div>
            ${proj.techStack && proj.techStack.length > 0 ? `<div class="entry-date">${proj.techStack.join(' · ')}</div>` : ''}
          </div>
          ${proj.description ? `<p class="summary" style="margin-bottom: 4px;">${proj.description}</p>` : ''}
          ${proj.impact ? `<p class="entry-sub" style="color: #059669; font-size: 12px;">★ Impact: ${proj.impact}</p>` : ''}
        </div>
      `).join('')}
    </section>
    ` : ''}

    ${safeEdu.length > 0 ? `
    <section class="section">
      <h2 class="section-title">Education & Credentials</h2>
      ${safeEdu.map(edu => `
        <div class="edu-item">
          <div>
            <span class="edu-degree">${edu.degree}</span> ${edu.institution ? `· <span class="edu-school">${edu.institution}</span>` : ''}
            ${edu.score ? `<span style="color: #4f46e5; font-size: 11px; margin-left: 6px;">(${edu.score})</span>` : ''}
          </div>
          ${edu.year ? `<div class="entry-date">${edu.year}</div>` : ''}
        </div>
      `).join('')}
    </section>
    ` : ''}

    ${safeCerts.length > 0 ? `
    <section class="section">
      <h2 class="section-title">Certifications & Training</h2>
      ${safeCerts.map(cert => `
        <div class="cert-item">
          <div>
            <span class="edu-degree">${cert.name}</span> ${cert.issuer ? `· <span class="edu-school">${cert.issuer}</span>` : ''}
          </div>
          ${cert.year ? `<div class="entry-date">${cert.year}</div>` : ''}
        </div>
      `).join('')}
    </section>
    ` : ''}
  </div>
</body>
</html>`;
}

function Resume() {
  const p = useProduct();
  const { user } = useUser();

  // Sync latest candidate profile from database on mount if needed
  useEffect(() => {
    let mounted = true;
    if (!p.profile.name || (p.profile.skills && p.profile.skills.length === 0)) {
      fetch('/api/candidate/profile')
        .then(res => res.ok ? res.json() : null)
        .then(data => {
          if (!mounted) return;
          if (data?.profile && (data.profile.name || (data.profile.skills && data.profile.skills.length > 0))) {
            p.updateProfile(data.profile);
          }
        })
        .catch(err => console.warn('Could not sync candidate profile in Resume:', err));
    }
    return () => { mounted = false; };
  }, []);

  const profile = p.profile;
  const candidateName = profile.name?.trim() || user?.fullName || user?.firstName || 'Candidate';
  const targetRole = profile.targetRole?.trim() || '';
  const targetCompany = profile.targetCompany?.trim() || '';
  const email = profile.email?.trim() || user?.primaryEmailAddress?.emailAddress || '';
  const phone = profile.phone?.trim() || '';
  const location = profile.location?.trim() || '';
  const summary = profile.summary?.trim() || '';
  const skills = profile.skills || [];
  const experience = profile.experience || [];
  const projects = profile.projects || [];
  const education = profile.education || [];
  const certifications = profile.certifications || [];
  const careerBreakYears = profile.careerBreakYears || 0;
  const breakContext = profile.breakContext?.trim() || '';

  const hasBreak = (careerBreakYears > 0) || (breakContext.length > 0);

  const handleExport = () => {
    const htmlContent = generateResumeHtml({
      name: candidateName,
      targetRole,
      targetCompany,
      email,
      phone,
      location,
      summary,
      readinessRating: profile.readinessRating,
      skills,
      experience,
      projects,
      education,
      certifications,
      careerBreakYears,
      breakContext
    });

    const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const sanitizedName = candidateName.replace(/[^a-zA-Z0-9_-]/g, '_') || 'Candidate';
    const fileName = `${sanitizedName}_Resume.html`;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    p.notify(`Resume exported successfully as ${fileName}!`);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <WorkspaceShell role="candidate">
      <PageTitle
        eyebrow="Resume Studio"
        title="Candidate Resume"
        description="Formatted view of your candidate profile. When you click export, your updated resume will download directly."
        action={
          <div className="no-print flex flex-wrap items-center gap-2.5">
            <Button onClick={handleExport} data-testid="button-export-resume">
              <Download size={15} /> Export Resume
            </Button>
            <Button onClick={handlePrint} variant="outline" data-testid="button-print-resume">
              <FileText size={15} /> Print / Save PDF
            </Button>
          </div>
        }
      />

      {/* Full Resume Document Sheet */}
      <div className="mx-auto max-w-4xl pb-12">
        <article
          id="resume-document-sheet"
          className="rounded-2xl border border-slate-200/90 bg-white p-8 text-slate-900 shadow-2xl sm:p-12"
          style={{ color: '#0f172a', background: '#ffffff' }}
        >
          {/* Header */}
          <header className="border-b-2 border-slate-900 pb-6">
            <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl text-slate-900">
              {candidateName}
            </h1>
            {targetRole && (
              <p className="mt-1 text-lg font-bold text-indigo-600">
                {targetRole} {targetCompany ? `· ${targetCompany}` : ''}
              </p>
            )}

            <div className="mt-4 flex flex-wrap gap-y-1.5 gap-x-4 text-xs font-medium text-slate-600">
              {email && <span>✉️ {email}</span>}
              {phone && <span>📞 {phone}</span>}
              {location && <span>📍 {location}</span>}
            </div>
          </header>

          {/* Executive Summary - ONLY if candidate provided one */}
          {summary && (
            <section className="mt-6">
              <h2 className="border-b border-slate-200 pb-1 text-xs font-extrabold uppercase tracking-widest text-slate-900">
                Professional Summary
              </h2>
              <p className="mt-2.5 text-sm leading-relaxed text-slate-700">
                {summary}
              </p>
            </section>
          )}

          {/* Core Competencies & Skills - ONLY candidate's actual skills */}
          {skills.length > 0 && (
            <section className="mt-6">
              <h2 className="border-b border-slate-200 pb-1 text-xs font-extrabold uppercase tracking-widest text-slate-900">
                Core Competencies & Skills
              </h2>
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {skills.map((skill, idx) => (
                  <span
                    key={idx}
                    className="rounded-md border border-slate-300 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-800 shadow-2xs"
                  >
                    {skill}
                  </span>
                ))}
              </div>
            </section>
          )}

          {/* Strategic Career Transition / Break Note - ONLY if candidate actually has one */}
          {hasBreak && (
            <section className="mt-6">
              <h2 className="border-b border-slate-200 pb-1 text-xs font-extrabold uppercase tracking-widest text-slate-900">
                Career Transition & Upskilling
              </h2>
              <div className="mt-2.5 rounded-lg border-l-4 border-indigo-500 bg-indigo-50/60 p-3.5 text-xs text-indigo-950">
                <p className="font-bold text-slate-900">
                  Career Break{careerBreakYears > 0 ? ` (${careerBreakYears} ${careerBreakYears === 1 ? 'Year' : 'Years'})` : ''}
                </p>
                {breakContext && (
                  <p className="mt-1 leading-relaxed text-slate-700">
                    {breakContext}
                  </p>
                )}
              </div>
            </section>
          )}

          {/* Professional Experience - ONLY real candidate experience */}
          {experience.length > 0 && (
            <section className="mt-6">
              <h2 className="border-b border-slate-200 pb-1 text-xs font-extrabold uppercase tracking-widest text-slate-900">
                Professional Experience
              </h2>
              <div className="mt-3 space-y-4">
                {experience.map((exp, idx) => (
                  <div key={idx}>
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <h3 className="text-sm font-bold text-slate-900">{exp.role}</h3>
                      {exp.duration && (
                        <span className="font-mono text-xs font-semibold text-slate-500">{exp.duration}</span>
                      )}
                    </div>
                    {exp.company && (
                      <p className="text-xs font-bold text-indigo-600">{exp.company}</p>
                    )}
                    {exp.highlights && exp.highlights.length > 0 && (
                      <ul className="mt-2 list-disc space-y-1 pl-4 text-xs leading-relaxed text-slate-700">
                        {exp.highlights.map((h, hIdx) => (
                          <li key={hIdx}>{h}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Key Projects - ONLY real candidate projects */}
          {projects.length > 0 && (
            <section className="mt-6">
              <h2 className="border-b border-slate-200 pb-1 text-xs font-extrabold uppercase tracking-widest text-slate-900">
                Projects & Key Work
              </h2>
              <div className="mt-3 space-y-4">
                {projects.map((proj, idx) => (
                  <div key={idx} className="rounded-lg border border-slate-200 bg-slate-50/60 p-3.5">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <h3 className="text-sm font-bold text-slate-900">{proj.title}</h3>
                      {proj.techStack && proj.techStack.length > 0 && (
                        <span className="font-mono text-[11px] font-medium text-slate-500">
                          {proj.techStack.join(' · ')}
                        </span>
                      )}
                    </div>
                    {proj.description && (
                      <p className="mt-1.5 text-xs leading-relaxed text-slate-700">{proj.description}</p>
                    )}
                    {proj.impact && (
                      <p className="mt-1.5 text-xs font-bold text-emerald-700">
                        ★ Impact: {proj.impact}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Education - ONLY real candidate education */}
          {education.length > 0 && (
            <section className="mt-6">
              <h2 className="border-b border-slate-200 pb-1 text-xs font-extrabold uppercase tracking-widest text-slate-900">
                Education & Credentials
              </h2>
              <div className="mt-2.5 space-y-2">
                {education.map((edu, idx) => (
                  <div key={idx} className="flex flex-wrap items-baseline justify-between text-xs">
                    <div>
                      <span className="font-bold text-slate-900">{edu.degree}</span>
                      {edu.institution && (
                        <span className="text-slate-600"> · {edu.institution}</span>
                      )}
                      {edu.score && (
                        <span className="ml-2 font-medium text-indigo-600">({edu.score})</span>
                      )}
                    </div>
                    {edu.year && (
                      <span className="font-mono font-medium text-slate-500">{edu.year}</span>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Certifications - ONLY real candidate certifications */}
          {certifications.length > 0 && (
            <section className="mt-6">
              <h2 className="border-b border-slate-200 pb-1 text-xs font-extrabold uppercase tracking-widest text-slate-900">
                Certifications & Training
              </h2>
              <div className="mt-2.5 space-y-2">
                {certifications.map((cert, idx) => (
                  <div key={idx} className="flex flex-wrap items-baseline justify-between text-xs">
                    <div>
                      <span className="font-bold text-slate-900">{cert.name}</span>
                      {cert.issuer && (
                        <span className="text-slate-600"> · {cert.issuer}</span>
                      )}
                    </div>
                    {cert.year && (
                      <span className="font-mono font-medium text-slate-500">{cert.year}</span>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* If the candidate profile has no details yet, show a clean helper note on-screen */}
          {!summary && skills.length === 0 && experience.length === 0 && projects.length === 0 && education.length === 0 && (
            <div className="no-print mt-6 rounded-xl border border-dashed border-slate-300 p-8 text-center text-xs text-slate-500">
              <p className="font-semibold text-sm text-slate-800">Your profile details will appear here.</p>
              <p className="mt-1">Add your skills, summary, or work history in <Link href="/candidate/profile" className="text-indigo-600 font-semibold underline">Edit Profile</Link> to view them on your resume.</p>
            </div>
          )}
        </article>
      </div>
    </WorkspaceShell>
  );
}

function AICoachMarkdownMessage({ content }: { content: string }) {

  const blocks = content.split('\n\n');

  function renderInline(text: string) {
    const parts = text.split(/(\*\*.*?\*\*|\*.*?\*|`.*?`)/g);
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={i} className="font-bold text-[hsl(var(--foreground))]">{part.slice(2, -2)}</strong>;
      }
      if (part.startsWith('*') && part.endsWith('*')) {
        return <em key={i} className="italic text-[hsl(var(--foreground))]/90">{part.slice(1, -1)}</em>;
      }
      if (part.startsWith('`') && part.endsWith('`')) {
        return <code key={i} className="rounded bg-[hsl(var(--muted))] px-1.5 py-0.5 font-mono text-xs text-[hsl(var(--primary))] font-semibold">{part.slice(1, -1)}</code>;
      }
      return part;
    });
  }

  function renderLines(lines: string[]) {
    return lines.map((line, idx) => (
      <span key={idx}>
        {renderInline(line)}
        {idx < lines.length - 1 && <br />}
      </span>
    ));
  }

  return (
    <div className="space-y-3.5 text-sm leading-relaxed">
      {blocks.map((block, bIdx) => {
        const lines = block.split('\n');
        const firstLine = lines[0].trim();

        // Section Headings (### or ##)
        if (firstLine.startsWith('### ') || firstLine.startsWith('## ')) {
          const headingText = firstLine.replace(/^#{2,3}\s+/, '');
          const restLines = lines.slice(1);
          return (
            <div key={bIdx} className="space-y-1 pt-1">
              <h4 className="font-semibold text-base tracking-tight text-[hsl(var(--foreground))] flex items-center gap-2">
                {headingText}
              </h4>
              {restLines.length > 0 && (
                <div className="space-y-1 text-sm text-[hsl(var(--foreground))]/90 mt-1">
                  {renderLines(restLines)}
                </div>
              )}
            </div>
          );
        }

        // Script / Quote Block (> )
        if (firstLine.startsWith('> ')) {
          const quoteContent = lines.map(l => l.replace(/^>\s*/, '')).join(' ');
          return (
            <div key={bIdx} className="my-2.5 rounded-xl border-l-4 border-[hsl(var(--primary))] bg-[hsl(var(--muted))]/70 p-4 italic text-[hsl(var(--foreground))] shadow-xs">
              <div className="text-xs font-semibold not-italic uppercase tracking-wider text-[hsl(var(--primary))] mb-1 flex items-center gap-1.5">
                <Sparkles size={13} /> Recommended Conversational Script
              </div>
              <div className="text-sm leading-relaxed">{renderInline(quoteContent)}</div>
            </div>
          );
        }

        // Bulleted List (- or *)
        if (lines.some(l => l.trim().startsWith('- ') || l.trim().startsWith('* '))) {
          return (
            <ul key={bIdx} className="space-y-2 pl-1">
              {lines.map((l, lIdx) => {
                const isBullet = l.trim().startsWith('- ') || l.trim().startsWith('* ');
                const cleanText = isBullet ? l.trim().replace(/^[-*]\s+/, '') : l;
                return (
                  <li key={lIdx} className="flex items-start gap-2.5">
                    <span className="mt-2 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-[hsl(var(--primary))]" />
                    <span className="flex-1">{renderInline(cleanText)}</span>
                  </li>
                );
              })}
            </ul>
          );
        }

        // Numbered List (1. 2. etc.)
        if (lines.some(l => /^\d+\.\s/.test(l.trim()))) {
          return (
            <ol key={bIdx} className="space-y-2.5 pl-1">
              {lines.map((l, lIdx) => {
                const match = l.trim().match(/^(\d+)\.\s+(.*)$/);
                if (match) {
                  return (
                    <li key={lIdx} className="flex items-start gap-2.5">
                      <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-[hsl(var(--primary))]/20 text-[11px] font-bold text-[hsl(var(--primary))] mt-0.5">
                        {match[1]}
                      </span>
                      <span className="flex-1">{renderInline(match[2])}</span>
                    </li>
                  );
                }
                return <p key={lIdx}>{renderInline(l)}</p>;
              })}
            </ol>
          );
        }

        // Regular Paragraph
        return (
          <p key={bIdx} className="text-[hsl(var(--foreground))]">
            {renderLines(lines)}
          </p>
        );
      })}
    </div>
  );
}

function Assistant() {
  const p = useProduct();
  const { user } = useUser();
  const profile = p.profile;
  const [profileLoading, setProfileLoading] = useState(false);

  // Actively fetch real candidate profile from backend database on mount
  useEffect(() => {
    let mounted = true;
    setProfileLoading(true);
    fetch('/api/candidate/profile')
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (!mounted) return;
        if (data?.profile && (data.profile.name || data.profile.targetRole || (data.profile.skills && data.profile.skills.length > 0))) {
          p.updateProfile(data.profile);
        }
      })
      .catch(err => console.warn('Could not fetch candidate profile on mount:', err))
      .finally(() => {
        if (mounted) setProfileLoading(false);
      });
    return () => { mounted = false; };
  }, []);

  const candidateName = profile.name?.trim() || user?.fullName || user?.firstName || 'Candidate';
  const targetRole = profile.targetRole?.trim() || (profile.skills?.length ? 'Software Engineer' : 'Target Role');
  const targetCompany = profile.targetCompany?.trim() || 'Target Employer';
  const skillsList = (profile.skills && profile.skills.length > 0) ? profile.skills : [];
  const fitScore = profile.fit || 85;
  const readinessRating = profile.readinessRating || 88;

  const initialGreeting = useMemo(() => {
    return `### 👋 Welcome, **${candidateName}**!

I am **SensAI Career Coach**, your AI-powered career co-pilot.

### 📊 Your Active Profile Intelligence
- **Target Role**: **${targetRole}** ${targetCompany !== 'Target Employer' ? `at **${targetCompany}**` : ''}
- **Verified Alignment**: **${fitScore}% Match** (Skills-first evaluation based on your demonstrated capabilities)
- **Top Verified Skills**: ${skillsList.length > 0 ? skillsList.slice(0, 5).join(', ') : 'Add skills or upload resume to view ontology signals'}

How can I support your career journey today? You can ask me for interview coaching, pitch formulation, or tailored skill gap roadmaps.`;
  }, [candidateName, targetRole, targetCompany, fitScore, skillsList]);

  const [messages, setMessages] = useState<Array<{ role: 'assistant' | 'user'; content: string }>>([
    { role: 'assistant', content: initialGreeting }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Sync initial greeting when fresh profile loads
  useEffect(() => {
    setMessages(prev => {
      if (prev.length === 1 && prev[0].role === 'assistant') {
        return [{ role: 'assistant', content: initialGreeting }];
      }
      return prev;
    });
  }, [initialGreeting]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  async function send(customText?: string) {
    const text = (customText || input).trim();
    if (!text || loading) return;

    const newMessages = [...messages, { role: 'user' as const, content: text }];
    setMessages(newMessages);
    if (!customText) setInput('');
    setLoading(true);

    try {
      const res = await fetch('/api/agents/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          history: messages,
          profile: {
            name: candidateName,
            location: profile.location || 'India',
            targetRole,
            targetCompany,
            workMode: profile.workMode || 'Hybrid',
            skills: profile.skills,
            fit: fitScore,
            readinessRating: readinessRating,
            education: profile.education,
            projects: profile.projects
          }
        }),
      });
      const data = await res.json().catch(() => null);

      if (!res.ok || (data && data.success === false)) {
        const errMsg = data?.error || `Agent request returned status ${res.status}`;
        setMessages(m => [...m, {
          role: 'assistant',
          content: `⚠️ **Agent Request Failed**: ${errMsg}\n\nPlease try sending your message again.`
        }]);
        p.notify(`Error: ${errMsg}`);
        return;
      }

      if (data?.reply) {
        setMessages(m => [...m, { role: 'assistant', content: data.reply }]);
      }
      // If backend returned refreshed DB profile, sync it to context
      if (data?.profile && data.profile.name) {
        p.updateProfile(data.profile);
      }
    } catch (err: any) {
      const errMsg = err?.message || 'Network connection failed.';
      setMessages(m => [...m, {
        role: 'assistant',
        content: `⚠️ **Connection Error**: ${errMsg}\n\nPlease check your internet connection and retry.`
      }]);
      p.notify(`Error: ${errMsg}`);
    } finally {
      setLoading(false);
    }
  }

  function handleReset() {
    setMessages([{ role: 'assistant', content: initialGreeting }]);
  }

  const promptSuggestions = [
    `How do I pitch my experience for ${targetRole}?`,
    skillsList.length > 0
      ? `What are my top strengths from my skills (${skillsList.slice(0, 2).join(', ')})?`
      : `What are the core technical skills needed for ${targetRole}?`,
    `Simulate a technical interview question for ${targetRole}`,
    `What skills should I develop next for ${targetRole}?`
  ];

  return (
    <WorkspaceShell role="candidate">
      <PageTitle
        eyebrow="SensAI Career Coach"
        title="Your Personalized Career Co-Pilot"
        description="Grounded in your real verified capabilities, learning goals, and Skills Intelligence Platform profile."
        action={
          <Button
            onClick={handleReset}
            data-testid="button-reset-coach-chat"
            variant="outline"
            size="sm"
            className="text-xs"
          >
            <RefreshCcw size={14} className="mr-1.5" /> Start New Conversation
          </Button>
        }
      />

      <div className="mx-auto max-w-4xl space-y-4">
        {/* Candidate Profile Intelligence Grounding Banner */}
        <section className="surface flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[hsl(var(--primary))]/20 bg-[hsl(var(--primary))]/5 p-4 sm:px-6">
          <div className="flex flex-wrap items-center gap-2.5 text-xs">
            <span className="font-semibold text-[hsl(var(--primary))] flex items-center gap-1.5">
              <Sparkles size={14} /> Grounded in Real Profile:
            </span>
            <span className="rounded-md bg-[hsl(var(--card))] px-2.5 py-1 font-medium shadow-2xs border border-[hsl(var(--border))]">
              👤 {candidateName}
            </span>
            <span className="rounded-md bg-[hsl(var(--card))] px-2.5 py-1 font-medium shadow-2xs border border-[hsl(var(--border))]">
              🎯 {targetRole} {targetCompany !== 'Target Employer' ? `@ ${targetCompany}` : ''}
            </span>
            {skillsList.length > 0 && (
              <span className="rounded-md bg-[hsl(var(--card))] px-2.5 py-1 font-medium shadow-2xs border border-[hsl(var(--border))]">
                ⚡ {skillsList.length} Verified Skills
              </span>
            )}
            <span className="rounded-md bg-[#e1f0ea] text-[#23614e] px-2.5 py-1 font-semibold">
              <ShieldCheck size={12} className="inline mr-1" /> Skills-First Intelligence
            </span>
            <span className="rounded-md bg-[hsl(var(--card))] px-2.5 py-1 font-medium shadow-2xs border border-[hsl(var(--border))]">
              ✨ {fitScore}% Match
            </span>
          </div>
          {profileLoading && (
            <span className="text-[11px] text-[hsl(var(--muted-foreground))] flex items-center gap-1">
              <RefreshCcw size={11} className="animate-spin" /> Syncing DB Profile...
            </span>
          )}
        </section>

        {/* Chat Conversation Card */}
        <section className="surface overflow-hidden rounded-2xl border border-[hsl(var(--border))] shadow-sm">
          {/* Card Header */}
          <div className="flex items-center justify-between border-b border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4 sm:px-6">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-[#8B5CF6] to-[#3B82F6] text-white shadow-sm">
                <Sparkles size={18} />
              </div>
              <div>
                <p className="text-sm font-bold flex items-center gap-1.5">
                  AI Career Coach
                  <span className="rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 text-[10px] font-semibold px-2 py-0.5">Live Agent</span>
                </p>
                <p className="text-xs text-[hsl(var(--muted-foreground))]">
                  Personalized to {candidateName} · Skills Intelligence Platform
                </p>
              </div>
            </div>
            <Badge tone="good">Grounded in Skills Graph</Badge>
          </div>

          {/* Chat Messages Body */}
          <div className="min-h-[420px] max-h-[560px] overflow-y-auto space-y-4 bg-[hsl(var(--background))] p-5 sm:p-6">
            {messages.map((m, i) => (
              <div
                key={`${m.role}-${i}`}
                className={`flex gap-3 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {m.role === 'assistant' && (
                  <div className="grid h-8 w-8 flex-shrink-0 place-items-center rounded-lg bg-gradient-to-br from-[#8B5CF6] to-[#3B82F6] text-white text-xs font-bold mt-1 shadow-2xs">
                    <Sparkles size={14} />
                  </div>
                )}
                <div
                  className={`max-w-[85%] rounded-2xl p-4 sm:p-5 text-sm leading-relaxed ${
                    m.role === 'user'
                      ? 'bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] font-medium rounded-tr-xs shadow-sm'
                      : 'bg-[hsl(var(--card))] border border-[hsl(var(--border))] text-[hsl(var(--foreground))] rounded-tl-xs shadow-xs'
                  }`}
                >
                  {m.role === 'assistant' ? (
                    <AICoachMarkdownMessage content={m.content} />
                  ) : (
                    <p className="whitespace-pre-wrap">{m.content}</p>
                  )}
                </div>
                {m.role === 'user' && (
                  <div className="grid h-8 w-8 flex-shrink-0 place-items-center rounded-lg bg-[hsl(var(--muted))] text-[hsl(var(--foreground))] text-xs font-bold mt-1">
                    {candidateName.slice(0, 2).toUpperCase() || 'ME'}
                  </div>
                )}
              </div>
            ))}

            {loading && (
              <div className="flex items-center gap-3">
                <div className="grid h-8 w-8 flex-shrink-0 place-items-center rounded-lg bg-gradient-to-br from-[#8B5CF6] to-[#3B82F6] text-white text-xs font-bold shadow-2xs">
                  <Sparkles size={14} className="animate-spin" />
                </div>
                <div className="rounded-2xl rounded-tl-xs border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-4 py-3 text-sm text-[hsl(var(--muted-foreground))] flex items-center gap-2 shadow-xs">
                  <span className="h-2 w-2 rounded-full bg-[hsl(var(--primary))] animate-ping" />
                  AI Coach is formulating your personalized guidance...
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick Context Prompt Suggestions & Input */}
          <div className="border-t border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4 sm:p-5 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wider mr-1">
                Suggested Prompts:
              </span>
              {promptSuggestions.map(q => (
                <button
                  key={q}
                  onClick={() => send(q)}
                  disabled={loading}
                  data-testid={`button-prompt-${q.slice(0, 8)}`}
                  className="rounded-full border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-1.5 text-xs text-[hsl(var(--foreground))] hover:border-[hsl(var(--primary))] hover:bg-[hsl(var(--primary))]/5 transition-all text-left disabled:opacity-50"
                >
                  ✨ {q}
                </button>
              ))}
            </div>

            <div className="flex gap-2">
              <input
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && send()}
                data-testid="input-assistant-message"
                placeholder={`Ask anything about your journey to ${targetRole}...`}
                className="h-12 flex-1 rounded-xl border border-[hsl(var(--input))] bg-[hsl(var(--background))] px-4 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]/30"
                disabled={loading}
              />
              <Button
                onClick={() => send()}
                data-testid="button-send-assistant"
                className="h-12 w-12 px-0 rounded-xl"
                disabled={loading || !input.trim()}
              >
                <Send size={16} />
              </Button>
            </div>
          </div>
        </section>
      </div>
    </WorkspaceShell>
  );
}


function RecruiterHome() {
  const p = useProduct(); 
  const { user } = useUser();
  const greeting = useTimeGreeting();
  const recruiterName = user?.firstName || 'Alex';
  usePageMeta('Recruiter overview', 'A human-reviewed intelligence workspace for hiring teams.');
  return <WorkspaceShell role="recruiter"><PageTitle title={`${greeting}, ${recruiterName}.`} description="Your team can move quickly today without letting the score make the decision." action={<Link href="/recruiter/jobs/create" data-testid="link-create-job-home" className="inline-flex min-h-10 items-center rounded-lg bg-[hsl(var(--primary))] px-4 text-sm font-semibold text-[hsl(var(--primary-foreground))]"><Plus size={15} className="mr-2" /> Create a role</Link>} /><div className="grid gap-5 lg:grid-cols-[1.2fr_.8fr]"><section className="rounded-2xl bg-[hsl(var(--sidebar))] p-6 text-[hsl(var(--sidebar-foreground))] sm:p-8"><div className="flex flex-wrap items-start justify-between gap-5"><div><p className="eyebrow text-[hsl(var(--accent))]">Hiring signal</p><h2 className="mt-3 font-display text-3xl">Your shortlist is ready for judgment.</h2><p className="mt-3 max-w-xl text-sm leading-6 text-[hsl(var(--sidebar-foreground))]/60">12 candidates have verified skill evidence for Product Operations Lead. 4 are ready for a human review.</p></div><UsersRound size={30} className="text-[hsl(var(--accent))]" /></div><div className="mt-8 grid gap-3 border-t border-[hsl(var(--sidebar-foreground))]/15 pt-5 sm:grid-cols-3"><div><p className="text-xs text-[hsl(var(--sidebar-foreground))]/55">Open roles</p><p className="mt-1 font-data text-xl">8</p></div><div><p className="text-xs text-[hsl(var(--sidebar-foreground))]/55">Shortlist-ready</p><p className="mt-1 font-data text-xl">12</p></div><div><p className="text-xs text-[hsl(var(--sidebar-foreground))]/55">Human reviewed</p><p className="mt-1 font-data text-xl text-[hsl(var(--accent))]">68%</p></div></div><Link href="/recruiter/shortlist" data-testid="link-review-shortlist-home" className="mt-7 inline-flex min-h-10 items-center rounded-lg bg-[hsl(var(--accent))] px-4 text-sm font-semibold text-[hsl(var(--foreground))]">Review shortlist <ArrowRight size={15} className="ml-2" /></Link></section><section className="surface rounded-2xl p-6"><div className="flex items-center justify-between"><div><p className="eyebrow">Fairness monitor</p><p className="mt-2 font-display text-2xl">Healthy with one watch</p></div><ShieldCheck size={23} className="text-[hsl(var(--primary))]" /></div><div className="mt-6 rounded-xl bg-[#e1f0ea] p-4"><div className="flex items-center gap-2 text-sm font-semibold text-[#23614e]"><CheckCircle2 size={16} /> Career breaks excluded from scoring</div><p className="mt-2 text-xs leading-5 text-[#23614e]/75">Fit signals use verified skills, role evidence, and stated preferences.</p></div><div className="mt-5 flex items-center justify-between text-sm"><span>Location signal variance</span><Badge tone="warm">Review</Badge></div><Link href="/recruiter/bias-audit" data-testid="link-view-fairness" className="mt-5 inline-flex items-center text-sm font-semibold text-[hsl(var(--primary))]">Open monitor <ArrowRight size={15} className="ml-2" /></Link></section></div><div className="mt-5 grid gap-5 lg:grid-cols-3"><section className="surface rounded-2xl p-6 lg:col-span-2"><div className="flex items-center justify-between"><div><p className="eyebrow">Recent activity</p><h2 className="mt-2 font-display text-2xl">Keep the conversation moving.</h2></div><Link href="/recruiter/candidates" data-testid="link-all-candidates" className="text-sm font-semibold text-[hsl(var(--primary))]">See all</Link></div><div className="mt-5 grid gap-3">{candidates.slice(0, 3).map((c, i) => <div key={c.id} className="flex items-center justify-between gap-3 rounded-xl bg-[hsl(var(--muted))] p-3"><div className="flex items-center gap-3"><div className="grid h-9 w-9 place-items-center rounded-full text-xs font-semibold text-white" style={{ background: c.color }}>{c.initials}</div><div><p className="text-sm font-semibold">{c.name}</p><p className="text-xs text-[hsl(var(--muted-foreground))]">{i === 0 ? 'Moved to human review' : i === 1 ? 'Added evidence note' : 'Saved to shortlist'}</p></div></div><Badge tone={i === 0 ? 'good' : 'quiet'}>{i === 0 ? 'Today' : 'Yesterday'}</Badge></div>)}</div></section><section className="rounded-2xl bg-[#f8e6cf] p-6"><p className="eyebrow text-[#925d26]">Employer readiness</p><p className="mt-4 font-display text-2xl">Your story helps candidates choose you too.</p><p className="mt-3 text-sm leading-6 text-[#925d26]/80">Add flexibility, manager context, and a real first-90-days view to improve qualified applications.</p><Link href="/recruiter/settings" data-testid="link-employer-readiness" className="mt-5 inline-flex items-center text-sm font-semibold text-[#925d26]">Complete profile <ArrowRight size={15} className="ml-2" /></Link></section></div></WorkspaceShell>;
}
function RecruiterJobs() {
  return <WorkspaceShell role="recruiter"><PageTitle eyebrow="Jobs" title="Roles in motion." description="Give every opening a clear brief, a fair signal, and a human owner." action={<Link href="/recruiter/jobs/create" data-testid="link-create-job" className="inline-flex min-h-10 items-center rounded-lg bg-[hsl(var(--primary))] px-4 text-sm font-semibold text-[hsl(var(--primary-foreground))]"><Plus size={15} className="mr-2" /> Create a role</Link>} /><div className="grid gap-4">{jobs.map((job, i) => <div key={job.id} className="surface flex flex-wrap items-center justify-between gap-4 rounded-2xl p-5"><div className="flex items-center gap-4"><div className="grid h-11 w-11 place-items-center rounded-xl bg-[hsl(var(--secondary))] text-[hsl(var(--primary))]"><BriefcaseBusiness size={19} /></div><div><Link href={`/recruiter/jobs/${job.id}`} data-testid={`link-recruiter-job-${job.id}`} className="font-semibold">{job.title}</Link><p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">{job.location} · {job.mode} · Updated {i + 1}d ago</p></div></div><div className="flex items-center gap-6"><div className="hidden text-right sm:block"><p className="font-data text-lg">{12 + i * 3}</p><p className="text-[11px] text-[hsl(var(--muted-foreground))]">candidates</p></div><Badge tone={i < 3 ? 'good' : 'quiet'}>{i < 3 ? 'Active' : 'Draft'}</Badge><MoreHorizontal size={18} className="text-[hsl(var(--muted-foreground))]" /></div></div>)}</div></WorkspaceShell>;
}
function CreateJob() {
  const [saved, setSaved] = useState(false); const [location, setLocation] = useLocation();
  return <WorkspaceShell role="recruiter"><PageTitle eyebrow="Jobs / New role" title="Create a clear brief." description="The quality of the signal starts with the quality of the question." /><div className="mx-auto max-w-3xl"><section className="surface rounded-2xl p-6 sm:p-8"><div className="grid gap-5"><label className="grid gap-2 text-sm font-semibold">Role title<input data-testid="input-create-job-title" defaultValue="Product Operations Lead" className="h-11 rounded-lg border border-[hsl(var(--input))] bg-transparent px-3 font-normal" /></label><div className="grid gap-5 sm:grid-cols-2"><label className="grid gap-2 text-sm font-semibold">Team<input data-testid="input-create-job-team" defaultValue="Product Operations" className="h-11 rounded-lg border border-[hsl(var(--input))] bg-transparent px-3 font-normal" /></label><label className="grid gap-2 text-sm font-semibold">Work mode<select data-testid="select-create-job-mode" className="h-11 rounded-lg border border-[hsl(var(--input))] bg-transparent px-3 font-normal"><option>Hybrid</option><option>Remote</option><option>On-site</option></select></label></div><label className="grid gap-2 text-sm font-semibold">What will this person make possible?<textarea data-testid="textarea-create-job-summary" defaultValue="Build the operating rhythm behind products that make work more human." className="min-h-28 rounded-lg border border-[hsl(var(--input))] bg-transparent p-3 font-normal" /></label><div><p className="text-sm font-semibold">Must-have signals</p><div className="mt-3 flex flex-wrap gap-2">{['Program strategy', 'Stakeholder alignment', 'SQL', 'Clear writing'].map(s => <Badge key={s} tone="good"><Check size={12} className="mr-1" />{s}</Badge>)}</div></div></div><div className="mt-8 flex flex-wrap justify-end gap-3 border-t border-[hsl(var(--border))] pt-6"><Button onClick={() => setLocation('/recruiter/jobs')} data-testid="button-cancel-create" variant="outline">Cancel</Button><Button onClick={() => { setSaved(true); setTimeout(() => setLocation('/recruiter/jobs'), 500); }} data-testid="button-publish-job">{saved ? 'Published' : 'Publish role'} <Send size={15} /></Button></div></section></div></WorkspaceShell>;
}
function RecruiterJobDetail() {
  const { id } = useParams<{ id: string }>(); const job = jobs.find(j => j.id === Number(id)) || jobs[0];
  return <WorkspaceShell role="recruiter"><Link href="/recruiter/jobs" data-testid="link-recruiter-back-jobs" className="mb-7 inline-flex items-center gap-2 text-sm font-semibold text-[hsl(var(--primary))]"><ArrowLeft size={15} /> Jobs</Link><PageTitle eyebrow="Role intelligence" title={job.title} description={`${job.company} · ${job.location} · ${job.mode}`} action={<Button onClick={() => window.alert('Role editor opened in this prototype.')} data-testid="button-edit-role" variant="outline"><Pencil size={15} /> Edit role</Button>} /><div className="grid gap-5 lg:grid-cols-[1.2fr_.8fr]"><section className="surface rounded-2xl p-6"><div className="flex items-center justify-between"><div><p className="eyebrow">Pipeline</p><h2 className="mt-2 font-display text-3xl">34 candidates → 12 signals</h2></div><Badge tone="good">Active</Badge></div><div className="mt-8 grid gap-3 sm:grid-cols-3">{[['New', '22'], ['Review', '8'], ['Shortlist', '4']].map(([label, n], i) => <div key={label} className="rounded-xl bg-[hsl(var(--muted))] p-4"><p className="text-xs text-[hsl(var(--muted-foreground))]">{label}</p><p className="mt-2 font-data text-2xl">{n}</p><div className="mt-3 h-1 rounded-full bg-[hsl(var(--secondary))]"><div className="h-full rounded-full bg-[hsl(var(--primary))]" style={{ width: `${[65, 40, 25][i]}%` }} /></div></div>)}</div><Link href="/recruiter/candidates" data-testid="link-review-role-candidates" className="mt-7 inline-flex min-h-10 items-center rounded-lg bg-[hsl(var(--primary))] px-4 text-sm font-semibold text-[hsl(var(--primary-foreground))]">Review candidates <ArrowRight size={15} className="ml-2" /></Link></section><aside className="surface rounded-2xl p-6"><p className="eyebrow">Signal guardrails</p><div className="mt-5 grid gap-4 text-sm"><div className="flex justify-between gap-3"><span>Scoring basis</span><span className="font-semibold text-[hsl(var(--primary))]">100% Skills-First</span></div><div className="flex justify-between gap-3"><span>Human review required</span><span className="font-semibold text-[hsl(var(--primary))]">Yes</span></div><div className="flex justify-between gap-3"><span>Fairness monitor</span><Badge tone="warm">1 watch</Badge></div></div><div className="mt-6 rounded-xl bg-[#e1f0ea] p-4 text-xs leading-5 text-[#23614e]">Recommendations are based on evidence and verified skills in Skills Intelligence Platform.</div></aside></div></WorkspaceShell>;
}

function RecruiterCandidates() {
  const [query, setQuery] = useState(''); const p = useProduct(); const list = candidates.filter(c => `${c.name} ${c.title} ${c.skills.join(' ')}`.toLowerCase().includes(query.toLowerCase()));
  return <WorkspaceShell role="recruiter"><PageTitle eyebrow="Candidates" title="See the signal. Keep the context." description="Explore candidates by verified evidence and capabilities. Shortlist remains a human action." action={<Button onClick={() => setQuery('')} data-testid="button-reset-candidate-filter" variant="outline"><RefreshCcw size={15} /> Reset</Button>} /><div className="mb-6 flex gap-3"><label className="relative flex max-w-lg flex-1 items-center"><Search size={16} className="absolute left-3 text-[hsl(var(--muted-foreground))]" /><input value={query} onChange={e => setQuery(e.target.value)} data-testid="input-candidate-search" placeholder="Search people, roles, or skills" className="h-11 w-full rounded-lg border border-[hsl(var(--input))] bg-[hsl(var(--card))] pl-10 text-sm" /></label><Button data-testid="button-candidate-filter" variant="outline"><Filter size={15} /> Fit 80%+</Button></div><div className="overflow-hidden rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))]"><div className="hidden grid-cols-[1.5fr_1.2fr_.6fr_.75fr_auto] gap-4 border-b border-[hsl(var(--border))] bg-[hsl(var(--muted))] px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))] md:grid"><span>Candidate</span><span>Evidence</span><span>Fit</span><span>Verification</span><span /></div>{list.map(c => <div key={c.id} className="grid gap-3 border-b border-[hsl(var(--border))] px-5 py-4 last:border-0 md:grid-cols-[1.5fr_1.2fr_.6fr_.75fr_auto] md:items-center md:gap-4"><div className="flex items-center gap-3"><div className="grid h-9 w-9 place-items-center rounded-full text-xs font-semibold text-white" style={{ background: c.color }}>{c.initials}</div><div><Link href={`/recruiter/candidates/${c.id}`} data-testid={`link-candidate-${c.id}`} className="text-sm font-semibold">{c.name}</Link><p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">{c.title}</p></div></div><div className="flex flex-wrap gap-1.5">{c.skills.map(s => <span key={s} className="rounded-md bg-[hsl(var(--muted))] px-2 py-1 text-[10px]">{s}</span>)}</div><div><span className="mr-2 text-xs text-[hsl(var(--muted-foreground))] md:hidden">Fit</span><span className="font-data text-sm">{c.fit}%</span></div><div><Badge tone={c.verified >= 90 ? 'good' : 'quiet'}>{c.verified}% verified</Badge></div><button onClick={() => { p.toggleShortlist(c.id); p.notify(p.shortlist.includes(c.id) ? 'Removed from shortlist.' : 'Added to shortlist.'); }} data-testid={`button-shortlist-${c.id}`} className="justify-self-start rounded-lg p-2 text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))]"><Star size={17} fill={p.shortlist.includes(c.id) ? 'currentColor' : 'none'} className={p.shortlist.includes(c.id) ? 'text-[#b8783d]' : ''} /></button></div>)}</div></WorkspaceShell>;
}
function CandidateDetail() {
  const { id } = useParams<{ id: string }>(); const p = useProduct(); const c = candidates.find(x => x.id === Number(id)) || candidates[0]; const shortlisted = p.shortlist.includes(c.id);
  return <WorkspaceShell role="recruiter"><Link href="/recruiter/candidates" data-testid="link-back-candidates" className="mb-7 inline-flex items-center gap-2 text-sm font-semibold text-[hsl(var(--primary))]"><ArrowLeft size={15} /> Candidates</Link><div className="grid gap-5 lg:grid-cols-[1.2fr_.8fr]"><section className="surface rounded-2xl p-6 sm:p-8"><div className="flex flex-wrap items-start justify-between gap-5"><div className="flex items-center gap-4"><div className="grid h-16 w-16 place-items-center rounded-full text-lg font-semibold text-white" style={{ background: c.color }}>{c.initials}</div><div><p className="eyebrow">Candidate profile</p><h1 className="mt-2 font-display text-4xl">{c.name}</h1><p className="mt-2 text-sm text-[hsl(var(--muted-foreground))]">{c.title} · {c.location}</p></div></div><Button onClick={() => p.toggleShortlist(c.id)} data-testid="button-candidate-shortlist-detail" variant={shortlisted ? 'soft' : 'primary'}><Star size={15} fill={shortlisted ? 'currentColor' : 'none'} /> {shortlisted ? 'Shortlisted' : 'Add to shortlist'}</Button></div><div className="mt-9 grid gap-4 border-t border-[hsl(var(--border))] pt-7 sm:grid-cols-3"><div><p className="eyebrow">Role fit</p><p className="mt-2 font-data text-3xl">{c.fit}%</p></div><div><p className="eyebrow">Verified skills</p><p className="mt-2 font-data text-3xl">{c.verified}%</p></div><div><p className="eyebrow">Evaluation</p><p className="mt-2 text-sm font-semibold">100% Skills-First</p></div></div><div className="mt-8"><h2 className="font-display text-2xl">Why this candidate?</h2><p className="mt-3 text-sm leading-7 text-[hsl(var(--muted-foreground))]">Strong evidence in {c.skills[0].toLowerCase()} and {c.skills[1].toLowerCase()} maps directly to the role's core requirements.</p></div><div className="mt-7 flex flex-wrap gap-2">{c.skills.map(s => <Badge key={s} tone="good"><CheckCircle2 size={12} className="mr-1" /> {s}</Badge>)}</div><div className="mt-8 rounded-xl bg-[hsl(var(--muted))] p-5"><div className="flex items-center gap-2 text-sm font-semibold"><Info size={16} className="text-[hsl(var(--primary))]" /> Keep a human in the loop</div><p className="mt-2 text-xs leading-5 text-[hsl(var(--muted-foreground))]">This is a recommendation, not an outcome. Review work samples and speak with the candidate before deciding.</p></div></section><aside className="grid content-start gap-5"><div className="surface rounded-2xl p-6"><p className="eyebrow">Decision trace</p><div className="mt-5 grid gap-4 text-sm">{[['Evidence match', 'Strong', 'good'], ['Intent alignment', 'Clear', 'good'], ['Skill verification', 'Verified', 'good'], ['Human review', 'Required', 'warm']].map(([a, b, tone]) => <div key={a} className="flex items-center justify-between"><span>{a}</span><Badge tone={tone as 'good' | 'quiet' | 'warm'}>{b}</Badge></div>)}</div><Button onClick={() => p.notify('Candidate marked for human review.')} data-testid="button-mark-human-review" className="mt-6 w-full"><ThumbsUp size={15} /> Mark for human review</Button></div><div className="rounded-2xl bg-[#dfe9e4] p-6"><p className="eyebrow text-[hsl(var(--primary))]">Suggested conversation</p><p className="mt-3 font-display text-xl">Ask how they delivered project outcomes and collaborated with teams.</p></div></aside></div></WorkspaceShell>;
}
function Shortlist() {
  const p = useProduct(); const list = candidates.filter(c => p.shortlist.includes(c.id));
  return <WorkspaceShell role="recruiter"><PageTitle eyebrow="Shortlist" title="The final call belongs to you." description="A focused view of candidates your team has chosen to discuss. Recommendations stay explainable; decisions stay human." action={<Button onClick={() => p.notify('Shortlist review notes saved.')} data-testid="button-save-shortlist" variant="outline"><Check size={15} /> Save review notes</Button>} />{list.length ? <div className="grid gap-4 lg:grid-cols-2">{list.map(c => <div key={c.id} className="surface rounded-2xl p-5"><div className="flex items-start justify-between"><div className="flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-full text-xs font-semibold text-white" style={{ background: c.color }}>{c.initials}</div><div><Link href={`/recruiter/candidates/${c.id}`} data-testid={`shortlist-link-${c.id}`} className="font-semibold">{c.name}</Link><p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">{c.title}</p></div></div><Badge tone="good">{c.fit}% fit</Badge></div><p className="mt-5 text-sm leading-6 text-[hsl(var(--muted-foreground))]">Strongest evidence: {c.skills.slice(0, 2).join(' + ')}. Ask about the outcomes behind that work.</p><div className="mt-5 flex gap-2"><Button onClick={() => p.notify(`${c.name} marked ready for interview.`)} data-testid={`button-advance-${c.id}`} className="flex-1">Advance to interview</Button><Button onClick={() => p.toggleShortlist(c.id)} data-testid={`button-remove-shortlist-${c.id}`} variant="outline">Remove</Button></div></div>)}</div> : <EmptyState icon={Star} title="Your shortlist is still yours to shape." body="Add candidates from the workspace when the evidence and your judgment point in the same direction." action={<Link href="/recruiter/candidates" data-testid="link-empty-candidates" className="inline-flex min-h-10 items-center rounded-lg bg-[hsl(var(--primary))] px-4 text-sm font-semibold text-[hsl(var(--primary-foreground))]">Explore candidates</Link>} />}</WorkspaceShell>;
}
function BiasAudit() {
  const [expanded, setExpanded] = useState(false);
  return <WorkspaceShell role="recruiter"><PageTitle eyebrow="Fairness monitor" title="See what the signal is doing." description="A calm check on the system: what it considers, what it excludes, and where a human should look closer." action={<Badge tone="good"><CheckCircle2 size={13} className="mr-1" /> Monitor healthy</Badge>} /><div className="grid gap-5 lg:grid-cols-3"><div className="surface rounded-2xl p-6 lg:col-span-2"><div className="flex items-center justify-between"><div><p className="eyebrow">Recommendation composition</p><h2 className="mt-2 font-display text-2xl">The shortlist reflects skills, not chronology.</h2></div><ShieldCheck className="text-[hsl(var(--primary))]" /></div><div className="mt-8 h-64"><ResponsiveContainer width="100%" height="100%"><BarChart data={[{ name: 'Skills', value: 86 }, { name: 'Experience', value: 72 }, { name: 'Intent', value: 64 }, { name: 'Location', value: 31 }]}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" /><XAxis dataKey="name" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} /><YAxis domain={[0, 100]} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} /><Tooltip /><Bar dataKey="value" fill="hsl(var(--primary))" radius={[5, 5, 0, 0]} /></BarChart></ResponsiveContainer></div><div className="mt-3 flex flex-wrap gap-4 text-xs text-[hsl(var(--muted-foreground))]"><span className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-[hsl(var(--primary))]" /> Signal weight, not a ranking</span><button onClick={() => setExpanded(!expanded)} data-testid="button-audit-details" className="font-semibold text-[hsl(var(--primary))]">{expanded ? 'Hide methodology' : 'See methodology'}</button></div>{expanded && <div className="mt-5 rounded-xl bg-[hsl(var(--muted))] p-4 text-xs leading-5 text-[hsl(var(--muted-foreground))]">Weights are illustrative mock data. Career break, name, age, and protected traits are explicitly excluded. Recruiters can inspect the evidence behind every recommendation.</div>}</div><div className="space-y-5"><div className="surface rounded-2xl p-6"><p className="eyebrow">Exclusion checks</p><div className="mt-5 grid gap-3">{['Career break', 'Name and photo', 'Protected traits', 'Unverified claims'].map(x => <div key={x} className="flex items-center gap-2 text-sm"><CheckCircle2 size={16} className="text-[hsl(var(--primary))]" /> {x}<span className="ml-auto text-xs text-[hsl(var(--muted-foreground))]">Excluded</span></div>)}</div></div><div className="rounded-2xl bg-[#f8e6cf] p-6"><p className="eyebrow text-[#925d26]">One watch</p><p className="mt-3 font-display text-2xl">Location signal variance</p><p className="mt-2 text-sm leading-6 text-[#925d26]/80">Review role requirements before changing the model. Flexibility can widen the qualified pool.</p></div></div></div></WorkspaceShell>;
}
function Analytics() {
  const data = [{ week: 'W1', views: 32, qualified: 12 }, { week: 'W2', views: 48, qualified: 17 }, { week: 'W3', views: 44, qualified: 19 }, { week: 'W4', views: 67, qualified: 28 }, { week: 'W5', views: 72, qualified: 34 }, { week: 'W6', views: 86, qualified: 41 }];
  return <WorkspaceShell role="recruiter"><PageTitle eyebrow="Analytics" title="Velocity with a conscience." description="Understand where candidates move, where they pause, and whether the system is widening the door." action={<Button onClick={() => window.alert('Report export prepared in this prototype.')} data-testid="button-export-analytics" variant="outline"><Download size={15} /> Export report</Button>} /><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{[['Time to shortlist', '4.8d', '−1.2d vs last month'], ['Qualified pool', '41', '+18 this month'], ['Human review rate', '68%', 'Target 70%'], ['Candidate clarity', '4.6/5', 'From 28 responses']].map(([a, b, c]) => <div key={a} className="surface rounded-2xl p-5"><p className="eyebrow">{a}</p><p className="mt-3 font-data text-3xl">{b}</p><p className="mt-2 text-xs text-[hsl(var(--primary))]">{c}</p></div>)}</div><div className="mt-5 grid gap-5 lg:grid-cols-[1.3fr_.7fr]"><section className="surface rounded-2xl p-6"><p className="eyebrow">Qualified candidates over time</p><div className="mt-6 h-72"><ResponsiveContainer width="100%" height="100%"><AreaChart data={data}><defs><linearGradient id="qual" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity=".25" /><stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0" /></linearGradient></defs><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" /><XAxis dataKey="week" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} /><YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} /><Tooltip /><Area type="monotone" dataKey="qualified" stroke="hsl(var(--primary))" fill="url(#qual)" strokeWidth={2} /></AreaChart></ResponsiveContainer></div></section><section className="surface rounded-2xl p-6"><p className="eyebrow">Where candidates pause</p><div className="mt-6 grid gap-5 text-sm">{[['Role clarity', 72], ['Employer readiness', 54], ['Application confidence', 41]].map(([x, v]) => <div key={x as string}><div className="mb-2 flex justify-between"><span>{x as string}</span><span className="font-data">{v}%</span></div><Progress value={v as number} color={v === 41 ? 'bg-[hsl(var(--accent))]' : 'bg-[hsl(var(--primary))]'} /></div>)}</div><div className="mt-8 rounded-xl bg-[hsl(var(--muted))] p-4 text-xs leading-5 text-[hsl(var(--muted-foreground))]">Insight: roles with a first-90-days brief receive 22% more qualified applications.</div></section></div></WorkspaceShell>;
}
function Billing() {
  /*
  const p = useProduct();
  const [plan, setPlan] = useState(p.plan);
  const [cycle, setCycle] = useState<'monthly' | 'yearly'>('monthly');
  const [selectedPlan, setSelectedPlan] = useState('Growth');
  const [studentId, setStudentId] = useState('');
  const [studentStatus, setStudentStatus] = useState<'idle' | 'checking' | 'eligible' | 'not_eligible'>('idle');
  const [processing, setProcessing] = useState(false);
  const prices = { Starter: cycle === 'monthly' ? '₹0' : '₹0', Growth: cycle === 'monthly' ? '₹799' : '₹7,990', Enterprise: cycle === 'monthly' ? '₹1,850' : '₹18,500' };
  const verifyStudent = () => {
    if (!studentId.trim()) { p.notify('Enter your student ID to check eligibility.'); return; }
    setStudentStatus('checking');
    window.setTimeout(() => setStudentStatus(/^(STU|STUDENT|EDU)-?\d{4,}$/i.test(studentId.trim()) ? 'eligible' : 'not_eligible'), 700);
  };
  const activatePlan = () => {
    if (studentStatus === 'eligible') {
      setPlan('Student Access'); p.setPlan('Student Access'); p.notify('Student access activated at ₹0.'); return;
    }
    setProcessing(true);
    window.setTimeout(() => { setProcessing(false); setPlan(selectedPlan); p.setPlan(selectedPlan); p.notify(`${selectedPlan} ${cycle} subscription activated in demo mode.`); }, 900);
  };
  usePageMeta('Subscription', 'Choose a SensAI plan or verify student access.');
  return <WorkspaceShell role="recruiter"><PageTitle eyebrow="Subscription" title="Thoughtful hiring, with room to grow." description="Choose a plan for your team. Students can unlock core access for free with a valid campus ID." /><div className="mb-5 flex justify-end"><div className="inline-flex rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-1"><button onClick={() => setCycle('monthly')} className={`rounded-md px-3 py-1.5 text-xs font-semibold ${cycle === 'monthly' ? 'bg-[hsl(var(--primary))] text-white' : 'text-[hsl(var(--muted-foreground))]'}`}>Monthly</button><button onClick={() => setCycle('yearly')} className={`rounded-md px-3 py-1.5 text-xs font-semibold ${cycle === 'yearly' ? 'bg-[hsl(var(--primary))] text-white' : 'text-[hsl(var(--muted-foreground))]'}`}>Yearly · 2 months free</button></div></div><div className="grid gap-4 lg:grid-cols-3">{[['Starter', 'For small teams getting started', ['3 active roles', '25 candidate analyses', 'Fairness monitor']], ['Growth', 'For teams hiring with context', ['Unlimited roles', '250 candidate analyses', 'Analytics + skill intelligence']], ['Enterprise', 'For workforce-scale hiring', ['Unlimited everything', 'Custom review workflows', 'Priority support']].map(([name, description, features]) => <button key={name} onClick={() => setSelectedPlan(name as string)} className={`surface rounded-2xl p-5 text-left transition hover:-translate-y-0.5 ${selectedPlan === name ? 'border-[hsl(var(--primary))] shadow-[0_0_0_1px_hsl(var(--primary))]' : ''}`}><div className="flex items-start justify-between"><div><p className="font-display text-2xl">{name}</p><p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">{description}</p></div>{selectedPlan === name && <Badge tone="good">Selected</Badge>}</div><p className="mt-6 font-data text-3xl">{prices[name as keyof typeof prices]}<span className="font-sans text-xs text-[hsl(var(--muted-foreground))]">{name === 'Starter' ? ' forever' : cycle === 'monthly' ? ' / month' : ' / year'}</span></p><ul className="mt-5 grid gap-2 text-xs text-[hsl(var(--muted-foreground))]">{(features as string[]).map(feature => <li key={feature} className="flex items-center gap-2"><CheckCircle2 size={13} className="text-[hsl(var(--primary))]" />{feature}</li>)}</ul></button>)}</div><div className="mt-5 grid gap-5 lg:grid-cols-[1fr_.8fr]"><section className="surface rounded-2xl p-6 sm:p-8"><div className="flex items-start justify-between gap-4"><div><p className="eyebrow text-[hsl(var(--cyan))]">Student access</p><h2 className="mt-2 font-display text-2xl">Keep the door open.</h2><p className="mt-2 max-w-lg text-sm leading-6 text-[hsl(var(--muted-foreground))]">Verify a campus ID and get Growth features at no cost. This is a safe mock check for the prototype; no ID document is uploaded.</p></div><GraduationCap className="text-[hsl(var(--cyan))]" /></div><div className="mt-6 flex flex-col gap-3 sm:flex-row"><input value={studentId} onChange={event => { setStudentId(event.target.value); setStudentStatus('idle'); }} placeholder="STUDENT-2026-001" data-testid="input-student-id" className="h-11 flex-1 rounded-lg border border-[hsl(var(--input))] bg-[hsl(var(--card))] px-3 text-sm" /><Button onClick={verifyStudent} disabled={studentStatus === 'checking'} data-testid="button-verify-student" variant="outline">{studentStatus === 'checking' ? 'Checking…' : 'Verify student ID'}</Button></div>{studentStatus === 'eligible' && <p className="mt-3 text-sm font-semibold text-[#86efac]"><CheckCircle2 size={15} className="mr-1 inline" /> Eligible — your subscription will be ₹0.</p>}{studentStatus === 'not_eligible' && <p className="mt-3 text-sm text-[hsl(var(--accent))]">That mock ID was not recognized. Try a format like STUDENT-2026-001.</p>}</section><section className="rounded-2xl bg-[hsl(var(--sidebar))] p-6 text-[hsl(var(--sidebar-foreground))]"><p className="eyebrow text-[hsl(var(--accent))]">Checkout summary</p><h2 className="mt-3 font-display text-2xl">{studentStatus === 'eligible' ? 'Student Access' : selectedPlan}</h2><div className="mt-5 flex items-end justify-between border-b border-[hsl(var(--sidebar-foreground))]/15 pb-5"><span className="text-sm text-[hsl(var(--sidebar-foreground))]/65">{studentStatus === 'eligible' ? 'Verified student plan' : `${cycle} subscription`}</span><span className="font-data text-2xl">{studentStatus === 'eligible' ? '₹0' : prices[selectedPlan as keyof typeof prices]}</span></div><p className="mt-5 text-xs leading-5 text-[hsl(var(--sidebar-foreground))]/55">Demo checkout only. Connect Stripe or Whop later to process real payments securely.</p><Button onClick={activatePlan} disabled={processing || selectedPlan === 'Starter'} data-testid="button-activate-subscription" className="mt-6 w-full">{processing ? 'Activating…' : studentStatus === 'eligible' ? 'Activate free student access' : selectedPlan === 'Starter' ? 'Starter is already free' : 'Continue to checkout'} <ArrowRight size={15} /></Button>{plan !== p.plan && <p className="mt-3 text-xs text-[#86efac]">Current plan updated to {plan}.</p>}</section></div><div className="mt-5 surface rounded-2xl p-6"><div className="flex items-center gap-2"><CreditCard size={18} className="text-[hsl(var(--primary))]" /><p className="text-sm font-semibold">Billing history and payment method</p></div><p className="mt-2 text-xs text-[hsl(var(--muted-foreground))]">These remain mock records until a billing provider is connected.</p><div className="mt-5 grid gap-3 text-sm sm:grid-cols-2"><div className="flex items-center justify-between rounded-lg bg-[hsl(var(--muted))] p-3"><span>Current plan</span><Badge tone="good">{plan}</Badge></div><div className="flex items-center justify-between rounded-lg bg-[hsl(var(--muted))] p-3"><span>Payment method</span><span className="text-xs text-[hsl(var(--muted-foreground))]">Not collected in demo</span></div></div></div></WorkspaceShell>;
  */
  return <BillingDemo />;
}
const subscriptionPlans = [
  { name: 'Starter', monthly: '₹0', yearly: '₹0', description: 'For small teams getting started', features: ['3 active roles', '25 candidate analyses', 'Fairness monitor'] },
  { name: 'Growth', monthly: '₹799', yearly: '₹7,990', description: 'For teams hiring with context', features: ['Unlimited roles', '250 candidate analyses', 'Analytics + skill intelligence'] },
  { name: 'Enterprise', monthly: '₹1,850', yearly: '₹18,500', description: 'For workforce-scale hiring', features: ['Unlimited everything', 'Custom review workflows', 'Priority support'] },
] as const;
function BillingDemo() {
  const p = useProduct();
  const [plan, setPlan] = useState(p.plan);
  const [cycle, setCycle] = useState<'monthly' | 'yearly'>('monthly');
  const [selectedPlan, setSelectedPlan] = useState('Growth');
  const [studentId, setStudentId] = useState('');
  const [studentStatus, setStudentStatus] = useState<'idle' | 'checking' | 'eligible' | 'not_eligible'>('idle');
  const [processing, setProcessing] = useState(false);
  const selected = subscriptionPlans.find(item => item.name === selectedPlan) ?? subscriptionPlans[1];
  const verifyStudent = () => {
    if (!studentId.trim()) { p.notify('Enter your student ID to check eligibility.'); return; }
    setStudentStatus('checking');
    window.setTimeout(() => setStudentStatus(/^(STU|STUDENT|EDU)-?\d{4,}$/i.test(studentId.trim()) ? 'eligible' : 'not_eligible'), 700);
  };
  const activatePlan = () => {
    if (studentStatus === 'eligible') {
      setPlan('Student Access'); p.setPlan('Student Access'); p.notify('Student access activated at ₹0.'); return;
    }
    setProcessing(true);
    window.setTimeout(() => {
      setProcessing(false); setPlan(selected.name); p.setPlan(selected.name);
      p.notify(`${selected.name} ${cycle} subscription activated in demo mode.`);
    }, 900);
  };
  usePageMeta('Subscription', 'Choose a SensAI plan or verify student access.');
  return <WorkspaceShell role="recruiter"><PageTitle eyebrow="Subscription" title="Thoughtful hiring, with room to grow." description="Choose a plan for your team. Students can unlock core access for free with a valid campus ID." /><div className="mb-5 flex justify-end"><div className="inline-flex rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-1"><button type="button" onClick={() => setCycle('monthly')} className={`rounded-md px-3 py-1.5 text-xs font-semibold ${cycle === 'monthly' ? 'bg-[hsl(var(--primary))] text-white' : 'text-[hsl(var(--muted-foreground))]'}`}>Monthly</button><button type="button" onClick={() => setCycle('yearly')} className={`rounded-md px-3 py-1.5 text-xs font-semibold ${cycle === 'yearly' ? 'bg-[hsl(var(--primary))] text-white' : 'text-[hsl(var(--muted-foreground))]'}`}>Yearly · 2 months free</button></div></div><div className="grid gap-4 lg:grid-cols-3">{subscriptionPlans.map(item => <button type="button" key={item.name} onClick={() => setSelectedPlan(item.name)} className={`surface rounded-2xl p-5 text-left transition hover:-translate-y-0.5 ${selectedPlan === item.name ? 'border-[hsl(var(--primary))] shadow-[0_0_0_1px_hsl(var(--primary))]' : ''}`}><div className="flex items-start justify-between"><div><p className="font-display text-2xl">{item.name}</p><p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">{item.description}</p></div>{selectedPlan === item.name && <Badge tone="good">Selected</Badge>}</div><p className="mt-6 font-data text-3xl">{cycle === 'monthly' ? item.monthly : item.yearly}<span className="font-sans text-xs text-[hsl(var(--muted-foreground))]">{item.name === 'Starter' ? ' forever' : cycle === 'monthly' ? ' / month' : ' / year'}</span></p><ul className="mt-5 grid gap-2 text-xs text-[hsl(var(--muted-foreground))]">{item.features.map(feature => <li key={feature} className="flex items-center gap-2"><CheckCircle2 size={13} className="text-[hsl(var(--primary))]" />{feature}</li>)}</ul></button>)}</div><div className="mt-5 grid gap-5 lg:grid-cols-[1fr_.8fr]"><section className="surface rounded-2xl p-6 sm:p-8"><div className="flex items-start justify-between gap-4"><div><p className="eyebrow text-[hsl(var(--cyan))]">Student access</p><h2 className="mt-2 font-display text-2xl">Keep the door open.</h2><p className="mt-2 max-w-lg text-sm leading-6 text-[hsl(var(--muted-foreground))]">Verify a campus ID and get Growth features at no cost. This is a safe mock check for the prototype; no ID document is uploaded.</p></div><GraduationCap className="text-[hsl(var(--cyan))]" /></div><div className="mt-6 flex flex-col gap-3 sm:flex-row"><input value={studentId} onChange={event => { setStudentId(event.target.value); setStudentStatus('idle'); }} placeholder="STUDENT-2026-001" data-testid="input-student-id" className="h-11 flex-1 rounded-lg border border-[hsl(var(--input))] bg-[hsl(var(--card))] px-3 text-sm" /><Button onClick={verifyStudent} disabled={studentStatus === 'checking'} data-testid="button-verify-student" variant="outline">{studentStatus === 'checking' ? 'Checking…' : 'Verify student ID'}</Button></div>{studentStatus === 'eligible' && <p className="mt-3 text-sm font-semibold text-[#86efac]"><CheckCircle2 size={15} className="mr-1 inline" /> Eligible — your subscription will be ₹0.</p>}{studentStatus === 'not_eligible' && <p className="mt-3 text-sm text-[hsl(var(--accent))]">That mock ID was not recognized. Try a format like STUDENT-2026-001.</p>}</section><section className="rounded-2xl bg-[hsl(var(--sidebar))] p-6 text-[hsl(var(--sidebar-foreground))]"><p className="eyebrow text-[hsl(var(--accent))]">Checkout summary</p><h2 className="mt-3 font-display text-2xl">{studentStatus === 'eligible' ? 'Student Access' : selected.name}</h2><div className="mt-5 flex items-end justify-between border-b border-[hsl(var(--sidebar-foreground))]/15 pb-5"><span className="text-sm text-[hsl(var(--sidebar-foreground))]/65">{studentStatus === 'eligible' ? 'Verified student plan' : `${cycle} subscription`}</span><span className="font-data text-2xl">{studentStatus === 'eligible' ? '₹0' : cycle === 'monthly' ? selected.monthly : selected.yearly}</span></div><p className="mt-5 text-xs leading-5 text-[hsl(var(--sidebar-foreground))]/55">Demo checkout only. Connect Stripe or Whop later to process real payments securely.</p><Button onClick={activatePlan} disabled={processing || selectedPlan === 'Starter'} data-testid="button-activate-subscription" className="mt-6 w-full">{processing ? 'Activating…' : studentStatus === 'eligible' ? 'Activate free student access' : selectedPlan === 'Starter' ? 'Starter is already free' : 'Continue to checkout'} <ArrowRight size={15} /></Button>{plan !== p.plan && <p className="mt-3 text-xs text-[#86efac]">Current plan updated to {plan}.</p>}</section></div><div className="mt-5 surface rounded-2xl p-6"><div className="flex items-center gap-2"><CreditCard size={18} className="text-[hsl(var(--primary))]" /><p className="text-sm font-semibold">Billing history and payment method</p></div><p className="mt-2 text-xs text-[hsl(var(--muted-foreground))]">These remain mock records until a billing provider is connected.</p><div className="mt-5 grid gap-3 text-sm sm:grid-cols-2"><div className="flex items-center justify-between rounded-lg bg-[hsl(var(--muted))] p-3"><span>Current plan</span><Badge tone="good">{plan}</Badge></div><div className="flex items-center justify-between rounded-lg bg-[hsl(var(--muted))] p-3"><span>Payment method</span><span className="text-xs text-[hsl(var(--muted-foreground))]">Not collected in demo</span></div></div></div></WorkspaceShell>;
}
function SettingsPage() {
  const [saved, setSaved] = useState(false); const [toggles, setToggles] = useState({ weekly: true, alerts: true, context: true });
  return <WorkspaceShell role="recruiter"><PageTitle eyebrow="Settings" title="Set the conditions for trust." description="Workspace preferences for your team, candidate experience, and review habits." action={<Button onClick={() => setSaved(true)} data-testid="button-save-settings">{saved ? <><Check size={15} /> Saved</> : 'Save changes'}</Button>} /><div className="grid gap-5 lg:grid-cols-2"><section className="surface rounded-2xl p-6"><p className="eyebrow">Employer readiness</p><h2 className="mt-2 font-display text-2xl">What candidates can see</h2><div className="mt-6 grid gap-4"><label className="grid gap-2 text-sm font-semibold">Company story<textarea data-testid="textarea-company-story" defaultValue="We build tools for teams doing consequential work." className="min-h-24 rounded-lg border border-[hsl(var(--input))] bg-transparent p-3 font-normal" /></label><label className="grid gap-2 text-sm font-semibold">First 90 days<textarea data-testid="textarea-first-90-days" defaultValue="Listen, learn the system, then make one operating rhythm clearer." className="min-h-24 rounded-lg border border-[hsl(var(--input))] bg-transparent p-3 font-normal" /></label></div></section><section className="surface rounded-2xl p-6"><p className="eyebrow">Workspace preferences</p><h2 className="mt-2 font-display text-2xl">Keep the right people close.</h2><div className="mt-6 grid gap-1">{[['weekly', 'Weekly hiring signal digest', 'A short view of movement and watch items.'], ['alerts', 'Human review reminders', 'Never let a recommendation become an outcome by accident.'], ['context', 'Show candidate context', 'Keep career breaks visible as context, never as score.']].map(([key, title, body]) => <label key={key} className="flex cursor-pointer items-start gap-3 rounded-xl p-3 hover:bg-[hsl(var(--muted))]"><input type="checkbox" checked={toggles[key as keyof typeof toggles]} onChange={e => setToggles({ ...toggles, [key]: e.target.checked })} data-testid={`checkbox-settings-${key}`} className="mt-1 h-4 w-4 accent-[hsl(var(--primary))]" /><span><span className="block text-sm font-semibold">{title}</span><span className="mt-1 block text-xs leading-5 text-[hsl(var(--muted-foreground))]">{body}</span></span></label>)}</div></section></div></WorkspaceShell>;
}

function RecruiterUploadPanel() {
  const [open, setOpen] = useState(false);
  const [stage, setStage] = useState<'idle' | 'analyzing' | 'ready'>('idle');
  const [analysisStep, setAnalysisStep] = useState(0);
  const [files, setFiles] = useState<string[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const p = useProduct();
  const steps = ['Analyzing resumes', 'Extracting skills', 'Comparing evidence', 'Generating explainability', 'Running fairness checks'];

  useEffect(() => {
    if (stage !== 'analyzing') return;
    setAnalysisStep(0);
    const timer = window.setInterval(() => setAnalysisStep(value => Math.min(value + 1, steps.length - 1)), 520);
    const done = window.setTimeout(() => setStage('ready'), 2800);
    return () => { window.clearInterval(timer); window.clearTimeout(done); };
  }, [stage, steps.length]);

  const startAnalysis = (names: string[]) => {
    if (!names.length) return;
    setFiles(names);
    setStage('analyzing');
  };

  const handleFiles = (selected: FileList | null) => {
    if (!selected?.length) return;
    startAnalysis(Array.from(selected).map(file => file.name));
  };

  return <div className="fixed bottom-5 right-5 z-40 w-[min(390px,calc(100vw-2.5rem))]">
    {!open ? <button onClick={() => setOpen(true)} data-testid="button-open-resume-upload" className="gradient-button inline-flex min-h-11 items-center gap-2 rounded-xl px-4 text-sm font-semibold text-[hsl(var(--primary-foreground))] shadow-[var(--shadow-md)]"><Upload size={16} /> Upload candidate resumes</button> :
      <section className="surface rounded-2xl p-5 shadow-[var(--shadow-md)]" aria-label="Candidate resume upload">
        <div className="flex items-start justify-between gap-3"><div><p className="eyebrow text-[hsl(var(--cyan))]">Candidate intake</p><h2 className="mt-2 font-display text-2xl">Bring more signal into the room.</h2></div><button onClick={() => setOpen(false)} data-testid="button-close-resume-upload" className="rounded-lg p-1.5 text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))]" aria-label="Close upload panel"><X size={17} /></button></div>
        {stage === 'idle' && <label onDragEnter={() => setDragActive(true)} onDragOver={event => { event.preventDefault(); setDragActive(true); }} onDragLeave={() => setDragActive(false)} onDrop={event => { event.preventDefault(); setDragActive(false); handleFiles(event.dataTransfer.files); }} className={`mt-5 grid cursor-pointer place-items-center rounded-xl border border-dashed p-6 text-center transition ${dragActive ? 'border-[hsl(var(--cyan))] bg-[hsl(var(--cyan))]/10' : 'border-[hsl(var(--border))] hover:border-[hsl(var(--primary))]'}`}><input type="file" multiple accept=".pdf,.doc,.docx" onChange={event => handleFiles(event.target.files)} className="sr-only" data-testid="input-resume-upload" /><div className="grid h-10 w-10 place-items-center rounded-full bg-[hsl(var(--primary))]/15 text-[hsl(var(--primary))]"><Upload size={18} /></div><p className="mt-3 text-sm font-semibold">Drop candidate resumes here</p><p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">PDF, DOC, or DOCX · multiple files supported</p></label>}
        {stage === 'analyzing' && <div className="mt-5 rounded-xl bg-[hsl(var(--muted))] p-4"><div className="flex items-center gap-2 text-sm font-semibold text-[hsl(var(--cyan))]"><RefreshCcw size={15} className="animate-spin" /> Reviewing {files.length} {files.length === 1 ? 'resume' : 'resumes'}</div><div className="mt-4 grid gap-2">{steps.map((step, index) => <div key={step} className={`flex items-center gap-2 text-xs ${index <= analysisStep ? 'text-[hsl(var(--foreground))]' : 'text-[hsl(var(--muted-foreground))]/55'}`}><span className={`grid h-4 w-4 place-items-center rounded-full border ${index < analysisStep ? 'border-[hsl(var(--success))] bg-[hsl(var(--success))]/15 text-[#86efac]' : index === analysisStep ? 'border-[hsl(var(--cyan))] text-[hsl(var(--cyan))]' : 'border-[hsl(var(--border))]'}`}>{index < analysisStep ? <Check size={10} /> : index + 1}</span>{step}</div>)}</div></div>}
        {stage === 'ready' && <div className="mt-5 rounded-xl border border-[hsl(var(--success))]/25 bg-[hsl(var(--success))]/10 p-4"><div className="flex items-center gap-2 text-sm font-semibold text-[#86efac]"><CheckCircle2 size={16} /> Skills extracted and checked</div><p className="mt-2 text-xs leading-5 text-[hsl(var(--muted-foreground))]">{files.length} {files.length === 1 ? 'resume is' : 'resumes are'} ready for evidence review. Career timeline remains context only.</p><div className="mt-4 flex flex-wrap gap-2"><Badge tone="good">Evidence mapped</Badge><Badge>Fairness checked</Badge></div><div className="mt-4 flex gap-2"><Button onClick={() => { p.notify('Candidate analysis added to the review queue.'); setOpen(false); }} data-testid="button-add-analyzed-candidates" className="flex-1">Review results <ArrowRight size={14} /></Button><Button onClick={() => setStage('idle')} variant="outline" data-testid="button-upload-more-resumes">Upload more</Button></div></div>}
      </section>}
  </div>;
}

function RecruiterUploadLauncher() {
  const [location] = useLocation();
  return location === '/recruiter/candidates' ? <RecruiterUploadPanel /> : null;
}

function Toast() { const p = useProduct(); if (!p.toast) return null; return <div role="status" data-testid="status-toast" className="fixed bottom-5 right-5 z-50 flex max-w-sm items-center gap-3 rounded-xl bg-[hsl(var(--sidebar))] px-4 py-3 text-sm text-[hsl(var(--sidebar-foreground))] shadow-[var(--shadow-md)]"><CheckCircle2 size={17} className="text-[hsl(var(--accent))]" />{p.toast}<button onClick={() => p.notify('')} data-testid="button-dismiss-toast"><X size={15} /></button></div>; }
function RoutedErrorBoundary({ children }: { children: ReactNode }) { const [location] = useLocation(); return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>; }
function Router() {
  return <><RoutedErrorBoundary><Switch>
    <Route path="/" component={HomeRoute} />
    <Route path="/login" component={() => <AuthRolePage role="candidate" />} />
    <Route path="/register" component={() => <AuthRolePage role="candidate" />} />
    <Route path="/auth/candidate" component={() => <AuthRolePage role="candidate" />} />
    <Route path="/auth/recruiter" component={() => <AuthRolePage role="recruiter" />} />
    <Route path="/sign-in/*?" component={() => <AuthPage mode="sign-in" />} />
    <Route path="/sign-up/*?" component={() => <AuthPage mode="sign-up" />} />
    <Route path="/pricing" component={() => <PublicPage kind="pricing" />} />
    <Route path="/about" component={() => <PublicPage kind="about" />} />
    <Route path="/how-it-works" component={() => <PublicPage kind="how" />} />
    <Route path="/architecture" component={() => <PublicPage kind="architecture" />} />
    <Route path="/candidate" component={CandidateHome} />
    <Route path="/candidate/profile" component={CandidateProfile} />
    <Route path="/candidate/skill-passport" component={SkillPassport} />
    <Route path="/candidate/background-check" component={BackgroundCheck} />
    <Route path="/candidate/onboarding" component={CandidateOnboarding} />
    <Route path="/candidate/jobs" component={CandidateJobs} />
    <Route path="/candidate/jobs/:id" component={CandidateJobDetail} />
    <Route path="/candidate/skill-gap" component={SkillGap} />
    <Route path="/candidate/learning" component={Learning} />
    <Route path="/candidate/applications" component={Applications} />
    <Route path="/candidate/resume" component={Resume} />
    <Route path="/candidate/assistant" component={Assistant} />
    <Route path="/recruiter" component={RecruiterHome} />
    <Route path="/recruiter/jobs" component={RecruiterJobs} />
    <Route path="/recruiter/jobs/create" component={CreateJob} />
    <Route path="/recruiter/jobs/:id" component={RecruiterJobDetail} />
    <Route path="/recruiter/candidates" component={RecruiterCandidates} />
    <Route path="/recruiter/candidates/:id" component={CandidateDetail} />
    <Route path="/recruiter/shortlist" component={Shortlist} />
    <Route path="/recruiter/bias-audit" component={BiasAudit} />
    <Route path="/recruiter/analytics" component={Analytics} />
    <Route path="/recruiter/billing" component={Billing} />
    <Route path="/recruiter/settings" component={SettingsPage} />
    <Route component={NotFound} />
  </Switch></RoutedErrorBoundary><Toast /></>;
}
function ClerkProductApp({ state }: { state: ProductState }) {
  const [, setLocation] = useLocation();
  return <ClerkProvider publishableKey={clerkPubKey} proxyUrl={clerkProxyUrl} appearance={clerkAppearance} signInUrl={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} routerPush={to => setLocation(stripBase(to))} routerReplace={to => setLocation(stripBase(to), { replace: true })} localization={{ signIn: { start: { title: 'Welcome back', subtitle: 'Continue to your SensAI workspace' } }, signUp: { start: { title: 'Create your SensAI account', subtitle: 'Choose a clearer next step' } } }}>
    <ProductContext.Provider value={state}><AuthSessionSync /><Router /><RecruiterUploadLauncher /><AuthControls /></ProductContext.Provider>
  </ClerkProvider>;
}
function App() {
  const [profile, setProfileState] = useState<CandidateProfileData>(() => {
    try {
      const stored = localStorage.getItem('rp-profile');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed && typeof parsed === 'object') {
          // If stored profile contains old mock data from previous sessions, purge it!
          const phone = parsed.phone || '';
          const summary = parsed.summary || '';
          if (phone.includes('98765') || summary.includes('caregiving') || summary.includes('Strategic Product Operations')) {
            localStorage.removeItem('rp-profile');
            return createCleanProfile('', '');
          }
          if (parsed.name || parsed.skills?.length) {
            return parsed;
          }
        }
      }
    } catch {}
    return createCleanProfile('', '');
  });
  const [isOnboarded, setIsOnboardedState] = useState(() => localStorage.getItem('rp-onboarded') === 'true');
  const [fit, setFitState] = useState(() => Number(localStorage.getItem('rp-fit') || 0));
  const [latestMatch, setLatestMatchState] = useState<any>(() => {
    try {
      const stored = localStorage.getItem('rp-latest-match');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });
  const [completedLearning, setCompletedLearningState] = useState(() => localStorage.getItem('rp-learning') === 'true');
  const [savedJobs, setSavedJobs] = useState<number[]>(() => JSON.parse(localStorage.getItem('rp-saved') || '[]') as number[]);
  const [applications, setApplications] = useState<number[]>(() => JSON.parse(localStorage.getItem('rp-applications') || '[]') as number[]);
  const [shortlist, setShortlist] = useState<number[]>(() => {
    const stored = localStorage.getItem('rp-shortlist');
    return stored ? JSON.parse(stored) as number[] : [];
  });
  const [analysis, setAnalysis] = useState<'idle' | 'analyzing' | 'ready'>('idle'); 
  const [plan, setPlan] = useState('Starter'); 
  const [toast, setToast] = useState('');

  const setIsOnboarded = (val: boolean) => {
    setIsOnboardedState(val);
    localStorage.setItem('rp-onboarded', String(val));
  };

  const setLatestMatch = (match: any) => {
    setLatestMatchState(match);
    if (match) {
      try {
        localStorage.setItem('rp-latest-match', JSON.stringify(match));
      } catch {}
    }
  };

  // NOTE: Profile is loaded after auth resolves in AuthSessionSync (with userId).
  // We do NOT fetch here without a userId to avoid returning another user's data.


  const updateProfile = async (data: Partial<CandidateProfileData>) => {
    const next = { ...profile, ...data };
    setProfileState(next);
    localStorage.setItem('rp-profile', JSON.stringify(next));
    try {
      await fetch('/api/candidate/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(next)
      });
    } catch {}
  };

  const setFit = (value: number) => { setFitState(value); localStorage.setItem('rp-fit', String(value)); };
  const setCompletedLearning = (value: boolean) => { setCompletedLearningState(value); localStorage.setItem('rp-learning', String(value)); };
  const toggleSaved = (id: number) => setSavedJobs(value => { const next = value.includes(id) ? value.filter(x => x !== id) : [...value, id]; localStorage.setItem('rp-saved', JSON.stringify(next)); return next; });
  const apply = (id: number) => setApplications(value => { if (value.includes(id)) return value; const next = [...value, id]; localStorage.setItem('rp-applications', JSON.stringify(next)); setToast('Application added to your workspace.'); return next; });
  const toggleShortlist = (id: number) => setShortlist(value => { const next = value.includes(id) ? value.filter(x => x !== id) : [...value, id]; localStorage.setItem('rp-shortlist', JSON.stringify(next)); return next; });
  const notify = (value: string) => { setToast(value); if (value) window.setTimeout(() => setToast(current => current === value ? '' : current), 3500); };
  
  const state = useMemo(() => ({
    fit, completedLearning, savedJobs, applications, shortlist, analysis, plan, toast,
    profile, latestMatch, setLatestMatch, isOnboarded, setIsOnboarded, updateProfile, setFit, setCompletedLearning, toggleSaved, apply, toggleShortlist, setAnalysis, setPlan, notify
  }), [fit, completedLearning, savedJobs, applications, shortlist, analysis, plan, toast, profile, latestMatch, isOnboarded]);

  return <QueryClientProvider client={queryClient}><TooltipProvider><WouterRouter base={basePath}><ClerkProductApp state={state} /></WouterRouter><Toaster /></TooltipProvider></QueryClientProvider>;
}
export default App;
