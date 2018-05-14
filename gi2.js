var GI = function(scene , renderer, camera){

	this.camera2 = camera;
	this.SIZE = 32;
	this.SIZE2 = this.SIZE * this.SIZE;
	this.camera = new THREE.PerspectiveCamera( 120, 1, 0.001, 10000 );
	// this.camera.position.set(0,0,5);

	// this.camera.lookAt(0, 0, 0);

	this.renderCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10000);
	this.renderCamera.position.set( 0, 0, 100 );
	this.renderCamera.lookAt(0, 0, 0);

	this.scene = scene.clone();

	this.renderScene = new THREE.Scene();
	// this.renderScene.autoUpdate = false;

	this.renderScene.background = new THREE.Color(1,1,1);

	this.renderer = renderer;

	this.rt = new THREE.WebGLRenderTarget( this.SIZE, this.SIZE, {
		wrapS: THREE.ClampToEdgeWrapping,
		wrapT: THREE.ClampToEdgeWrapping,
		magFilter: THREE.NearestFilter,
		minFilter: THREE.NearestFilter,
		format: THREE.RGBAFormat,
		type: THREE.FloatType,
		stencilBuffer: false,
		depthBuffer: true
	} );

	this.bounces = 0;
	this.meshIndex = 0;
	this.meshs = [];

	this.triangles = [];
	this.currentIndex = 0;

	var i;
	var l = scene.children.length;

	this.uv2 = new UV2();
	for(var i = 0; i < l ; i ++){
		var child = scene.children[i];
		if(child == undefined) continue;
		if(child.isMesh){
			//gen uv2
			this.uv2.addUV2(child);

			var renderMesh = child.clone();
			
			this.meshs.push(renderMesh);
			this.renderScene.add(renderMesh);

		}else if(child.isLight){
			if(child.isPointLight){
				var pointSphere = new THREE.SphereBufferGeometry( 0.02, 32, 32 );
				var lightColor = child.color.clone().multiplyScalar(child.intensity);

				var pointLightMaterial = new THREE.MeshBasicMaterial({
					color : lightColor,
				});
				var newObject = new THREE.Mesh(pointSphere, pointLightMaterial);
				newObject.position.copy(child.position);
				// this.lights.push(newObject);
				this.renderScene.add(newObject);
			}else if(child.isDirectionalLight){
				console.log('directional light is not supported');
			}

		}
	}

	this.renderScene.updateMatrixWorld(true);

	console.log(this.renderScene);

	this.uv2.uvWrap();

	this.width = this.uv2.mapWidth;
	this.height = this.uv2.mapHeight;

	this.length = this.width * this.height;

	this.positions = new Array(this.width * this.height);

	this.lightBuffer = new Float32Array( this.SIZE2 * 4 );
	this.lightsData = new Float32Array(this.length * 4);
	this.lightMapTexture = new THREE.DataTexture(this.lightsData,  this.width, this.height, THREE.RGBAFormat, THREE.FloatType);

}


