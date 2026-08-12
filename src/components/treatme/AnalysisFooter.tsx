/** shown at the bottom of every analysis screen */
export function AnalysisFooter({ className = "" }: { className?: string }) {
  return (
    <p className={`text-[11px] leading-relaxed text-ink-mute ${className}`}>
      this is an ai estimate, not a medical diagnosis. a provider will confirm what's worth treating.
    </p>
  );
}
