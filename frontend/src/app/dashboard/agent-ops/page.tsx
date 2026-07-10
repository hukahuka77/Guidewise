"use client";

import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  ChevronRight,
  CircleDot,
  Clock3,
  Code2,
  GitPullRequest,
  MessageSquare,
  Play,
  ShieldCheck,
  SlidersHorizontal,
  TestTube2,
  UserRoundCog,
} from "lucide-react";
import { useMemo, useState } from "react";

type WorkStatus = "backlog" | "in-progress" | "testing" | "reviewed" | "blocked" | "merged";
type Priority = "low" | "medium" | "high";
type Difficulty = "low" | "medium" | "high";
type AgentId = "ed" | "hohenheim" | "greed" | "alphonse";

type ActivityItem = {
  author: string;
  body: string;
  time: string;
};

type AgentWorkItem = {
  id: number;
  title: string;
  description: string;
  status: WorkStatus;
  priority: Priority;
  difficulty: Difficulty;
  assignedAgent: AgentId;
  reviewer: AgentId;
  labels: string[];
  branch: string;
  pr: string;
  checks: "passing" | "pending" | "failing" | "not-started";
  lastModified: string;
  nextAction: string;
  comments: ActivityItem[];
};

const agents: Record<AgentId, { name: string; role: string; cost: string }> = {
  ed: { name: "Ed", role: "Lead reviewer", cost: "highest reliability" },
  hohenheim: { name: "Hohenheim", role: "Local builder", cost: "local" },
  greed: { name: "Greed", role: "Low-risk worker", cost: "cheap" },
  alphonse: { name: "Alphonse", role: "Backup reviewer", cost: "paid backup" },
};

const initialWorkItems: AgentWorkItem[] = [
  {
    id: 15,
    title: "Agent loop utilities",
    description:
      "Picker, worker handoff, PR helper, review handoff, and conservative merge-policy evaluator for the Guidewise automation loop.",
    status: "reviewed",
    priority: "high",
    difficulty: "high",
    assignedAgent: "ed",
    reviewer: "ed",
    labels: ["agent:review-needed", "env:dev", "type:task"],
    branch: "agent/issue-picker",
    pr: "#15",
    checks: "passing",
    lastModified: "5 min ago",
    nextAction: "Lead review, then merge utility spine into main.",
    comments: [
      { author: "Ed", body: "Review and merge policy helpers added. All checks green.", time: "17:55" },
      { author: "CI", body: "Frontend, Backend, and Vercel passed.", time: "17:56" },
    ],
  },
  {
    id: 17,
    title: "Local check script",
    description:
      "Add a deterministic local check command for agents before opening or updating PRs.",
    status: "testing",
    priority: "medium",
    difficulty: "medium",
    assignedAgent: "ed",
    reviewer: "ed",
    labels: ["agent:review-needed", "env:dev"],
    branch: "agent/14-add-deterministic-local-check-script-for-agent-w",
    pr: "#17",
    checks: "passing",
    lastModified: "20 min ago",
    nextAction: "Elevated review pass, then merge after policy decision.",
    comments: [
      { author: "Worker", body: "Added scripts/check.sh and docs.", time: "17:30" },
      { author: "Ed", body: "Known warnings are npm audit and local Supabase env.", time: "17:31" },
    ],
  },
  {
    id: 13,
    title: "Document local setup and environment variables",
    description:
      "Create a concise setup reference for local Guidewise development, expected env vars, and common verification commands.",
    status: "backlog",
    priority: "medium",
    difficulty: "low",
    assignedAgent: "greed",
    reviewer: "ed",
    labels: ["agent:ready", "documentation", "env:dev"],
    branch: "not claimed",
    pr: "none",
    checks: "not-started",
    lastModified: "1 hr ago",
    nextAction: "Claim into an isolated worktree and draft docs.",
    comments: [
      { author: "Andrew", body: "Useful starter issue for lower-risk worker routing.", time: "16:49" },
    ],
  },
  {
    id: 11,
    title: "Backend smoke check",
    description:
      "Add a minimal backend readiness check so the automation loop can quickly detect import or configuration breakage.",
    status: "blocked",
    priority: "medium",
    difficulty: "medium",
    assignedAgent: "hohenheim",
    reviewer: "ed",
    labels: ["agent:ready", "type:task", "backend"],
    branch: "not claimed",
    pr: "none",
    checks: "not-started",
    lastModified: "1 hr ago",
    nextAction: "Clarify whether smoke check should hit Flask routes or stay compile-only.",
    comments: [
      { author: "Ed", body: "Needs a small decision on backend runtime assumptions.", time: "17:03" },
    ],
  },
  {
    id: 10,
    title: "Agent runner config",
    description:
      "Define the runner defaults for repo path, worktree root, default agents, timeouts, and verification commands.",
    status: "in-progress",
    priority: "high",
    difficulty: "medium",
    assignedAgent: "ed",
    reviewer: "ed",
    labels: ["agent:ready", "automation", "env:dev"],
    branch: "agent/10-create-guidewise-agent-runner-config",
    pr: "draft",
    checks: "pending",
    lastModified: "32 min ago",
    nextAction: "Wait for loop utilities to merge, then align config names.",
    comments: [
      { author: "Ed", body: "Depends on the utility scripts landing first.", time: "17:39" },
    ],
  },
];

