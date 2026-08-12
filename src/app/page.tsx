import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  Brain,
  Code2,
  Eye,
  Lock,
  ShieldCheck,
  Users,
  Video,
} from "lucide-react";
import { BrandMark } from "@/components/layout/brand-mark";
import { AuthPanel } from "@/components/landing/auth-panel";
import { Button } from "@/components/ui/button";

const features = [
  {
    icon: Eye,
    title: "AI Proctoring",
    desc: "Face, eye and behavior tracking with multi-person detection.",
  },
  {
    icon: Code2,
    title: "Coding Assessments",
    desc: "Monaco-style editor with Python, Java, C++ and JavaScript runners.",
  },
  {
    icon: Video,
    title: "Live Interviews",
    desc: "Split-screen interview room with notes, code pad and AI cues.",
  },
  {
    icon: Lock,
    title: "Strict Security",
    desc: "Tab switch, paste, dev-tools and screen-share violation engine.",
  },
  {
    icon: BarChart3,
    title: "Deep Analytics",
    desc: "Performance, security and growth dashboards in real time.",
  },
  {
    icon: Brain,
    title: "AI Insights",
    desc: "Plagiarism, AI-generated answer and emotion analysis.",
  },
];

const roles = [
  {
    title: "Super Admin",
    desc: "Manage assessments, students, AI monitoring and reports.",
    href: "#login",
    gradient: "from-indigo-500 to-blue-500",
  },
  {
    title: "Student",
    desc: "Take secure assessments, coding tests and interviews.",
    href: "#login",
    gradient: "from-blue-500 to-cyan-500",
  },
  {
    title: "Interviewer",
    desc: "Conduct live interviews and evaluate candidates.",
    href: "#login",
    gradient: "from-violet-500 to-fuchsia-500",
  },
];

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ verified?: string }>;
}) {
  const params = await searchParams;
  const verifiedBanner = params.verified === "1";

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/70 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <BrandMark />
          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-muted-foreground">
            <a href="#features" className="hover:text-foreground">
              Features
            </a>
            <a href="#roles" className="hover:text-foreground">
              Roles
            </a>
            <a href="#login" className="hover:text-foreground">
              Sign in
            </a>
          </nav>
          <Button asChild size="sm">
            <a href="#login">Get started</a>
          </Button>
        </div>
      </header>

      <section className="relative overflow-hidden">
        <div className="absolute inset-0 grid-bg opacity-60 pointer-events-none" />
        <div className="absolute -top-32 -right-32 w-[480px] h-[480px] rounded-full bg-primary/15 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-32 -left-32 w-[420px] h-[420px] rounded-full bg-accent/15 blur-3xl pointer-events-none" />

        <div className="relative max-w-7xl mx-auto px-6 py-16 lg:py-24 grid lg:grid-cols-[1.1fr_1fr] gap-12 items-center">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary-soft text-primary text-xs font-semibold mb-6">
              <ShieldCheck className="w-3.5 h-3.5" />
              AI-Powered Proctoring · Enterprise Ready
            </div>
            <h1 className="font-display font-bold text-4xl lg:text-6xl tracking-tight leading-[1.05]">
              Secure assessments &
              <br />
              smarter interviews
            </h1>
            <p className="mt-6 text-lg text-muted-foreground max-w-xl">
              A complete platform for universities, certifications and
              recruiters — AI proctoring, coding tests, live interviews and
              analytics in one polished workspace.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild>
                <a href="#login">
                  Try the demo <ArrowRight className="w-4 h-4" />
                </a>
              </Button>
              <Button asChild variant="outline">
                <a href="#features">Explore features</a>
              </Button>
            </div>
            <div className="mt-10 grid grid-cols-3 gap-6 max-w-md">
              {[
                { v: "5,240+", l: "Students" },
                { v: "12K+", l: "Assessments" },
                { v: "99.9%", l: "Uptime" },
              ].map((s) => (
                <div key={s.l}>
                  <div className="font-display font-bold text-xl">{s.v}</div>
                  <div className="text-xs text-muted-foreground">{s.l}</div>
                </div>
              ))}
            </div>
          </div>

          <div id="login">
            <AuthPanel verifiedBanner={verifiedBanner} />
          </div>
        </div>
      </section>

      <section id="features" className="max-w-7xl mx-auto px-6 py-20">
        <div className="text-center mb-12">
          <div className="text-xs font-semibold uppercase tracking-wider text-primary mb-2">
            Platform
          </div>
          <h2 className="font-display font-bold text-3xl tracking-tight">
            Everything you need to assess at scale
          </h2>
          <p className="text-muted-foreground mt-3 max-w-2xl mx-auto">
            From question banks to live interviews — one unified, AI-monitored
            experience.
          </p>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
          {features.map((f) => (
            <div key={f.title} className="card-soft p-6">
              <div className="w-10 h-10 rounded-xl bg-primary-soft text-primary flex items-center justify-center mb-4">
                <f.icon className="w-5 h-5" />
              </div>
              <h3 className="font-display font-bold text-lg">{f.title}</h3>
              <p className="text-sm text-muted-foreground mt-2">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="roles" className="max-w-7xl mx-auto px-6 pb-20">
        <div className="text-center mb-12">
          <h2 className="font-display font-bold text-3xl tracking-tight">
            Built for every role
          </h2>
          <p className="text-muted-foreground mt-3">
            Tailored workspaces for administrators, students and interviewers.
          </p>
        </div>
        <div className="grid md:grid-cols-3 gap-5">
          {roles.map((r) => (
            <div key={r.title} className="card-soft p-6 overflow-hidden relative">
              <div
                className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${r.gradient}`}
              />
              <div className="w-10 h-10 rounded-xl bg-primary-soft text-primary flex items-center justify-center mb-4">
                <Users className="w-5 h-5" />
              </div>
              <h3 className="font-display font-bold text-lg">{r.title}</h3>
              <p className="text-sm text-muted-foreground mt-2 mb-5">{r.desc}</p>
              <Link
                href={r.href}
                className="text-sm font-semibold text-primary inline-flex items-center gap-1"
              >
                Enter workspace <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-border py-8">
        <div className="max-w-7xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-sm text-muted-foreground">
          <div>CodeShield AI © 2026</div>
          <div className="flex gap-4 text-xs font-semibold">
            <span>SOC2-aligned</span>
            <span>GDPR-ready</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
