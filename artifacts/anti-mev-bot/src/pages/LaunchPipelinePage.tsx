import * as React from "react";
import { Sidebar } from "@/components/Sidebar";
import {
  RefreshCcw,
  Rocket,
  TrendingUp,
  Bot,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  Play,
  Loader2,
  ChevronDown,
  ChevronUp,
  ExternalLink,
} from "lucide-react";
import { cn } from "@/lib/utils";

type TrendTopic = {
  id: number;
  topic: string;
  source: string;
  rawData: unknown;
  createdAt: string;
};

type Candidate = {
  id: number;
  tokenName: string;
  tokenSymbol: string;
  description: string;
  narrative: string;
  logoUrl: string | null;
  riskLevel: "low" | "medium" | "high";
  suggestedChain: "bsc" | "sol" | "both";
  status: string;
  bscBuyTier: string | null;
  solBuyTier: string | null;
  createdAt: string;
};

type LaunchJob = {
  id: number;
  candidateId: number;
  chain: string;
  status: string;
  contractAddress: string | null;
  txHash: string | null;
  opsBuyTxHash: string | null;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
};

const RISK_COLORS: Record<string, string> = {
  low: "text-emerald-400 bg-emerald-400/10",
  medium: "text-yellow-400 bg-yellow-400/10",
  high: "text-red-400 bg-red-400/10",
};

const STATUS_ICONS: Record<string, React.ReactNode> = {
  pending_review: <Clock className="w-3.5 h-3.5 text-yellow-400" />,
  approved: <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />,
  rejected: <XCircle className="w-3.5 h-3.5 text-red-400" />,
  blacklisted: <AlertTriangle className="w-3.5 h-3.5 text-red-600" />,
  launched: <Rocket className="w-3.5 h-3.5 text-blue-400" />,
  pending: <Clock className="w-3.5 h-3.5 text-yellow-400" />,
  deploying: <Loader2 className="w-3.5 h-3.5 text-blue-400 animate-spin" />,
  deployed: <CheckCircle className="w-3.5 h-3.5 text-blue-300" />,
  buying: <Loader2 className="w-3.5 h-3.5 text-emerald-400 animate-spin" />,
  bought: <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />,
  failed: <XCircle className="w-3.5 h-3.5 text-red-400" />,
};

const STATUS_LABELS: Record<string, string> = {
  pending_review: "Pending Review",
  approved: "Approved",
  rejected: "Rejected",
  blacklisted: "Blacklisted",
  launched: "Launched",
  pending: "Pending",
  deploying: "Deploying",
  deployed: "Deployed",
  buying: "Buying",
  bought: "Bought",
  failed: "Failed",
};

function StatusBadge({ status }: { status: string }) {
  return (
    <span className="flex items-center gap-1.5 text-xs">
      {STATUS_ICONS[status] ?? <Clock className="w-3.5 h-3.5 text-muted-foreground" />}
      <span className="text-muted-foreground">{STATUS_LABELS[status] ?? status}</span>
    </span>
  );
}

function SectionCard({ title, icon, children, action }: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="bg-card border border-white/5 rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/5">
        <div className="flex items-center gap-2.5">
          <span className="text-primary">{icon}</span>
          <h2 className="text-sm font-semibold text-white">{title}</h2>
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

function PipelineButton({
  onClick,
  loading,
  children,
  variant = "primary",
}: {
  onClick: () => void;
  loading?: boolean;
  children: React.ReactNode;
  variant?: "primary" | "secondary";
}) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className={cn(
        "flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed",
        variant === "primary"
          ? "bg-primary text-black hover:bg-primary/90 shadow-[0_0_12px_rgba(0,208,133,0.25)]"
          : "bg-white/5 text-white hover:bg-white/10 border border-white/10"
      )}
    >
      {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
      {children}
    </button>
  );
}

function EmptyRow({ cols, message }: { cols: number; message: string }) {
  return (
    <tr>
      <td colSpan={cols} className="text-center py-10 text-muted-foreground text-sm">
        {message}
      </td>
    </tr>
  );
}

