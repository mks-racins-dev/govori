import Svg, { Circle, Path, Rect } from 'react-native-svg';

type IconProps = { size?: number; color?: string };

export function MicIcon({ size = 28, color = '#fff' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x={8} y={2} width={8} height={13} rx={4} fill={color} />
      <Path d="M5 11a7 7 0 0 0 14 0M12 18v3M8 21h8" stroke={color} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}

export function PlayIcon({ size = 24, color = '#1A1A1A' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M7 4.5v15a1 1 0 0 0 1.5.86l12-7.5a1 1 0 0 0 0-1.72l-12-7.5A1 1 0 0 0 7 4.5Z" fill={color} />
    </Svg>
  );
}

export function PauseIcon({ size = 24, color = '#1A1A1A' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Rect x={6} y={4} width={4} height={16} rx={1} fill={color} />
      <Rect x={14} y={4} width={4} height={16} rx={1} fill={color} />
    </Svg>
  );
}

export function BackIcon({ size = 24, color = '#1A1A1A' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M15 5l-7 7 7 7" stroke={color} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function MenuIcon({ size = 24, color = '#1A1A1A' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M8 7h12M4 12h16M10 17h10" stroke={color} strokeWidth={2.2} strokeLinecap="round" />
    </Svg>
  );
}

export function ShuffleIcon({ size = 22, color = '#1A1A1A' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M17 3l4 4-4 4M3 7h18M7 21l-4-4 4-4M21 17H3"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function TrashIcon({ size = 22, color = '#1A1A1A' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function PlusIcon({ size = 24, color = '#fff' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M12 5v14M5 12h14" stroke={color} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}

export function HomeIcon({ size = 22, color = '#111' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M4 10.5 12 4l8 6.5V19a1 1 0 0 1-1 1h-4v-5h-6v5H5a1 1 0 0 1-1-1v-8.5Z"
        stroke={color}
        strokeWidth={1.6}
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function JourneyIcon({ size = 22, color = '#111' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M4 5.5C6.5 4 9.5 4 12 5.5 14.5 4 17.5 4 20 5.5V19c-2.5-1.5-5.5-1.5-8 0-2.5-1.5-5.5-1.5-8 0V5.5ZM12 5.5V19"
        stroke={color}
        strokeWidth={1.6}
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function UserIcon({ size = 22, color = '#111' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM4.5 20a7.5 7.5 0 0 1 15 0" stroke={color} strokeWidth={1.6} strokeLinecap="round" />
    </Svg>
  );
}

export function ArrowIcon({ size = 18, color = '#111' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M5 12h14M13 6l6 6-6 6" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function ChevronIcon({ size = 16, color = '#111', up = false }: IconProps & { up?: boolean }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d={up ? 'M6 15l6-6 6 6' : 'M6 9l6 6 6-6'}
        stroke={color}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/** The reference's black disc with an offset white circle. */
export function DiscArt({ size = 64 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64">
      <Circle cx={32} cy={32} r={32} fill="#111" />
      <Circle cx={34} cy={27} r={16} fill="#fff" />
      <Circle cx={34} cy={27} r={16} fill="none" stroke="#111" strokeWidth={1.5} />
    </Svg>
  );
}

/** Line-art illustration for the featured card: a mic with speech bubbles, white on black. */
export function MicArt({ size = 120 }: { size?: number }) {
  return (
    <Svg width={size} height={size * 1.4} viewBox="0 0 100 140" fill="none">
      <Rect x={34} y={30} width={32} height={52} rx={16} fill="#fff" />
      <Path d="M42 44h16M42 54h16M42 64h16" stroke="#111" strokeWidth={2} strokeLinecap="round" />
      <Path d="M24 66a26 26 0 0 0 52 0M50 92v16M36 110h28" stroke="#fff" strokeWidth={3} strokeLinecap="round" />
      <Path d="M70 10h22a4 4 0 0 1 4 4v12a4 4 0 0 1-4 4h-12l-6 6v-6h-4a4 4 0 0 1-4-4V14a4 4 0 0 1 4-4Z" stroke="#fff" strokeWidth={2.5} strokeLinejoin="round" />
      <Path d="M8 112h18a4 4 0 0 1 4 4v8a4 4 0 0 1-4 4h-4l-6 5v-5H8a4 4 0 0 1-4-4v-8a4 4 0 0 1 4-4Z" fill="#fff" />
    </Svg>
  );
}

export function GridIcon({ size = 22, color = '#111' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x={4} y={4} width={7} height={7} rx={2} stroke={color} strokeWidth={1.6} />
      <Rect x={13} y={4} width={7} height={7} rx={2} stroke={color} strokeWidth={1.6} />
      <Rect x={4} y={13} width={7} height={7} rx={2} stroke={color} strokeWidth={1.6} />
      <Rect x={13} y={13} width={7} height={7} rx={2} stroke={color} strokeWidth={1.6} />
    </Svg>
  );
}
