import { Link } from "@tanstack/react-router";
import { Home, Search, Sparkles, ListChecks, User } from "lucide-react";
import { cn } from "@/lib/utils";

type Tab = {
  to: "/" | "/search" | "/scan" | "/treatments" | "/profile";
  label: string;
  icon: typeof Home;
  primary?: boolean;
};

const tabs: Tab[] = [
  { to: "/", label: "menu", icon: Home },
  { to: "/search", label: "search", icon: Search },
  { to: "/scan", label: "scan", icon: Sparkles, primary: true },
  { to: "/treatments", label: "tx", icon: ListChecks },
  { to: "/profile", label: "profile", icon: User },
];

export function BottomNav() {
  return (
    <nav className="fixed bottom-0 inset-x-0 z-30 bg-cream/95 backdrop-blur border-t border-line/70 pb-[env(safe-area-inset-bottom)]">
      <ul className="grid grid-cols-5 px-2 pt-2 pb-2">
        {tabs.map((tab) => (
          <li key={tab.to} className="flex justify-center">
            <Link
              to={tab.to}
              className="group flex flex-col items-center gap-1 px-3 py-1 rounded-xl"
              activeOptions={{ exact: tab.to === "/" }}
            >
              {({ isActive }) => (
                <>
                  <span
                    className={cn(
                      "grid place-items-center transition-colors",
                      tab.primary
                        ? "size-11 rounded-full -mt-4 shadow-md"
                        : "size-7",
                      tab.primary
                        ? isActive
                          ? "bg-hot text-white"
                          : "bg-ink text-cream"
                        : isActive
                          ? "text-ink"
                          : "text-ink-mute group-hover:text-ink-soft",
                    )}
                  >
                    <tab.icon className={tab.primary ? "size-5" : "size-[18px]"} strokeWidth={2.2} />
                  </span>
                  <span
                    className={cn(
                      "text-[10px] font-semibold tracking-[0.08em] lowercase",
                      isActive ? "text-ink" : "text-ink-mute",
                    )}
                  >
                    {tab.label}
                  </span>
                </>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
