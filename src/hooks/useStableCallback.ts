import { useCallback, useLayoutEffect, useRef } from 'react';

/**
 * A function with a stable identity that always calls the latest `fn`. Lets memoized children
 * (PinComponent) skip re-rendering when only the parent's handlers were re-created. Only for
 * event handlers: it must not be called during render.
 */
export const useStableCallback = <A extends unknown[], R>(fn: (...args: A) => R): ((...args: A) => R) => {
  const ref = useRef(fn);
  useLayoutEffect(() => {
    ref.current = fn;
  });
  return useCallback((...args: A) => ref.current(...args), []);
};
