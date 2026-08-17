/**
 * Interval arithmetic — enclosures of real expressions over boxes.
 */
export type { Interval, IntervalBox } from './Interval';
export {
  ipoint,
  iball,
  iadd,
  isub,
  imul,
  iscale,
  ineg,
  isqr,
  icube,
  imid,
  irad,
  iwidth,
  imag,
  icontains,
  iinterior,
  box,
  boxInterior,
  boxContains,
} from './Interval';
