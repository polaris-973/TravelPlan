import { useState, useEffect } from 'react';
import { OnboardingPage } from './pages/OnboardingPage';
import { HomePage } from './pages/HomePage';
import { PlanViewer } from './components/Planning/PlanViewer';
import { decodePlanFromHash, getShareHashValue, type SharePayload } from './services/share';
import { useTripStore } from './store/tripStore';

export default function App() {
  const trips = useTripStore((s) => s.trips);
  const activeTripId = useTripStore((s) => s.activeTripId);
  const [onboarded, setOnboarded] = useState(() => {
    return localStorage.getItem('travelplan_onboarded') === '1';
  });
  const [sharedPayload, setSharedPayload] = useState<SharePayload | null>(null);
  const [shareLoading, setShareLoading] = useState(false);

  // Detect #view= share link
  useEffect(() => {
    const check = async () => {
      const hash = getShareHashValue();
      if (!hash) { setSharedPayload(null); return; }
      setShareLoading(true);
      const payload = await decodePlanFromHash(hash);
      setSharedPayload(payload);
      setShareLoading(false);
    };
    check();
    window.addEventListener('hashchange', check);
    return () => window.removeEventListener('hashchange', check);
  }, []);

  useEffect(() => {
    if (trips.length > 0) {
      localStorage.setItem('travelplan_onboarded', '1');
    }
  }, [trips.length]);

  // Mark storage as persistent so browsers don't auto-evict when disk is low.
  // First call may prompt the user; silent on subsequent calls.
  useEffect(() => {
    if (typeof navigator !== 'undefined' && navigator.storage && 'persist' in navigator.storage) {
      navigator.storage.persist().then((granted) => {
        if (granted) console.info('[storage] persistent storage granted');
      }).catch(() => { /* silent */ });
    }
  }, []);

  const exitShare = () => {
    // Clear hash without reloading
    history.replaceState(null, '', window.location.pathname);
    setSharedPayload(null);
  };

  if (shareLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-[13px] text-muted">正在加载分享方案…</div>
      </div>
    );
  }

  if (sharedPayload) {
    return <PlanViewer payload={sharedPayload} onExit={exitShare} />;
  }

  const showOnboarding = !onboarded && trips.length === 0;

  const handleOnboardingComplete = () => {
    localStorage.setItem('travelplan_onboarded', '1');
    setOnboarded(true);
  };

  if (showOnboarding) {
    return <OnboardingPage onComplete={handleOnboardingComplete} />;
  }

  return <HomePage key={activeTripId ?? 'default'} />;
}
