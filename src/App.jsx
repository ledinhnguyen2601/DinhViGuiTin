import React, { useState, useEffect } from 'react';
import confetti from 'canvas-confetti';
import { useTracker } from './hooks/useTracker.js';
import { Header } from './components/Header.jsx';
import { Navigation } from './components/Navigation.jsx';
import { Home } from './pages/Home.jsx';
import { Settings } from './pages/Settings.jsx';
import { Permissions } from './pages/Permissions.jsx';
import { Logs } from './pages/Logs.jsx';
import { TRIP_STATES } from './config/constants.js';
import { useTelegramBot } from './hooks/useTelegramBot.js';

export function App() {
  const [activeTab, setActiveTab] = useState('home');
  const tracker = useTracker();
  useTelegramBot(tracker); // Initialize Telegram bot polling

  // Trigger celebration confetti when arrived
  useEffect(() => {
    if (tracker.tripState === TRIP_STATES.ARRIVED) {
      try {
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.6 },
        });
      } catch {}
    }
  }, [tracker.tripState]);

  const renderActivePage = () => {
    switch (activeTab) {
      case 'settings':
        return <Settings tracker={tracker} />;
      case 'permissions':
        return <Permissions />;
      case 'logs':
        return <Logs />;
      case 'home':
      default:
        return <Home tracker={tracker} setActiveTab={setActiveTab} />;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col justify-between">
      <div>
        <Header
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          tripState={tracker.tripState}
        />
        <main className="max-w-md mx-auto px-4 pt-4 pb-20">
          {renderActivePage()}
        </main>
      </div>

      <Navigation
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        tripState={tracker.tripState}
      />
    </div>
  );
}

export default App;
