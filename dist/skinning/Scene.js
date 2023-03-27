import { Vec3 } from "../lib/TSM.js";
export class Attribute {
    constructor(attr) {
        this.values = attr.values;
        this.count = attr.count;
        this.itemSize = attr.itemSize;
    }
}
export class MeshGeometry {
    constructor(mesh) {
        this.position = new Attribute(mesh.position);
        this.normal = new Attribute(mesh.normal);
        if (mesh.uv) {
            this.uv = new Attribute(mesh.uv);
        }
        this.skinIndex = new Attribute(mesh.skinIndex);
        this.skinWeight = new Attribute(mesh.skinWeight);
        this.v0 = new Attribute(mesh.v0);
        this.v1 = new Attribute(mesh.v1);
        this.v2 = new Attribute(mesh.v2);
        this.v3 = new Attribute(mesh.v3);
    }
}
export class Bone {
    constructor(bone) {
        this.cumOffset = new Vec3();
        this.parent = bone.parent;
        this.children = Array.from(bone.children);
        this.position = bone.position.copy();
        this.endpoint = bone.endpoint.copy();
        this.rotation = bone.rotation.copy();
        this.offset = bone.offset;
        this.initialPosition = bone.initialPosition.copy();
        this.initialEndpoint = bone.initialEndpoint.copy();
        this.initialTransformation = bone.initialTransformation.copy();
    }
}
export class Mesh {
    constructor(mesh) {
        this.rotating = false;
        this.ogvec = new Vec3();
        this.geometry = new MeshGeometry(mesh.geometry);
        this.worldMatrix = mesh.worldMatrix.copy();
        this.rotation = mesh.rotation.copy();
        this.bones = [];
        mesh.bones.forEach(bone => {
            this.bones.push(new Bone(bone));
        });
        this.bones.forEach(bone => {
            if (bone.parent != -1) {
                var temp3 = new Vec3();
                bone.cumOffset = this.bones[bone.parent].cumOffset.add(bone.initialPosition, temp3);
            }
        });
        this.materialName = mesh.materialName;
        this.imgSrc = null;
        this.boneIndices = Array.from(mesh.boneIndices);
        this.bonePositions = new Float32Array(mesh.bonePositions);
        this.boneIndexAttribute = new Float32Array(mesh.boneIndexAttribute);
        this.boneHighlightIndex = -1;
    }
    getBoneIndices() {
        return new Uint32Array(this.boneIndices);
    }
    getBonePositions() {
        return this.bonePositions;
    }
    getBoneIndexAttribute() {
        return this.boneIndexAttribute;
    }
    getBoneHighlightIndex() {
        return this.boneHighlightIndex;
    }
    setBoneHighlightIndex(index) {
        this.boneHighlightIndex = index;
    }
    getBoneTranslations() {
        let trans = new Float32Array(3 * this.bones.length);
        this.bones.forEach((bone, index) => {
            let res = bone.position.xyz;
            for (let i = 0; i < res.length; i++) {
                trans[3 * index + i] = res[i];
            }
        });
        return trans;
    }
    getBoneRotations() {
        let trans = new Float32Array(4 * this.bones.length);
        this.bones.forEach((bone, index) => {
            let res = bone.rotation.xyzw;
            for (let i = 0; i < res.length; i++) {
                trans[4 * index + i] = res[i];
            }
        });
        return trans;
    }
    update(i) {
        var parentID = this.bones[i].parent;
        var jointLoc = this.bones[i].position;
        var Temp4 = new Vec3();
        if (parentID != -1) {
            jointLoc = jointLoc.subtract(this.bones[parentID].cumOffset, Temp4);
            this.bones[i].position = this.Trans(jointLoc, parentID);
        }
        var endLoc = this.bones[i].endpoint;
        endLoc = endLoc.subtract(this.bones[i].cumOffset, Temp4);
        this.bones[i].endpoint = this.Trans(endLoc, parentID);
    }
    Trans(pos, id) {
        // if(id == -1) return pos;
        // else {
        //   return this.Trans(this.bones[id].rotation.multiplyVec3(pos).add(this.bones[id].), this.bones[id].parent);
        // }
        return new Vec3();
    }
}
//# sourceMappingURL=Scene.js.map