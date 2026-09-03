const ICONS: Record<string, string> = {
  "icon-send": "↗",
  "icon-exit": "↪",
  "icon-play": "▶",
  "icon-record": "●",
  "icon-battle": "⚔",
  "icon-coffee": "◇",
  "icon-chip": "▦",
  "icon-empty": "—",
  "icon-chain": "∞",
  "icon-chain-all": "⛓",
  "icon-chain-broken": "∅",
  "icon-front": "▲",
  "icon-back": "▼",
  "icon-back-defence": "◆",
  "icon-side-bar-fill": "▤",
  "icon-mora": "✦",
  "icon-one": "1",
};

export const IconFont: React.FC<{
  type: string;
  size?: number;
  color?: string;
  style?: React.CSSProperties;
}> = ({ type, size = "inherit", style, color = "inherit" }) => (
  <span
    aria-hidden="true"
    data-icon={type}
    style={{
      display: "inline-grid",
      minWidth: "1em",
      placeItems: "center",
      fontSize: size,
      color,
      ...style,
    }}
  >
    {ICONS[type] ?? "•"}
  </span>
);
