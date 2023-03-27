import { Mat4, Quat, Vec3 } from "../lib/TSM.js";
import { AttributeLoader, MeshGeometryLoader, BoneLoader, MeshLoader } from "./AnimationFileLoader.js";

export class Attribute {
  values: Float32Array;
  count: number;
  itemSize: number;

  constructor(attr: AttributeLoader) {
    this.values = attr.values;
    this.count = attr.count;
    this.itemSize = attr.itemSize;
  }
}

export class MeshGeometry {
  position: Attribute;
  normal: Attribute;
  uv: Attribute | null;
  skinIndex: Attribute; // which bones affect each vertex?
  skinWeight: Attribute; // with what weight?
  v0: Attribute; // position of each vertex of the mesh *in the coordinate system of bone skinIndex[0]'s joint*. Perhaps useful for LBS.
  v1: Attribute;
  v2: Attribute;
  v3: Attribute;

  constructor(mesh: MeshGeometryLoader) {
    this.position = new Attribute(mesh.position);
    this.normal = new Attribute(mesh.normal);
    if (mesh.uv) { this.uv = new Attribute(mesh.uv); }
    this.skinIndex = new Attribute(mesh.skinIndex);
    this.skinWeight = new Attribute(mesh.skinWeight);
    this.v0 = new Attribute(mesh.v0);
    this.v1 = new Attribute(mesh.v1);
    this.v2 = new Attribute(mesh.v2);
    this.v3 = new Attribute(mesh.v3);
  }
}

export class Bone {
  public parent: number;
  public children: number[];
  public position: Vec3; // current position of the bone's joint *in world coordinates*. Used by the provided skeleton shader, so you need to keep this up to date.
  public endpoint: Vec3; // current position of the bone's second (non-joint) endpoint, in world coordinates
  public rotation: Quat; // current orientation of the joint *with respect to world coordinates*
  
  public initialPosition: Vec3; // position of the bone's joint *in world coordinates*
  public initialEndpoint: Vec3; // position of the bone's second (non-joint) endpoint, in world coordinates
  public U: Mat4 = Mat4.identity;
  public B: Mat4 = Mat4.identity;
  public D: Mat4 = Mat4.identity;
  public T: Mat4 = Mat4.identity;


  public offset: number; // used when parsing the Collada file---you probably don't need to touch these
  public initialTransformation: Mat4;

  constructor(bone: BoneLoader) {
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
  public geometry: MeshGeometry;
  public worldMatrix: Mat4; // in this project all meshes and rigs have been transformed into world coordinates for you
  public rotation: Vec3;
  public bones: Bone[];
  public materialName: string;
  public imgSrc: String | null;
  public rotating: boolean = false;
  public ogvec: Vec3 = new Vec3();

  private boneIndices: number[];
  private bonePositions: Float32Array;
  private boneIndexAttribute: Float32Array;
  private boneHighlightIndex: number;

  constructor(mesh: MeshLoader) {
    this.geometry = new MeshGeometry(mesh.geometry);
    this.worldMatrix = mesh.worldMatrix.copy();
    this.rotation = mesh.rotation.copy();
    this.bones = [];
    mesh.bones.forEach(bone => {
      this.bones.push(new Bone(bone));
    });
    this.bones.forEach(bone=>{ 
      if(bone.parent == -1)
      {
        bone.B = new Mat4([1, 0 , 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, bone.initialPosition.x, bone.initialPosition.y, bone.initialPosition.z, 1]);
      }
      else 
      {
        var x: number = bone.initialPosition.x - this.bones[bone.parent].initialPosition.x;
        var y: number = bone.initialPosition.y - this.bones[bone.parent].initialPosition.y;
        var z: number = bone.initialPosition.z - this.bones[bone.parent].initialPosition.z;

        bone.B = new Mat4([1, 0 , 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, x, y, z, 1]);
      }
      bone.T = Mat4.identity;
    })

    this.bones.forEach(bone => {
      bone.U = bone.B;
      bone.D = bone.B;
      var parentB: Bone = bone;
      while(parentB.parent != -1)
      {
        parentB = this.bones[bone.parent];
        bone.U.multiply(parentB.B);
        bone.D.multiply(parentB.T);
        bone.D.multiply(parentB.B);
      }
      
    })

    this.materialName = mesh.materialName;
    this.imgSrc = null;
    this.boneIndices = Array.from(mesh.boneIndices);
    this.bonePositions = new Float32Array(mesh.bonePositions);
    this.boneIndexAttribute = new Float32Array(mesh.boneIndexAttribute);
    this.boneHighlightIndex = Infinity;
  }

  public getBoneIndices(): Uint32Array {
    return new Uint32Array(this.boneIndices);
  }

  public getBonePositions(): Float32Array {
    return this.bonePositions;
  }

  public getBoneIndexAttribute(): Float32Array {
    return this.boneIndexAttribute;
  }

  public getBoneHighlightIndex(): number{
    return this.boneHighlightIndex;
  }

  public setBoneHighlightIndex(index: number): void {
    this.boneHighlightIndex = index;
  }

  public getBoneTranslations(): Float32Array {
    let trans = new Float32Array(3 * this.bones.length);
    this.bones.forEach((bone, index) => {
      let res = bone.position.xyz;
      for (let i = 0; i < res.length; i++) {
        trans[3 * index + i] = res[i];
      }
    });
    return trans;
  }

  public getBoneRotations(): Float32Array {
    let trans = new Float32Array(4 * this.bones.length);
    this.bones.forEach((bone, index) => {
      let res = bone.rotation.xyzw;
      for (let i = 0; i < res.length; i++) {
        trans[4 * index + i] = res[i];
      }
    });
    return trans;
  }

  public update(i: number) {
    var parentID : number = this.bones[i].parent;
    var parentB2 : Bone = this.bones[i];
    var jointLoc : Vec3 = this.bones[i].initialPosition;
    var Temp4 : Vec3 = new Vec3();
    if(parentID != -1)
    {
      parentB2 = this.bones[parentID];
      jointLoc = parentB2.U.inverse().multiplyVec3(jointLoc);
      this.Trans(parentID);
      this.bones[i].position = this.bones[parentID].D.multiplyVec3(jointLoc); 
    }

    var endLoc : Vec3 = this.bones[i].initialEndpoint;
    endLoc = this.bones[i].U.inverse().multiplyVec3(endLoc);
    this.Trans(i);
    this.bones[i].endpoint = this.bones[i].D.multiplyVec3(endLoc);

    this.bones[i].children.forEach(child => {
      this.update(child);
    })

  }

  public Trans(id: number) {
    if(id == -1) return;
    else {
      var temp8: Mat4 = new Mat4();
      this.bones[id].T = this.bones[id].rotation.toMat4();
      if(this.bones[id].parent != -1)
      {
        this.bones[id].D = this.bones[id].D.multiply(this.bones[this.bones[id].parent].D, temp8);
        this.bones[id].D = this.bones[id].D.multiply(this.bones[id].B, temp8);
        this.bones[id].D = this.bones[id].T;
      }
      else 
      {
        this.bones[id].D = this.bones[id].B.multiply(this.bones[id].T, temp8);
      }
        
    }

  }

}