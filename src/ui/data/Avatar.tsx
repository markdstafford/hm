type Props = { initial?: string; src?: string; alt?: string; size?: number; className?: string };

export function Avatar({ initial, src, alt, size = 20, className = "" }: Props) {
  if (src) {
    return (
      <img
        src={src}
        alt={alt ?? ""}
        width={size}
        height={size}
        className={`rounded-full bg-surface object-cover ${className}`}
      />
    );
  }
  return (
    <span
      aria-hidden={!alt}
      role={alt ? "img" : undefined}
      aria-label={alt}
      className={`inline-flex items-center justify-center rounded-full bg-primary/20 text-primary text-xs font-medium ${className}`}
      style={{ width: size, height: size }}
    >
      {initial?.toUpperCase() ?? "?"}
    </span>
  );
}
