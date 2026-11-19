import { HeroId } from '../types';

export const HERO_PORTRAITS: Record<HeroId, string> = {
  sniper: `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <radialGradient id="bg-sniper" cx="50%" cy="35%" r="65%">
        <stop offset="0%" stop-color="#92400e"/>
        <stop offset="100%" stop-color="#1c1917"/>
      </radialGradient>
    </defs>
    <rect width="64" height="64" rx="8" fill="url(#bg-sniper)"/>
    <path d="M12 58 C14 42, 50 42, 52 58 Z" fill="#78350f"/>
    <path d="M22 44 L42 44 L38 58 L26 58 Z" fill="#d97706"/>
    <circle cx="32" cy="30" r="11" fill="#f3c69f"/>
    <path d="M21 33 Q32 45 43 33 L40 42 Q32 48 24 42 Z" fill="#e5e7eb"/>
    <ellipse cx="32" cy="21" rx="18" ry="5" fill="#451a03"/>
    <path d="M20 21 C21 10, 43 10, 44 21 Z" fill="#713f12"/>
    <rect x="21" y="25" width="9" height="6" rx="3" fill="#0f172a" stroke="#fbbf24" stroke-width="1.5"/>
    <rect x="34" y="25" width="9" height="6" rx="3" fill="#0f172a" stroke="#fbbf24" stroke-width="1.5"/>
    <circle cx="25.5" cy="28" r="2" fill="#38bdf8"/>
    <circle cx="38.5" cy="28" r="2" fill="#facc15"/>
    <line x1="46" y1="48" x2="60" y2="20" stroke="#94a3b8" stroke-width="3" stroke-linecap="round"/>
  </svg>`,

  crystal_maiden: `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <radialGradient id="bg-cm" cx="50%" cy="30%" r="65%">
        <stop offset="0%" stop-color="#0284c7"/>
        <stop offset="100%" stop-color="#0c1929"/>
      </radialGradient>
    </defs>
    <rect width="64" height="64" rx="8" fill="url(#bg-cm)"/>
    <path d="M10 60 C12 38, 52 38, 54 60 Z" fill="#0369a1"/>
    <path d="M16 42 Q32 49 48 42 L44 58 L20 58 Z" fill="#e0f2fe"/>
    <path d="M16 26 C16 10, 48 10, 48 26 L46 42 L18 42 Z" fill="#0284c7" stroke="#bae6fd" stroke-width="1.5"/>
    <path d="M21 24 C21 14, 43 14, 43 24 L42 38 L22 38 Z" fill="#fde047"/>
    <circle cx="32" cy="29" r="9.5" fill="#fde8d7"/>
    <circle cx="28.5" cy="28.5" r="1.6" fill="#0ea5e9"/>
    <circle cx="35.5" cy="28.5" r="1.6" fill="#0ea5e9"/>
    <polygon points="52,14 56,22 52,30 48,22" fill="#7dd3fc" stroke="#ffffff" stroke-width="1"/>
  </svg>`,

  sven: `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <radialGradient id="bg-sven" cx="50%" cy="35%" r="65%">
        <stop offset="0%" stop-color="#1d4ed8"/>
        <stop offset="100%" stop-color="#0f172a"/>
      </radialGradient>
    </defs>
    <rect width="64" height="64" rx="8" fill="url(#bg-sven)"/>
    <path d="M8 60 C10 40, 54 40, 56 60 Z" fill="#1e3a8a"/>
    <path d="M14 44 L50 44 L44 60 L20 60 Z" fill="#3b82f6"/>
    <path d="M16 22 L10 10 L24 18 Z" fill="#cbd5e1"/>
    <path d="M48 22 L54 10 L40 18 Z" fill="#cbd5e1"/>
    <path d="M20 20 C20 12, 44 12, 44 20 L42 38 L32 43 L22 38 Z" fill="#64748b" stroke="#93c5fd" stroke-width="1.5"/>
    <polygon points="24,26 40,26 38,31 26,31" fill="#090d16"/>
    <circle cx="28" cy="28.5" r="1.8" fill="#ef4444"/>
    <circle cx="36" cy="28.5" r="1.8" fill="#ef4444"/>
    <line x1="12" y1="54" x2="54" y2="12" stroke="#e2e8f0" stroke-width="3.5" stroke-linecap="round" opacity="0.5"/>
  </svg>`,

  venomancer: `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <radialGradient id="bg-veno" cx="50%" cy="35%" r="65%">
        <stop offset="0%" stop-color="#15803d"/>
        <stop offset="100%" stop-color="#052e16"/>
      </radialGradient>
    </defs>
    <rect width="64" height="64" rx="8" fill="url(#bg-veno)"/>
    <path d="M10 46 C8 22, 56 22, 54 46 C46 54, 18 54, 10 46 Z" fill="#166534" stroke="#84cc16" stroke-width="1.5"/>
    <ellipse cx="32" cy="31" rx="12" ry="14" fill="#22c55e"/>
    <polygon points="25,27 30,30 25,31" fill="#fef08a"/>
    <polygon points="39,27 34,30 39,31" fill="#fef08a"/>
    <path d="M25 38 Q32 43 39 38" stroke="#052e16" stroke-width="2.5" fill="none"/>
    <circle cx="17" cy="36" r="3" fill="#bef264"/>
    <circle cx="47" cy="36" r="3" fill="#bef264"/>
    <circle cx="32" cy="18" r="2.5" fill="#bef264"/>
  </svg>`,

  lina: `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <radialGradient id="bg-lina" cx="50%" cy="30%" r="65%">
        <stop offset="0%" stop-color="#ea580c"/>
        <stop offset="100%" stop-color="#270a02"/>
      </radialGradient>
    </defs>
    <rect width="64" height="64" rx="8" fill="url(#bg-lina)"/>
    <path d="M16 32 C12 14, 24 6, 32 8 C40 6, 52 14, 48 32 L54 46 L10 46 Z" fill="#f97316"/>
    <path d="M20 26 C20 12, 44 12, 44 26 L42 40 L22 40 Z" fill="#facc15"/>
    <path d="M14 60 C16 44, 48 44, 50 60 Z" fill="#b91c1c"/>
    <circle cx="32" cy="30" r="10" fill="#fde8d7"/>
    <circle cx="28.5" cy="29.5" r="1.8" fill="#fef08a"/>
    <circle cx="35.5" cy="29.5" r="1.8" fill="#fef08a"/>
    <circle cx="14" cy="48" r="5" fill="#fef08a"/>
    <circle cx="50" cy="48" r="5" fill="#fef08a"/>
  </svg>`,

  earthshaker: `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <radialGradient id="bg-es" cx="50%" cy="35%" r="65%">
        <stop offset="0%" stop-color="#a16207"/>
        <stop offset="100%" stop-color="#1c140d"/>
      </radialGradient>
    </defs>
    <rect width="64" height="64" rx="8" fill="url(#bg-es)"/>
    <path d="M8 60 C10 38, 54 38, 56 60 Z" fill="#78350f"/>
    <path d="M16 24 C8 20, 8 10, 18 12" stroke="#e5e7eb" stroke-width="4" fill="none" stroke-linecap="round"/>
    <path d="M48 24 C56 20, 56 10, 46 12" stroke="#e5e7eb" stroke-width="4" fill="none" stroke-linecap="round"/>
    <ellipse cx="32" cy="30" rx="13" ry="12" fill="#92400e"/>
    <ellipse cx="32" cy="36" rx="8" ry="5" fill="#d97706"/>
    <circle cx="27" cy="27" r="2" fill="#fef08a"/>
    <circle cx="37" cy="27" r="2" fill="#fef08a"/>
    <rect x="46" y="14" width="8" height="36" rx="2" fill="#57534e" stroke="#fbbf24" stroke-width="1.2"/>
  </svg>`,

  drow_ranger: `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <radialGradient id="bg-drow" cx="50%" cy="30%" r="65%">
        <stop offset="0%" stop-color="#3730a3"/>
        <stop offset="100%" stop-color="#0f172a"/>
      </radialGradient>
    </defs>
    <rect width="64" height="64" rx="8" fill="url(#bg-drow)"/>
    <path d="M10 60 C12 38, 52 38, 54 60 Z" fill="#1e1b4b"/>
    <path d="M15 28 C15 10, 49 10, 49 28 L46 44 L18 44 Z" fill="#312e81" stroke="#818cf8" stroke-width="1.5"/>
    <circle cx="32" cy="30" r="9.5" fill="#93c5fd"/>
    <path d="M22 31 L42 31 L39 40 L25 40 Z" fill="#1e293b"/>
    <circle cx="28" cy="28" r="1.8" fill="#e0f2fe"/>
    <circle cx="36" cy="28" r="1.8" fill="#e0f2fe"/>
    <path d="M48 12 Q60 32 48 52" stroke="#38bdf8" stroke-width="3" fill="none"/>
  </svg>`,

  zeus: `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <radialGradient id="bg-zeus" cx="50%" cy="30%" r="65%">
        <stop offset="0%" stop-color="#0284c7"/>
        <stop offset="100%" stop-color="#082f49"/>
      </radialGradient>
    </defs>
    <rect width="64" height="64" rx="8" fill="url(#bg-zeus)"/>
    <path d="M10 60 C12 42, 52 42, 54 60 Z" fill="#1d4ed8"/>
    <path d="M18 44 L46 44 L42 60 L22 60 Z" fill="#fbbf24"/>
    <circle cx="32" cy="29" r="10.5" fill="#f3c69f"/>
    <path d="M20 26 C20 14, 44 14, 44 26 Z" fill="#f8fafc"/>
    <path d="M21 32 Q32 46 43 32 L40 43 Q32 49 24 43 Z" fill="#e2e8f0"/>
    <circle cx="28" cy="28" r="2" fill="#38bdf8"/>
    <circle cx="36" cy="28" r="2" fill="#38bdf8"/>
    <polygon points="52,10 45,26 51,26 44,44 58,22 52,22" fill="#fef08a"/>
  </svg>`,
};
