interface AppIconProps {
  className?: string;
  size?: number;
}

/**
 * App Icon Component
 * Clock with leaf accent - matches PWA icon design
 */
export function AppIcon({ className = '', size = 40 }: AppIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 512 512"
      className={className}
      aria-hidden="true"
    >
      {/* Background circle */}
      <circle cx="256" cy="256" r="256" fill="currentColor" className="text-primary" />

      {/* Clock face */}
      <circle cx="256" cy="256" r="180" fill="white" />

      {/* Clock hands */}
      <line
        x1="256"
        y1="256"
        x2="256"
        y2="140"
        stroke="currentColor"
        className="text-primary"
        strokeWidth="16"
        strokeLinecap="round"
      />
      <line
        x1="256"
        y1="256"
        x2="340"
        y2="256"
        stroke="currentColor"
        className="text-primary"
        strokeWidth="12"
        strokeLinecap="round"
      />

      {/* Center dot */}
      <circle cx="256" cy="256" r="16" fill="currentColor" className="text-primary" />

      {/* Small leaf accent */}
      <path
        d="M380 120 Q420 80 420 120 Q420 160 380 160 Q340 160 380 120"
        fill="#22c55e"
      />
      <line
        x1="380"
        y1="140"
        x2="400"
        y2="100"
        stroke="#166534"
        strokeWidth="4"
      />
    </svg>
  );
}
