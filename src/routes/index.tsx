import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { motion } from "framer-motion";
import { useRef, useState } from "react";
import { FileText, Loader2, Upload, Users, Briefcase, Gauge } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { createJobDescription } from "@/lib/skillmatch.functions";
import { extractText, validateFile } from "@/lib/extract-text";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "AISYNC — Rank resumes against any job description" },
      {
        name: "description",
        content:
          "AISYNC screens a batch of resumes against any job description and returns an explainable, ranked shortlist.",
      },
      { property: "og:title", content: "AISYNC — AI resume screening system" },
      {
        property: "og:description",
        content:
          "Paste a job description, upload resumes, and review a ranked, explainable shortlist in minutes.",
      },
    ],
  }),
  component: Index,
});

type JobRow = {
  id: string;
  title: string;
  company: string | null;
  required_skills: string[];
  created_at: string;
};

function Index() {
  const navigate = useNavigate();
  const createJd = useServerFn(createJobDescription);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const jobsQuery = useQuery({
    queryKey: ["jobs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("job_descriptions")
        .select("id, title, company, required_skills, created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as JobRow[];
    },
  });

  const statsQuery = useQuery({
    queryKey: ["home-stats"],
    queryFn: async () => {
      const [{ count: candidates }, matches] = await Promise.all([
        supabase.from("candidates").select("id", { count: "exact", head: true }),
        supabase.from("match_results").select("overall_score, user_status"),
      ]);
      const rows = matches.data ?? [];
      const avg = rows.length
        ? Math.round(rows.reduce((a, r) => a + Number(r.overall_score), 0) / rows.length)
        : 0;
      return {
        candidates: candidates ?? 0,
        avg,
        shortlisted: rows.filter((r) => r.user_status === "shortlisted").length,
        analysed: rows.length,
      };
    },
  });

  async function submit(rawText: string, fileName?: string) {
    if (rawText.trim().length < 50) {
      toast.error("That job description is too short to analyse.");
      return;
    }
    setBusy(true);
    try {
      const result = await createJd({ data: { rawText, fileName } });
      toast.success("Job description analysed");
      navigate({ to: "/jobs/$jobId", params: { jobId: result.id } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  async function handleFile(file: File) {
    const invalid = validateFile(file);
    if (invalid) {
      toast.error(invalid);
      return;
    }
    setBusy(true);
    try {
      const extracted = await extractText(file);
      await submit(extracted, file.name.replace(/\.(pdf|docx)$/i, ""));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not read that file.");
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-14">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, ease: "easeOut" }}
      >
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-primary">
          Step 1 — job description
        </p>
        <h1 className="mt-2 text-3xl font-semibold sm:text-4xl">Create a job description</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Paste the role or upload the file. It gets broken down into required skills, nice-to-haves,
          experience and education so every resume is judged against the same rubric.
        </p>

        <div className="mt-8 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
          <section className="rounded-xl border border-border bg-card p-5 shadow-card">
            <label htmlFor="jd" className="text-sm font-medium">
              Paste job description text
            </label>
            <Textarea
              id="jd"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Senior Full-Stack Engineer — we're looking for..."
              className="mt-2 min-h-[260px] resize-y font-mono text-[13px] leading-relaxed"
            />
            <div className="mt-4 flex items-center justify-between gap-3">
              <span className="text-xs text-muted-foreground">
                {text.trim().length} characters
              </span>
              <Button onClick={() => submit(text)} disabled={busy}>
                {busy ? <Loader2 className="size-4 animate-spin" /> : <FileText className="size-4" />}
                Analyse job description
              </Button>
            </div>
          </section>

          <section className="flex flex-col gap-4">
            <motion.div
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragging(false);
                const file = e.dataTransfer.files?.[0];
                if (file) void handleFile(file);
              }}
              animate={{
                borderColor: dragging ? "var(--primary)" : "var(--border)",
                backgroundColor: dragging ? "var(--brand-soft)" : "var(--card)",
              }}
              className="flex flex-1 flex-col items-center justify-center rounded-xl border-2 border-dashed p-8 text-center shadow-soft"
            >
              <Upload className="size-6 text-primary" aria-hidden="true" />
              <p className="mt-3 text-sm font-medium">Or upload the JD file</p>
              <p className="mt-1 text-xs text-muted-foreground">PDF or DOCX, up to 5 MB</p>
              <Button
                variant="outline"
                className="mt-4"
                disabled={busy}
                onClick={() => fileInput.current?.click()}
              >
                Browse files
              </Button>
              <input
                ref={fileInput}
                type="file"
                accept=".pdf,.docx"
                className="sr-only"
                aria-label="Upload job description file"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void handleFile(file);
                  e.target.value = "";
                }}
              />
            </motion.div>

            <div className="grid grid-cols-2 gap-3">
              <StatCard
                icon={<Briefcase className="size-4" />}
                label="Job descriptions"
                value={jobsQuery.data?.length ?? 0}
              />
              <StatCard
                icon={<Users className="size-4" />}
                label="Resumes screened"
                value={statsQuery.data?.candidates ?? 0}
              />
              <StatCard
                icon={<Gauge className="size-4" />}
                label="Average score"
                value={statsQuery.data?.avg ?? 0}
              />
              <StatCard
                icon={<FileText className="size-4" />}
                label="Shortlisted"
                value={statsQuery.data?.shortlisted ?? 0}
              />
            </div>
          </section>
        </div>
      </motion.div>

      <section className="mt-14">
        <h2 className="text-lg font-semibold">Previous job descriptions</h2>
        {jobsQuery.isLoading ? (
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-28 rounded-xl" />
            ))}
          </div>
        ) : (jobsQuery.data?.length ?? 0) === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">
            Nothing here yet — your analysed roles will show up in this list.
          </p>
        ) : (
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {jobsQuery.data!.map((job, i) => (
              <motion.div
                key={job.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04, duration: 0.2 }}
                whileHover={{ scale: 1.02 }}
              >
                <Link
                  to="/jobs/$jobId"
                  params={{ jobId: job.id }}
                  className="block rounded-xl border border-border bg-card p-4 shadow-soft transition-shadow hover:shadow-card"
                >
                  <p className="font-medium">{job.title}</p>
                  <p className="text-xs text-muted-foreground">{job.company ?? "Company not stated"}</p>
                  <p className="mt-3 text-xs text-muted-foreground">
                    {job.required_skills.length} required skills ·{" "}
                    {new Date(job.created_at).toLocaleDateString()}
                  </p>
                </Link>
              </motion.div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

function StatCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-soft">
      <div className="flex items-center gap-2 text-muted-foreground">
        {icon}
        <span className="text-xs">{label}</span>
      </div>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
    </div>
  );
}
