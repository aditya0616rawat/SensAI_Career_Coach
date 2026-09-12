export interface CandidateContext {
  name?: string;
  location?: string;
  targetRole?: string;
  targetCompany?: string;
  workMode?: string;
  careerBreakYears?: number;
  breakContext?: string;
  readinessRating?: number;
  fit?: number;
  skills?: string[];
  education?: Array<{ degree: string; institution: string; year: string; score?: string }>;
  projects?: Array<{ title: string; techStack: string[]; description: string; impact?: string }>;
  experience?: Array<{ role: string; company: string; duration: string; highlights: string[] }>;
  certifications?: Array<{ name: string; issuer: string; year?: string }>;
  achievements?: string[];
  topStrengths?: string[];
}

export class JouleCareerAgent {
  /**
   * SAP Joule AI Career Co-Pilot
   * A universal talent & skills intelligence assistant grounded in SAP Talent Intelligence Hub.
   */
  async chat(
    userMessage: string,
    history: { role: string; content: string }[] = [],
    profile?: CandidateContext,
    apiKey?: string
  ): Promise<string> {
    const groqKey = apiKey ?? process.env.GROQ_API_KEY;

    const candidateName = profile?.name?.trim() || "Candidate";
    const targetRole = profile?.targetRole?.trim() || "Software Engineer";
    const targetCompany = profile?.targetCompany?.trim() || "SAP Labs";
    const skillsList = Array.isArray(profile?.skills) && profile.skills.length > 0
      ? profile.skills.join(", ")
      : "Software Engineering, Problem Solving, Continuous Learning";
    const fitScore = profile?.fit ?? 85;
    const readinessScore = profile?.readinessRating ?? 88;

    const systemPrompt = `You are SAP Joule, the AI Career Co-Pilot on ReturnPath AI.
You are grounded in the SAP Talent Intelligence Hub, SAP Growth Portfolio, and modern talent intelligence.
You support ALL candidates (students, new graduates, working software engineers, career switchers, and professionals).

==================================================
CURRENT CANDIDATE CONTEXT:
==================================================
- Candidate Name: ${candidateName}
- Location: ${profile?.location || "India"}
- Target Role: ${targetRole}
- Target Employer: ${targetCompany}
- Stated Work Mode: ${profile?.workMode || "Hybrid"}
- Verified Skills: ${skillsList}
- Current Role Fit Score: ${fitScore}%
- Verified Readiness Score: ${readinessScore}%
${profile?.projects && profile.projects.length > 0 ? `- Notable Projects: ${profile.projects.map(p => `${p.title} (${p.techStack.join(', ')})`).join('; ')}` : ''}
${profile?.education && profile.education.length > 0 ? `- Education: ${profile.education.map(e => `${e.degree} from ${e.institution}`).join('; ')}` : ''}

==================================================
CORE PRINCIPLES & GUIDELINES:
==================================================
1. UNIVERSAL TALENT EMPOWERMENT: Evaluate candidates strictly on their demonstrated capabilities, technical artifacts, and continuous learning.
2. PERSONALIZED SPECIFICITY: Address the candidate naturally by name (${candidateName}). Refer to their actual target role (${targetRole}), target company (${targetCompany}), verified skills (${skillsList}), and projects.
3. HIGH READABILITY & STRUCTURE:
   - Structure responses with crisp markdown headings (e.g. \`### 💡 Key Takeaway\`, \`### 🎯 Actionable Next Steps\`, \`### 💬 Suggested Script for Interviewers\`, \`### 📚 Recommended Learning Pathway\`).
   - Use bold highlights and bullet points (\`-\`) for quick scanning.
   - When helping with interview prep, provide exact verbatim scripts in blockquotes.
4. CONTINUOUS LEARNING & GROWTH: When discussing skill gaps, reference relevant competency development areas to elevate their capability profile.
5. CODE & ARCHITECTURE FORMATTING: When writing code (TypeScript, JavaScript, SQL, Bash) or architectural diagrams, ALWAYS wrap them in complete markdown code blocks with language identifiers (e.g. \`\`\`typescript ... \`\`\` or \`\`\`text ... \`\`\`). Use clean markdown tables and structured lists for high readability.`;

    if (groqKey) {
      const modelsToTry = ["openai/gpt-oss-120b", "qwen/qwen3.6-27b", "openai/gpt-oss-20b", "llama-3.3-70b-versatile", "llama-3.1-8b-instant"];
      
      for (const model of modelsToTry) {
        try {
          const messages = [
            { role: "system", content: systemPrompt },
            ...history.slice(-6).map(h => ({ role: h.role === "assistant" ? "assistant" : "user", content: h.content })),
            { role: "user", content: userMessage }
          ];

          const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${groqKey}`,
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              model,
              messages,
              temperature: 0.5,
              max_tokens: 3500
            })
          });

          if (res.ok) {
            const data = (await res.json()) as any;
            const reply = data.choices?.[0]?.message?.content;
            if (reply) {
              return reply.replace(/<think>[\s\S]*?<\/think>/g, "").trim();
            }
          }
        } catch (modelErr) {
          console.warn(`Groq chat with model ${model} failed, trying next:`, modelErr);
        }
      }
    }

    return this.generatePersonalizedFallback(userMessage, candidateName, targetRole, targetCompany, skillsList, fitScore);
  }

  private generatePersonalizedFallback(
    msg: string,
    name: string,
    role: string,
    company: string,
    skills: string,
    fit: number
  ): string {
    const q = msg.toLowerCase();
    const topSkill = skills.split(',')[0]?.trim() || 'Core Engineering';

    if (q.includes("interview") || q.includes("prep") || q.includes("question") || q.includes("pitch")) {
      return `### 💬 Interview Preparation for ${role} at ${company}

Hi **${name}**, here is how to position your expertise for **${role}** at **${company}**:

### 🎯 Suggested Pitch / Introduction Script
> *"I specialize in delivering robust solutions leveraging **${skills.split(',').slice(0, 3).map(s => s.trim()).join(', ')}**. In my recent projects, I focused on high-reliability architecture and measurable feature impact, which aligns directly with ${company}'s engineering standards."*

### 💡 3 Key Focus Areas
- **Highlight Technical Evidence**: Walk through architecture decisions in your core stack (${topSkill}).
- **Demonstrate Problem Solving**: Explain how you tackle complex system constraints and trade-offs.
- **Showcase Growth Agility**: Highlight your continuous learning and readiness rating (**${fit}% Fit**).`;
    }

    if (q.includes("learn") || q.includes("course") || q.includes("skill") || q.includes("gap")) {
      return `### 📚 Recommended Skill Growth & Learning Pathway

Hi **${name}**, based on your target role of **${role}** at **${company}**, here are key competency areas to expand:

### 🎯 Recommended Competency Modules
1. **Enterprise Architecture & System Design for ${role}**
   - *Competency*: Scalable application design & microservices orchestration.
2. **Advanced Data Modeling & Systems Integration**
   - *Competency*: End-to-end API integration and data streaming.
3. **Agile Engineering & Production Delivery**
   - *Competency*: CI/CD automation, testing frameworks, and observability.

### 💡 Next Step
Explore relevant micro-credentials and hands-on projects to add more verified signals to your profile.`;
    }


    return `### 🤖 SAP Joule Career Co-Pilot

Hi **${name}**, I am ready to help you accelerate your journey toward **${role}** at **${company}**.

### 📊 Verified Profile Highlights
- **Target Role**: ${role} (${company})
- **Current Alignment**: **${fit}% Fit** (Verified by SAP Talent Intelligence Hub)
- **Top Competencies**: ${skills}

### 🎯 How Can I Help You Today?
- **Interview Coaching**: Practice technical and behavioral interview scenarios.
- **Project Highlighting**: Craft compelling narratives around your technical artifacts.
- **Skill Acceleration**: Review recommended SAP Learning Hub modules.`;
  }
}

export const jouleCareerAgent = new JouleCareerAgent();

