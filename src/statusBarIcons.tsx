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

export function ThemeLightIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="8" cy="8" r="2" />
      <path d="M8 3.35L8 4.55M8 12.65L8 11.45M3.35 8L4.55 8M12.65 8L11.45 8M4.71 4.71L5.49 5.49M11.29 4.71L10.51 5.49M11.29 11.29L10.51 10.51M4.71 11.29L5.49 10.51" />
    </Icon>
  );
}

export function ThemeDarkIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M11.5 9.5a4.5 4.5 0 0 1-5-5 4.5 4.5 0 1 0 5 5Z" />
    </Icon>
  );
}

export function ThemeSystemIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="8" cy="8" r="4.5" />
      <path d="M8 3.5v9" />
      <path
        d="M8 3.5a4.5 4.5 0 0 1 0 9"
        fill="currentColor"
        stroke="none"
      />
    </Icon>
  );
}

export function PlusIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M8 3.5v9" />
      <path d="M3.5 8h9" />
    </Icon>
  );
}

export function FinderIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M3 5.5h3l1.5 1.5h6v5H3z" />
    </Icon>
  );
}

export function TrashIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M3.5 4.5h9" />
      <path d="M5.5 4.5V3.5h5v1" />
      <path d="M5 4.5v6.5h6V4.5" />
    </Icon>
  );
}

export function CloseIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4.5 4.5l7 7" />
      <path d="M11.5 4.5l-7 7" />
    </Icon>
  );
}

export function CheckIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M3.5 8.5 6.5 11.5 12.5 5" />
    </Icon>
  );
}
