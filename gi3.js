var GI = function(scene , renderer ,viewCamera){
	
	var SIZE = 32;
	var SIZE2 = SIZE * SIZE;
	var camera = new THREE.PerspectiveCamera( 120, 1, 0.001, 10000 );

	var renderer = renderer;

	var rt = new THREE.WebGLRenderTarget( SIZE, SIZE, {
		wrapS: THREE.ClampToEdgeWrapping,
		wrapT: THREE.ClampToEdgeWrapping,
		stencilBuffer: false,
		depthBuffer: true
	} );

	var meshs = [];

	var bounces = 0;
	var meshIndex = 0 ;
	var currentVertex = 0;

	var clone = new THREE.Scene();
	clone.background = scene.background;

	var i;
	var l = scene.children.length;

	function getMaterial(mat){
		var material = new THREE.MeshBasicMaterial({ vertexColors: THREE.VertexColors});
		if(mat.map) material.map = mat.map;
		if(mat.color) material.color = mat.color;
		return material;
	}
	
	for(i = 0; i < l; i++){
		var object = scene.children[ i ];
		if(object.isMesh){

			var geometry = processGeometry(object);
			var material = getMaterial(object.material);
			
			// object.material = getMaterial(object.material);
			// object.material.vertexColors = THREE.VertexColors;
			var mesh = new THREE.Mesh(geometry, material);
			mesh.position.copy(object.position);
			mesh.rotation.copy(object.rotation);
			mesh.scale.copy(object.scale);
			meshs.push(mesh);
			clone.add(mesh);
		}else if(object.isLight){
			if(object.isPointLight){
				var pointSphere = new THREE.SphereBufferGeometry( 0.02, 32, 32 );
				var pointLightMaterial = new THREE.MeshBasicMaterial({color : object.color.clone().multiplyScalar(object.intensity)});
				var lightShphere = new THREE.Mesh(pointSphere, pointLightMaterial);
				lightShphere.position.copy(object.position);
				mesh.add(lightShphere);
			}else if(object.isDirectionalLight){
				console.log('directional light is not supported');
			}

			object.visible = false;
		}
	}


	// var clone = scene.clone();
	clone.autoUpdate = false;
	clone.updateMatrixWorld(true);

	console.log(clone);

	var normalMatrix = new THREE.Matrix3();

	var position = new THREE.Vector3();
	var normal = new THREE.Vector3();

	var bounces = 0;
	var currentVertex = 0;

	var color = new Float32Array( 3 );
	var buffer = new Uint8Array( SIZE2 * 4 );



	function processGeometry(object){
		console.log(object);
		var attributes = object.geometry.attributes;

		var positions = Array.prototype.slice.call(attributes.position.array);
		var normals = Array.prototype.slice.call(attributes.normal.array);
		var uvs = Array.prototype.slice.call(attributes.uv.array);
		// var uv2s = attributes.uv2.array;

		var index = object.geometry.index?Array.prototype.slice.call(object.geometry.index.array):null;

		var newPositions = [];
		var newNormals = [];
		var newUvs = [];

		var positionLength = positions.length / 3;

		var pos1 = new THREE.Vector3();
		var pos2 = new THREE.Vector3();
		var pos3 = new THREE.Vector3();

		var nor1 = new THREE.Vector3();
		var nor2 = new THREE.Vector3();
		var nor3 = new THREE.Vector3();

		var uv1 = new THREE.Vector2();
		var uv2 = new THREE.Vector2();
		var uv3 = new THREE.Vector2();

		var offset1,offset2,offset3;
		var areaWeight;

		var edge1 = new THREE.Vector3();
		var edge2 = new THREE.Vector3();

		var newIndex = [];

		if(index){
			// var length = ;
			var m = 0;
			// for(var n = 0; n < index.length / 3; n++){
			while(index[m] !== undefined){
				// var m = n * 3;
				pos1.fromArray( positions, index[m] * 3 );
				pos2.fromArray( positions, index[m+1] * 3 );
				pos3.fromArray( positions, index[m+2] * 3 );

				nor1.fromArray( normals, index[m] * 3 );
				nor2.fromArray( normals, index[m+1] * 3 );
				nor3.fromArray( normals, index[m+2] * 3 );

				uv1.fromArray( uvs, index[m] * 2 );
				uv2.fromArray( uvs, index[m+1] * 2 );
				uv3.fromArray( uvs, index[m+2] * 2 );

				edge1 = edge1.subVectors(pos2, pos1);
				edge2 = edge2.subVectors(pos3, pos1);
				edge2 = edge2.subVectors(pos3, pos1);

				areaWeight = edge1.cross(edge2).length();

				areaWeight *= object.scale.x * object.scale.y * object.scale.z;



				if(areaWeight > 0.01){

					var n = 1;
					var m = pow(2, n);

					while(areaWeight / m > 0.01){
						n++;
						m = pow(2, n);
					}

					

					var vertex = splitTri({
						position : pos1, normal : nor1, uv : uv1, index : index[m],
					},
					{
						position : pos2, normal : nor2, uv : uv2, index : index[m+1],
					},
					{
						position : pos3, normal : nor3, uv : uv3, index : index[m+2],
					});
					
					positions.push(vertex.position.x, vertex.position.y, vertex.position.z);
					normals.push(vertex.normal.x, vertex.normal.y, vertex.normal.z);
					uvs.push(vertex.uv.x, vertex.uv.y);

					var positionIndex = positions.length / 3;

					var i1 = index[m];
					var i2 = index[m+1];
					var i3 = index[m+2];


					delete index[m];
					delete index[m+1];
					delete index[m+2];
				}
				m += 3;
			}
		}

		var indices = [];
		for(var i = 0; i < index.length; i++){
			if(index[i] || index[i] === 0){
				indices.push(index[i]);
			}
		}

		var geometry = new THREE.BufferGeometry();

		indices = new Uint16Array( indices );
		
		geometry.addAttribute( 'position', new THREE.BufferAttribute( new Float32Array( positions ), 3 ) );
		geometry.addAttribute( 'normal', new THREE.BufferAttribute( new Float32Array( normals ), 3 ) );
		geometry.addAttribute( 'uv', new THREE.BufferAttribute( new Float32Array( uvs ), 2 ) );

		geometry.setIndex(new THREE.BufferAttribute( indices, 1 ));

		return geometry;
	}


	function splitTri(vertex1, vertex2, vertex3){
	
		var newPosition = new THREE.Vector3(
			( vertex2.position.x + vertex3.position.x ) / 2,
			( vertex2.position.y + vertex3.position.y ) / 2,
			( vertex2.position.z + vertex3.position.z ) / 2,
		);

		var newNormal = new THREE.Vector3((vertex2.normal.x + vertex3.normal.x) / 2, (vertex2.normal.y + vertex3.normal.y) / 2, (vertex2.normal.z + vertex3.normal.z) / 2).normalize();
		var newUv = new THREE.Vector2( (vertex2.uv.x + vertex3.uv.x) / 2, (vertex2.uv.y + vertex3.uv.y) /2 );
		
		return {
			position : newPosition,
			normal : newNormal,
			uv : newUv,
		}
		
	}

	


	function compute(){
		if ( bounces === 3 ) {
			console.log('end');
			// end = Date.now();
			// console.log( (end - begin ) / 1000 );
			animate();
			return;
		}

		var object = meshs[ meshIndex ];
		var geometry = object.geometry;

		var attributes = geometry.attributes;
		var positions = attributes.position.array;
		var normals = attributes.normal.array;

		if ( attributes.color === undefined ) {

			var colors = new Float32Array( positions.length );
			geometry.addAttribute( 'color', new THREE.BufferAttribute( colors, 3 ).setDynamic( true ) );

		}

		var colors = attributes.color.array;

		var startVertex = currentVertex;
		var totalVertex = positions.length / 3;

		for ( var i = 0; i < 32; i ++ ) {

			if ( currentVertex >= totalVertex ) break;

			position.fromArray( positions, currentVertex * 3 );
			position.applyMatrix4( object.matrixWorld );

			normal.fromArray( normals, currentVertex * 3 );
			normal.applyMatrix3( normalMatrix.getNormalMatrix( object.matrixWorld ) ).normalize();

			camera.position.copy( position );
			camera.lookAt( position.add( normal ) );

			renderer.render( clone, camera, rt);
			// renderer.render( clone, camera);
			// return;
			renderer.readRenderTargetPixels( rt, 0, 0, SIZE, SIZE, buffer );

			color[ 0 ] = 0;
			color[ 1 ] = 0;
			color[ 2 ] = 0;

			for ( var k = 0, kl = buffer.length; k < kl; k += 4 ) {

				color[ 0 ] += buffer[ k + 0 ];
				color[ 1 ] += buffer[ k + 1 ];
				color[ 2 ] += buffer[ k + 2 ];

			}

			colors[ currentVertex * 3 + 0 ] = color[ 0 ] / ( SIZE2 * 255 );
			colors[ currentVertex * 3 + 1 ] = color[ 1 ] / ( SIZE2 * 255 );
			colors[ currentVertex * 3 + 2 ] = color[ 2 ] / ( SIZE2 * 255 );

			currentVertex ++;

		}

		attributes.color.updateRange.offset = startVertex * 3;
		attributes.color.updateRange.count = ( currentVertex - startVertex ) * 3;
		attributes.color.needsUpdate = true;

		if ( currentVertex >= totalVertex ) {
			if(meshIndex === meshs.length - 1){

				bounces ++;
				meshIndex = 0;
			}else{
				meshIndex++;
			}

			currentVertex = 0;

		}

		requestAnimationFrame( compute );

		renderer.render( clone, viewCamera );
	}

	requestAnimationFrame( compute );
	

	function animate(){
		requestAnimationFrame( animate );
		renderer.render( clone, viewCamera );
	}
}

