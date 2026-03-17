import {Curve,Vector3} from "three";

class CircleCurve extends Curve {
    constructor(startAngle=0,endAngle=2*Math.PI,scale=1) {
        super();

        this.startAngle=startAngle;
        this.endAngle=endAngle;
        this.scale=scale;

    }

    getPoint( t, optionalTarget = new Vector3() ) {

        const point = optionalTarget;

        let deltaAngle = this.aEndAngle - this.aStartAngle;
        let x = this.scale*Math.cos(this.startAngle + t*deltaAngle);
        let z = this.scale*Math.sin(this.startAngle + t*deltaAngle);

        return point.set( x, 0 , z);
    }

    copy( source ) {

        super.copy( source );

        this.scale = source.scale;

        this.startAngle = source.startAngle;
        this.endAngle = source.endAngle;

        return this;

    }

}


export default CircleCurve;
