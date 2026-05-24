# Cal Insights 📊

Conectá tu Google Calendar y descubrí en qué invertís tu tiempo. Reportes por día, semana, mes y año.

## Features

- **Google OAuth2** — Login con Google, solo lectura del calendario
- **Dashboard interactivo** — Resumen con métricas clave (tiempo total, eventos, promedio diario, top actividad)
- **Gráfico de torta** — Distribución porcentual por actividad
- **Gráfico de barras** — Horas por día dentro del rango seleccionado
- **Tabla detallada** — Todas las actividades con su tiempo, cantidad de eventos y porcentaje
- **Filtros temporales** — Día, semana, mes, año con navegación anterior/siguiente

## Tech Stack

- [Next.js 16](https://nextjs.org/) (App Router)
- [NextAuth.js](https://next-auth.js.org/) (Google OAuth2 + Calendar API)
- [Recharts](https://recharts.org/) (gráficos)
- [Tailwind CSS 4](https://tailwindcss.com/) (estilos)
- [date-fns](https://date-fns.org/) (fechas)
- [Lucide React](https://lucide.dev/) (íconos)
- TypeScript

## Setup

### 1. Clonar y instalar

```bash
git clone https://github.com/feragusper/cal-insights.git
cd cal-insights
npm install
```

### 2. Configurar Google OAuth

1. Ir a [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. Crear un proyecto (o usar uno existente)
3. Habilitar la **Google Calendar API**
4. Crear credenciales **OAuth 2.0 Client ID** (tipo: Web Application)
5. Agregar `http://localhost:3000/api/auth/callback/google` como **Authorized redirect URI**
6. Copiar el **Client ID** y **Client Secret**

### 3. Variables de entorno

```bash
cp .env.example .env.local
```

Editar `.env.local` con tus credenciales:

```env
GOOGLE_CLIENT_ID=tu-client-id
GOOGLE_CLIENT_SECRET=tu-client-secret
NEXTAUTH_SECRET=generado-con-openssl-rand-base64-32
NEXTAUTH_URL=http://localhost:3000
```

### 4. Correr en desarrollo

```bash
npm run dev
```

Abrir [http://localhost:3000](http://localhost:3000) y conectar con Google.

## Estructura del Proyecto

```
src/
├── app/
│   ├── api/
│   │   ├── auth/[...nextauth]/route.ts  # NextAuth handler
│   │   └── calendar/route.ts            # Calendar data API
│   ├── dashboard/page.tsx               # Dashboard principal
│   ├── layout.tsx                       # Root layout
│   └── page.tsx                         # Landing page
├── components/
│   ├── ActivityTable.tsx                # Tabla de actividades
│   ├── CategoryChart.tsx                # Gráfico de torta
│   ├── DailyChart.tsx                   # Gráfico de barras diario
│   ├── DateRangeSelector.tsx            # Selector de rango
│   ├── SessionProvider.tsx              # NextAuth session provider
│   └── StatsCards.tsx                   # Tarjetas de métricas
├── lib/
│   ├── auth.ts                          # NextAuth config
│   ├── calendar.ts                      # Google Calendar API service
│   └── dates.ts                         # Utilidades de fechas
└── types/
    ├── index.ts                         # Type definitions
    └── next-auth.d.ts                   # NextAuth type extensions
```

## License

MIT
