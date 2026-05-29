import { Link } from "@tanstack/react-router";

export function TopBar() {
  return (
    <header className="sticky top-0 z-30 bg-cream/85 backdrop-blur-md border-b border-line/60">
      <div className="flex items-center justify-between px-6 h-14">
        <Link to="/" className="brand-display text-[26px] tracking-[-0.05em] leading-none">
          treatme<span className="text-hot">.</span>
        </Link>
        <Link
          to="/profile"
          className="size-9 rounded-full bg-ink text-cream grid place-items-center font-bold text-[13px] tracking-tight"
          aria-label="profile"
        >
          tx
        </Link>
      </div>
    </header>
  );
}
