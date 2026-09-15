import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const CreateJobInput = z.object({
  rawText: z.string().min(50, "The job description looks too short to analyse."),
  fileName: z.string().optional(),
});

const CandidateInput = z.object({
  candidateId: z.string().uuid(),
});

type JdParsed = {
  title?: string | null;
  company?: string | null;
  required_skills?: string[];
  preferred_skills?: string[];
  min_experience_years?: number | null;
  max_experience_years?: number | null;
  education_requirement?: string | null;
  role_summary?: string | null;
};

type ResumeParsed = {
  full_name?: string | null;
  email?: string | null;
  phone?: string | null;
  skills?: string[];
  education?: unknown;
  experience?: unknown;
  total_experience_years?: number | null;
};

type MatchParsed = {
  matched_skills?: string[];
  missing_skills?: string[];
  semantic_score?: number;
  rationale?: string;
  strength?: string | null;
  concern?: string | null;
};

const cleanList = (v: unknown): string[] =>
  Array.isArray(v)
    ? Array.from(
        new Set(
          v
            .filter((s): s is string => typeof s === "string")
            .map((s) => s.trim())
            .filter(Boolean),
        ),
      )
    : [];

const num = (v: unknown): number | null =>
  typeof v === "number" && Number.isFinite(v) ? v : null;

/** Create a job description from raw text: parse it with AI and store it. */
export const createJobDescription = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => CreateJobInput.parse(input))
  .handler(async ({ data }) => {
    const { groqJson } = await import("./groq.server");
    const { createServerSupabase } = await import("./supabase-public.server");

    const text = data.rawText.slice(0, 24000);
    const parsed = await groqJson<JdParsed>(
      `You are an expert HR recruiter. Extract key information from this job description and return ONLY valid JSON.

Job Description:
${text}

Return a JSON object with exactly these fields:
{
  "title": "job title",
  "company": "company name or null",
  "required_skills": ["skill1", "skill2"],
  "preferred_skills": ["skill3"],
  "min_experience_years": number or null,
  "max_experience_years": number or null,
  "education_requirement": "string or null",
  "role_summary": "1-2 sentence summary"
}`,
    );

    const supabase = createServerSupabase();
    const { data: row, error } = await supabase
      .from("job_descriptions")
      .insert({
        title: (parsed.title || data.fileName || "Untitled role").toString().slice(0, 200),
        company: parsed.company ?? null,
        raw_text: text,
        required_skills: cleanList(parsed.required_skills),
        preferred_skills: cleanList(parsed.preferred_skills),
        min_experience_years: num(parsed.min_experience_years),
        max_experience_years: num(parsed.max_experience_years),
        education_requirement: parsed.education_requirement ?? null,
        role_summary: parsed.role_summary ?? null,
      })
      .select("id")
      .single();

    if (error) throw new Error(`Could not save the job description: ${error.message}`);
    return { id: row.id };
  });