const statusStyles: Record<WorkStatus, string> = {
  backlog: "bg-slate-100 text-slate-700 border-slate-200",
  "in-progress": "bg-blue-50 text-blue-700 border-blue-200",
  testing: "bg-amber-50 text-amber-700 border-amber-200",
  reviewed: "bg-emerald-50 text-emerald-700 border-emerald-200",
  blocked: "bg-rose-50 text-rose-700 border-rose-200",
  merged: "bg-zinc-900 text-white border-zinc-900",
};

const priorityStyles: Record<Priority, string> = {
  low: "bg-slate-100 text-slate-700",
  medium: "bg-indigo-50 text-indigo-700",
  high: "bg-rose-50 text-rose-700",
};

const difficultyStyles: Record<Difficulty, string> = {
  low: "bg-emerald-50 text-emerald-700",
  medium: "bg-amber-50 text-amber-700",
  high: "bg-stone-900 text-white",
};

const statusLabels: Record<WorkStatus, string> = {
  backlog: "Backlog",
  "in-progress": "In progress",
  testing: "Testing",
  reviewed: "Reviewed",
  blocked: "Blocked",
  merged: "Merged",
};

const checkStyles = {
  passing: "text-emerald-700 bg-emerald-50 border-emerald-200",
  pending: "text-amber-700 bg-amber-50 border-amber-200",
  failing: "text-rose-700 bg-rose-50 border-rose-200",
  "not-started": "text-slate-600 bg-slate-50 border-slate-200",
};

