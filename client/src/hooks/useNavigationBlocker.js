import { useContext, useEffect, useState, useCallback, useRef } from 'react';
import { UNSAFE_NavigationContext as NavigationContext } from 'react-router-dom';

/**
 * Navigation blocker compatible with BrowserRouter (useBlocker requires a data router).
 * Intercepts navigate() calls (push/replace) and browser back/forward via popstate.
 *
 * Returns { state: 'blocked' | 'unblocked', proceed, reset } — same shape as useBlocker.
 */
export function useNavigationBlocker(when) {
  const { navigator } = useContext(NavigationContext);
  const proceedRef = useRef(null);
  const [state, setState] = useState('unblocked');

  const block = useCallback((fn) => {
    proceedRef.current = fn;
    setState('blocked');
  }, []);

  // Intercept navigate() / <Link> clicks (push + replace)
  useEffect(() => {
    if (!when) {
      proceedRef.current = null;
      setState('unblocked');
      return;
    }

    const origPush = navigator.push;
    const origReplace = navigator.replace;

    navigator.push = function (...args) {
      block(() => origPush.apply(navigator, args));
    };
    navigator.replace = function (...args) {
      block(() => origReplace.apply(navigator, args));
    };

    return () => {
      navigator.push = origPush;
      navigator.replace = origReplace;
    };
  }, [when, navigator, block]);

  // Intercept browser back/forward button
  useEffect(() => {
    if (!when) return;

    const onPopState = () => {
      // Go forward to restore blocked state, then let user confirm
      window.history.go(1);
      block(() => window.history.go(-1));
    };

    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [when, block]);

  const proceed = useCallback(() => {
    const fn = proceedRef.current;
    proceedRef.current = null;
    setState('unblocked');
    if (fn) fn();
  }, []);

  const reset = useCallback(() => {
    proceedRef.current = null;
    setState('unblocked');
  }, []);

  return { state, proceed, reset };
}
