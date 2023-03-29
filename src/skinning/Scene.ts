import { Mat4, Quat, Vec3, Vec4 } from "../lib/TSM.js";
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
  public bonePositions: Float32Array;
  private boneIndexAttribute: Float32Array;
  private boneHighlightIndex: number;
  

  private recurseU(bone: Bone): Mat4 {
    if (bone.parent == -1) {
      return new Mat4(bone.B.all());
    }
    else {
      return Mat4.product(this.recurseU(this.bones[bone.parent]), bone.B);
    }
  }

  private recurseD(bone: Bone): Mat4 {
    if (bone.parent == -1) {
      return Mat4.product(bone.B, bone.T);
    }
    else {
      return Mat4.product(Mat4.product(this.recurseD(this.bones[bone.parent]), bone.B) , bone.T);
    }
  }
  constructor(mesh: MeshLoader) {
    this.geometry = new MeshGeometry(mesh.geometry);
    this.worldMatrix = mesh.worldMatrix.copy();
    this.rotation = mesh.rotation.copy();
    this.bones = [];
    mesh.bones.forEach(bone => {
      this.bones.push(new Bone(bone));
      console.log( (this.bones.length - 1) +  "  " + this.bones[this.bones.length - 1].initialPosition.xyz.toLocaleString());
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
      bone.U = new Mat4([1,0,0,0,0,1,0,0,0,0,1,0, bone.initialPosition.x, bone.initialPosition.y, bone.initialPosition.z, 1]);
      bone.D = bone.U;
    });

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

  public getBoneEndpoints(): Float32Array {
    let trans = new Float32Array(6 * this.bones.length);
    this.bones.forEach((bone, index) => {
      let res = bone.position.xyz;
      let res2 = bone.endpoint.xyz;
        for(let j = 0; j < 3; j++)  
        {
          trans[6 * index + j] = res[j];
          trans[6 * index + 3 + j] = res2[j];
        }
      
    });
    return trans;
  }

  public getDeez(): Float32Array{
    let trans = new Float32Array(16 * this.bones.length);
    this.bones.forEach((bone, index) =>{
      let res = bone.D.all();
      for(let j = 0; j < 16; j++)
      {
        trans[16*index + j] = res[j];
      }
    });
    return trans;
  }


  public getUeez(): Float32Array{
    let trans = new Float32Array(16 * this.bones.length);
    this.bones.forEach((bone, index) =>{
      let res = bone.U.copy().inverse().all();
      for(let j = 0; j < 16; j++)
      {
        trans[16*index + j] = res[j];
      }
    });
    return trans;
  }


  

  public update(i: number) {
    var jointLoc : Vec3 = this.bones[i].initialPosition;
    this.Trans(i);
    this.bones[i].position = Mat4.product(this.bones[i].D, this.bones[i].U.copy().inverse()).multiplyPt3(jointLoc);
    this.bonePositions[6*i] = this.bones[i].position.x;
    this.bonePositions[6*i + 1] = this.bones[i].position.y;
    this.bonePositions[6*i + 2] = this.bones[i].position.z;
    
    var endLoc : Vec3 = this.bones[i].initialEndpoint;
    this.bones[i].endpoint = Mat4.product(this.bones[i].D, this.bones[i].U.copy().inverse()).multiplyPt3(endLoc);
    this.bonePositions[6*i + 3] = this.bones[i].endpoint.x;
    this.bonePositions[6*i + 4] = this.bones[i].endpoint.y;
    this.bonePositions[6*i + 5] = this.bones[i].endpoint.z;
    this.bones[i].children.forEach(child => {
      this.update(child);
    })

  }

  public Trans(id: number) {
    if(id == -1) return;
    else {
      this.bones[id].T = this.bones[id].rotation.toMat4();
      this.bones[id].D = this.recurseD(this.bones[id]);
    }

  }

}