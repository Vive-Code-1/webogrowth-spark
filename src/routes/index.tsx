import { createFileRoute, Link } from "@tanstack/react-router";
import { Sparkles, Target, Lightbulb, Flame, Bell, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "WeboGrowth Planner — Business Growth Tracker" },
      { name: "description", content: "Track daily tasks, ideas, plans, and deadline challenges for Webogrowth.com in one dark, colorful dashboard." },
    ],
  }),
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <div className="flex items-center gap-2">
          <div className="grid h-9 w-9 place-items-center rounded-xl gradient-primary glow-primary">
            <Sparkles className="h-5 w-5 text-white" />
          </div>
          <span className="font-display text-lg font-semibold">WeboGrowth</span>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="ghost"><Link to="/auth">Log in</Link></Button>
          <Button asChild className="gradient-primary text-white"><Link to="/auth">Get started</Link></Button>
        </div>
      </header>

      <section className="relative mx-auto max-w-6xl px-6 pt-16 pb-24 text-center">
        <div className="absolute inset-x-0 top-10 -z-10 mx-auto h-72 max-w-3xl rounded-full bg-primary/20 blur-3xl" />
        <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-muted-foreground">
          <Flame className="h-3.5 w-3.5 text-warning" /> Built for the Webogrowth.com growth team
        </span>
        <h1 className="mt-6 text-4xl font-bold leading-tight md:text-6xl">
          Daily growth <span className="text-gradient">planning</span><br />
          in one dashboard
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-base text-muted-foreground md:text-lg">
          Tasks, ideas, plans, and deadline challenges — all in a clean dark UI. Smart push reminders as deadlines approach.
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <Button asChild size="lg" className="gradient-primary text-white glow-primary">
            <Link to="/auth">Create free account <ArrowRight className="ml-1 h-4 w-4" /></Link>
          </Button>
        </div>

        <div className="mt-20 grid gap-4 text-left md:grid-cols-4">
          {[
            { icon: Target, title: "Daily tasks", desc: "Priority and due dates.", grad: "gradient-primary" },
            { icon: Lightbulb, title: "Idea board", desc: "Capture every growth idea.", grad: "gradient-warm" },
            { icon: Flame, title: "Challenges", desc: "Race the deadline.", grad: "gradient-cool" },
            { icon: Bell, title: "Smart reminders", desc: "Frequency rises as time shrinks.", grad: "gradient-primary" },
          ].map((f) => (
            <div key={f.title} className="glass rounded-2xl p-5">
              <div className={`mb-3 grid h-10 w-10 place-items-center rounded-xl ${f.grad}`}>
                <f.icon className="h-5 w-5 text-white" />
              </div>
              <h3 className="font-semibold">{f.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
