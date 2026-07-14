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
    <Icon viewBox="0 0 24 24" strokeWidth="2" strokeLinejoin="round" {...props}>
      <path d="M10 11v6" />
      <path d="M14 11v6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
      <path d="M3 6h18" />
      <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
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

const PIN_BODY =
  "M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z";

export function PinIcon(props: IconProps) {
  return (
    <Icon viewBox="0 0 24 24" strokeWidth="2" strokeLinejoin="round" {...props}>
      <path d="M12 17v5" />
      <path d={PIN_BODY} />
    </Icon>
  );
}

export function PinFilledIcon(props: IconProps) {
  return (
    <Icon viewBox="0 0 24 24" strokeWidth="2" strokeLinejoin="round" {...props}>
      <path d="M12 17v5" />
      <path d={PIN_BODY} fill="currentColor" />
    </Icon>
  );
}

export function UnmarkdownIcon(props: IconProps) {
  return (
    <Icon viewBox="-5 -5 34 34" strokeWidth="3.2" strokeLinejoin="round" {...props}>
      <path d="M21 21H8a2 2 0 0 1-1.42-.587l-3.994-3.999a2 2 0 0 1 0-2.828l10-10a2 2 0 0 1 2.829 0l5.999 6a2 2 0 0 1 0 2.828L12.834 21" />
      <path d="m5.082 11.09 8.828 8.828" />
    </Icon>
  );
}
