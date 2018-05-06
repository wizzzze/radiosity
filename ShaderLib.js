var ShaderLib = {
	vertex : `

precision highp float;
precision highp int;

attribute vec2 uv2;

varying vec2 vUv2;
varying vec3 vPosition;
varying vec3 vNormal;
varying vec2 vUv;


void main(){
	vUv2 = uv2;
	vPosition = (modelMatrix * vec4(position, 1.)).xyz;
	// vPosition = position;
	vNormal =  normalize(normalMatrix * normal);
	vUv = uv;
	vec2 pos = uv2 * 2. - 1.;
	gl_Position = vec4(pos, 0., 1.);
}
	`,

	position : `
precision highp float;
precision highp int;

varying vec3 vPosition;

const float DIST_MAX = 150.;

void main(){
	gl_FragColor = vec4(((vPosition + DIST_MAX) /( DIST_MAX * 2.) ), 0.);
}
	`,

	normal : `
precision highp float;
precision highp int;
precision highp sampler2D;


const float DIST_MAX = 1000.;

varying vec2 vUv2;
varying vec3 vPosition;
varying	vec3 vNormal;

#ifdef USE_NORMAL_MAP
	
	varying vec2 vUv;
	uniform sampler2D normalMap;
	
#endif

void main(){

	vec3 nor = vNormal;

	#ifdef USE_NORMAL_MAP
		nor = texture2D(normalMap, vUv).xyz * 2. - 1.;
		nor = normalize(normalMatrix * nor);

	#endif

	nor = (nor + 1.) / 2.;

    gl_FragColor = vec4(nor, 0.);
}
	`,


	renderVertexShader : `
		
	`,
};