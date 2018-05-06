var UV2 = function(){
	this.units = [];

	this.mapWidth = 0;
	this.mapHeight = 0;
	this.padding = 2; 
}

UV2.maxUnitSize = 512;
UV2.minUnitSize = 16;

UV2.prototype = {
	addUV2 : function(mesh, size){
		if(mesh instanceof THREE.Group){
			for(var i = 0, l = mesh.children; i < l; i++){
				this.addUV2(mesh.children[i]);
			}
		}
		if(size === undefined){
			var geometry = mesh.geometry;
			if(!geometry.boundingBox){
				geometry.computeBoundingBox();
			}
			var boxVec3 = geometry.boundingBox.getSize();
			
			var bx,by,bz;
			bx = boxVec3.x || 0.1;
			by = boxVec3.y || 0.1;
			bz = boxVec3.z || 0.1;

			var scale = mesh.scale.x * mesh.scale.y * mesh.scale.z;
			var volume = bx * by * bz * scale;

			size = this.evaluateSize(volume);

		}

		var unit = new Unit(size, mesh);
		if(size == UV2.maxUnitSize){
			var m, n, x, y;
			var l = this.units.length;

			m = Math.floor(l / 8);
			n = l % 8;

			x = n * UV2.maxUnitSize;
			y = m * UV2.maxUnitSize;

			unit.setOffset(x, y);
			this.units.push(unit);
			return true;
		}

		var units = this.units;
		var i, l, u;
		for(var i = 0, l = units.length; i < l; i++){
			u = units[i];
			if(u.addUnit(unit)){
				unit.updateOffset();
				return true;
			}
		}

		u = new Unit(UV2.maxUnitSize);

		var m, n, x, y;

		m = Math.floor(l / 8);
		n = l % 8;

		x = n * UV2.maxUnitSize;
		y = m * UV2.maxUnitSize;

		u.setOffset(x, y);
		this.units.push(u);

		if(u.addUnit(unit)){
			return true;
		}
		console.error('unit can\'t insert into maps');
		console.error(u);
		console.error(unit);
		return false;
	},
	evaluateSize : function(volume){
		// return 128;
		if(volume < 0.01)return 16;
		else if(volume < 0.16)return 32;
		else if(volume < 0.5)return 64;
		else if(volume < 3)return 128;
		else if(volume < 12)return 256;
		else return 512;
	},
	arrange : function(){
		var l = this.units.length;
		if(l == 0) return;
		if(l <= 8){
			this.mapWidth = l * 512;
			this.mapHeight = 512;
		}else{
			var rows = l / 8;
			this.mapWidth = 4096;
			this.mapHeight = Math.ceil(rows) * 512;
		}
	},

	uvWrap : function(){
		this.arrange();
		var units = this.units;
		for(var i = 0 ,l = units.length; i < l ; i++ ){
			var unit = units[i];
			this.uvUnitWrap(unit);
		}
	},
	uvUnitWrap : function(unit){
		if(Array.isArray(unit.children) && unit.children.length > 0){
			var i , l, childUnit;
			for(i = 0, l = unit.children.length; i < l; i++){
				childUnit = unit.children[i];
				this.uvUnitWrap(childUnit);
			}
		}else if(unit.reference !== null){
			var size = unit.size;

			var width = this.mapWidth;// - this.padding * 2;
			var height = this.mapHeight;// - this.padding * 2;

			var offsetX = unit.offsetX + this.padding;
			var offsetY = unit.offsetY + this.padding;

			var mesh = unit.reference;
			var geometry = mesh.geometry;
			var uv, uv2, u, v, u2, v2;
			if(geometry instanceof THREE.Geometry){
				//TODO::
			}else if(geometry instanceof THREE.ShapeBufferGeometry){
				uv2 = [];
				//shapebuffergeometry : uv is not between 0 and 1
				var positions = geometry.attributes.position.array;
				var minX, maxX, minY, maxY, x, y, i, l;
				for(i = 0, l = positions.length; i < l; i++){
					x = positions[i];
					y = positions[++i];
					i++;//ignore z component

					if(minX === undefined || x < minX) minX = x;
					if(minY === undefined || y < minY) minY = y;
					if(maxX === undefined || x > maxX) maxX = x;
					if(maxY === undefined || y > maxY) maxY = y;
				}

				var vec2 = new THREE.Vector2(minX, minY);
				var w = maxX - minX;
				var h = maxY - minY;
				for(i = 0; i < l; i++ ){
					x = positions[i];
					y = positions[++i];
					i++;

					u2 = (((x - minX) / w * (size - 2 * this.padding)) + offsetX) / width;
					v2 = (((y - minY) / h * (size - 2 * this.padding)) + offsetY) / height;

					if(u2 > 1 || u2 < 0)console.log(geometry);
					uv2.push(u2,v2);
				}

				if(isNaN(v2)){
					console.log(x, y);
					console.log(minX, minY);
				}
				geometry.addAttribute( 'uv2', new THREE.Float32BufferAttribute( uv2, 2 ) );
				uv2 = null;
				// console.log(geometry); return;
			}else if(geometry instanceof THREE.BufferGeometry){
				uv = geometry.attributes.uv.array;
				uv2 = [];
				var l = uv.length;
				for(var i = 0; i < l; i++){
					u = uv[i];
					v = uv[++i];
					u2 = ((u * (size - 2 * this.padding)) + offsetX)/width;
					v2 = ((v * (size - 2 * this.padding)) + offsetY)/height;
					if(u2 > 1 || u2 < 0)console.log(geometry);
					uv2.push(u2,v2);
				}
				geometry.addAttribute( 'uv2', new THREE.Float32BufferAttribute( uv2, 2 ) );
				uv2 = null;
			}
		}
	},

	uvToWorld : function(){
		console.log('still in progress');
		var units = this.units;
		var unit;
		for(var i = 0, l = units.length; i < l; i++){
			unit = units[i];
			this.unitToWorld(unit);
		}
	},

	unitToWorld : function(unit){
		if(Array.isArray(unit.children)){
			for(var i = 0, l = unit.children.length; i < l; i++){
				this.unitToWorld(unit.children[i]);
			}
		}else if(unit.reference !== null){
			
		}
	}
}