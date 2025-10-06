import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { BookOpen, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";

const PRACTICE_ACTIVE_KEY = "qm-practice-active";

const HomePage = () => {
  const navigate = useNavigate();

  useEffect(() => {
    if (typeof window === "undefined") return;
    const active = window.localStorage.getItem(PRACTICE_ACTIVE_KEY);
    if (active === "1") {
      navigate("/practice", { replace: true });
    }
  }, [navigate]);

  return (
    <main className="min-h-screen bg-gradient-to-b from-background via-background/80 to-background">
      <div className="mx-auto flex max-w-5xl flex-col items-center gap-10 px-6 py-24 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <BookOpen className="h-8 w-8" />
        </div>
        <div className="space-y-4">
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
            Q-Master AI (Preview)
          </h1>
          <p className="mx-auto max-w-2xl text-base text-muted-foreground sm:text-lg">
            We&apos;re building an evidence-based study coach that transforms your documents into active recall drills and
            feedback loops. While the full experience is coming soon, you can already try the practice flow.
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-4">
          <Button size="lg" className="gap-2" onClick={() => navigate("/practice")}> 
            <Sparkles className="h-4 w-4" />
            Try the Practice Flow
          </Button>
          <Button variant="ghost" size="lg" onClick={() => navigate("/auth")}>Sign in / upgrade</Button>
        </div>
      </div>
    </main>
  );
};

export default HomePage;
