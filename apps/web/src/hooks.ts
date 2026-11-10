import { useLayoutEffect, useRef } from 'react';

/**
 * A ref that always holds the value from the latest render. Effects read callbacks and state
 * through it when they must see the newest value without re-running when that value changes.
 */
export function useLatest<T>(value: T) {
  const ref = useRef(value);
  useLayoutEffect(() => {
    ref.current = value;
  });
  return ref;
}
