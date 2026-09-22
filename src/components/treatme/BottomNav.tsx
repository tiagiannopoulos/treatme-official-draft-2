import { Link, useRouterState } from "@tanstack/react-router";
import { Home, MessageCircle, Sparkles, ListChecks, User } from "lucide-react";
import { cn } from "@/lib/utils";

type Tab = {
  to: "/" | "/scan/chat" | "/scan" | "/treatments" | "/profile";
  label: string;
  icon: typeof Home;
  primary?: boolean;
};

const tabs: Tab[] = [
  { to: "/", label: "home", icon: Home },
  { to: "/scan/chat", label: "consult", icon: MessageCircle },
  { to: "/scan", label: "scan", icon: Sparkles, primary: true },
  { to: "/treatments", label: "treatments", icon: ListChecks },
  { to: "/profile", label: "profile", icon: User },
];

export function BottomNav() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const inScan = pathname.startsWith("/scan") && !pathname.startsWith("/scan/chat");
  return (
    <nav
      aria-label="main"
      className="fixed bottom-0 inset-x-0 z-30 bg-white/95 backdrop-blur border-t border-line/70 pb-[env(safe-area-inset-bottom)]"
    >
      <ul className="grid grid-cols-5 px-2 pt-2 pb-2">
        {tabs.map((tab) => (
          <li key={tab.to} className="flex justify-center">
            <Link
              to={tab.to}
              aria-label={tab.label}
              aria-current={tab.to === "/scan" && inScan ? "page" : undefined}
              className="group flex flex-col items-center gap-1 px-3 py-1 rounded-xl min-h-11"
              activeOptions={{ exact: tab.to === "/" || tab.to === "/scan" }}
            >
              {({ isActive }) => {
                const selected = tab.to === "/scan" ? inScan : isActive;
                return (
                  <>
                    <span
                      className={cn(
                        "grid place-items-center transition-colors",
                        tab.primary ? "size-11 rounded-full -mt-4 shadow-md" : "size-7",
                        tab.primary
                          ? selected
                            ? "bg-hot text-white"
                            : "bg-ink text-cream"
                          : selected
                            ? "text-ink"
                            : "text-ink-mute group-hover:text-ink-soft",
                      )}
                    >
                      <tab.icon
                        className={tab.primary ? "size-5" : "size-[18px]"}
                        strokeWidth={2.2}
                      />
                    </span>
                    <span
                      className={cn(
                        "text-[10px] font-semibold tracking-[0.06em] lowercase whitespace-nowrap",
                        selected ? "text-ink" : "text-ink-mute",
                      )}
                    >
                      {tab.label}
                    </span>
                  </>
                );
              }}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
