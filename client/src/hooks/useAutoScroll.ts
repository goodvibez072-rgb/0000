import { useState, useEffect, useCallback, useRef } from 'react';

export interface AutoScrollConfig {
  speed: number; // pixels per second
  enabled: boolean;
}

export function useAutoScroll(initialConfig: AutoScrollConfig = { speed: 100, enabled: false }) {
  const [config, setConfig] = useState<AutoScrollConfig>(initialConfig);
  const animationFrameRef = useRef<number>();
  const lastTimeRef = useRef<number>(0);

  const startAutoScroll = useCallback(() => {
    if (!config.enabled) return;

    const scroll = (currentTime: number) => {
      if (lastTimeRef.current === 0) {
        lastTimeRef.current = currentTime;
      }

      const deltaTime = currentTime - lastTimeRef.current;
      const scrollAmount = (config.speed * deltaTime) / 1000;

      window.scrollBy(0, scrollAmount);

      if (window.scrollY + window.innerHeight >= document.documentElement.scrollHeight) {
        stopAutoScroll();
        return;
      }

      lastTimeRef.current = currentTime;
      animationFrameRef.current = requestAnimationFrame(scroll);
    };

    animationFrameRef.current = requestAnimationFrame(scroll);
  }, [config.enabled, config.speed]);

  const stopAutoScroll = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = undefined;
      lastTimeRef.current = 0;
    }
  }, []);

  const toggleAutoScroll = useCallback(() => {
    setConfig(prev => {
      const newEnabled = !prev.enabled;
      if (!newEnabled) {
        stopAutoScroll();
      }
      return { ...prev, enabled: newEnabled };
    });
  }, [stopAutoScroll]);

  const setSpeed = useCallback((speed: number) => {
    setConfig(prev => ({ ...prev, speed }));
  }, []);

  useEffect(() => {
    if (config.enabled) {
      startAutoScroll();
    } else {
      stopAutoScroll();
    }

    return () => {
      stopAutoScroll();
    };
  }, [config.enabled, startAutoScroll, stopAutoScroll]);

  return {
    isAutoScrolling: config.enabled,
    speed: config.speed,
    toggleAutoScroll,
    setSpeed,
    stopAutoScroll,
  };
}
