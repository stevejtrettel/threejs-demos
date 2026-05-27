/**
 * Shared editable 4x4 matrix panel for the coupled-linear demos.
 *
 * The panel sits to the right of the canvas on wide viewports and collapses
 * to a compact strip at the bottom of narrow viewports. Each cell of the
 * upper triangle is a free-text input; the lower triangle mirrors the upper
 * automatically. Eigenvalues, sqrt-eigenvalues, and a positive-definite flag
 * recompute on every keystroke; consumers register an onChange callback.
 */

import { jacobiEig } from './jacobi';

const N = 4;
const POSDEF_TOL = 1e-9;

export interface HState {
  H: number[][];
  isPosDef: boolean;
  eigenvalues: number[];
  eigenvectors: number[][];   // O, columns are eigenvectors
  omega: number[];             // sqrt of eigenvalues, NaN where < 0
}

const DEFAULT_H: number[][] = [
  [1.0,  0.2,  0.15, 0.1 ],
  [0.2,  1.6,  0.2,  0.15],
  [0.15, 0.2,  2.4,  0.2 ],
  [0.1,  0.15, 0.2,  3.2 ],
];

function deepCopy(M: number[][]): number[][] {
  return M.map(row => row.slice());
}

function buildState(H: number[][]): HState {
  const eig = jacobiEig(H);
  const isPosDef = eig.values.every(v => v > POSDEF_TOL);
  const omega = eig.values.map(v => v >= 0 ? Math.sqrt(v) : NaN);
  return {
    H: deepCopy(H),
    isPosDef,
    eigenvalues: eig.values,
    eigenvectors: eig.vectors,
    omega,
  };
}

function fmt(v: number): string {
  if (!Number.isFinite(v)) return '—';
  return (Math.round(v * 100) / 100).toFixed(2);
}

const STYLE = `
  .matrix-panel {
    position: fixed;
    right: 16px;
    top: 50%;
    transform: translateY(-50%);
    font: 13px/1.4 monospace;
    color: #333;
    z-index: 10;
  }
  .matrix-bracket-wrap {
    display: flex;
    align-items: stretch;
    gap: 6px;
  }
  .matrix-bracket {
    flex: 0 0 7px;
    border-style: solid;
    border-color: #8FA3B5;
  }
  .matrix-bracket.left  { border-width: 1.5px 0 1.5px 1.5px; }
  .matrix-bracket.right { border-width: 1.5px 1.5px 1.5px 0; }
  .matrix-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 4px;
    padding: 4px 6px;
    width: min(240px, 28vw);
  }
  .matrix-grid input,
  .matrix-grid .mirror {
    width: 100%;
    padding: 3px 5px;
    font: 13px/1.2 monospace;
    border-radius: 2px;
    box-sizing: border-box;
    text-align: right;
  }
  .matrix-grid input {
    border: 1px solid #c0bdb6;
    background: transparent;
    color: #222;
  }
  .matrix-grid input:focus {
    outline: 1px solid #4A6B8A;
    border-color: #4A6B8A;
    background: rgba(255, 255, 255, 0.55);
  }
  .matrix-grid .mirror {
    border: 1px solid transparent;
    color: #999;
    background: transparent;
  }

  @media (max-width: 700px) {
    .matrix-panel {
      right: 4px;
      left: 4px;
      top: auto;
      bottom: 4px;
      transform: none;
      font-size: 11px;
    }
    .matrix-bracket-wrap { gap: 3px; }
    .matrix-bracket { flex: 0 0 5px; }
    .matrix-grid {
      width: 100%;
      max-width: 220px;
      margin: 0 auto;
      gap: 2px;
      padding: 2px 4px;
    }
    .matrix-grid input,
    .matrix-grid .mirror {
      padding: 1px 3px;
      font-size: 10px;
    }
  }
`;

export interface MatrixPanelHandle {
  readonly state: HState;
  readonly node: HTMLDivElement;
  onChange(cb: (s: HState) => void): () => void;
  appendBelow(node: HTMLElement): void;
}

let styleInjected = false;

export function setupMatrixPanel(): MatrixPanelHandle {
  if (!styleInjected) {
    const styleEl = document.createElement('style');
    styleEl.textContent = STYLE;
    document.head.appendChild(styleEl);
    styleInjected = true;
  }

  const H = deepCopy(DEFAULT_H);
  let state = buildState(H);
  const callbacks: Set<(s: HState) => void> = new Set();

  const panel = document.createElement('div');
  panel.className = 'matrix-panel';

  const wrap = document.createElement('div');
  wrap.className = 'matrix-bracket-wrap';
  panel.appendChild(wrap);

  const bracketLeft = document.createElement('div');
  bracketLeft.className = 'matrix-bracket left';
  wrap.appendChild(bracketLeft);

  const grid = document.createElement('div');
  grid.className = 'matrix-grid';
  wrap.appendChild(grid);

  const bracketRight = document.createElement('div');
  bracketRight.className = 'matrix-bracket right';
  wrap.appendChild(bracketRight);

  const inputs: (HTMLInputElement | null)[][] = Array.from({ length: N }, () => new Array(N).fill(null));
  const mirrors: (HTMLDivElement | null)[][] = Array.from({ length: N }, () => new Array(N).fill(null));

  for (let i = 0; i < N; i++) {
    for (let j = 0; j < N; j++) {
      if (i <= j) {
        const inp = document.createElement('input');
        inp.type = 'text';
        inp.value = fmt(H[i][j]);
        inp.spellcheck = false;
        inp.addEventListener('input', () => onCellInput(i, j, inp));
        grid.appendChild(inp);
        inputs[i][j] = inp;
      } else {
        const div = document.createElement('div');
        div.className = 'mirror';
        div.textContent = fmt(H[i][j]);
        grid.appendChild(div);
        mirrors[i][j] = div;
      }
    }
  }

  document.body.appendChild(panel);

  function onCellInput(i: number, j: number, inp: HTMLInputElement) {
    const v = parseFloat(inp.value);
    if (!Number.isFinite(v)) return;
    H[i][j] = v;
    if (i !== j) {
      H[j][i] = v;
      const m = mirrors[j][i];
      if (m) m.textContent = fmt(v);
    }
    refresh();
  }

  function refresh() {
    state = buildState(H);
    callbacks.forEach(cb => cb(state));
  }

  return {
    get state() { return state; },
    get node() { return panel; },
    onChange(cb) {
      callbacks.add(cb);
      return () => callbacks.delete(cb);
    },
    appendBelow(node: HTMLElement) {
      panel.appendChild(node);
    },
  };
}