GI.prototype = {

	genTris : function(){
		for(var i = 0, l = this.meshs.length; i < l; i++ ){
			var object = this.meshs[i];
			if(object instanceof THREE.Geometry){
				throw 'THREE.Geometry is not supported';
			}
			var geometry = object.geometry;

			var normalMatrix = new THREE.Matrix3();
			normalMatrix = normalMatrix.getNormalMatrix( object.matrixWorld );

			var attributes = geometry.attributes;
			var positions = attributes.position.array;
			var normals = attributes.normal.array;
			var uv2s = attributes.uv2.array;

			var index = geometry.index?geometry.index.array:null;

			var pos1 = new THREE.Vector3();
			var pos2 = new THREE.Vector3();
			var pos3 = new THREE.Vector3();

			var nor1 = new THREE.Vector3();
			var nor2 = new THREE.Vector3();
			var nor3 = new THREE.Vector3();

			var uv21 = new THREE.Vector2();
			var uv22 = new THREE.Vector2();
			var uv23 = new THREE.Vector2();

			var offset1,offset2,offset3;
			var areaWeight;

			var edge1 = new THREE.Vector3();
			var edge2 = new THREE.Vector3();


			if(index){
				var length = index.length / 3;
				for(var n = 0; n < length; n++){
					var m = n * 3;
					pos1.fromArray( positions, index[m] * 3 );
					pos1.applyMatrix4( object.matrixWorld );
					
					pos2.fromArray( positions, index[m+1] * 3 );
					pos2.applyMatrix4( object.matrixWorld );

					pos3.fromArray( positions, index[m+2] * 3 );
					pos3.applyMatrix4( object.matrixWorld );


					nor1.fromArray( normals, index[m] * 3 );
					nor1.applyMatrix3(normalMatrix);
					nor2.fromArray( normals, index[m+1] * 3 );
					nor2.applyMatrix3(normalMatrix);
					nor3.fromArray( normals, index[m+2] * 3 );
					nor3.applyMatrix3(normalMatrix);

					uv21.fromArray( uv2s, index[m] * 2 );
					uv22.fromArray( uv2s, index[m+1] * 2 );
					uv23.fromArray( uv2s, index[m+2] * 2 );


					edge1 = edge1.subVectors(pos2, pos1);
					edge2 = edge2.subVectors(pos3, pos1);

					areaWeight = edge1.cross(edge2).lengthSq();

					offset1 = Math.floor(( Math.floor(uv21.y * this.height) * this.width) + uv21.x * this.width);
					
					offset2 = Math.floor(( Math.floor(uv22.y * this.height) * this.width) + uv22.x * this.width);
					offset3 = Math.floor(( Math.floor(uv23.y * this.height) * this.width) + uv23.x * this.width);

					this.triangles.push({
						position : [[pos1.x, pos1.y, pos1.z], [pos2.x, pos2.y, pos2.z], [pos3.x, pos3.y, pos3.z]],
						normal : [[nor1.x, nor1.y, nor1.z], [nor2.x, nor2.y, nor2.z], [nor3.x, nor3.y, nor3.z]],
						uv2 : [[uv21.x, uv21.y], [uv22.x, uv22.y], [uv23.x, uv23.y]],
						offset: [offset1, offset2, offset3],
						weight : areaWeight,
					});
					
				}
			}else{
				
			}
		}

		// console.log(this.triangles);throw 123;


	},
	reorganizeTris : function(){
		// var i = 0;
		for(var i = 0; i < this.triangles.length; i++){
			var tri = this.triangles[i];
			if(tri.weight > 0.001){
				this.rts = this.rts?this.rts+1:1;
				this.splitTri(tri);
				delete this.triangles[i];
			}else{
				this.genSamplePosition(tri);
			}
		}

		this.triangles.sort();
	},
	genSamplePosition : function(tri){
		var positions = this.positions;
		
		for(var i = 0; i < 3; i++){

			if(positions[tri.offset[i]]){
				continue;
			}

			this.positions[tri.offset[i]] = {
				position : tri.position[i],
				normal : tri.normal[i],
				offset : tri.offset[i],
			};
		}
		

	},

	reorganizeSamplePosition : function(){
		var positions = this.positions;
		this.positions = [];
		for(var i = 0, l = positions.length; i < l; i++){
			if(positions[i]){
				this.positions.push(positions[i]);
			}
		}
	},
	splitTri : function(tri){

		var newPoint = new THREE.Vector3(
			( tri.position[1][0] + tri.position[2][0]) / 2,
			( tri.position[1][1] + tri.position[2][1]) / 2,
			( tri.position[1][2] + tri.position[2][2]) / 2,
		);

		var edge1 = new THREE.Vector3(newPoint.x - tri.position[0][0], newPoint.y - tri.position[0][1], newPoint.z - tri.position[0][2]);
		var edge2 = new THREE.Vector3(newPoint.x - tri.position[1][0], newPoint.y - tri.position[1][1], newPoint.z - tri.position[1][2]);
		var edge3 = new THREE.Vector3(newPoint.x - tri.position[2][0], newPoint.y - tri.position[2][1], newPoint.z - tri.position[2][2]);

		var d2 = edge2.length();
		var d3 = edge3.length();

		var sum = d2 + d3;

		var newNormal = new THREE.Vector3();
		newNormal = newNormal.set(
			(tri.normal[1][0] * (d2 / sum) + tri.normal[2][0] * (d3 / sum)),
			(tri.normal[1][1] * (d2 / sum) + tri.normal[2][1] * (d3 / sum)),
			(tri.normal[1][2] * (d2 / sum) + tri.normal[2][2] * (d3 / sum)),
		).normalize();


		var uv2 = new THREE.Vector2(
			(tri.uv2[1][0] * (d2 / sum) + tri.uv2[1][0] * (d3 / sum)),
			(tri.uv2[1][1] * (d2 / sum) + tri.uv2[1][1] * (d3 / sum)),
		);

		var offset = Math.round( Math.round(uv2.y * this.height + 0.5 )* this.width  + uv2.x * this.width + 0.5);


		this.triangles.push(
			{
				position : [[newPoint.x, newPoint.y, newPoint.z], tri.position[0], tri.position[1]],
				normal : [[newNormal.x, newNormal.y, newNormal.z], tri.normal[0], tri.normal[1]],
				uv2 : [[uv2.x, uv2.y], tri.uv2[0], tri.uv2[1]],
				offset: [offset, tri.offset[0], tri.offset[1],],
				weight : edge1.clone().cross(edge2).lengthSq(),
			},
			{
				position : [ [newPoint.x, newPoint.y, newPoint.z], tri.position[0], tri.position[2]],
				normal : [ [newNormal.x, newNormal.y, newNormal.z], tri.normal[0], tri.normal[2]],
				uv2 : [ [uv2.x, uv2.y], tri.uv2[0], tri.uv2[2]],
				offset: [offset, tri.offset[0], tri.offset[2] ],
				weight : edge1.clone().cross(edge3).lengthSq(),
			},
		);


	},


	bake : function(){
		this.begin = Date.now();
		this.beforeBaking();
		var end = Date.now();
		console.log( (end - this.begin ) / 1000 );
		this.genTris();
		this.reorganizeTris();
		this.reorganizeSamplePosition();
		this.compute();
	},

	beforeBaking : function(){
		var self = this;
		function getBakeMaterial(material){
			material.lightMap = self.lightMapTexture;
			material.side = THREE.DoubleSide;
			return material;
		}
		var length = this.meshs.length;
		for(var i = 0; i < length; i++){
			var child = this.meshs[i];
			child.material = getBakeMaterial(child.material);
			child.material.needsUpdate = true;
		}

	},
	afterBaking : function(){
		// var scene = new THREE.Scene();
		// var plane = new THREE.PlaneBufferGeometry(2, 2);

		// var material = new THREE.MeshBasicMaterial({map : this.lightMapTexture});
		// var mesh = new THREE.Mesh(plane, material);
		// scene.add(mesh);

		// this.renderer.render(scene, this.renderCamera);

		this.camera.position.set(0,0,5);
		this.camera.lookAt(0,0,0);
		var controls = new THREE.OrbitControls( this.camera );
		this.render();
	},
	render : function(){
		var self = this;
		this.renderer.render(this.renderScene, this.camera);
		requestAnimationFrame(function(){self.render()});
	},

	compute : function(){

		var self = this;
		if(this.bounces === 3){
			console.log('end');
			var end = Date.now();
			console.log( (end - this.begin ) / 1000 );
			this.afterBaking();
			return;
		}
		var positions = this.positions;

		var samplePosition, offset;

		// var position = new THREE.Vector3();
		var normal = new THREE.Vector3();
		var uv2 = new THREE.Vector2();

		var length = positions.length;
		var color = new Float32Array( 3 );

		for(var i = 0; i < 32; i++){

			if(this.currentIndex >= length)break;
			if(!positions[this.currentIndex]){
				i--;continue
			}

			samplePosition = positions[this.currentIndex];
			offset = samplePosition.offset;
			this.camera.position.fromArray( samplePosition.position );

			// camera.position.copy( samplePosition.position );
			this.camera.lookAt( samplePosition.position[0] + samplePosition.normal[0], samplePosition.position[1] + samplePosition.normal[1], samplePosition.position[2] + samplePosition.normal[2] );
			this.renderer.clear();
			// if(i == 1){
			// 	console.log(this.camera);
			// 	this.renderer.render( this.renderScene, this.camera);
			// 	throw 123;
			// }
			this.renderer.render( this.renderScene, this.camera, this.rt);

			this.renderer.readRenderTargetPixels( this.rt, 0, 0, this.SIZE, this.SIZE, this.lightBuffer );

			color[ 0 ] = 0;
			color[ 1 ] = 0;
			color[ 2 ] = 0;

			for ( var k = 0, kl = this.lightBuffer.length; k < kl; k += 4 ) {
				
				color[ 0 ] += this.lightBuffer[ k + 0 ];
				color[ 1 ] += this.lightBuffer[ k + 1 ];
				color[ 2 ] += this.lightBuffer[ k + 2 ];

			}
			
			this.lightsData[ offset * 4 + 0 ] = color[ 0 ] / this.SIZE2;
			this.lightsData[ offset * 4 + 1 ] = color[ 1 ] / this.SIZE2;
			this.lightsData[ offset * 4 + 2 ] = color[ 2 ] / this.SIZE2;
			this.lightsData[ offset * 4 + 3 ] = 255;

			this.currentIndex ++;


		}

		if(this.currentIndex >= length){
			this.bounces ++;
			this.currentIndex = 0;
			console.log('propagate start');
		 	// this.lightMapTexture.needsUpdate = true;
			requestAnimationFrame( function(){self.propagate();} );
		}
		else
		{
			requestAnimationFrame( function(){self.compute();} );
		}
		
	},
	propagate : function(){
		var self = this;
		var length = this.triangles.length;
		var lightsData = this.lightsData;
		var width = this.width;
		var height = this.height;
		// console.log(this.triangles[14]);throw 123;
		for(var i = 0; i < 16; i++){
			var tri = this.triangles[this.currentIndex];
			this.currentIndex++;
			if(!tri) {
				continue;
			}

			var pos1 = { x : tri.uv2[0][0] * width, y : tri.uv2[0][1] * height };
			var pos2 = { x : tri.uv2[1][0] * width, y : tri.uv2[1][1] * height };
			var pos3 = { x : tri.uv2[2][0] * width, y : tri.uv2[2][1] * height };

			var offset1 = tri.offset[0];
			var offset2 = tri.offset[1];
			var offset3 = tri.offset[2];

			var maxX,minX,maxY,minY;

			maxX = Math.ceil(pos1.x > pos2.x ? ( pos1.x > pos3.x ? pos1.x : pos3.x ) : ( pos2.x > pos3.x ? pos2.x : pos3.x )) ;
			minX = Math.floor(pos1.x < pos2.x ? ( pos1.x < pos3.x ? pos1.x : pos3.x ) : ( pos2.x < pos3.x ? pos2.x : pos3.x )) ;
			maxY = Math.ceil(pos1.y > pos2.y ? ( pos1.y > pos3.y ? pos1.y : pos3.y ) : ( pos2.y > pos3.y ? pos2.y : pos3.y )) ;
			minY = Math.floor(pos1.y < pos2.y ? ( pos1.y < pos3.y ? pos1.y : pos3.y ) : ( pos2.y < pos3.y ? pos2.y : pos3.y )) ;

			var edge1 = new THREE.Vector2(pos2.x - pos1.x, pos2.y - pos1.y);
			var edge2 = new THREE.Vector2(pos3.x - pos1.x, pos3.y - pos1.y);

			var area = Math.abs(edge1.x * edge2.y - edge1.y * edge2.x);


			var tempEdge1 = new THREE.Vector2();
			var tempEdge2 = new THREE.Vector2();

			var area1,area2,area3;
			var d1, d2, d3, sum, r1, r2, r3;

			for(var x = minX + 1; x < maxX; x++){
				for(var y = minY + 1; y < maxY; y++){
					var posX = x;
					var posY = y;

					tempEdge1.set(pos1.x - posX, pos1.y - posY);
					d1 = tempEdge1.length();
					tempEdge2.set(pos2.x - posX, pos2.y - posY);
					d2 = tempEdge2.length();

					area1 = Math.abs(tempEdge1.x * tempEdge2.y - tempEdge1.y * tempEdge2.x);
					
					tempEdge1.set(pos2.x - posX, pos2.y - posY);
					tempEdge2.set(pos3.x - posX, pos3.y - posY);
					d3 = tempEdge2.length();

					sum = d1 + d2 + d3;
					r1 = d1 / sum;
					r2 = d2 / sum;
					r3 = d3 / sum;

					area2 = Math.abs(tempEdge1.x * tempEdge2.y - tempEdge1.y * tempEdge2.x);

					tempEdge1.set(pos1.x - posX, pos1.y - posY);
					tempEdge2.set(pos3.x - posX, pos3.y - posY);

					area3 = Math.abs(tempEdge1.x * tempEdge2.y - tempEdge1.y * tempEdge2.x);
					
					if(area1 + area2 + area3 <= area + 0.001){
						// console.log(area1 + area2 + area3, area);throw 123;
						var offset = y * width + x;
						if(!this.lightsData[offset * 4]){
							this.lightsData[offset * 4] = lightsData[offset1 * 4] * r1 + lightsData[ offset2 * 4] * r2 + lightsData[ offset3 * 4 ];
							this.lightsData[offset * 4 + 1] = lightsData[offset1 * 4 + 1] * r1 + lightsData[ offset2 * 4 + 1] * r2 + lightsData[ offset3 * 4 + 1 ];
							this.lightsData[offset * 4 + 2] = lightsData[offset1 * 4 + 2] * r1 + lightsData[ offset2 * 4 + 2] * r2 + lightsData[ offset3 * 4 + 2 ];
							this.lightsData[offset * 4 + 3] = 255;
						}
					}
				}
			}

		}


		if(this.currentIndex >= length){
			this.currentIndex = 0;
			this.lightMapTexture.needsUpdate = true;
			console.log(this.bounces + 'compute start');
			requestAnimationFrame( function(){self.compute();} );
		}else{
			requestAnimationFrame( function(){self.propagate();} );
		}
	}

	
}

