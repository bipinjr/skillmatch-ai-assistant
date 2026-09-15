import { Link } from "@tanstack/react-router";
import { Sparkles } from "lucide-react";

export function AppHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border/80 bg-card/85 backdrop-blur">
      <div className="mx-auto flex h-[60px] max-w-7xl items-center justify-between px-4 sm:px-6">
        <Link to="/" className="flex items-center gap-2.5" aria-label="SkillMatch AI home">
          <span className="flex size-8 items-center justify-center rounded-lg bg-gradient-brand text-primary-foreground shadow-soft">
            <Sparkles className="size-4" aria-hidden="true" />
          </span>
          <span className="text-base font-semibold tracking-tight">SkillMatch AI</span>
        </Link>
        <p className="hidden text-xs text-muted-foreground sm:block">
          AI-assisted first-pass resume screening — decision support, not auto-reject
        </p>
      </div>
    </header>
  );
}