export default function LaunchPipelinePage() {
  const [trends, setTrends] = React.useState<TrendTopic[]>([]);
  const [candidates, setCandidates] = React.useState<Candidate[]>([]);
  const [jobs, setJobs] = React.useState<LaunchJob[]>([]);

  const [loadingTrends, setLoadingTrends] = React.useState(false);
  const [loadingCandidates, setLoadingCandidates] = React.useState(false);
  const [loadingJobs, setLoadingJobs] = React.useState(false);

  const [runningTrends, setRunningTrends] = React.useState(false);
  const [runningCandidates, setRunningCandidates] = React.useState(false);
  const [launchingJob, setLaunchingJob] = React.useState<number | null>(null);

  const [candidateLimit, setCandidateLimit] = React.useState(5);
  const [toast, setToast] = React.useState<{ type: "ok" | "err"; msg: string } | null>(null);

  const [expandedCandidate, setExpandedCandidate] = React.useState<number | null>(null);

  const showToast = (type: "ok" | "err", msg: string) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 4000);
  };

  const fetchTrends = React.useCallback(async () => {
    setLoadingTrends(true);
    try {
      const r = await fetch("/api/admin/trends");
      const d = await r.json();
      setTrends(d.trends ?? []);
    } finally {
      setLoadingTrends(false);
    }
  }, []);

  const fetchCandidates = React.useCallback(async () => {
    setLoadingCandidates(true);
    try {
      const r = await fetch("/api/admin/candidates");
      const d = await r.json();
      setCandidates(d.candidates ?? []);
    } finally {
      setLoadingCandidates(false);
    }
  }, []);

  const fetchJobs = React.useCallback(async () => {
    setLoadingJobs(true);
    try {
      const r = await fetch("/api/admin/launch-jobs");
      const d = await r.json();
      setJobs(d.jobs ?? []);
    } finally {
      setLoadingJobs(false);
    }
  }, []);

  const refreshAll = React.useCallback(() => {
    fetchTrends();
    fetchCandidates();
    fetchJobs();
  }, [fetchTrends, fetchCandidates, fetchJobs]);

  React.useEffect(() => {
    refreshAll();
    const interval = setInterval(refreshAll, 30000);
    return () => clearInterval(interval);
  }, [refreshAll]);

  const handleRunTrends = async () => {
    setRunningTrends(true);
    try {
      const r = await fetch("/api/admin/run-trends", { method: "POST" });
      const d = await r.json();
      showToast("ok", `Trends collected: ${d.saved ?? 0} saved (${d.source ?? ""})`);
      fetchTrends();
    } catch {
      showToast("err", "Failed to collect trends");
    } finally {
      setRunningTrends(false);
    }
  };

  const handleRunCandidates = async () => {
    setRunningCandidates(true);
    try {
      const r = await fetch("/api/admin/run-candidates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ limit: candidateLimit }),
      });
      const d = await r.json();
      showToast(
        d.errors?.length ? "err" : "ok",
        `Processed ${d.processed ?? 0}, created ${d.created ?? 0}${d.errors?.length ? `, ${d.errors.length} errors` : ""}`
      );
      fetchCandidates();
    } catch {
      showToast("err", "Failed to generate candidates");
    } finally {
      setRunningCandidates(false);
    }
  };

  const handleLaunch = async (jobId: number) => {
    setLaunchingJob(jobId);
    try {
      const r = await fetch(`/api/admin/run-launch/${jobId}`, { method: "POST" });
      const d = await r.json();
      showToast(d.ok ? "ok" : "err", d.ok ? `Launch started for job #${jobId}` : (d.error ?? "Launch failed"));
      fetchJobs();
    } catch {
      showToast("err", "Failed to trigger launch");
    } finally {
      setLaunchingJob(null);
    }
  };

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) +
      " " + d.toLocaleDateString([], { month: "short", day: "numeric" });
  };

  const truncate = (s: string, n = 32) => s.length > n ? s.slice(0, n) + "…" : s;

  return (
    <div className="flex h-screen overflow-hidden bg-background text-foreground">
      <Sidebar />

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="h-16 shrink-0 border-b border-white/5 flex items-center justify-between px-6">
          <div>
            <p className="text-xs text-muted-foreground">Dashboard / Launch Pipeline</p>
            <h1 className="text-sm font-semibold text-white flex items-center gap-2">
              <Rocket className="w-4 h-4 text-primary" />
              Token Launch Pipeline
            </h1>
          </div>
          <button
            onClick={refreshAll}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-white transition-colors"
          >
            <RefreshCcw className="w-3.5 h-3.5" />
            Refresh
          </button>
        </header>

        {/* Toast */}
        {toast && (
          <div className={cn(
            "fixed top-4 right-4 z-50 px-4 py-2.5 rounded-lg text-sm font-medium shadow-lg transition-all",
            toast.type === "ok"
              ? "bg-emerald-500/20 border border-emerald-500/30 text-emerald-300"
              : "bg-red-500/20 border border-red-500/30 text-red-300"
          )}>
            {toast.msg}
          </div>
        )}

        {/* Pipeline Controls Bar */}
        <div className="shrink-0 px-6 py-3 border-b border-white/5 bg-black/20 flex flex-wrap items-center gap-3">
          <span className="text-xs text-muted-foreground font-medium mr-1">Pipeline Steps:</span>

          <PipelineButton onClick={handleRunTrends} loading={runningTrends}>
            1. Scrape X Trends
          </PipelineButton>

          <div className="flex items-center gap-2">
            <PipelineButton onClick={handleRunCandidates} loading={runningCandidates} variant="secondary">
              2. Generate Candidates (AI)
            </PipelineButton>
            <div className="flex items-center gap-1">
              <span className="text-xs text-muted-foreground">Limit:</span>
              <select
                value={candidateLimit}
                onChange={e => setCandidateLimit(Number(e.target.value))}
                className="bg-black/40 border border-white/10 text-white text-xs rounded px-2 py-1 focus:outline-none focus:border-primary/50"
              >
                {[1, 2, 3, 5, 10].map(n => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </div>
          </div>

          <span className="text-xs text-muted-foreground ml-auto">
            Auto-refresh every 30s · Telegram approve → creates launch job
          </span>
        </div>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto p-6 space-y-5">

          {/* Stats Row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: "Trends Tracked", value: trends.length, icon: <TrendingUp className="w-4 h-4" />, color: "text-blue-400" },
              { label: "Candidates", value: candidates.length, icon: <Bot className="w-4 h-4" />, color: "text-violet-400" },
              { label: "Pending Review", value: candidates.filter(c => c.status === "pending_review").length, icon: <Clock className="w-4 h-4" />, color: "text-yellow-400" },
              { label: "Launch Jobs", value: jobs.length, icon: <Rocket className="w-4 h-4" />, color: "text-primary" },
            ].map(stat => (
              <div key={stat.label} className="bg-card border border-white/5 rounded-xl p-4 flex items-center gap-3">
                <span className={stat.color}>{stat.icon}</span>
                <div>
                  <p className="text-xl font-bold text-white">{stat.value}</p>
                  <p className="text-xs text-muted-foreground">{stat.label}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Trends Table */}
          <SectionCard
            title="X Trending Topics"
            icon={<TrendingUp className="w-4 h-4" />}
            action={
              loadingTrends ? <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" /> : null
            }
          >
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-muted-foreground border-b border-white/5">
                    <th className="text-left px-5 py-2.5 font-medium">Topic</th>
                    <th className="text-left px-5 py-2.5 font-medium">Source</th>
                    <th className="text-left px-5 py-2.5 font-medium">Collected</th>
                  </tr>
                </thead>
                <tbody>
                  {trends.length === 0
                    ? <EmptyRow cols={3} message="No trends yet — click 'Scrape X Trends'" />
                    : trends.slice(0, 10).map(t => (
                      <tr key={t.id} className="border-b border-white/5 hover:bg-white/2 transition-colors">
                        <td className="px-5 py-2.5 font-medium text-white">{t.topic}</td>
                        <td className="px-5 py-2.5">
                          <span className="text-xs px-2 py-0.5 rounded bg-white/5 text-muted-foreground">{t.source}</span>
                        </td>
                        <td className="px-5 py-2.5 text-muted-foreground text-xs">{formatTime(t.createdAt)}</td>
                      </tr>
                    ))
                  }
                </tbody>
              </table>
            </div>
          </SectionCard>

          {/* Candidates Table */}
          <SectionCard
            title="AI-Generated Candidates"
            icon={<Bot className="w-4 h-4" />}
            action={
              loadingCandidates ? <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" /> : null
            }
          >
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-muted-foreground border-b border-white/5">
                    <th className="w-8 px-2 py-2.5" />
                    <th className="text-left px-4 py-2.5 font-medium">Token</th>
                    <th className="text-left px-4 py-2.5 font-medium">Chain</th>
                    <th className="text-left px-4 py-2.5 font-medium">Risk</th>
                    <th className="text-left px-4 py-2.5 font-medium">Status</th>
                    <th className="text-left px-4 py-2.5 font-medium">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {candidates.length === 0
                    ? <EmptyRow cols={6} message="No candidates yet — click 'Generate Candidates (AI)'" />
                    : candidates.map(c => (
                      <React.Fragment key={c.id}>
                        <tr
                          className="border-b border-white/5 hover:bg-white/2 transition-colors cursor-pointer"
                          onClick={() => setExpandedCandidate(expandedCandidate === c.id ? null : c.id)}
                        >
                          <td className="px-2 py-3 text-center">
                            {expandedCandidate === c.id
                              ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" />
                              : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
                            }
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2.5">
                              {c.logoUrl && (
                                <img src={c.logoUrl} alt={c.tokenSymbol} className="w-7 h-7 rounded-full" />
                              )}
                              <div>
                                <p className="font-semibold text-white">{c.tokenName}</p>
                                <p className="text-xs text-muted-foreground">${c.tokenSymbol}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span className={cn(
                              "text-xs px-2 py-0.5 rounded font-medium uppercase",
                              c.suggestedChain === "bsc" ? "bg-yellow-400/10 text-yellow-400" :
                              c.suggestedChain === "sol" ? "bg-violet-400/10 text-violet-400" :
                              "bg-blue-400/10 text-blue-400"
                            )}>
                              {c.suggestedChain}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span className={cn("text-xs px-2 py-0.5 rounded font-medium capitalize", RISK_COLORS[c.riskLevel])}>
                              {c.riskLevel}
                            </span>
                          </td>
                          <td className="px-4 py-3"><StatusBadge status={c.status} /></td>
                          <td className="px-4 py-3 text-xs text-muted-foreground">{formatTime(c.createdAt)}</td>
                        </tr>
                        {expandedCandidate === c.id && (
                          <tr className="bg-black/20 border-b border-white/5">
                            <td colSpan={6} className="px-8 py-4">
                              <div className="space-y-2 max-w-2xl">
                                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Description</p>
                                <p className="text-sm text-white/80">{c.description}</p>
                                <p className="text-xs text-primary italic">"{c.narrative}"</p>
                                {(c.bscBuyTier || c.solBuyTier) && (
                                  <p className="text-xs text-muted-foreground">
                                    Buy tiers: BSC={c.bscBuyTier ?? "—"} / SOL={c.solBuyTier ?? "—"}
                                  </p>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    ))
                  }
                </tbody>
              </table>
            </div>
          </SectionCard>

          {/* Launch Jobs Table */}
          <SectionCard
            title="Launch Jobs"
            icon={<Rocket className="w-4 h-4" />}
            action={
              loadingJobs ? <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" /> : null
            }
          >
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-muted-foreground border-b border-white/5">
                    <th className="text-left px-5 py-2.5 font-medium">Job ID</th>
                    <th className="text-left px-5 py-2.5 font-medium">Candidate</th>
                    <th className="text-left px-5 py-2.5 font-medium">Chain</th>
                    <th className="text-left px-5 py-2.5 font-medium">Status</th>
                    <th className="text-left px-5 py-2.5 font-medium">Contract</th>
                    <th className="text-left px-5 py-2.5 font-medium">Updated</th>
                    <th className="text-left px-5 py-2.5 font-medium">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {jobs.length === 0
                    ? <EmptyRow cols={7} message="No launch jobs yet — approve a candidate via Telegram" />
                    : jobs.map(j => (
                      <tr key={j.id} className="border-b border-white/5 hover:bg-white/2 transition-colors">
                        <td className="px-5 py-3 text-muted-foreground">#{j.id}</td>
                        <td className="px-5 py-3 text-white">#{j.candidateId}</td>
                        <td className="px-5 py-3">
                          <span className={cn(
                            "text-xs px-2 py-0.5 rounded font-medium uppercase",
                            j.chain === "bsc" ? "bg-yellow-400/10 text-yellow-400" :
                            j.chain === "sol" ? "bg-violet-400/10 text-violet-400" :
                            "bg-blue-400/10 text-blue-400"
                          )}>
                            {j.chain}
                          </span>
                        </td>
                        <td className="px-5 py-3"><StatusBadge status={j.status} /></td>
                        <td className="px-5 py-3">
                          {j.contractAddress ? (
                            <span className="flex items-center gap-1 text-xs text-blue-400 font-mono">
                              {truncate(j.contractAddress, 16)}
                              <ExternalLink className="w-3 h-3" />
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="px-5 py-3 text-xs text-muted-foreground">{formatTime(j.updatedAt)}</td>
                        <td className="px-5 py-3">
                          {j.status === "pending" && (
                            <button
                              onClick={() => handleLaunch(j.id)}
                              disabled={launchingJob === j.id}
                              className="flex items-center gap-1.5 text-xs px-2.5 py-1 bg-primary/10 text-primary hover:bg-primary/20 rounded transition-colors disabled:opacity-50"
                            >
                              {launchingJob === j.id
                                ? <Loader2 className="w-3 h-3 animate-spin" />
                                : <Rocket className="w-3 h-3" />
                              }
                              Launch
                            </button>
                          )}
                          {j.errorMessage && (
                            <span className="text-xs text-red-400 max-w-[120px] truncate block" title={j.errorMessage}>
                              {truncate(j.errorMessage, 20)}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))
                  }
                </tbody>
              </table>
            </div>
          </SectionCard>

          {/* Pipeline Flow Diagram */}
          <div className="bg-card border border-white/5 rounded-xl p-5">
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-4">Pipeline Flow</h2>
            <div className="flex items-center gap-2 flex-wrap">
              {[
                { step: "1", label: "X Trends", sublabel: "Scrape & store", color: "bg-blue-500/10 border-blue-500/20 text-blue-400" },
                { step: "→", label: "", sublabel: "", color: "" },
                { step: "2", label: "AI Candidates", sublabel: "GPT-5-mini generates token concepts", color: "bg-violet-500/10 border-violet-500/20 text-violet-400" },
                { step: "→", label: "", sublabel: "", color: "" },
                { step: "3", label: "Telegram Review", sublabel: "Admin approve/reject", color: "bg-yellow-500/10 border-yellow-500/20 text-yellow-400" },
                { step: "→", label: "", sublabel: "", color: "" },
                { step: "4", label: "Launch Job", sublabel: "BSC (four.meme) or SOL (pump.fun)", color: "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" },
                { step: "→", label: "", sublabel: "", color: "" },
                { step: "5", label: "Ops Buy", sublabel: "First-buy from ops wallet", color: "bg-primary/10 border-primary/20 text-primary" },
              ].map((item, i) =>
                item.label === "" ? (
                  <span key={i} className="text-muted-foreground text-lg">→</span>
                ) : (
                  <div key={i} className={cn("border rounded-lg px-3.5 py-2.5 text-center min-w-[100px]", item.color)}>
                    <p className="font-bold text-sm">{item.step}. {item.label}</p>
                    <p className="text-xs opacity-70 mt-0.5">{item.sublabel}</p>
                  </div>
                )
              )}
            </div>
          </div>

        </main>
      </div>
    </div>
  );
}