const normalizeSkill = (s: string) => s.toLowerCase().replace(/[^a-z0-9+#.]/g, "");

async function runAnalysis(candidateId: string) {
  const { groqJson } = await import("./groq.server");
  const { createServerSupabase } = await import("./supabase-public.server");
  const supabase = createServerSupabase();

  const { data: candidate, error: cErr } = await supabase
    .from("candidates")
    .select("*")
    .eq("id", candidateId)
    .single();
  if (cErr || !candidate) throw new Error("Candidate not found.");
  if (!candidate.job_description_id) throw new Error("Candidate is not linked to a job.");

  const { data: jd, error: jErr } = await supabase
    .from("job_descriptions")
    .select("*")
    .eq("id", candidate.job_description_id)
    .single();
  if (jErr || !jd) throw new Error("Job description not found.");

  const required = jd.required_skills ?? [];
  const skills = candidate.parsed_skills ?? [];
  const matchedRequired = required.filter((req) =>
    skills.some((s) => normalizeSkill(s) === normalizeSkill(req)),
  );
  const keywordScore = required.length
    ? Math.round((matchedRequired.length / required.length) * 100)
    : 0;

  const parsed = await groqJson<MatchParsed>(
    `You are a hiring expert comparing a resume to a job description. Be concise and accurate.

JD Required Skills: ${required.join(", ") || "none listed"}
JD Preferred Skills: ${(jd.preferred_skills ?? []).join(", ") || "none listed"}
JD Experience Range: ${jd.min_experience_years ?? "?"} to ${jd.max_experience_years ?? "?"} years
Candidate Skills: ${skills.join(", ") || "none extracted"}
Candidate Total Experience: ${candidate.total_experience_years ?? "unknown"} years
Candidate Experience: ${JSON.stringify(candidate.parsed_experience ?? []).slice(0, 4000)}

Analyze the match and return ONLY valid JSON:
{
  "matched_skills": ["skill1"],
  "missing_skills": ["skill2"],
  "semantic_score": number between 0 and 100,
  "rationale": "2-3 sentence summary of fit",
  "strength": "one key strength",
  "concern": "one key concern or null"
}`,
    700,
  );

  const semanticScore = Math.max(0, Math.min(100, Math.round(num(parsed.semantic_score) ?? 0)));
  const overall = Math.round(0.4 * keywordScore + 0.6 * semanticScore);

  const { error: upErr } = await supabase.from("match_results").upsert(
    {
      candidate_id: candidateId,
      job_description_id: jd.id,
      overall_score: overall,
      keyword_score: keywordScore,
      semantic_score: semanticScore,
      matched_skills: cleanList(parsed.matched_skills),
      missing_skills: cleanList(parsed.missing_skills),
      ai_summary: parsed.rationale ?? null,
      strengths: parsed.strength ?? null,
      concerns: parsed.concern ?? null,
    },
    { onConflict: "candidate_id,job_description_id" },
  );
  if (upErr) throw new Error(`Could not save the analysis: ${upErr.message}`);

  const { data: all } = await supabase
    .from("match_results")
    .select("id, overall_score")
    .eq("job_description_id", jd.id)
    .order("overall_score", { ascending: false });

  if (all) {
    await Promise.all(
      all.map((m, i) => supabase.from("match_results").update({ rank: i + 1 }).eq("id", m.id)),
    );
  }

  return { overall_score: overall, keyword_score: keywordScore, semantic_score: semanticScore };
}

/** Parse a candidate's resume text, then score it against the job description. */
export const processCandidate = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => CandidateInput.parse(input))
  .handler(async ({ data }) => {
    const { groqJson } = await import("./groq.server");
    const { createServerSupabase } = await import("./supabase-public.server");
    const supabase = createServerSupabase();

    const { data: candidate, error } = await supabase
      .from("candidates")
      .select("id, raw_text, file_name")
      .eq("id", data.candidateId)
      .single();
    if (error || !candidate) throw new Error("Candidate not found.");
    if (!candidate.raw_text || candidate.raw_text.trim().length < 40) {
      await supabase
        .from("candidates")
        .update({ status: "failed", error_message: "No readable text found in this file." })
        .eq("id", candidate.id);
      throw new Error("No readable text found in this file.");
    }

    await supabase
      .from("candidates")
      .update({ status: "processing", error_message: null })
      .eq("id", candidate.id);

    try {
      const parsed = await groqJson<ResumeParsed>(
        `You are an expert resume parser. Extract key information from this resume and return ONLY valid JSON.

Resume:
${candidate.raw_text.slice(0, 24000)}

Return a JSON object with exactly these fields:
{
  "full_name": "string",
  "email": "string or null",
  "phone": "string or null",
  "skills": ["skill1", "skill2"],
  "education": [{"degree": "string", "institution": "string", "year": number or null}],
  "experience": [{"role": "string", "company": "string", "duration_years": number, "description": "string"}],
  "total_experience_years": number
}`,
      );

      await supabase
        .from("candidates")
        .update({
          full_name: parsed.full_name ?? candidate.file_name,
          email: parsed.email ?? null,
          phone: parsed.phone ?? null,
          parsed_skills: cleanList(parsed.skills),
          parsed_education: (parsed.education ?? []) as never,
          parsed_experience: (parsed.experience ?? []) as never,
          total_experience_years: num(parsed.total_experience_years),
          status: "analyzed",
          error_message: null,
        })
        .eq("id", candidate.id);

      const scores = await runAnalysis(candidate.id);
      return { success: true as const, ...scores };
    } catch (e) {
      const message = e instanceof Error ? e.message : "Unknown error";
      await supabase
        .from("candidates")
        .update({ status: "failed", error_message: message.slice(0, 500) })
        .eq("id", candidate.id);
      throw new Error(message);
    }
  });

/** Re-run only the matching engine for an already-parsed candidate. */
export const reanalyzeCandidate = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => CandidateInput.parse(input))
  .handler(async ({ data }) => runAnalysis(data.candidateId));
