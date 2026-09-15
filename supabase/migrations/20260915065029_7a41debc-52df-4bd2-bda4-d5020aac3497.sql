CREATE TABLE IF NOT EXISTS public.job_descriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  company TEXT,
  raw_text TEXT NOT NULL,
  required_skills TEXT[] NOT NULL DEFAULT '{}',
  preferred_skills TEXT[] NOT NULL DEFAULT '{}',
  min_experience_years NUMERIC,
  max_experience_years NUMERIC,
  education_requirement TEXT,
  role_summary TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.job_descriptions TO anon, authenticated;
GRANT ALL ON public.job_descriptions TO service_role;
ALTER TABLE public.job_descriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public access to job_descriptions" ON public.job_descriptions FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.candidates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_description_id UUID REFERENCES public.job_descriptions(id) ON DELETE CASCADE,
  full_name TEXT,
  email TEXT,
  phone TEXT,
  file_name TEXT NOT NULL,
  blob_url TEXT,
  raw_text TEXT,
  parsed_skills TEXT[] NOT NULL DEFAULT '{}',
  parsed_education JSONB,
  parsed_experience JSONB,
  total_experience_years NUMERIC,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processing','analyzed','failed')),
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.candidates TO anon, authenticated;
GRANT ALL ON public.candidates TO service_role;
ALTER TABLE public.candidates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public access to candidates" ON public.candidates FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.match_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id UUID REFERENCES public.candidates(id) ON DELETE CASCADE,
  job_description_id UUID REFERENCES public.job_descriptions(id) ON DELETE CASCADE,
  overall_score NUMERIC NOT NULL,
  keyword_score NUMERIC,
  semantic_score NUMERIC,
  matched_skills TEXT[] NOT NULL DEFAULT '{}',
  missing_skills TEXT[] NOT NULL DEFAULT '{}',
  ai_summary TEXT,
  strengths TEXT,
  concerns TEXT,
  rank INT,
  user_status TEXT NOT NULL DEFAULT 'unreviewed' CHECK (user_status IN ('unreviewed','shortlisted','rejected')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (candidate_id, job_description_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.match_results TO anon, authenticated;
GRANT ALL ON public.match_results TO service_role;
ALTER TABLE public.match_results ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public access to match_results" ON public.match_results FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_candidates_job_id ON public.candidates(job_description_id);
CREATE INDEX IF NOT EXISTS idx_match_results_job_id ON public.match_results(job_description_id);
CREATE INDEX IF NOT EXISTS idx_match_results_overall_score ON public.match_results(overall_score DESC);

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_job_descriptions_updated_at BEFORE UPDATE ON public.job_descriptions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_candidates_updated_at BEFORE UPDATE ON public.candidates FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_match_results_updated_at BEFORE UPDATE ON public.match_results FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();