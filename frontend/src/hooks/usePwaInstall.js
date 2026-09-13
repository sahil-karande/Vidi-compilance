/**
 * Vidi — frontend/src/hooks/usePwaInstall.js
 * Unified hook delegating to global PwaContext so all install buttons and banners share synchronized state.
 */

import { usePwa } from '../context/PwaContext';

export function usePwaInstall() {
  return usePwa();
}
