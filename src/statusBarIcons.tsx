import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

function Icon(props: IconProps) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      aria-hidden="true"
      {...props}
    />
  );
}

export function FontSizeIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <text
        x="8"
        y="8.5"
        textAnchor="middle"
        dominantBaseline="central"
        fill="currentColor"
        stroke="none"
        fontSize="10"
        fontFamily="ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace"
      >
        Aa
      </text>
    </Icon>
  );
}

export function WrapOnIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M3 4.5h10" />
      <path d="M3 8h10" />
      <path d="M3 11.5h6" />
    </Icon>
  );
}

export function WrapOffIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M2 8h12" />
      <path d="M12 6.5 14 8 12 9.5" />
    </Icon>
  );
}

export function FullWidthIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="1.5" y="5" width="13" height="6" rx="1" />
    </Icon>
  );
}

export function NarrowWidthIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="4.5" y="5" width="7" height="6" rx="1" />
    </Icon>
  );
}
