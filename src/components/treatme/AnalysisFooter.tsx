/** shown at the bottom of every analysis screen */
export function AnalysisFooter({ className = "" }: { className?: string }) {
  return (
    <p className={`text-[11px] leading-relaxed text-ink-mute ${className}`}>
      this is an estimate, not a diagnosis. a provider will confirm what's worth treating.
    </p>
  );
}
