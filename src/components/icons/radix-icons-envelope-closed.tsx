import * as React from "react";

export function EnvelopeClosedIcon({
  size = 15,
  color = "currentColor",
  strokeWidth = 2,
  className,
  ...props
}: React.SVGProps<SVGSVGElement> & {
  size?: number;
  color?: string;
  strokeWidth?: number;
}) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 15 15"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...props}
    >
      <path d="M1 2C0.448 2 0 2.448 0 3v9c0 .552.448 1 1 1h13c.552 0 1-.448 1-1V3c0-.552-.448-1-1-1zm0 1h13v.925a.45.45 0 0 0-.241.07L7.5 7.968L1.241 3.995A.45.45 0 0 0 1 3.925zm0 1.908V12h13V4.908L7.741 8.88a.45.45 0 0 1-.482 0z" />
    </svg>
  );
}
