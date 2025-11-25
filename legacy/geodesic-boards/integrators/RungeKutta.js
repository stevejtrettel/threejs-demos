/* GeodesicIntegrator.js ------------------------------------------- */
import { Vector2 } from 'three';
import TangentVector from "../diffgeo/TangentVector.js";

export default class RungeKutta {

    //acc: TangentVector → Vector2  -- the geodesic acceleration
    constructor( acc, eps = 0.01 ) {
        this.acc = acc;
        this.eps = eps;
    }

    /** single RK-4 step   s  →  s′   */
    step( s ) {

        const h = this.eps;

        // --- k1  ------------------------------------------------------
        const k1_pos = s.vel.clone();          // du/dt , dv/dt
        const k1_vel = this.acc( s ).clone();  // ü , v̈

        // --- k2 -------------------------------------------------------
        const s2 = s.clone();
        s2.pos.addScaledVector( k1_pos, 0.5*h );
        s2.vel.addScaledVector( k1_vel, 0.5*h );

        const k2_pos = s2.vel.clone();
        const k2_vel = this.acc( s2 ).clone();

        // --- k3 -------------------------------------------------------
        const s3 = s.clone();
        s3.pos.addScaledVector( k2_pos, 0.5*h );
        s3.vel.addScaledVector( k2_vel, 0.5*h );

        const k3_pos = s3.vel.clone();
        const k3_vel = this.acc( s3 ).clone();

        // --- k4 -------------------------------------------------------
        const s4 = s.clone();
        s4.pos.addScaledVector( k3_pos, h );
        s4.vel.addScaledVector( k3_vel, h );

        const k4_pos = s4.vel.clone();
        const k4_vel = this.acc( s4 ).clone();

        // --- combine --------------------------------------------------
        const posInc = new Vector2()
            .addScaledVector( k1_pos, 1 )
            .addScaledVector( k2_pos, 2 )
            .addScaledVector( k3_pos, 2 )
            .addScaledVector( k4_pos, 1 )
            .multiplyScalar( h / 6 );

        const velInc = new Vector2()
            .addScaledVector( k1_vel, 1 )
            .addScaledVector( k2_vel, 2 )
            .addScaledVector( k3_vel, 2 )
            .addScaledVector( k4_vel, 1 )
            .multiplyScalar( h / 6 );

        return new TangentVector(
            s.pos.clone().add( posInc ),
            s.vel.clone().add( velInc )
        );
    }

    /** integrate for *n* steps (convenience) */
    integrate( state, n = 1 ) {
        let s = state;
        for ( let i = 0; i < n; ++i ) s = this.step( s );
        return s;
    }
}
