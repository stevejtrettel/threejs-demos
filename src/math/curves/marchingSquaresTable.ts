/**
 * Marching Squares lookup table for level curve extraction
 *
 * Maps each of the 16 possible square configurations to edge pairs that form line segments.
 *
 * Square corner numbering (counterclockwise from bottom-left):
 *   3 ---- 2
 *   |      |
 *   |      |
 *   0 ---- 1
 *
 * Edge numbering:
 *   0: bottom (between corners 0 and 1)
 *   1: right (between corners 1 and 2)
 *   2: top (between corners 2 and 3)
 *   3: left (between corners 3 and 0)
 *
 * Each entry contains pairs of edge indices [edge1, edge2, edge3, edge4, ...]
 * representing line segments to draw.
 */

export const MARCHING_SQUARES_EDGES: number[][] = [
  // 0: 0000 - all outside
  [],

  // 1: 0001 - corner 0 inside
  [3, 0],

  // 2: 0010 - corner 1 inside
  [0, 1],

  // 3: 0011 - corners 0,1 inside
  [3, 1],

  // 4: 0100 - corner 2 inside
  [1, 2],

  // 5: 0101 - corners 0,2 inside (ambiguous case - we use one config)
  [3, 0, 1, 2],

  // 6: 0110 - corners 1,2 inside
  [0, 2],

  // 7: 0111 - corners 0,1,2 inside
  [3, 2],

  // 8: 1000 - corner 3 inside
  [2, 3],

  // 9: 1001 - corners 0,3 inside
  [2, 0],

  // 10: 1010 - corners 1,3 inside (ambiguous case - we use one config)
  [0, 1, 2, 3],

  // 11: 1011 - corners 0,1,3 inside
  [2, 1],

  // 12: 1100 - corners 2,3 inside
  [1, 3],

  // 13: 1101 - corners 0,2,3 inside
  [1, 0],

  // 14: 1110 - corners 1,2,3 inside
  [0, 3],

  // 15: 1111 - all inside
  []
];
