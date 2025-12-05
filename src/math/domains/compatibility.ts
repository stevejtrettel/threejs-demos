/**
 * Compatibility layer for transitioning from old SurfaceDomain to new Domain system
 */

import { Rectangle2D } from './Rectangle2D';
import type { SurfaceDomain } from '../surfaces/types';

/**
 * Convert old SurfaceDomain format to Rectangle2D
 *
 * This helper makes it easy to migrate existing code.
 *
 * @example
 *   // Old way
 *   getDomain(): SurfaceDomain {
 *     return { uMin: 0, uMax: 2*PI, vMin: 0, vMax: 2*PI };
 *   }
 *
 *   // New way (with backward compatibility)
 *   getDomain(): Domain2D {
 *     return surfaceDomainToRectangle2D({ uMin: 0, uMax: 2*PI, vMin: 0, vMax: 2*PI });
 *   }
 */
export function surfaceDomainToRectangle2D(domain: SurfaceDomain): Rectangle2D {
  return new Rectangle2D({
    uMin: domain.uMin,
    uMax: domain.uMax,
    vMin: domain.vMin,
    vMax: domain.vMax
  });
}

/**
 * Convert Rectangle2D to old SurfaceDomain format (for backward compatibility)
 */
export function rectangle2DToSurfaceDomain(domain: Rectangle2D): SurfaceDomain {
  return {
    uMin: domain.uMin,
    uMax: domain.uMax,
    vMin: domain.vMin,
    vMax: domain.vMax
  };
}

/**
 * Helper to extract simple bounds from any Domain2D
 * Useful when you just need the bounding box
 */
export function getDomain2DBounds(domain: { getBounds(): number[] }): SurfaceDomain {
  const [uMin, uMax, vMin, vMax] = domain.getBounds();
  return { uMin, uMax, vMin, vMax };
}
