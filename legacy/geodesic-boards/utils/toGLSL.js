import { parse } from 'mathjs';

/**
 * Convert a Math-JS node (or expression string) to a GLSL expression
 * that is side-effect free and has explicit evaluation order.
 *
 * @param {string | import('mathjs').MathNode} expr
 * @returns {string}
 */
export function toGLSL(expr) {
    const node = typeof expr === 'string' ? parse(expr) : expr;

    switch (node.type) {

        /* ----------------------------------------------------------
         *  Explicit parentheses supplied by the user
         * -------------------------------------------------------- */
        case 'ParenthesisNode':
            return `(${toGLSL(node.content)})`;

        /* ----------------------------------------------------------
         *  Operators
         * -------------------------------------------------------- */
        case 'OperatorNode': {
            const args = node.args.map(toGLSL);
            const op   = node.op;

            // ^  ────────────────────────────────────────────────────
            if (op === '^') {
                const base      = args[0];
                const exponent  = node.args[1];

                if (exponent.type === 'ConstantNode') {
                    const n = Number(exponent.value);
                    if (Number.isInteger(n) && n >= 0 && n <= 3) {
                        /* inline small powers to avoid a function call */
                        return (
                            n === 0 ? '1.0' :
                                n === 1 ? base  :
                                    n === 2 ? `(${base}*${base})` :
                                        `(${base}*${base}*${base})`
                        );
                    }
                }
                return `pow(${base}, ${args[1]})`;
            }

            // % / mod ───────────────────────────────────────────────
            if (op === '%' || op === 'mod') return `mod(${args[0]}, ${args[1]})`;

            // logical ───────────────────────────────────────────────
            if (op === 'and') return `(${args[0]} && ${args[1]})`;
            if (op === 'or')  return `(${args[0]} || ${args[1]})`;
            if (op === 'not') return `!${maybeParen(args[0])}`;

            // unary + / −  (mathjs encodes unary ops as single-arg OperatorNode)
            if (args.length === 1) return `${op}${maybeParen(args[0])}`;

            // binary arithmetic or comparison
            //  (includes + − * / < > <= >= == !=)
            return `(${args[0]} ${op} ${args[1]})`;
        }

        /* ----------------------------------------------------------
         *  Function calls
         * -------------------------------------------------------- */
        case 'FunctionNode': {
            // Rename certain functions to their GLSL equivalents
            const RENAME = { atan2: 'atan', ln: 'log', mod: 'mod' };
            const name   = RENAME[node.name] ?? node.name;
            const argStr = node.args.map(toGLSL).join(', ');

            // Special case: log(x, base)  ->  log(x)/log(base)
            if (name === 'log' && node.args.length === 2) {
                const [x, base] = node.args.map(toGLSL);
                return `(log(${x})/log(${base}))`;
            }
            return `${name}(${argStr})`;
        }

        /* ----------------------------------------------------------
         *  Ternary   (a ? b : c)
         * -------------------------------------------------------- */
        case 'ConditionalNode':
            return `(${toGLSL(node.condition)} ? ${toGLSL(node.trueExpr)} : ${toGLSL(node.falseExpr)})`;

        /* ----------------------------------------------------------
         *  Symbols & constants
         * -------------------------------------------------------- */
        case 'SymbolNode':
            if (node.name === 'pi') return '3.141592653589793';
            if (node.name === 'e')  return '2.718281828459045';
            return node.name;

        case 'ConstantNode': {
            let v = node.value.toString();
            if (/^\d+$/.test(v)) v += '.0';          // ensure GLSL float literal
            return v;
        }

        /* ----------------------------------------------------------
         *  Anything else
         * -------------------------------------------------------- */
        default:
            throw new Error(
                `toGLSL: unsupported or unhandled node type "${node.type}".\n` +
                `Node dump: ${JSON.stringify(node, null, 2)}`
            );
    }
}

/* ======================================================================
 *  Helpers
 * ==================================================================== */

/** Add parentheses if the sub-expression already contains an operator */
function maybeParen(s) {
    return /[+\-*/<>!=&|]/.test(s) ? `(${s})` : s;
}
