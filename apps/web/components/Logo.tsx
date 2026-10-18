export function LogoMark({ size = 48 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <rect width="64" height="64" rx="18" fill="var(--floresta-950)" />
      <circle cx="32" cy="40" r="12" fill="none" stroke="var(--pasto-400)" strokeWidth="7" />
      <path
        d="M23.5 31.5C13 31 9 21 13 13"
        fill="none"
        stroke="var(--pasto-400)"
        strokeWidth="6"
        strokeLinecap="round"
      />
      <path
        d="M40.5 31.5C51 31 55 21 51 13"
        fill="none"
        stroke="var(--pasto-400)"
        strokeWidth="6"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function Wordmark({ size = 30 }: { size?: number }) {
  return (
    <span className="disp" style={{ fontSize: size, letterSpacing: '-.02em' }}>
      <span style={{ fontWeight: 400 }}>O </span>
      <span style={{ fontWeight: 800 }}>Gado</span>
    </span>
  );
}
