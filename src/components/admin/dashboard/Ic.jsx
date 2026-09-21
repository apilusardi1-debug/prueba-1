// Íconos de línea del Dashboard (sin emojis, hereda el color del texto).
const TRAZOS = {
  wallet: <><path d="M4 7.5A2.5 2.5 0 0 1 6.5 5H18v3" /><rect x="3.5" y="7.5" width="17" height="12" rx="3" /><circle cx="16.5" cy="13.5" r="1.2" /></>,
  cash: <><rect x="3" y="6.5" width="18" height="11" rx="2.5" /><circle cx="12" cy="12" r="2.6" /></>,
  target: <><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1.5" /></>,
  cal: <><rect x="3.5" y="5" width="17" height="15.5" rx="3" /><path d="M8 3v4M16 3v4M3.5 10h17" /></>,
  users: <><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20a6.5 6.5 0 0 1 13 0" /><path d="M16 4.6a3.5 3.5 0 0 1 0 6.8M18.5 14.5A6.5 6.5 0 0 1 21.5 20" /></>,
  gear: <><circle cx="12" cy="12" r="3" /><path d="M12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21M5.6 5.6l1.8 1.8M16.6 16.6l1.8 1.8M18.4 5.6l-1.8 1.8M7.4 16.6l-1.8 1.8" /></>,
  chat: <path d="M20 12a8 8 0 0 1-11.6 7.1L4 20l1-4.2A8 8 0 1 1 20 12z" />,
  send: <path d="M4 12l16-8-6 16-3-6.5z" />,
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  up: <path d="M12 19V5M6 11l6-6 6 6" />,
  down: <path d="M12 5v14M6 13l6 6 6-6" />,
  arrow: <path d="M5 12h14M13 6l6 6-6 6" />,
  dl: <path d="M12 4v11M7 11l5 5 5-5M5 20h14" />,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  compass: <><circle cx="12" cy="12" r="9" /><path d="M15.5 8.5l-2 5-5 2 2-5z" /></>,
  car: <><rect x="3.5" y="10" width="17" height="6" rx="2" /><path d="M6 10l1.6-4h8.8L18 10M7 16v2.5M17 16v2.5" /></>,
  briefcase: <><rect x="3.5" y="7.5" width="17" height="12" rx="2.5" /><path d="M9 7.5V6a1.5 1.5 0 0 1 1.5-1.5h3A1.5 1.5 0 0 1 15 6v1.5M3.5 13h17" /></>,
  user: <><circle cx="12" cy="8" r="3.8" /><path d="M4.5 20a7.5 7.5 0 0 1 15 0" /></>,
  pin: <><path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z" /><circle cx="12" cy="10" r="2.3" /></>,
  phone: <path d="M5 4.5h3.5l1.7 4-2 1.3a10 10 0 0 0 5 5l1.3-2 4 1.7V18a2 2 0 0 1-2 2A14 14 0 0 1 3 6.5a2 2 0 0 1 2-2z" />,
  hotel: <><rect x="5" y="3.5" width="14" height="17" rx="2" /><path d="M9 8h1.5M13.5 8H15M9 12h1.5M13.5 12H15M10 20.5v-3.5h4v3.5" /></>,
  lock: <><rect x="5" y="10.5" width="14" height="10" rx="2.5" /><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" /></>,
  camera: <><path d="M4 8.5A2 2 0 0 1 6 6.5h1.5L9 4.5h6L16.5 6.5H18a2 2 0 0 1 2 2V17a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z" /><circle cx="12" cy="12.5" r="3.3" /></>,
  film: <><rect x="3.5" y="5" width="17" height="14" rx="2.5" /><path d="M8 5v14M16 5v14M3.5 9.5H8M3.5 14.5H8M16 9.5h4.5M16 14.5h4.5" /></>,
  file: <><path d="M7 3.5h7l4 4v13H7z" /><path d="M14 3.5v4h4M9.5 12.5h5M9.5 16h5" /></>,
  clip: <path d="M20 11.5l-7.7 7.7a4.5 4.5 0 0 1-6.4-6.4l8.2-8.2a3 3 0 0 1 4.3 4.3l-8.2 8.2a1.5 1.5 0 0 1-2.1-2.1l7.5-7.5" />,
  pencil: <><path d="M4 20l1-4.5L16.5 4a2.1 2.1 0 0 1 3 3L8 18.5z" /><path d="M14.5 6l3.5 3.5" /></>,
  eye: <><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" /><circle cx="12" cy="12" r="2.8" /></>,
  eyeoff: <path d="M4 4l16 16M9.9 6.1A9.6 9.6 0 0 1 12 5.5c6 0 9.5 6.5 9.5 6.5a17 17 0 0 1-3 3.8M6.2 7.7A17 17 0 0 0 2.5 12S6 18.5 12 18.5a9.5 9.5 0 0 0 3.9-.8" />,
  card: <><rect x="3" y="5.5" width="18" height="13" rx="2.5" /><path d="M3 10h18M6.5 15h3" /></>,
  map: <><path d="M9 5L3.5 7v12L9 17l6 2 5.5-2V5L15 7z" /><path d="M9 5v12M15 7v12" /></>,
  xcircle: <><circle cx="12" cy="12" r="9" /><path d="M9 9l6 6M15 9l-6 6" /></>,
  checkcircle: <><circle cx="12" cy="12" r="9" /><path d="M8 12.5l3 3 5-6" /></>,
  waves: <path d="M3 9c2-2 4-2 6 0s4 2 6 0 4-2 6 0M3 14c2-2 4-2 6 0s4 2 6 0 4-2 6 0M3 19c2-2 4-2 6 0s4 2 6 0 4-2 6 0" />,
  alert: <><path d="M12 4l9 16H3z" /><path d="M12 10v4M12 17v.4" /></>,
  dot: <circle cx="12" cy="12" r="2.2" />,
  checks: <path d="M2 12.5l4.5 4.5L15 8M10 15.5l1.5 1.5L22 7.5" />,
  bell: <><path d="M6 9a6 6 0 0 1 12 0c0 6 2.5 7.5 2.5 7.5h-17S6 15 6 9z" /><path d="M10 20a2 2 0 0 0 4 0" /></>,
  columns: <><rect x="3.5" y="4.5" width="4.5" height="15" rx="1.2" /><rect x="9.75" y="4.5" width="4.5" height="10" rx="1.2" /><rect x="16" y="4.5" width="4.5" height="13" rx="1.2" /></>,
  list: <path d="M8 6.5h12M8 12h12M8 17.5h12M4 6.5h.01M4 12h.01M4 17.5h.01" />,
  search: <><circle cx="11" cy="11" r="6.5" /><path d="M16 16l4.5 4.5" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
  trash: <path d="M4 7h16M9 7V4.5h6V7M6.5 7l1 13h9l1-13" />,
  bellOff: <><path d="M8.5 5.2A6 6 0 0 1 18 9c0 3 .7 4.9 1.5 6M6 9c0 6-2.5 7.5-2.5 7.5H15" /><path d="M10 20a2 2 0 0 0 4 0M4 4l16 16" /></>,
}

export default function Ic({ n, className = 'w-[18px] h-[18px]' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={`shrink-0 ${className}`} aria-hidden="true">
      {TRAZOS[n]}
    </svg>
  )
}

// Icono grande y tenue para los estados vacíos ("Sin datos todavía")
export function IcGrande({ n }) {
  return (
    <span className="mb-2 flex justify-center text-gray-300 dark:text-zinc-600">
      <Ic n={n} className="h-9 w-9" />
    </span>
  )
}

// Icono chico que acompaña a un texto en la misma línea
export function IcTxt({ n, className = '' }) {
  return <Ic n={n} className={`mr-1 inline-block h-3.5 w-3.5 align-[-2px] ${className}`} />
}
