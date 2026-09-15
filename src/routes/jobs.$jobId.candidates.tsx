import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Download,
  Loader2,
  RefreshCw,
  Search,
  Star,
  X,
} from "lucide-react";
import { toast } from "sonner";
import Papa from "papaparse";

import { supabase } from "@/integrations/supabase/client";
import { reanalyzeCandidate } from "@/lib/skillmatch.functions";
import { CountUp, ScoreRing, scoreTone } from "@/components/ScoreRing";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/jobs/$jobId/candidates")({
  head: () => ({
    meta: [
      { title: "Ranked candidates — SkillMatch AI" },
      {
        name: "description",
        content:
          "An explainable, ranked shortlist: match scores, matched and missing skills, AI rationale, strengths and concerns for every resume.",
      },
      { property: "og:title", content: "Ranked candidates — SkillMatch AI" },
      {
        property: "og:description",
        content: "Review scored candidates with matched skills, gaps and AI rationale, then export your shortlist.",
      },
    ],
  }),
  component: CandidateDashboard,
});

type Education = { degree?: string; institution?: string; year?: number | null };
type Experience = {
  role?: string;
  company?: string;
  duration_years?: number | null;
  description?: string;
};

type Candidate = {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  file_name: string;
  parsed_skills: string[];
  parsed_education: unknown;
  parsed_experience: unknown;
  total_experience_years: number | null;
  status: string;
  error_message: string | null;
  match: {
    id: string;
    overall_score: number;
    keyword_score: number | null;
    semantic_score: number | null;
    matched_skills: string[];
    missing_skills: string[];
    ai_summary: string | null;
    strengths: string | null;
    concerns: string | null;
    rank: number | null;
    user_status: string;
  } | null;
};

