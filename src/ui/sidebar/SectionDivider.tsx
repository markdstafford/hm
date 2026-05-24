export function SectionDivider({ className = "" }: { className?: string }) {
  return <hr role="separator" className={`my-1 border-t border-border/30 ${className}`} />;
}
