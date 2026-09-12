import { bootstrapPostgresSchema, createPool, Pool } from "@workspace/db";

export type ConnectionMode = "NEON_CONNECTED" | "NEON_DISCONNECTED" | "IN_MEMORY";

export class NeonDatabase {
  private pool: InstanceType<typeof Pool> | null = null;
  private mode: ConnectionMode = "IN_MEMORY";
  private memoryStore: Map<string, any[]> = new Map();

  constructor() {
    this.initMemoryStore();
  }

  private initMemoryStore() {
    this.memoryStore.set("jobs", [
      {
        id: 1,
        title: "Product Operations Lead",
        company: "SensAI",
        location: "Bangalore (Hybrid)",
        mode: "Hybrid",
        salary: "₹28L – ₹36L",
        skills: ["Product Strategy", "Cross-Functional Alignment", "SQL Analytics", "Agile Execution"],
        description: "Scale core enterprise cloud solutions, aligning 5 product teams across Bangalore & remote hubs.",
      },
      {
        id: 2,
        title: "Senior Systems Specialist",
        company: "Northstar Health",
        location: "Remote",
        mode: "Remote",
        salary: "₹22L – ₹30L",
        skills: ["HealthTech", "System Architecture", "TypeScript", "Node.js"],
        description: "Lead patient record integration with human-centered care and modern AI infrastructure.",
      },
      {
        id: 3,
        title: "Full Stack Engineer (AI Platforms)",
        company: "SensAI Careers",
        location: "Remote",
        mode: "Remote",
        salary: "₹25L – ₹35L",
        skills: ["React", "Node.js", "PostgreSQL", "Tailwind CSS", "API Design"],
        description: "Build inclusive hiring platforms and skills-first evaluation engines.",
      },
    ]);
    this.memoryStore.set("candidates", []);
    this.memoryStore.set("recruiter_access", []);
    this.memoryStore.set("applications", []);
  }

  async connect(): Promise<boolean> {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      console.warn(
        "⚠️  DATABASE_URL is not set.\n" +
        "    Running in IN_MEMORY mode — data will reset on restart.\n" +
        "    To persist data in Neon, set DATABASE_URL in your .env file."
      );
      this.mode = "IN_MEMORY";
      return false;
    }

