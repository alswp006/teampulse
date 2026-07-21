import { useEffect } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { lazy, Suspense, type ReactNode } from 'react';
import Home from './pages/Home';
import Onboarding from './pages/Onboarding';
import Feed from './pages/Feed';
import Leaderboard from './pages/Leaderboard';
import Report from './pages/Report';
import { ProfileProvider, useProfile } from './lib/profileContext';
import { FloatingTabBar } from './components/FloatingTabBar';
import { ErrorBoundary } from './components/ErrorBoundary';
import { checkTossSession } from './lib/sessionCheck';

// Dev-only TDS Gallery route — `import.meta.env.DEV` is statically replaced
// (true in dev, false in prod) so the entire import + Route is tree-shaken
// from production builds. Verify with: `grep -r "TdsGallery" dist/` → empty.
const DevTdsGallery = import.meta.env.DEV
  ? lazy(() => import('./pages/__TdsGallery'))
  : null;

const TAB_ITEMS = [
  { label: '홈', path: '/' },
  { label: '피드', path: '/feed' },
  { label: '랭킹', path: '/leaderboard' },
  { label: '리포트', path: '/report' },
];

function RequireProfile({ children }: { children: ReactNode }) {
  const { profile } = useProfile();
  if (!profile) {
    return <Navigate to="/onboarding" replace />;
  }
  return <>{children}</>;
}

function AppRoutes() {
  const location = useLocation();

  useEffect(() => {
    checkTossSession();
  }, []);

  return (
    <>
      <ErrorBoundary key={location.pathname}>
        <Routes>
          <Route path="/" element={<RequireProfile><Home /></RequireProfile>} />
          <Route path="/onboarding" element={<Onboarding />} />
          <Route path="/feed" element={<RequireProfile><Feed /></RequireProfile>} />
          <Route path="/leaderboard" element={<RequireProfile><Leaderboard /></RequireProfile>} />
          <Route path="/report" element={<RequireProfile><Report /></RequireProfile>} />
          {DevTdsGallery && (
            <Route
              path="/__tds-gallery"
              element={
                <Suspense fallback={null}>
                  <DevTdsGallery />
                </Suspense>
              }
            />
          )}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </ErrorBoundary>
      {location.pathname !== '/onboarding' && <FloatingTabBar items={TAB_ITEMS} />}
    </>
  );
}

export default function App() {
  return (
    <ProfileProvider>
      <AppRoutes />
    </ProfileProvider>
  );
}
