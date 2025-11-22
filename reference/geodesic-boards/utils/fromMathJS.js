/**
 * Turn a Math.js AST node directly into a JS function.
 *
 * Added: support for constants π, e, τ, √2, √3, √½, ln 2, ln 10, log₂ e, log₁₀ e, φ
 *        (case-insensitive; feel free to extend `constantMap`).
 */
export function fromMathJS(
    node,
    { vars = ['x','y'], params = [], paramsObj = {} } = {}
) {

    const vSet = new Set(vars);
    const pSet = new Set(params);

    /* ──────────────────────────────────────────────────────────────
     * Constants recognised in SymbolNodes
     * ────────────────────────────────────────────────────────────── */
    const constantMap = {
        pi      : 'Math.PI',
        tau     : '2*Math.PI',
        e       : 'Math.E',
        sqrt2   : 'Math.sqrt(2)',
        sqrt3   : 'Math.sqrt(3)',
        phi     : '(1+Math.sqrt(5))/2',
    };

    function gen(n) {

        /* numeric literal ------------------------------------------------ */
        if (n.isConstantNode) {
            return String(n.value);
        }

        /* parentheses ---------------------------------------------------- */
        if (n.isParenthesisNode) {
            return `(${gen(n.content)})`;
        }

        /* variables, parameters, or named constants --------------------- */
        if (n.isSymbolNode) {
            const name = n.name;
            if (vSet.has(name)) return name;                 // independent var
            if (pSet.has(name)) return `paramsObj.${name}`;  // parameter
            const key = name.toLowerCase();                  // constant?
            if (key in constantMap) return constantMap[key];
            throw new Error(`Unrecognised symbol “${name}” in expression`);
        }

        /* operators: + − * / ^ ------------------------------------------ */
        if (n.isOperatorNode) {
            const [L, R] = n.args;
            if (n.fn === 'unaryMinus') return `(-${gen(L)})`;
            const op = n.op === '^' ? '**' : n.op;
            return `(${gen(L)} ${op} ${gen(R)})`;
        }

        /* function calls: sin, cos, … ----------------------------------- */
        if (n.isFunctionNode) {
            const nameMap = {
                sin:   'Math.sin',   cos:   'Math.cos', tan:   'Math.tan',
                asin:  'Math.asin',  acos:  'Math.acos', atan:  'Math.atan',
                atan2: 'Math.atan2', exp:   'Math.exp',  log:   'Math.log',
                log10:'Math.log10',  sqrt:  'Math.sqrt', abs:   'Math.abs',
                ceil:  'Math.ceil',  floor: 'Math.floor',round: 'Math.round',
                max:   'Math.max',   min:   'Math.min',
            };
            const fn   = n.name;
            const jsFn = nameMap[fn] || `Math.${fn}`;
            const args = n.args.map(gen).join(', ');
            return `${jsFn}(${args})`;
        }

        /* array / object accessor --------------------------------------- */
        if (n.isAccessorNode) {
            return `${gen(n.object)}[${gen(n.index)}]`;
        }

        /* fall back to node.toString() ---------------------------------- */
        if (typeof n.toString === 'function') return n.toString();

        throw new Error(`Unsupported node type: ${n.type}`);
    }

    /* emit function ----------------------------------------------------- */
    const expr   = gen(node);
    const fnArgs = ['paramsObj', ...vars];
    const fnBody = `return ${expr};`;
    const raw    = new Function(...fnArgs, fnBody);

    /* bind paramsObj so caller supplies just the variables */
    return raw.bind(null, paramsObj);
}
