// /components/icons/HopyCompassIcon.tsx
import * as React from "react";

type HopyCompassIconProps = React.SVGProps<SVGSVGElement> & {
  title?: string;
};

export default function HopyCompassIcon({
  title = "HOPY Compass",
  width = 24,
  height = 24,
  viewBox = "0 0 24 24",
  fill = "none",
  role,
  "aria-label": ariaLabel,
  ...props
}: HopyCompassIconProps) {
  const accessibleRole = role ?? (ariaLabel || title ? "img" : undefined);
  const ariaHidden =
    accessibleRole === undefined && !ariaLabel && !title ? true : undefined;

  return (
    <svg
      width={width}
      height={height}
      viewBox={viewBox}
      fill={fill}
      xmlns="http://www.w3.org/2000/svg"
      role={accessibleRole}
      aria-label={ariaLabel}
      aria-hidden={ariaHidden}
      focusable="false"
      {...props}
    >
      {title ? <title>{title}</title> : null}

      <circle
        cx="12"
        cy="12"
        r="9"
        stroke="currentColor"
        strokeWidth="1.6"
      />

      <circle cx="12" cy="12" r="1.35" fill="currentColor" />

      <path
        d="M12 6.2L14.9 11.1L12 10.15L9.1 11.1L12 6.2Z"
        fill="currentColor"
      />

      <path
        d="M12 17.8L9.9 13.35L12 14.05L14.1 13.35L12 17.8Z"
        fill="currentColor"
        opacity="0.28"
      />
    </svg>
  );
}