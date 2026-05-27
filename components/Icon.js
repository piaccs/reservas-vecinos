// Iconos SVG de línea — sistema V1 Comunidad Cálida
// Uso: <Icon name="calendar" size={18} />

export default function Icon({ name, size = 18, color, className }) {
  const s = size
  const sw = 1.6
  const props = {
    width: s,
    height: s,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: color || 'currentColor',
    strokeWidth: sw,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    className,
    style: { flexShrink: 0, display: 'inline-block', verticalAlign: 'middle' }
  }

  switch (name) {
    case 'calendar':
      return <svg {...props}><rect x="3.5" y="5" width="17" height="15" rx="2" /><path d="M8 3v4M16 3v4M3.5 10h17" /></svg>
    case 'clock':
      return <svg {...props}><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></svg>
    case 'pin':
      return <svg {...props}><path d="M12 21s7-6.5 7-12a7 7 0 1 0-14 0c0 5.5 7 12 7 12Z" /><circle cx="12" cy="9" r="2.5" /></svg>
    case 'wallet':
      return <svg {...props}><rect x="3" y="6.5" width="18" height="13" rx="2" /><path d="M3 9.5h18M16 14h2" /></svg>
    case 'check':
      return <svg {...props}><path d="M5 12.5l4 4 10-10" /></svg>
    case 'check-circle':
      return <svg {...props}><circle cx="12" cy="12" r="9" /><path d="M8 12.5l3 3 5-6.5" /></svg>
    case 'x':
      return <svg {...props}><path d="M6 6l12 12M18 6l-12 12" /></svg>
    case 'x-circle':
      return <svg {...props}><circle cx="12" cy="12" r="9" /><path d="M9 9l6 6M15 9l-6 6" /></svg>
    case 'lock':
      return <svg {...props}><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></svg>
    case 'upload':
      return <svg {...props}><path d="M12 16V5M7 10l5-5 5 5M5 19h14" /></svg>
    case 'chevron-down':
      return <svg {...props}><path d="M6 9l6 6 6-6" /></svg>
    case 'chevron-up':
      return <svg {...props}><path d="M18 15l-6-6-6 6" /></svg>
    case 'arrow-right':
      return <svg {...props}><path d="M5 12h14M13 6l6 6-6 6" /></svg>
    case 'arrow-left':
      return <svg {...props}><path d="M19 12H5M11 6l-6 6 6 6" /></svg>
    case 'users':
      return <svg {...props}><circle cx="9" cy="9" r="3.5" /><path d="M2.5 19c.6-3 3.3-5 6.5-5s5.9 2 6.5 5" /><circle cx="17" cy="8" r="2.5" /><path d="M15 14c2.5 0 4.5 1.5 5 3.5" /></svg>
    case 'chart':
      return <svg {...props}><path d="M4 20V10M10 20V4M16 20v-8M22 20H2" /></svg>
    case 'settings':
      return <svg {...props}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h0a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h0a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v0a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" /></svg>
    case 'list':
      return <svg {...props}><path d="M8 6h13M8 12h13M8 18h13M4 6h.01M4 12h.01M4 18h.01" /></svg>
    case 'plus':
      return <svg {...props}><path d="M12 5v14M5 12h14" /></svg>
    case 'minus':
      return <svg {...props}><path d="M5 12h14" /></svg>
    case 'trash':
      return <svg {...props}><path d="M4 7h16M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M6 7l1 13a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-13" /></svg>
    case 'download':
      return <svg {...props}><path d="M12 4v12M7 11l5 5 5-5M5 20h14" /></svg>
    case 'search':
      return <svg {...props}><circle cx="11" cy="11" r="7" /><path d="M16 16l5 5" /></svg>
    case 'eye':
      return <svg {...props}><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" /></svg>
    case 'phone':
      return <svg {...props}><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92Z" /></svg>
    case 'play':
      return <svg {...props}><path d="M6 4l14 8-14 8V4Z" fill={color || 'currentColor'} /></svg>
    case 'pause':
      return <svg {...props}><rect x="6" y="4" width="4" height="16" fill={color || 'currentColor'} /><rect x="14" y="4" width="4" height="16" fill={color || 'currentColor'} /></svg>
    case 'edit':
      return <svg {...props}><path d="M17 3a2.83 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3Z" /></svg>
    case 'alert':
      return <svg {...props}><circle cx="12" cy="12" r="9" /><path d="M12 8v5M12 16h.01" /></svg>
    default:
      return null
  }
}