    try {
      this.pool = createPool(databaseUrl) || new Pool({
        connectionString: databaseUrl,
        ssl: { rejectUnauthorized: false },
      });

      // Test connection with a simple query
      const client = await this.pool.connect();
      client.release();

      this.mode = "NEON_CONNECTED";
      console.log("✅ Connected to Neon Serverless PostgreSQL successfully.");
      return true;
    } catch (err: any) {
      console.error("❌ Neon PostgreSQL connection failed:", err.message);
      this.mode = "NEON_DISCONNECTED";
      this.pool = null;
      return false;
    }
  }

  async bootstrapSchema(): Promise<void> {
    if (this.mode !== "NEON_CONNECTED" || !this.pool) {
      console.log(`ℹ️  Schema bootstrap skipped (mode: ${this.mode}).`);
      return;
    }

    try {
      await bootstrapPostgresSchema(this.pool);
      console.log("✅ Neon schema bootstrapped (tables ready).");
    } catch (err: any) {
      console.error("❌ Failed to bootstrap Neon schema:", err.message);
    }
  }

  private async query<T = any>(text: string, params: any[] = []): Promise<T[]> {
    if (!this.pool) throw new Error("Neon pool is not connected.");
    const res = await this.pool.query(text, params);
    return res.rows;
  }

  async getCandidateProfile(userId: string): Promise<any | null> {
    if (!userId) return null;

    if (this.mode === "NEON_CONNECTED") {
      try {
        const rows = await this.query<{ profile_json: any }>(
          `SELECT profile_json FROM candidates WHERE user_id = $1 LIMIT 1`,
          [userId]
        );
        if (rows.length > 0) {
          const profile = rows[0].profile_json;
          return typeof profile === "string" ? JSON.parse(profile) : profile;
        }
        return null;
      } catch (e: any) {
        console.error("Neon getCandidateProfile error:", e.message);
        return null;
      }
    }

    const candidates = this.memoryStore.get("candidates") ?? [];
    return candidates.find((c) => c.userId === userId || c.id === userId) ?? null;
  }

  async saveCandidateProfile(profile: any): Promise<any> {
    const record = {
      ...profile,
      name: profile.name || profile.candidateName || "",
      candidateName: profile.candidateName || profile.name || "",
      id: profile.id || `cand_${Date.now()}`,
      updatedAt: new Date().toISOString(),
    };

    if (this.mode === "NEON_CONNECTED") {
      try {
        const json = typeof record === "string" ? record : JSON.stringify(record);
        await this.query(
          `INSERT INTO candidates (id, user_id, profile_json, updated_at)
           VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
           ON CONFLICT (user_id)
           DO UPDATE SET profile_json = EXCLUDED.profile_json, updated_at = CURRENT_TIMESTAMP`,
          [record.id, record.userId, json]
        );
        console.log(`💾 Profile saved to Neon for userId: ${record.userId}`);
        return record;
      } catch (e: any) {
        console.error("Neon saveCandidateProfile error:", e.message);
        throw e;
      }
    }

    const candidates = this.memoryStore.get("candidates") ?? [];
    const idx = candidates.findIndex(
      (c) => c.userId === record.userId || (record.id && c.id === record.id)
    );
    if (idx >= 0) candidates[idx] = { ...candidates[idx], ...record };
    else candidates.push(record);
    this.memoryStore.set("candidates", candidates);
    return record;
  }

  async getCandidates(): Promise<any[]> {
    if (this.mode === "NEON_CONNECTED") {
      try {
        const rows = await this.query<{ profile_json: any }>(
          `SELECT profile_json FROM candidates ORDER BY updated_at DESC`
        );
        return rows.map((r) => typeof r.profile_json === "string" ? JSON.parse(r.profile_json) : r.profile_json);
      } catch (e: any) {
        console.error("Neon getCandidates error:", e.message);
        return [];
      }
    }
    return this.memoryStore.get("candidates") ?? [];
  }

  async isRecruiter(userId: string): Promise<boolean> {
    if (!userId) return false;

    if (this.mode === "NEON_CONNECTED") {
      try {
        const rows = await this.query<{ user_id: string }>(
          `SELECT user_id FROM recruiter_access WHERE user_id = $1`,
          [userId]
        );
        return rows.length > 0;
      } catch (e: any) {
        console.error("Neon isRecruiter error:", e.message);
        return false;
      }
    }

    return (this.memoryStore.get("recruiter_access") ?? []).includes(userId);
  }

  async grantRecruiterAccess(userId: string): Promise<void> {
    if (!userId) throw new Error("A user ID is required to grant recruiter access.");

    if (this.mode === "NEON_CONNECTED") {
      await this.query(
        `INSERT INTO recruiter_access (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING`,
        [userId]
      );
      return;
    }

    const recruiters = this.memoryStore.get("recruiter_access") ?? [];
    if (!recruiters.includes(userId)) recruiters.push(userId);
    this.memoryStore.set("recruiter_access", recruiters);
  }

  async getJobs(): Promise<any[]> {
    if (this.mode === "NEON_CONNECTED") {
      try {
        const rows = await this.query<{ id: number; title: string; company: string; job_json: any }>(
          `SELECT id, title, company, job_json FROM jobs ORDER BY id ASC`
        );
        return rows.map((r) => {
          const parsed = typeof r.job_json === "string" ? JSON.parse(r.job_json) : r.job_json;
          return { ...parsed, id: r.id, title: r.title, company: r.company };
        });
      } catch (e: any) {
        console.error("Neon getJobs error:", e.message);
        return [];
      }
    }
    return this.memoryStore.get("jobs") ?? [];
  }

  async getJob(jobId: number): Promise<any | null> {
    if (!Number.isInteger(jobId) || jobId < 1) return null;

    if (this.mode === "NEON_CONNECTED") {
      try {
        const rows = await this.query<{ id: number; title: string; company: string; job_json: any }>(
          `SELECT id, title, company, job_json FROM jobs WHERE id = $1`,
          [jobId]
        );
        if (rows.length > 0) {
          const r = rows[0];
          const parsed = typeof r.job_json === "string" ? JSON.parse(r.job_json) : r.job_json;
          return { ...parsed, id: r.id, title: r.title, company: r.company };
        }
        return null;
      } catch (e: any) {
        console.error("Neon getJob error:", e.message);
        return null;
      }
    }

    const jobs = this.memoryStore.get("jobs") ?? [];
    return jobs.find((job) => job.id === jobId) ?? null;
  }

  async createJob(job: any): Promise<any> {
    const newJob = { ...job, created_at: new Date().toISOString() };

    if (this.mode === "NEON_CONNECTED") {
      try {
        const json = typeof newJob === "string" ? newJob : JSON.stringify(newJob);
        const rows = await this.query<{ id: number }>(
          `INSERT INTO jobs (title, company, job_json) VALUES ($1, $2, $3) RETURNING id`,
          [newJob.title ?? "", newJob.company ?? "", json]
        );
        const id = rows[0]?.id;
        return { ...newJob, id: id ?? newJob.id };
      } catch (e: any) {
        console.error("Neon createJob error:", e.message);
        throw e;
      }
    }

    const jobs = this.memoryStore.get("jobs") ?? [];
    newJob.id = jobs.length + 1;
    jobs.push(newJob);
    this.memoryStore.set("jobs", jobs);
    return newJob;
  }

  getStatus() {
    const databaseUrl = process.env.DATABASE_URL;
    let host = "in-memory";
    if (databaseUrl) {
      try {
        const parsed = new URL(databaseUrl);
        host = parsed.host;
      } catch {}
    }
    return {
      database: "Neon Serverless PostgreSQL",
      mode: this.mode,
      status: this.mode === "NEON_CONNECTED" ? "CONNECTED" : this.mode,
      host,
      tables: ["candidates", "jobs", "applications", "recruiter_access"],
    };
  }
}

export const neonDb = new NeonDatabase();
export const db = neonDb;
export const hanaDb = neonDb; // Alias for seamless backwards compatibility
