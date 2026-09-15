import { Link } from "@tanstack/react-router";
import logoAsset from "@/assets/aisync-icon.png.asset.json";

export function AppHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border/80 bg-card/85 backdrop-blur">
      <div className="mx-auto flex h-[60px] max-w-7xl items-center justify-between px-4 sm:px-6">
        <Link to="/" className="flex items-center gap-2.5" aria-label="AISYNC home">
          <img src={logoAsset.url} alt="AISYNC logo" className="size-9 object-contain" />
          <span className="text-base font-bold tracking-tight">AISYNC</span>
        </Link>
        <p className="hidden text-xs text-muted-foreground sm:block">
          AI-assisted first-pass resume screening — decision support, not auto-reject
        </p>
      </div>
    </header>
  );
}
