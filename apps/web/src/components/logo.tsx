export function Logo({ size = 24 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden
      xmlns="http://www.w3.org/2000/svg"
    >
      <title>SkillHub</title>
      <rect x="1" y="1" width="22" height="22" fill="none" stroke="#111" strokeWidth="1.5" />
      <rect x="5" y="5" width="6" height="6" fill="#111" />
      <rect x="13" y="5" width="6" height="6" fill="none" stroke="#111" strokeWidth="1.5" />
      <rect x="5" y="13" width="6" height="6" fill="none" stroke="#111" strokeWidth="1.5" />
      <rect x="13" y="13" width="6" height="6" fill="#111" />
    </svg>
  );
}
