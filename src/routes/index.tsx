import { createFileRoute, Link } from "@tanstack/react-router";
import { Sparkles, Target, Lightbulb, Flame, Bell, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "WeboGrowth Planner — বাংলায় বিজনেস গ্রোথ ট্র্যাকার" },
      { name: "description", content: "Webogrowth.com-এর ডেইলি টাস্ক, আইডিয়া, প্ল্যান ও ডেডলাইন চ্যালেঞ্জ একসাথে ট্র্যাক করুন। ডার্ক, কালারফুল ড্যাশবোর্ড।" },
    ],
  }),
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen">
      {/* nav */}
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <div className="flex items-center gap-2">
          <div className="grid h-9 w-9 place-items-center rounded-xl gradient-primary glow-primary">
            <Sparkles className="h-5 w-5 text-white" />
          </div>
          <span className="font-display text-lg font-semibold">WeboGrowth</span>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="ghost"><Link to="/auth">লগইন</Link></Button>
          <Button asChild className="gradient-primary text-white"><Link to="/auth">শুরু করুন</Link></Button>
        </div>
      </header>

      {/* hero */}
      <section className="relative mx-auto max-w-6xl px-6 pt-16 pb-24 text-center">
        <div className="absolute inset-x-0 top-10 -z-10 mx-auto h-72 max-w-3xl rounded-full bg-primary/20 blur-3xl" />
        <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-muted-foreground">
          <Flame className="h-3.5 w-3.5 text-warning" /> Webogrowth.com গ্রোথ টিমের জন্য তৈরি
        </span>
        <h1 className="mt-6 text-4xl font-bold leading-tight md:text-6xl">
          প্রতিদিনের গ্রোথ <span className="text-gradient">পরিকল্পনা</span><br />
          এক ড্যাশবোর্ডেই
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-base text-muted-foreground md:text-lg">
          টাস্ক, আইডিয়া, প্ল্যান এবং ডেডলাইন চ্যালেঞ্জ — সবকিছু বাংলায়, পরিষ্কার ডার্ক UI-তে। ডেডলাইন কাছে এলে স্মার্ট পুশ রিমাইন্ডার।
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <Button asChild size="lg" className="gradient-primary text-white glow-primary">
            <Link to="/auth">ফ্রি অ্যাকাউন্ট খুলুন <ArrowRight className="ml-1 h-4 w-4" /></Link>
          </Button>
        </div>

        {/* feature grid */}
        <div className="mt-20 grid gap-4 text-left md:grid-cols-4">
          {[
            { icon: Target, title: "ডেইলি টাস্ক", desc: "প্রায়োরিটি ও ডিউ ডেট সহ।", grad: "gradient-primary" },
            { icon: Lightbulb, title: "আইডিয়া বোর্ড", desc: "প্রতিটি গ্রোথ আইডিয়া ধরে রাখুন।", grad: "gradient-warm" },
            { icon: Flame, title: "চ্যালেঞ্জ", desc: "ডেডলাইনের সাথে দৌড়।", grad: "gradient-cool" },
            { icon: Bell, title: "স্মার্ট রিমাইন্ডার", desc: "সময় কমলে ফ্রিকোয়েন্সি বাড়ে।", grad: "gradient-primary" },
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