function CandidateDashboard() {
  const { jobId } = Route.useParams();
  const queryClient = useQueryClient();
  const reanalyze = useServerFn(reanalyzeCandidate);
  const [search, setSearch] = useState("");
  const [minScore, setMinScore] = useState(0);
  const [statusFilter, setStatusFilter] = useState("active");
  const [openId, setOpenId] = useState<string | null>(null);

  const jobQuery = useQuery({
    queryKey: ["job", jobId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("job_descriptions")
        .select("id, title, company")
        .eq("id", jobId)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const listQuery = useQuery({
    queryKey: ["candidates", jobId],
    refetchInterval: 8000,
    queryFn: async () => {
      const [{ data: candidates, error }, { data: matches }] = await Promise.all([
        supabase
          .from("candidates")
          .select(
            "id, full_name, email, phone, file_name, parsed_skills, parsed_education, parsed_experience, total_experience_years, status, error_message",
          )
          .eq("job_description_id", jobId),
        supabase.from("match_results").select("*").eq("job_description_id", jobId),
      ]);
      if (error) throw error;
      const byCandidate = new Map((matches ?? []).map((m) => [m.candidate_id, m]));
      return (candidates ?? [])
        .map((c) => {
          const m = byCandidate.get(c.id);
          return {
            ...c,
            match: m
              ? {
                  id: m.id,
                  overall_score: Number(m.overall_score),
                  keyword_score: m.keyword_score === null ? null : Number(m.keyword_score),
                  semantic_score: m.semantic_score === null ? null : Number(m.semantic_score),
                  matched_skills: m.matched_skills ?? [],
                  missing_skills: m.missing_skills ?? [],
                  ai_summary: m.ai_summary,
                  strengths: m.strengths,
                  concerns: m.concerns,
                  rank: m.rank,
                  user_status: m.user_status,
                }
              : null,
          } as Candidate;
        })
        .sort((a, b) => (b.match?.overall_score ?? -1) - (a.match?.overall_score ?? -1));
    },
  });

  const setStatus = useMutation({
    mutationFn: async ({ matchId, status }: { matchId: string; status: string }) => {
      const { error } = await supabase
        .from("match_results")
        .update({ user_status: status })
        .eq("id", matchId);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["candidates", jobId] }),
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not update"),
  });

  const retry = useMutation({
    mutationFn: async (candidateId: string) => reanalyze({ data: { candidateId } }),
    onSuccess: () => {
      toast.success("Re-analysed");
      void queryClient.invalidateQueries({ queryKey: ["candidates", jobId] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not re-analyse"),
  });

  const rows = listQuery.data ?? [];

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((c) => {
      const status = c.match?.user_status ?? "unreviewed";
      if (statusFilter === "active" && status === "rejected") return false;
      if (statusFilter !== "active" && statusFilter !== "all" && status !== statusFilter)
        return false;
      if ((c.match?.overall_score ?? 0) < minScore) return false;
      if (!q) return true;
      return (
        (c.full_name ?? c.file_name).toLowerCase().includes(q) ||
        (c.email ?? "").toLowerCase().includes(q)
      );
    });
  }, [rows, search, minScore, statusFilter]);

  const open = rows.find((c) => c.id === openId) ?? null;

  useEffect(() => {
    if (!openId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpenId(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openId]);

  function exportShortlist() {
    const shortlisted = rows.filter((c) => c.match?.user_status === "shortlisted");
    if (shortlisted.length === 0) {
      toast.error("No shortlisted candidates to export yet.");
      return;
    }
    const csv = Papa.unparse(
      shortlisted.map((c) => ({
        rank: c.match?.rank ?? "",
        name: c.full_name ?? c.file_name,
        email: c.email ?? "",
        phone: c.phone ?? "",
        overall_score: c.match?.overall_score ?? "",
        keyword_score: c.match?.keyword_score ?? "",
        semantic_score: c.match?.semantic_score ?? "",
        total_experience_years: c.total_experience_years ?? "",
        matched_skills: (c.match?.matched_skills ?? []).join("; "),
        missing_skills: (c.match?.missing_skills ?? []).join("; "),
        ai_summary: c.match?.ai_summary ?? "",
      })),
    );
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `shortlist-${jobQuery.data?.title ?? "job"}.csv`.replace(/\s+/g, "-");
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <Link
        to="/jobs/$jobId"
        params={{ jobId }}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Back to job description
      </Link>

      <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">{jobQuery.data?.title ?? "Candidates"}</h1>
          <p className="text-sm text-muted-foreground">
            {filtered.length} of {rows.length} candidates shown, ranked by match score
          </p>
        </div>
        <Button variant="outline" onClick={exportShortlist}>
          <Download className="size-4" /> Export shortlist
        </Button>
      </div>

      <div className="mt-6 grid gap-4 rounded-xl border border-border bg-card p-4 shadow-soft sm:grid-cols-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name or email"
            className="pl-9"
            aria-label="Search candidates"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger aria-label="Filter by status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="active">Active (hide rejected)</SelectItem>
            <SelectItem value="all">All candidates</SelectItem>
            <SelectItem value="unreviewed">Unreviewed</SelectItem>
            <SelectItem value="shortlisted">Shortlisted</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
          </SelectContent>
        </Select>
        <div>
          <p className="text-xs text-muted-foreground">Minimum score: {minScore}</p>
          <Slider
            value={[minScore]}
            onValueChange={(v) => setMinScore(v[0] ?? 0)}
            max={100}
            step={5}
            className="mt-3"
            aria-label="Minimum match score"
          />
        </div>
      </div>

      {listQuery.isLoading ? (
        <div className="mt-6 space-y-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <p className="mt-10 text-center text-sm text-muted-foreground">
          No candidates match these filters yet.
        </p>
      ) : (
        <motion.ul className="mt-6 space-y-3">
          {filtered.map((c) => {
            const score = c.match?.overall_score ?? 0;
            const tone = scoreTone(score);
            const status = c.match?.user_status ?? "unreviewed";
            return (
              <motion.li
                key={c.id}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ layout: { duration: 0.3, ease: "easeInOut" } }}
                whileHover={{ scale: 1.005 }}
                className="rounded-xl border border-border bg-card p-4 shadow-soft"
              >
                <div className="flex flex-wrap items-center gap-4">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-sm font-semibold text-secondary-foreground">
                    #{c.match?.rank ?? "–"}
                  </span>

                  <button
                    onClick={() => setOpenId(c.id)}
                    className="min-w-0 flex-1 text-left"
                    aria-label={`Open details for ${c.full_name ?? c.file_name}`}
                  >
                    <p className="truncate font-medium hover:text-primary">
                      {c.full_name ?? c.file_name}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {c.email ?? c.file_name}
                      {c.total_experience_years !== null
                        ? ` · ${c.total_experience_years} yrs experience`
                        : ""}
                    </p>
                  </button>

                  <div className="w-20 text-center">
                    {c.match ? (
                      <>
                        <CountUp value={score} className={`text-2xl font-semibold ${tone.text}`} />
                        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                          {tone.label}
                        </p>
                      </>
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        {c.status === "failed" ? "Failed" : "Pending"}
                      </span>
                    )}
                  </div>

                  <div className="hidden min-w-[190px] flex-wrap gap-1.5 md:flex">
                    {(c.match?.matched_skills ?? []).slice(0, 3).map((s) => (
                      <span key={s} className="chip bg-success-soft text-success-foreground">
                        {s}
                      </span>
                    ))}
                    {(c.match?.missing_skills?.length ?? 0) > 0 && (
                      <span className="chip bg-warning-soft text-warning-foreground">
                        {c.match!.missing_skills.length} missing
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {c.status === "failed" ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => retry.mutate(c.id)}
                        disabled={retry.isPending}
                      >
                        {retry.isPending ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : (
                          <RefreshCw className="size-4" />
                        )}
                        Retry
                      </Button>
                    ) : (
                      c.match && (
                        <>
                          <Button
                            size="sm"
                            variant={status === "shortlisted" ? "default" : "outline"}
                            onClick={() =>
                              setStatus.mutate({
                                matchId: c.match!.id,
                                status: status === "shortlisted" ? "unreviewed" : "shortlisted",
                              })
                            }
                          >
                            <Star className="size-4" />
                            {status === "shortlisted" ? "Shortlisted" : "Shortlist"}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className={status === "rejected" ? "text-danger" : ""}
                            onClick={() =>
                              setStatus.mutate({
                                matchId: c.match!.id,
                                status: status === "rejected" ? "unreviewed" : "rejected",
                              })
                            }
                            aria-label="Reject candidate"
                          >
                            <X className="size-4" />
                            {status === "rejected" ? "Rejected" : "Reject"}
                          </Button>
                        </>
                      )
                    )}
                  </div>
                </div>
                {c.error_message && (
                  <p className="mt-2 text-xs text-danger">{c.error_message}</p>
                )}
              </motion.li>
            );
          })}
        </motion.ul>
      )}

      <AnimatePresence>
        {open && (
          <>
            <motion.div
              className="fixed inset-0 z-40 bg-foreground"
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.3 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setOpenId(null)}
            />
            <motion.aside
              role="dialog"
              aria-label={`Candidate detail: ${open.full_name ?? open.file_name}`}
              className="fixed right-0 top-0 z-50 h-full w-full max-w-2xl overflow-y-auto border-l border-border bg-card p-6 shadow-float"
              initial={{ x: 480 }}
              animate={{ x: 0 }}
              exit={{ x: 480 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-xl font-semibold">{open.full_name ?? open.file_name}</h2>
                  <p className="text-xs text-muted-foreground">
                    {open.email ?? "No email found"} · {open.phone ?? "No phone found"}
                  </p>
                </div>
                <Button variant="ghost" size="icon" onClick={() => setOpenId(null)} aria-label="Close">
                  <X className="size-4" />
                </Button>
              </div>

              {open.match && (
                <div className="mt-6 flex flex-wrap items-center gap-6 rounded-xl border border-border bg-secondary/40 p-4">
                  <ScoreRing score={open.match.overall_score} />
                  <div className="space-y-2 text-sm">
                    <Bar label="Keyword" value={open.match.keyword_score ?? 0} />
                    <Bar label="Semantic" value={open.match.semantic_score ?? 0} />
                    <p className="text-xs text-muted-foreground">
                      Overall = 40% keyword + 60% semantic
                    </p>
                  </div>
                </div>
              )}

              <div className="mt-6 grid gap-6 md:grid-cols-2">
                <div className="space-y-5">
                  <Section title="Skills">
                    <div className="flex flex-wrap gap-1.5">
                      {open.parsed_skills.length ? (
                        open.parsed_skills.map((s) => (
                          <span key={s} className="chip bg-secondary text-secondary-foreground">
                            {s}
                          </span>
                        ))
                      ) : (
                        <p className="text-sm text-muted-foreground">None extracted</p>
                      )}
                    </div>
                  </Section>

                  <Section title="Education">
                    {(open.parsed_education as Education[] | null)?.length ? (
                      <ul className="space-y-1.5 text-sm">
                        {(open.parsed_education as Education[]).map((e, i) => (
                          <li key={i}>
                            <span className="font-medium">{e.degree ?? "Degree"}</span>
                            <span className="text-muted-foreground">
                              {" "}
                              — {e.institution ?? "Institution"} {e.year ? `(${e.year})` : ""}
                            </span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-sm text-muted-foreground">Not found</p>
                    )}
                  </Section>

                  <Section title="Experience">
                    {(open.parsed_experience as Experience[] | null)?.length ? (
                      <ul className="space-y-3 text-sm">
                        {(open.parsed_experience as Experience[]).map((e, i) => (
                          <li key={i}>
                            <p className="font-medium">
                              {e.role ?? "Role"}{" "}
                              <span className="text-muted-foreground">
                                @ {e.company ?? "Company"}
                              </span>
                            </p>
                            {e.duration_years ? (
                              <p className="text-xs text-muted-foreground">
                                {e.duration_years} yrs
                              </p>
                            ) : null}
                            {e.description && (
                              <p className="mt-1 text-xs text-muted-foreground">{e.description}</p>
                            )}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-sm text-muted-foreground">Not found</p>
                    )}
                  </Section>
                </div>

                <div className="space-y-5">
                  <Section title="Matched skills">
                    <div className="flex flex-wrap gap-1.5">
                      {(open.match?.matched_skills ?? []).map((s) => (
                        <span key={s} className="chip bg-success-soft text-success-foreground">
                          {s}
                        </span>
                      ))}
                    </div>
                  </Section>
                  <Section title="Missing skills">
                    <div className="flex flex-wrap gap-1.5">
                      {(open.match?.missing_skills ?? []).length ? (
                        open.match!.missing_skills.map((s) => (
                          <span key={s} className="chip bg-warning-soft text-warning-foreground">
                            {s}
                          </span>
                        ))
                      ) : (
                        <p className="text-sm text-muted-foreground">No gaps found</p>
                      )}
                    </div>
                  </Section>
                  {open.match?.ai_summary && (
                    <Section title="AI rationale">
                      <p className="text-sm leading-relaxed">{open.match.ai_summary}</p>
                    </Section>
                  )}
                  {open.match?.strengths && (
                    <div className="rounded-lg bg-success-soft p-3 text-sm text-success-foreground">
                      <p className="text-xs font-semibold uppercase tracking-wide">Strength</p>
                      <p className="mt-1">{open.match.strengths}</p>
                    </div>
                  )}
                  {open.match?.concerns && (
                    <div className="rounded-lg bg-warning-soft p-3 text-sm text-warning-foreground">
                      <p className="text-xs font-semibold uppercase tracking-wide">Concern</p>
                      <p className="mt-1">{open.match.concerns}</p>
                    </div>
                  )}
                </div>
              </div>

              {open.match && (
                <div className="mt-8 flex flex-wrap gap-2 border-t border-border pt-4">
                  <Button
                    onClick={() =>
                      setStatus.mutate({ matchId: open.match!.id, status: "shortlisted" })
                    }
                  >
                    <Star className="size-4" /> Shortlist
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setStatus.mutate({ matchId: open.match!.id, status: "rejected" })}
                  >
                    <X className="size-4" /> Reject
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => retry.mutate(open.id)}
                    disabled={retry.isPending}
                  >
                    {retry.isPending ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <RefreshCw className="size-4" />
                    )}
                    Re-analyse
                  </Button>
                </div>
              )}
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </p>
      {children}
    </div>
  );
}

function Bar({ label, value }: { label: string; value: number }) {
  return (
    <div className="w-48">
      <div className="flex justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium">{Math.round(value)}%</span>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
        <motion.div
          className="h-full rounded-full bg-primary"
          initial={{ width: 0 }}
          animate={{ width: `${Math.min(100, value)}%` }}
          transition={{ duration: 0.8, ease: "easeOut" }}
        />
      </div>
    </div>
  );
}
