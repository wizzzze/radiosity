var Radiosity = function(scene , renderer ,viewCamera){
	this.patchThreshold = 0.001;
	
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
	
	console.log(clone);
	for(i = 0; i < l; i++){
		var object = scene.children[ i ];
		if(object.isMesh){


			var geometry = this.processGeometry(object);
			var material = getMaterial(object.material);
			// if(i == 3){
			// 	console.log(object.geometry);
			// 	console.log(geometry);
			// 	throw 123;
			// }

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
				clone.add(lightShphere);
			}else if(object.isDirectionalLight){
				console.log('directional light is not supported');
			}

			object.visible = false;
		}
	}


	//TMP
	var pointSphere = new THREE.SphereBufferGeometry( 0.02, 32, 32 );
	var pointLightMaterial = new THREE.MeshBasicMaterial({color : 0xffffff});
	var lightShphere = new THREE.Mesh(pointSphere, pointLightMaterial);
	lightShphere.position.set(0, 2.5, 0);
	clone.add(lightShphere);


	clone.autoUpdate = false;
	clone.updateMatrixWorld(true);


	var normalMatrix = new THREE.Matrix3();

	var position = new THREE.Vector3();
	var normal = new THREE.Vector3();

	var bounces = 0;
	var currentVertex = 0;

	var color = new Float32Array( 3 );
	var buffer = new Uint8Array( SIZE2 * 4 );

	var begin = Date.now();


	function compute(){
		if ( bounces === 3 ) {
			console.log('end');
			console.log(clone);
			end = Date.now();
			console.log( (end - begin ) / 1000 );
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



Radiosity.prototype = {
	processGeometry : function(object){

		if(!object.geometry.index){
			return object.geometry;
		}

		var attributes = object.geometry.attributes;
		var geometry = new THREE.BufferGeometry();

		this.positions = Array.prototype.slice.call(attributes.position.array);
		this.normals = Array.prototype.slice.call(attributes.normal.array);
		this.uvs = Array.prototype.slice.call(attributes.uv.array);
		// var uv2s = attributes.uv2.array;

		this.index = object.geometry.index?Array.prototype.slice.call(object.geometry.index.array):null;

		this.newVertexLookUpTable = [];

		var newPositions = [];
		var newNormals = [];
		var newUvs = [];


		var newIndices = [];
		var indexOffset = this.positions.length / 3 - 1;

		var pos1,pos2,pos3;

		var areaWeight;

		var edge1 = new THREE.Vector3();
		var edge2 = new THREE.Vector3();


		if(this.index){
			for(var n = 0; n < this.index.length / 3; n++){
				var m = n * 3;

				pos1 = new Float32Array([this.positions[this.index[m] * 3], this.positions[this.index[m] * 3 + 1], this.positions[this.index[m] * 3 + 2]]);
				pos2 = new Float32Array([this.positions[this.index[m + 1] * 3], this.positions[this.index[m + 1] * 3 + 1], this.positions[this.index[m + 1] * 3 + 2]]);
				pos3 = new Float32Array([this.positions[this.index[m + 2] * 3], this.positions[this.index[m + 2] * 3 + 1], this.positions[this.index[m + 2] * 3 + 2]]);


				edge1.set(
					this.positions[this.index[m + 1] * 3] - this.positions[this.index[m] * 3], 
					this.positions[this.index[m + 1] * 3 + 1] - this.positions[this.index[m] * 3 + 1], 
					this.positions[this.index[m + 1] * 3 + 2] - this.positions[this.index[m] * 3 + 2]
				);
				edge2.set(
					this.positions[this.index[m + 2] * 3] - this.positions[this.index[m] * 3], 
					this.positions[this.index[m + 2] * 3 + 1] - this.positions[this.index[m] * 3 + 1], 
					this.positions[this.index[m + 2] * 3 + 2] - this.positions[this.index[m] * 3 + 2]
				);

				areaWeight = edge1.cross(edge2).length();
				areaWeight *= object.scale.x * object.scale.y * object.scale.z;

				if(areaWeight > this.patchThreshold){

					var triangles = this.splitTris(
						[
							[this.index[m], this.index[m+1], this.index[m+2]],
						],areaWeight
					);
					
					for(var j = 0; j < triangles.length; j ++){
						newIndices.push(triangles[j][0], triangles[j][1], triangles[j][2]);
					}
				}else{
					newIndices.push(this.index[m], this.index[m+1], this.index[m+2]);
				}
			}
			indices = new Uint16Array( newIndices );
		
			geometry.addAttribute( 'position', new THREE.BufferAttribute( new Float32Array( this.positions ), 3 ) );
			geometry.addAttribute( 'normal', new THREE.BufferAttribute( new Float32Array( this.normals ), 3 ) );
			geometry.addAttribute( 'uv', new THREE.BufferAttribute( new Float32Array( this.uvs ), 2 ) );

			geometry.setIndex(new THREE.BufferAttribute( indices, 1 ));
		}else{
			
		}

		

		

		return geometry;
	},

	splitTris : function(tris, weight){
		var newTriangles = [];
		var tempTriangles = [];

		for(var i = 0; i < tris.length; i++){
			var tri = tris[i];
			var newVerteices = [];
			for(var n = 0; n < 3; n++){
				var index1 = n;
				var index2 = n + 1 >= 3 ? 0 : n + 1;

				var vertexIndex1 = tri[index1];
				var vertexIndex2 = tri[index2];

				var lookUpIndex1,lookUpIndex2;

				if(vertexIndex1 > vertexIndex2){
					lookUpIndex1 = vertexIndex2;
					lookUpIndex2 = vertexIndex1;
				}else{
					lookUpIndex1 = vertexIndex1;
					lookUpIndex2 = vertexIndex2;
				}
				var newVertex;
				if(this.newVertexLookUpTable[lookUpIndex1] && this.newVertexLookUpTable[lookUpIndex1][lookUpIndex2]){
					newVertex = this.newVertexLookUpTable[lookUpIndex1][lookUpIndex2];
				}else{
					newVertex = this.genNewVertex(vertexIndex1, vertexIndex2);
				}
				newVerteices.push(newVertex);
			}
			var newWeight = weight / 4;

			tempTriangles = [
				[ tri[0], newVerteices[0], newVerteices[2] ],
				[ newVerteices[0], tri[1], newVerteices[1] ],
				[ newVerteices[0], newVerteices[1], newVerteices[2] ],
				[ newVerteices[2], newVerteices[1], tri[2] ],
			];
			

			if(newWeight > this.patchThreshold){
				var result = this.splitTris(tempTriangles, newWeight);
				for(var m = 0; m < result.length; m++){
					newTriangles.push(result[m]);
				}
			}else{
				newTriangles.push(tempTriangles[0], tempTriangles[1], tempTriangles[2],  tempTriangles[3]);
			}
		
		}

		return  newTriangles;
	},


	genNewVertex : function(i1, i2){
		this.positions.push(
			(this.positions[i1 * 3] + this.positions[i2 * 3]) / 2, 
			(this.positions[i1 * 3 + 1] + this.positions[i2 * 3 + 1]) / 2, 
			(this.positions[i1 * 3 + 2] + this.positions[i2 * 3 + 2]) / 2
		);

		this.normals.push(
			(this.normals[i1 * 3] + this.normals[i2 * 3]) / 2,
			(this.normals[i1 * 3 + 1] + this.normals[i2 * 3 + 1]) / 2, 
			(this.normals[i1 * 3 + 2] + this.normals[i2 * 3 + 2]) / 2
		);

		this.uvs.push(
			(this.uvs[i1 * 2] + this.uvs[i2 * 2]) / 2,
			(this.uvs[i1 * 2 + 1] + this.uvs[i2 * 2 + 1]) / 2, 
		);

		var index = this.positions.length / 3 - 1;

		if(i1 < i2){
			if(!this.newVertexLookUpTable[i1]){
				this.newVertexLookUpTable[i1] = {};	
			}
			this.newVertexLookUpTable[i1][i2] = index;
		}else{
			if(!this.newVertexLookUpTable[i2]){
				this.newVertexLookUpTable[i2] = {};	
			}
			this.newVertexLookUpTable[i2][i1] = index;
		}

		return index;

	}
}