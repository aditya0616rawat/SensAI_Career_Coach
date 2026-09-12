import { pgTable, text, serial, varchar, integer, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";

// Candidates Table
export const candidatesTable = pgTable("candidates", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().unique(),
  profileJson: jsonb("profile_json").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const insertCandidateSchema = createInsertSchema(candidatesTable);
export const selectCandidateSchema = createSelectSchema(candidatesTable);
export type Candidate = typeof candidatesTable.$inferSelect;
export type InsertCandidate = typeof candidatesTable.$inferInsert;

// Jobs Table
export const jobsTable = pgTable("jobs", {
  id: serial("id").primaryKey(),
  title: varchar("title", { length: 256 }).notNull(),
  company: varchar("company", { length: 256 }),
  jobJson: jsonb("job_json").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const insertJobSchema = createInsertSchema(jobsTable);
export const selectJobSchema = createSelectSchema(jobsTable);
export type Job = typeof jobsTable.$inferSelect;
export type InsertJob = typeof jobsTable.$inferInsert;

// Recruiter Access Table
export const recruiterAccessTable = pgTable("recruiter_access", {
  userId: varchar("user_id", { length: 128 }).primaryKey(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const insertRecruiterAccessSchema = createInsertSchema(recruiterAccessTable);
export const selectRecruiterAccessSchema = createSelectSchema(recruiterAccessTable);
export type RecruiterAccess = typeof recruiterAccessTable.$inferSelect;
export type InsertRecruiterAccess = typeof recruiterAccessTable.$inferInsert;

// Applications Table
export const applicationsTable = pgTable("applications", {
  id: varchar("id", { length: 128 }).primaryKey(),
  candidateId: varchar("candidate_id", { length: 128 }).notNull(),
  jobId: integer("job_id").notNull(),
  status: varchar("status", { length: 64 }).default("APPLIED").notNull(),
  appliedAt: timestamp("applied_at", { withTimezone: true }).defaultNow().notNull(),
});

export const insertApplicationSchema = createInsertSchema(applicationsTable);
export const selectApplicationSchema = createSelectSchema(applicationsTable);
export type Application = typeof applicationsTable.$inferSelect;
export type InsertApplication = typeof applicationsTable.$inferInsert;