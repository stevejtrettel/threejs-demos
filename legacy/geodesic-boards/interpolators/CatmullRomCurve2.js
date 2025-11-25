// CatmullRomCurve2 — Catmull–Rom spline for Vector2
// ---------------------------------------------------
// Lightweight 2‑D analogue of THREE.CatmullRomCurve3.  We deliberately DO NOT
// extend THREE.Curve, because that base class mixes‑in helpers (Frenet frames,
// cross products, etc.) that assume 3‑D vectors.  Here we expose only:
//   • constructor( points [, { closed, curveType, tension } ] )
//   • getPoint( t )          – Vector2 at t ∈ [0,1]
//   • getSpacedPoints( n )   – n samples including endpoints (→ n‑1 segments)
//   • getLength(), getLengths()  – arc‑length utilities (sampling based)
//
// Supports the usual Catmull–Rom parameterisations:
//   • 'uniform'   (τ = 0)   – may overshoot, uses user‑supplied tension
//   • 'centripetal' (τ = 0.5) – default, good general‑purpose choice
//   • 'chordal'   (τ = 1)
// and optional closed loops.

import { Vector2 } from 'three';

export default class CatmullRomCurve2 {

    /**
     * @param {Array<Vector2 | [number,number]>} points
     * @param {Object}  [options]
     * @param {boolean} [options.closed=false]
     * @param {'uniform'|'centripetal'|'chordal'} [options.curveType='centripetal']
     * @param {number}  [options.tension=0.5]   // only for 'uniform' type
     */
    constructor( points, { closed = false, curveType = 'centripetal', tension = 0.5 } = {} ) {

        // normalise to Vector2 instances ----------------------------------
        this.points  = points.map( p => ( p && p.isVector2 ? p.clone() : new Vector2( ...p ) ) );
        this.closed  = closed;
        this.type    = curveType;
        this.tension = tension;   // applicable only when type === 'uniform'

        if ( this.points.length < 2 ) {
            throw new Error( 'CatmullRomCurve2 requires at least two control points.' );
        }
    }

    // ─────────────────────────────────────────────────────────────────────
    // Static helper — interpolate 4 control points at local parameter u.
    // Uses centripetal/chordal re‑parameterisation when K ≠ 0;
    // falls back to classic uniform Catmull–Rom when K = 0.
    // --------------------------------------------------------------------
    static #interpolate( p0, p1, p2, p3, u, K, tension ) {

        // ---------- Classic uniform Catmull–Rom -------------------------
        if ( K === 0 ) {
            const s  = ( 1 - tension ) / 2;  // tension→ slope scaling
            const u2 = u * u;
            const u3 = u2 * u;

            const b1 = -s  * u3 + 2*s * u2 - s * u;
            const b2 = ( 2 - s ) * u3 + ( s - 3 ) * u2 + 1;
            const b3 = ( s - 2 ) * u3 + ( 3 - 2*s ) * u2 + s * u;
            const b4 =   s * u3 - s * u2;

            return new Vector2()
                .addScaledVector( p0, b1 )
                .addScaledVector( p1, b2 )
                .addScaledVector( p2, b3 )
                .addScaledVector( p3, b4 );
        }

        // ---------- Centripetal / Chordal parameterisation --------------
        let dt0 = Math.pow( p0.distanceTo( p1 ), K );
        let dt1 = Math.pow( p1.distanceTo( p2 ), K );
        let dt2 = Math.pow( p2.distanceTo( p3 ), K );

        // Guard against coincident points (zero length chords)
        const eps = 1e-4;
        if ( dt1 < eps ) dt1 = 1;
        if ( dt0 < eps ) dt0 = dt1;
        if ( dt2 < eps ) dt2 = dt1;

        // Tangents (finite‑difference Hermite form)
        const t1 = new Vector2()
            .addScaledVector( p2, -dt0 )
            .addScaledVector( p1,  dt0 + dt1 )
            .addScaledVector( p0, -dt1 )
            .divideScalar( dt0 * dt1 );

        const t2 = new Vector2()
            .addScaledVector( p3, -dt1 )
            .addScaledVector( p2,  dt1 + dt2 )
            .addScaledVector( p1, -dt2 )
            .divideScalar( dt1 * dt2 );

        // Hermite basis blending
        const u2 = u * u;
        const u3 = u2 * u;

        const h00 =  2*u3 - 3*u2 + 1;
        const h10 =      u3 - 2*u2 + u;
        const h01 = -2*u3 + 3*u2;
        const h11 =      u3 -   u2;

        return new Vector2()
            .addScaledVector( p1, h00 )
            .addScaledVector( t1, h10 )
            .addScaledVector( p2, h01 )
            .addScaledVector( t2, h11 );
    }

    // --------------------------------------------------------------------
    // Public API
    // --------------------------------------------------------------------

    /** Return position at global parameter t ∈ [0,1]. */
    getPoint( t ) {
        const pts = this.points;
        const l   = pts.length;
        const segCount = this.closed ? l : l - 1; // number of curve segments

        // Map global t to segment index i and local parameter u
        const s = t * segCount;      // s ∈ [0, segCount]
        let   i = Math.floor( s );
        let   u = s - i;

        if ( i >= segCount ) { i = segCount - 1; u = 1; } // clamp upper end

        // Helper: index with wrapping for closed curves
        const idx = k => ( this.closed ? ( ( k % l + l ) % l ) : Math.min( Math.max( k, 0 ), l - 1 ) );

        const p0 = pts[ idx( i - 1 ) ];
        const p1 = pts[ idx( i     ) ];
        const p2 = pts[ idx( i + 1 ) ];
        const p3 = pts[ idx( i + 2 ) ];

        const K = ( this.type === 'centripetal' ) ? 0.5 : ( this.type === 'chordal' ? 1 : 0 );

        return CatmullRomCurve2.#interpolate( p0, p1, p2, p3, u, K, this.tension );
    }

    /** Return an array of n evenly‑spaced samples including endpoints. */
    getSpacedPoints( n = 64 ) {
        const samples = new Array( n );
        const step = 1 / ( n - 1 );
        for ( let i = 0; i < n; ++i ) {
            samples[ i ] = this.getPoint( i * step );
        }
        return samples;
    }

    /** Approximate total length by sampling (simple but effective). */
    getLength( divisions = 200 ) { return this.getLengths( divisions ).pop(); }

    /** Return cumulative arc‑lengths array. */
    getLengths( divisions = 200 ) {
        const pts = this.getSpacedPoints( divisions );
        const len = [ 0 ];
        for ( let i = 1; i < pts.length; ++i ) {
            len[ i ] = len[ i - 1 ] + pts[ i ].distanceTo( pts[ i - 1 ] );
        }
        return len;
    }
}