function Pill({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={`inline-flex h-7 items-center rounded-full border px-2.5 text-xs font-medium ${className}`}>
      {children}
    </span>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <label className="text-xs font-semibold uppercase text-slate-500">{children}</label>;
}

export default function AgentOpsPage() {
  const [workItems, setWorkItems] = useState<AgentWorkItem[]>(initialWorkItems);
  const [selectedId, setSelectedId] = useState(initialWorkItems[0].id);
  const [statusFilter, setStatusFilter] = useState<WorkStatus | "all">("all");
  const [commentDraft, setCommentDraft] = useState("");

  const selectedItem = workItems.find((item) => item.id === selectedId) ?? workItems[0];

  const filteredItems = useMemo(
    () => workItems.filter((item) => statusFilter === "all" || item.status === statusFilter),
    [statusFilter, workItems],
  );

  const metrics = useMemo(
    () => ({
      active: workItems.filter((item) => ["in-progress", "testing"].includes(item.status)).length,
      waitingReview: workItems.filter((item) => item.status === "reviewed").length,
      blocked: workItems.filter((item) => item.status === "blocked").length,
      passing: workItems.filter((item) => item.checks === "passing").length,
    }),
    [workItems],
  );

  const updateSelected = <K extends keyof AgentWorkItem>(field: K, value: AgentWorkItem[K]) => {
    setWorkItems((items) =>
      items.map((item) =>
        item.id === selectedItem.id
          ? { ...item, [field]: value, lastModified: "just now" }
          : item,
      ),
    );
  };

  const addComment = () => {
    const body = commentDraft.trim();
    if (!body) return;
    setWorkItems((items) =>
      items.map((item) =>
        item.id === selectedItem.id
          ? {
              ...item,
              comments: [{ author: "Andrew", body, time: "now" }, ...item.comments],
              lastModified: "just now",
            }
          : item,
      ),
    );
    setCommentDraft("");
  };

  return (
    <div className="space-y-5">
      <section className="flex flex-col gap-4 border-b border-slate-200 pb-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm font-medium text-slate-500">
            <UserRoundCog className="size-4" />
            Agent operations
          </div>
          <h1 className="mt-2 text-3xl font-semibold tracking-normal text-slate-950">Guidewise agent control room</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
            Live-style board for issue triage, worker assignment, PR review, checks, and agent activity.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="inline-flex h-9 items-center gap-2 rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50">
            <SlidersHorizontal className="size-4" />
            Filters
          </button>
          <button className="inline-flex h-9 items-center gap-2 rounded-md bg-slate-950 px-3 text-sm font-medium text-white shadow-sm transition hover:bg-slate-800">
            <Play className="size-4" />
            Run loop
          </button>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold uppercase">Active work</span>
            <CircleDot className="size-4 text-blue-600" />
          </div>
          <div className="mt-3 text-2xl font-semibold text-slate-950">{metrics.active}</div>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold uppercase">Review queue</span>
            <ShieldCheck className="size-4 text-emerald-600" />
          </div>
          <div className="mt-3 text-2xl font-semibold text-slate-950">{metrics.waitingReview}</div>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold uppercase">Blocked</span>
            <AlertTriangle className="size-4 text-rose-600" />
          </div>
          <div className="mt-3 text-2xl font-semibold text-slate-950">{metrics.blocked}</div>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold uppercase">Passing checks</span>
            <CheckCircle2 className="size-4 text-emerald-600" />
          </div>
          <div className="mt-3 text-2xl font-semibold text-slate-950">{metrics.passing}</div>
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-[minmax(360px,0.9fr)_minmax(520px,1.1fr)]">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-slate-950">Stories and tasks</h2>
              <p className="text-sm text-slate-500">{filteredItems.length} visible work items</p>
            </div>
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as WorkStatus | "all")}
              className="h-9 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-700 shadow-sm outline-none focus:border-slate-500"
            >
              <option value="all">All statuses</option>
              {Object.entries(statusLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            {filteredItems.map((item) => (
              <button
                key={item.id}
                onClick={() => setSelectedId(item.id)}
                className={`w-full rounded-lg border bg-white p-4 text-left shadow-sm transition hover:border-slate-400 ${
                  item.id === selectedItem.id ? "border-slate-900 ring-2 ring-slate-900/10" : "border-slate-200"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-semibold text-slate-500">#{item.id}</span>
                      <Pill className={statusStyles[item.status]}>{statusLabels[item.status]}</Pill>
                    </div>
                    <h3 className="mt-2 line-clamp-2 text-sm font-semibold text-slate-950">{item.title}</h3>
                  </div>
                  <ChevronRight className="mt-1 size-4 shrink-0 text-slate-400" />
                </div>
                <p className="mt-2 line-clamp-2 text-sm leading-5 text-slate-600">{item.description}</p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Pill className={`border-transparent ${priorityStyles[item.priority]}`}>{item.priority} priority</Pill>
                  <Pill className={`border-transparent ${difficultyStyles[item.difficulty]}`}>{item.difficulty} difficulty</Pill>
                  <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                    <Clock3 className="size-3.5" />
                    {item.lastModified}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Pill className={statusStyles[selectedItem.status]}>{statusLabels[selectedItem.status]}</Pill>
                    <Pill className={checkStyles[selectedItem.checks]}>{selectedItem.checks.replace("-", " ")}</Pill>
                  </div>
                  <h2 className="mt-3 text-xl font-semibold text-slate-950">#{selectedItem.id} {selectedItem.title}</h2>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{selectedItem.description}</p>
                </div>
                <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                  {selectedItem.pr}
                </div>
              </div>
            </div>

            <div className="grid gap-4 p-5 md:grid-cols-2">
              <div className="space-y-2">
                <FieldLabel>Status</FieldLabel>
                <select
                  value={selectedItem.status}
                  onChange={(event) => updateSelected("status", event.target.value as WorkStatus)}
                  className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-800 outline-none focus:border-slate-500"
                >
                  {Object.entries(statusLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <FieldLabel>Assigned worker</FieldLabel>
                <select
                  value={selectedItem.assignedAgent}
                  onChange={(event) => updateSelected("assignedAgent", event.target.value as AgentId)}
                  className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-800 outline-none focus:border-slate-500"
                >
                  {Object.entries(agents).map(([id, agent]) => (
                    <option key={id} value={id}>
                      {agent.name} - {agent.role}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <FieldLabel>Priority</FieldLabel>
                <select
                  value={selectedItem.priority}
                  onChange={(event) => updateSelected("priority", event.target.value as Priority)}
                  className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-800 outline-none focus:border-slate-500"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>

              <div className="space-y-2">
                <FieldLabel>Difficulty</FieldLabel>
                <select
                  value={selectedItem.difficulty}
                  onChange={(event) => updateSelected("difficulty", event.target.value as Difficulty)}
                  className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-800 outline-none focus:border-slate-500"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>
            </div>

            <div className="grid gap-4 border-t border-slate-200 p-5 lg:grid-cols-3">
              <div className="rounded-lg bg-slate-50 p-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                  <Bot className="size-4" />
                  Worker
                </div>
                <div className="mt-2 text-sm text-slate-600">{agents[selectedItem.assignedAgent].name}</div>
                <div className="text-xs text-slate-500">{agents[selectedItem.assignedAgent].cost}</div>
              </div>
              <div className="rounded-lg bg-slate-50 p-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                  <ShieldCheck className="size-4" />
                  Reviewer
                </div>
                <div className="mt-2 text-sm text-slate-600">{agents[selectedItem.reviewer].name}</div>
                <div className="text-xs text-slate-500">{agents[selectedItem.reviewer].role}</div>
              </div>
              <div className="rounded-lg bg-slate-50 p-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                  <GitPullRequest className="size-4" />
                  Branch
                </div>
                <div className="mt-2 break-words font-mono text-xs text-slate-600">{selectedItem.branch}</div>
              </div>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
            <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-950">
                <TestTube2 className="size-4" />
                Current action
              </h3>
              <p className="mt-3 text-sm leading-6 text-slate-600">{selectedItem.nextAction}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                {selectedItem.labels.map((label) => (
                  <Pill key={label} className="border-slate-200 bg-slate-50 text-slate-600">
                    {label}
                  </Pill>
                ))}
              </div>
            </div>

            <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-950">
                <Code2 className="size-4" />
                Agent routing
              </h3>
              <div className="mt-3 space-y-2 text-sm text-slate-600">
                <div className="flex justify-between gap-3">
                  <span>Low-risk docs</span>
                  <span className="font-medium text-slate-900">Greed</span>
                </div>
                <div className="flex justify-between gap-3">
                  <span>Local repetitive work</span>
                  <span className="font-medium text-slate-900">Hohenheim</span>
                </div>
                <div className="flex justify-between gap-3">
                  <span>Code and review</span>
                  <span className="font-medium text-slate-900">Ed</span>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-950">
                <MessageSquare className="size-4" />
                Comments and activity
              </h3>
              <span className="text-xs text-slate-500">Modified {selectedItem.lastModified}</span>
            </div>
            <div className="mt-4 flex gap-2">
              <input
                value={commentDraft}
                onChange={(event) => setCommentDraft(event.target.value)}
                className="h-10 min-w-0 flex-1 rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-slate-500"
                placeholder="Add a tracking note"
              />
              <button
                onClick={addComment}
                className="inline-flex h-10 items-center rounded-md bg-slate-950 px-4 text-sm font-medium text-white transition hover:bg-slate-800"
              >
                Add
              </button>
            </div>
            <div className="mt-4 space-y-3">
              {selectedItem.comments.map((comment, index) => (
                <div key={`${comment.author}-${comment.time}-${index}`} className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                  <div className="flex items-center justify-between gap-3 text-xs text-slate-500">
                    <span className="font-semibold text-slate-700">{comment.author}</span>
                    <span>{comment.time}</span>
                  </div>
                  <p className="mt-2 text-sm leading-5 text-slate-600">{comment.body}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
