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