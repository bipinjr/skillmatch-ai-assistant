import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AnimatePresence, motion } from "framer-motion";
import { useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  GraduationCap,
  Loader2,
  Upload,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { processCandidate } from "@/lib/skillmatch.functions";
import { extractText, validateFile } from "@/lib/extract-text";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";

export const Route = createFileRoute("/jobs/$jobId/")({
  head: () => ({
    meta: [
      { title: "Job breakdown & resume upload — AISYNC" },
      {
        name: "description",
        content:
          "Review the extracted required skills, experience and education for this role, then upload a batch of resumes to screen.",
      },
      { property: "og:title", content: "Job breakdown & resume upload — AISYNC" },
      {
        property: "og:description",
        content: "Check the parsed role requirements, then drop in resumes to screen against them.",
      },
    ],
  }),
  component: JobDetail,
});

type FileState = {
  id: string;
  name: string;
  progress: number;
  status: "reading" | "analysing" | "done" | "failed";
  error?: string;
};

function JobDetail() {
  const { jobId } = Route.useParams();
  const navigate = useNavigate();
  const runCandidate = useServerFn(processCandidate);
  const fileInput = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [queue, setQueue] = useState<FileState[]>([]);
  const [running, setRunning] = useState(false);

  const jobQuery = useQuery({
    queryKey: ["job", jobId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("job_descriptions")
        .select("*")
        .eq("id", jobId)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const countQuery = useQuery({
    queryKey: ["job-candidate-count", jobId],
    queryFn: async () => {
      const { count } = await supabase
        .from("candidates")
        .select("id", { count: "exact", head: true })
        .eq("job_description_id", jobId);
      return count ?? 0;
    },
  });

  function patch(id: string, changes: Partial<FileState>) {
    setQueue((q) => q.map((f) => (f.id === id ? { ...f, ...changes } : f)));
  }

  async function handleFiles(files: File[]) {
    if (files.length === 0) return;
    if (files.length > 20) {
      toast.error("Up to 20 resumes at a time, please.");
      return;
    }

    const valid: File[] = [];
    for (const file of files) {
      const invalid = validateFile(file);
      if (invalid) toast.error(invalid);
      else valid.push(file);
    }
    if (valid.length === 0) return;

    const entries: FileState[] = valid.map((f) => ({
      id: `${f.name}-${crypto.randomUUID()}`,
      name: f.name,
      progress: 5,
      status: "reading",
    }));
    setQueue((q) => [...q, ...entries]);
    setRunning(true);

    for (let i = 0; i < valid.length; i++) {
      const file = valid[i]!;
      const entry = entries[i]!;
      try {
        const text = await extractText(file);
        patch(entry.id, { progress: 40, status: "analysing" });

        const { data: row, error } = await supabase
          .from("candidates")
          .insert({
            job_description_id: jobId,
            file_name: file.name,
            raw_text: text,
            status: "processing",
          })
          .select("id")
          .single();
        if (error) throw new Error(error.message);

        patch(entry.id, { progress: 65 });
        await runCandidate({ data: { candidateId: row.id } });
        patch(entry.id, { progress: 100, status: "done" });
      } catch (e) {
        patch(entry.id, {
          progress: 100,
          status: "failed",
          error: e instanceof Error ? e.message : "Failed",
        });
      }
    }

    setRunning(false);
    void countQuery.refetch();
    toast.success("Screening finished");
  }

  const job = jobQuery.data;
  const done = queue.filter((f) => f.status === "done" || f.status === "failed").length;

  return (
    <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <Link
        to="/"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> All job descriptions
      </Link>

      {jobQuery.isLoading ? (
        <Skeleton className="mt-6 h-64 rounded-xl" />
      ) : !job ? (
        <p className="mt-6 text-sm text-muted-foreground">This job description could not be found.</p>
      ) : (
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
          className="mt-5 rounded-xl border border-border bg-card p-6 shadow-card"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-2xl font-semibold">{job.title}</h1>
              <p className="text-sm text-muted-foreground">{job.company ?? "Company not stated"}</p>
            </div>
            {(countQuery.data ?? 0) > 0 && (
              <Button asChild variant="outline">
                <Link to="/jobs/$jobId/candidates" params={{ jobId }}>
                  View ranked candidates ({countQuery.data}) <ArrowRight className="size-4" />
                </Link>
              </Button>
            )}
          </div>

          {job.role_summary && <p className="mt-4 text-sm leading-relaxed">{job.role_summary}</p>}

          <div className="mt-6 space-y-4">
            <SkillGroup title="Required skills" skills={job.required_skills} tone="required" />
            <SkillGroup title="Nice to have" skills={job.preferred_skills} tone="preferred" />
          </div>

          <dl className="mt-6 grid gap-4 sm:grid-cols-2">
            <div className="rounded-lg bg-secondary/60 p-3">
              <dt className="text-xs text-muted-foreground">Experience</dt>
              <dd className="text-sm font-medium">
                {job.min_experience_years ?? "?"}–{job.max_experience_years ?? "?"} years
              </dd>
            </div>
            <div className="rounded-lg bg-secondary/60 p-3">
              <dt className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <GraduationCap className="size-3.5" /> Education
              </dt>
              <dd className="text-sm font-medium">
                {job.education_requirement ?? "Not specified"}
              </dd>
            </div>
          </dl>
        </motion.section>
      )}

      <section className="mt-8">
        <h2 className="text-lg font-semibold">Upload resumes</h2>
        <motion.div
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            void handleFiles(Array.from(e.dataTransfer.files ?? []));
          }}
          animate={{
            borderColor: dragging ? "var(--primary)" : "var(--border)",
            backgroundColor: dragging ? "var(--brand-soft)" : "var(--card)",
          }}
          className="mt-3 flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-10 text-center shadow-soft"
        >
          <Upload className="size-7 text-primary" aria-hidden="true" />
          <p className="mt-3 text-sm font-medium">Drop resumes here</p>
          <p className="mt-1 text-xs text-muted-foreground">
            PDF or DOCX · max 20 files · 5 MB each
          </p>
          <Button
            className="mt-4"
            disabled={running}
            onClick={() => fileInput.current?.click()}
          >
            {running ? <Loader2 className="size-4 animate-spin" /> : null}
            {running ? "Screening…" : "Browse files"}
          </Button>
          <input
            ref={fileInput}
            type="file"
            multiple
            accept=".pdf,.docx"
            className="sr-only"
            aria-label="Upload resume files"
            onChange={(e) => {
              void handleFiles(Array.from(e.target.files ?? []));
              e.target.value = "";
            }}
          />
        </motion.div>

        <AnimatePresence>
          {queue.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mt-5 rounded-xl border border-border bg-card p-4 shadow-soft"
            >
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">
                  Screening {done} of {queue.length}
                </p>
                {!running && (
                  <Button
                    size="sm"
                    onClick={() => navigate({ to: "/jobs/$jobId/candidates", params: { jobId } })}
                  >
                    View results <ArrowRight className="size-4" />
                  </Button>
                )}
              </div>
              <ul className="mt-3 space-y-3">
                {queue.map((f, i) => (
                  <motion.li
                    key={f.id}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.04 }}
                    className="space-y-1.5"
                  >
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <span className="truncate font-mono text-[13px]">{f.name}</span>
                      <span className="flex shrink-0 items-center gap-1.5 text-xs">
                        {f.status === "done" && (
                          <motion.span initial={{ scale: 1.3 }} animate={{ scale: 1 }}>
                            <CheckCircle2 className="size-4 text-success" />
                          </motion.span>
                        )}
                        {f.status === "failed" && <XCircle className="size-4 text-danger" />}
                        {(f.status === "reading" || f.status === "analysing") && (
                          <motion.span
                            className="size-2 rounded-full bg-primary"
                            animate={{ opacity: [1, 0.3, 1] }}
                            transition={{ repeat: Infinity, duration: 1.2 }}
                          />
                        )}
                        <span className="text-muted-foreground">
                          {f.status === "reading"
                            ? "Reading file"
                            : f.status === "analysing"
                              ? "AI analysing"
                              : f.status === "done"
                                ? "Analysed"
                                : "Failed"}
                        </span>
                      </span>
                    </div>
                    <Progress value={f.progress} className="h-1.5" />
                    {f.error && <p className="text-xs text-danger">{f.error}</p>}
                  </motion.li>
                ))}
              </ul>
            </motion.div>
          )}
        </AnimatePresence>
      </section>
    </main>
  );
}

function SkillGroup({
  title,
  skills,
  tone,
}: {
  title: string;
  skills: string[];
  tone: "required" | "preferred";
}) {
  if (!skills.length) return null;
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{title}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {skills.map((s) => (
          <span
            key={s}
            className={
              tone === "required"
                ? "chip bg-brand-soft text-secondary-foreground"
                : "chip bg-secondary text-secondary-foreground"
            }
          >
            {s}
          </span>
        ))}
      </div>
    </div>
  );
}
