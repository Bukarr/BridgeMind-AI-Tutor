import React, { useState, useEffect } from 'react';
import { Download, X, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showPrompt, setShowPrompt] = useState(false);

  useEffect(() => {
    const handler = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      // Show prompt after a short delay
      setTimeout(() => setShowPrompt(true), 3000);
    };

    window.addEventListener('beforeinstallprompt', handler);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
      setShowPrompt(false);
    }
  };

  return (
    <AnimatePresence>
      {showPrompt && (
        <motion.div 
          initial={{ opacity: 0, y: 100 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 100 }}
          className="fixed bottom-24 left-6 right-6 z-[100] max-w-md mx-auto"
        >
          <div className="bg-bg-primary/95 border border-accent-cyan/30 p-5 rounded-[2rem] shadow-2xl shadow-cyan-500/20 backdrop-blur-xl">
            <div className="flex items-start justify-between">
              <div className="flex gap-4">
                <div className="w-12 h-12 rounded-2xl bg-accent-cyan flex-shrink-0 flex items-center justify-center shadow-lg shadow-cyan-500/30">
                  <Sparkles className="w-6 h-6 text-bg-base" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-sm font-black text-text-primary uppercase tracking-tighter">Install BridgeMind</h3>
                  <p className="text-xs text-text-secondary leading-relaxed font-medium">Add BridgeMind to your home screen for lightning-fast offline access.</p>
                </div>
              </div>
              <button 
                onClick={() => setShowPrompt(false)}
                className="p-1 hover:bg-bg-secondary rounded-full transition-colors text-text-muted"
              >
                <X size={18} />
              </button>
            </div>
            <div className="mt-5 flex gap-3">
              <button 
                onClick={handleInstall}
                className="flex-1 btn-primary py-3 flex items-center justify-center gap-2 text-xs"
              >
                <Download size={16} /> Install Now
              </button>
              <button 
                onClick={() => setShowPrompt(false)}
                className="px-6 py-3 rounded-full bg-bg-secondary text-text-muted text-xs font-bold border border-border-default hover:text-text-secondary transition-colors"
              >
                Maybe Later
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
