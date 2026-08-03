import { Link, useRouterState } from "@tanstack/react-router";

function titleFor(pathname: string) {
  if (pathname.startsWith("/search")) return "search";
  if (pathname.startsWith("/treatments") || pathname.startsWith("/treatment/")) return "treatments";
  if (pathname.startsWith("/profile")) return "profile";
  if (pathname.startsWith("/scan")) return "scan";
  if (pathname.startsWith("/storefront") || pathname.startsWith("/medspas")) return "clinic";

  return "menu";
}

export function TopBar() {
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const title = titleFor(pathname);

  return (
    <header className="bg-white">
      <div className="flex items-center justify-between px-6 h-14">
        <Link to="/" className="brand-display text-[26px] tracking-[-0.05em] leading-none lowercase">
          {title}
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
