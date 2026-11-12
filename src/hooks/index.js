import { depsChanged } from './depsChanged.js';

export { useState } from './useState.js';
export { useEffect } from './useEffect.js';
export { useMemo } from './useMemo.js';
export { useRef } from './useRef.js';
export { depsChanged };
export const areDepsEqual = (prevDeps, nextDeps) => !depsChanged(prevDeps, nextDeps);
