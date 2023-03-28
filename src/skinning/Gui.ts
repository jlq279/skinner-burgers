import { Camera } from "../lib/webglutils/Camera.js";
import { CanvasAnimation } from "../lib/webglutils/CanvasAnimation.js";
import { SkinningAnimation } from "./App.js";
import { Mat4, Vec3, Vec4, Vec2, Mat2, Quat, Mat3 } from "../lib/TSM.js";
import { Bone, Mesh } from "./Scene.js";
import { RenderPass } from "../lib/webglutils/RenderPass.js";
import { FrontSide } from "../lib/threejs/src/constants.js";

/**
 * Might be useful for designing any animation GUI
 */
interface IGUI {
  viewMatrix(): Mat4;
  projMatrix(): Mat4;
  dragStart(me: MouseEvent): void;
  drag(me: MouseEvent): void;
  dragEnd(me: MouseEvent): void;
  onKeydown(ke: KeyboardEvent): void;
}

export enum Mode {
  playback,  
  edit  
}

/**
 * Handles Mouse and Button events along with
 * the the camera.
 */

export class GUI implements IGUI {
  private static readonly rotationSpeed: number = 0.05;
  private static readonly zoomSpeed: number = 0.1;
  private static readonly rollSpeed: number = 0.1;
  private static readonly panSpeed: number = 0.1;

  private camera: Camera;
  private dragging: boolean;
  private fps: boolean;
  private prevX: number;
  private prevY: number;

  private height: number;
  private viewPortHeight: number;
  private width: number;

  private animation: SkinningAnimation;

  public time: number;
  
  public mode: Mode;
  

  public hoverX: number = 0;
  public hoverY: number = 0;

  public startBoneDrag: boolean = false;
  public draggingBone: boolean = false;
  public highlightedT: number = Infinity;
  public highlightedBone: number = Infinity;

  /**
   *
   * @param canvas required to get the width and height of the canvas
   * @param animation required as a back pointer for some of the controls
   * @param sponge required for some of the controls
   */
  constructor(canvas: HTMLCanvasElement, animation: SkinningAnimation) {
    this.height = canvas.height;
    this.viewPortHeight = this.height - 200;
    this.width = canvas.width;
    this.prevX = 0;
    this.prevY = 0;
    
    this.animation = animation;
    
    this.reset();
    
    this.registerEventListeners(canvas);
  }

  public getNumKeyFrames(): number {
    // TODO
    // Used in the status bar in the GUI
    return 0;
  }
  public getTime(): number { return this.time; }
  
  public getMaxTime(): number { 
    // TODO
    // The animation should stop after the last keyframe
    return 0;
  }

  /**
   * Resets the state of the GUI
   */
  public reset(): void {
    this.fps = false;
    this.dragging = false;
    this.time = 0;
    this.mode = Mode.edit;
    this.camera = new Camera(
      new Vec3([0, 0, -6]),
      new Vec3([0, 0, 0]),
      new Vec3([0, 1, 0]),
      45,
      this.width / this.viewPortHeight,
      0.1,
      1000.0
    );
  }

  /**
   * Sets the GUI's camera to the given camera
   * @param cam a new camera
   */
  public setCamera(
    pos: Vec3,
    target: Vec3,
    upDir: Vec3,
    fov: number,
    aspect: number,
    zNear: number,
    zFar: number
  ) {
    this.camera = new Camera(pos, target, upDir, fov, aspect, zNear, zFar);
  }

  /**
   * Returns the view matrix of the camera
   */
  public viewMatrix(): Mat4 {
    return this.camera.viewMatrix();
  }

  /**
   * Returns the projection matrix of the camera
   */
  public projMatrix(): Mat4 {
    return this.camera.projMatrix();
  }

  /**
   * Callback function for the start of a drag event.
   * @param mouse
   */
  public dragStart(mouse: MouseEvent): void {
    if (mouse.offsetY > 600) {
      // outside the main panel
      return;
    }
    
    // TODO
    // Some logic to rotate the bones, instead of moving the camera, if there is a currently highlighted bone
    this.dragging = true;
    if (this.highlightedBone != Infinity) {
      this.startBoneDrag = true;
      this.draggingBone = true;
    }
    this.prevX = mouse.screenX;
    this.prevY = mouse.screenY;
    
  }

  public incrementTime(dT: number): void {
    if (this.mode === Mode.playback) {
      this.time += dT;
      if (this.time >= this.getMaxTime()) {
        this.time = 0;
        this.mode = Mode.edit;
      }
    }
  }

  private getCylinderIntersection(intersection: [number, number], rayPos: Vec3, rayDir: Vec3, bone: Bone, index: number): [number, number] {
    const pa: Vec3 = bone.position;
    const va: Vec3 = Vec3.direction(bone.endpoint, bone.position);

    const p1: Vec3 = bone.position;
    const p2: Vec3 = bone.endpoint;

    const dp: Vec3 = Vec3.difference(rayPos, pa);

    const r: number = 0.1;

    var temp: Vec3 = new Vec3();

    const a: number = Vec3.difference(rayDir, va.scale(Vec3.dot(rayDir, va), temp)).squaredLength();
    const b: number = 2.0 * Vec3.dot(Vec3.difference(rayDir, va.scale(Vec3.dot(rayDir, va), temp)), Vec3.difference(dp, va.scale(Vec3.dot(dp, va), temp)));
    const c: number = Vec3.difference(dp, va.scale(Vec3.dot(dp, va), temp)).squaredLength() - r * r;

    var discriminant: number = b * b - 4.0 * a * c;

    if (a == 0.0 || discriminant < 0.0) {
      return intersection;
    }

    discriminant = Math.sqrt(discriminant);
    const t2 = (-b + discriminant) / (2.0 * a);
    if(t2 <= 0.0) {
      return intersection;
    }

    const t1 = (-b - discriminant) / (2.0 * a);
    if(t1 > 0.0) {
      const q1: Vec3 = Vec3.sum(rayPos, rayDir.scale(t1, temp));
      if(t1 < intersection[0] && Vec3.dot(Vec3.difference(q1, p1), Vec3.difference(p2, p1)) >= 0 && Vec3.dot(Vec3.difference(q1, p1), Vec3.difference(p2, p1)) <= Vec3.dot(Vec3.difference(p2, p1), Vec3.difference(p2, p1))) {
        intersection = [t1, index];
        return intersection;
      }
    }

    const q2: Vec3 = Vec3.sum(rayPos, rayDir.scale(t2, temp));
    if(t2 < intersection[0] && Vec3.dot(Vec3.difference(q2, p1), Vec3.difference(p2, p1)) >= 0 && Vec3.dot(Vec3.difference(q2, p1), Vec3.difference(p2, p1)) <= Vec3.dot(Vec3.difference(p2, p1), Vec3.difference(p2, p1))) {
      intersection = [t2, index];
    }

    return intersection;
  }

  /**
   * The callback function for a drag event.
   * This event happens after dragStart and
   * before dragEnd.
   * @param mouse
   */
  public drag(mouse: MouseEvent): void {
    // TODO
    // You will want logic here:
    // 1) To highlight a bone, if the mouse is hovering over a bone;
    // 2) To rotate a bone, if the mouse button is pressed and currently highlighting a bone.
    let x = mouse.offsetX;
    let y = mouse.offsetY;

    var temp: Vec3 = new Vec3();
    
    // mouse from screen to ndc to world
    const ndx: number = 2.0 * ((x + 0.5)/this.width) - 1.0;
    const ndy: number = 2.0 * (1 - (y + 0.5)/this.viewPortHeight) - 1.0;
    const mouseWorld: Vec4 = this.viewMatrix().inverse().multiply(this.projMatrix().inverse()).multiplyVec4(new Vec4([ndx, ndy, -1, 1]));
    mouseWorld.scale(1.0/mouseWorld.w);

    const mouseVec3: Vec3 =  new Vec3(mouseWorld.xyz);

    // ray-cylinder intersection
    const p: Vec3 = this.camera.pos();
    const v: Vec3 = Vec3.direction(mouseVec3, p);
    
    if(this.draggingBone) { // dragging highlighted bone
      const axis: Vec3 = this.camera.forward().normalize();
      const joint: Vec3 = this.animation.getScene().meshes[0].bones[this.highlightedBone].position;
      const endpoint: Vec3 = this.animation.getScene().meshes[0].bones[this.highlightedBone].endpoint;
      const bone: Vec3 = Vec3.difference(endpoint, joint);

      // point and normal

      // center of rotation is axis passing through joint

      // joint + axis * ((endpoint - joint) dot axis) = center of rotation
      const centerOfRotation = Vec3.sum(joint, axis.scale(Vec3.dot(Vec3.difference(endpoint, joint), axis), temp));

      // mouse intersection
      // ((camera - endpoint) dot axis) / (v dot axis) to get t from camera to plane
      const t = Vec3.dot(Vec3.difference(endpoint, p), axis) / Vec3.dot(v, axis);
      // camera + v * t = mouse intersection point
      const mouseIntersection = Vec3.sum(p, v.scale(t, temp));
      const endpointIntersection = Vec3.difference(endpoint, axis.scale(Vec3.dot(bone, axis), temp));

      // mouse intersection point - center of rotation
      // endpoint - center of rotation
      const mouseDir = Vec3.difference(mouseIntersection, centerOfRotation).normalize();
      const boneDir = Vec3.difference(endpointIntersection, centerOfRotation).normalize();
      // normalize, dot, arccos








      // const jointNDC: Vec4 = Mat4.product(this.projMatrix(), this.viewMatrix()).multiplyVec4(new Vec4([joint.x, joint.y, joint.z, 1.0]));
      // jointNDC.scale(1.0/jointNDC.w);
      // const endpointNDC: Vec4 = Mat4.product(this.projMatrix(), this.viewMatrix()).multiplyVec4(new Vec4([endpoint.x, endpoint.y, endpoint.z, 1.0]));
      // endpointNDC.scale(1.0/endpointNDC.w);
      // const mouseNDC: Vec4 = Mat4.product(this.projMatrix(), this.viewMatrix()).multiplyVec4(new Vec4([mouseVec3.x, mouseVec3.y, mouseVec3.z, 1.0]));
      // mouseNDC.scale(1.0/mouseNDC.w);
      // console.log("joint " + jointNDC.scale(1.0/jointNDC.w).xyzw.toLocaleString() + " endpoint " + endpointNDC.scale(1.0/endpointNDC.w).xyzw.toLocaleString() + " mouseVec3 " + mouseNDC.scale(1.0/mouseNDC.w).xyzw.toLocaleString());
      // const projection: number[] = [];
      // for (var col: number = 0; col < 3; col++) {
      //   for (var row: number = 0; row < 3; row++) {
      //     if (col == row) {
      //       projection.push(1 - axis.at(col) * axis.at(row));
      //     }
      //     else {
      //       projection.push(-axis.at(col) * axis.at(row));
      //     }
      //   }
      // }
      // const P: Mat3 = new Mat3(projection);
      // console.log("projection " + P.all().toLocaleString());
      // const projJoint: Vec3 = P.multiplyVec3(Vec3.difference(joint, p));
      // const projEndpoint: Vec3 = P.multiplyVec3(Vec3.difference(endpoint, p));
      // const projMouse: Vec3 = P.multiplyVec3(Vec3.difference(mouseVec3, p));
      // const projBone: Vec3 = Vec3.difference(projEndpoint, projJoint).normalize();
      // const projMouseToJoint: Vec3 = Vec3.difference(projMouse, projJoint).normalize();
      // console.log("projJoint " + projJoint.xyz.toLocaleString() + " projEndpoint " + projEndpoint.xyz.toLocaleString());
      // console.log("projMouse " + projMouse.xyz.toLocaleString());
      // const projBone: Vec3 = Vec3.difference(new Vec3(endpointNDC.xyz), new Vec3(jointNDC.xyz)).normalize();
      // const projMouseToJoint: Vec3 = Vec3.difference(new Vec3(mouseNDC.xyz), new Vec3(jointNDC.xyz)).normalize();

      // const jointPerp: Vec3 = axis.scale(Vec3.dot(joint, axis), temp);
      // const projJoint: Vec3 = Vec3.sum(joint, jointPerp);
      // const endpointPerp: Vec3 = axis.scale(Vec3.dot(joint, axis), temp)
      // const projEndpoint: Vec3 = Vec3.difference(endpoint, endpointPerp);
      // const projMouse: Vec3 = Vec3.sum(mouseVec3, v.scale(Vec3.dot(Vec3.difference(projJoint, mouseVec3), axis)/Vec3.dot(v, axis), temp));
      // const projBone: Vec3 = Vec3.difference(projEndpoint, projJoint).normalize();
      // const projMouseToJoint: Vec3 = Vec3.difference(projMouse, projJoint).normalize();
      // 
      // 
      // const diff = Vec3.difference(p, joint)
      // const prod1 = Vec3.dot(diff, axis);
      // const prod2 = Vec3.dot(v, axis);
      // const prod3 = prod1 / prod2;
      // const intersectionPoint = Vec3.difference(p, v.scale(prod3, temp));
      // const diff1 = Vec3.difference(mouseVec3, joint)
      // const prod11 = Vec3.dot(diff1, axis);
      // const prod21 = Vec3.dot(axis.scale(-1.0, temp), axis);
      // const prod31 = prod11 / prod21;
      // const intersectionPoint1 = Vec3.difference(mouseVec3, axis.scale(-prod31, temp));
      // const diff2 = Vec3.difference(endpoint, joint)
      // const prod12 = Vec3.dot(diff2, axis);
      // const prod22 = Vec3.dot(axis.scale(-1.0, temp), axis);
      // const prod32 = prod12 / prod22;
      // const intersectionPoint2 = Vec3.difference(endpoint, axis.scale(-prod32, temp));
      // const projMouse = Vec3.difference(intersectionPoint, intersectionPoint1).normalize();
      // const projBone = Vec3.difference(intersectionPoint2, joint).normalize();


      var angle: number = Math.acos(Math.min(Vec3.dot(boneDir, mouseDir), 1));
      const v3: Vec3 = Vec3.cross(boneDir, mouseDir);
      // if (Vec3.dot(v3, axis) < 0) angle = -angle;
      // const v3: Vec3 = Vec3.cross(projBone, projMouseToJoint);
      
      var angle: number = Math.atan2(Math.min(Vec3.dot(v3, axis), 1.0), Math.min(Vec3.dot(boneDir, mouseDir), 1.0));
      // if (angle >= Math.PI) angle = -angle;
      // console.log("projBone " + boneDir.xyz.toLocaleString() + " projMouse " + mouseDir.xyz.toLocaleString());
      // console.log("v3 " + v3.xyz.toLocaleString() + " axis " + axis.xyz.toLocaleString());
      // console.log("angle " + angle + " dot " + Vec3.dot(mouseDir, boneDir));
      var nq: Quat = Quat.fromAxisAngle(axis, angle);
      var cq: Quat = Quat.product(nq, this.animation.getScene().meshes[0].bones[this.highlightedBone].rotation);
      console.log("new quaternion " + nq.xyzw + " cquaternion " + cq.xyzw);
      this.animation.getScene().meshes[0].bones[this.highlightedBone].rotation = cq.normalize();

      // const s: Vec3 = v3.scale(1.0/v3.length(), temp);
      // const rot: Mat3 = new Mat3([Math.cos(angle) + s.x * s.x * (1 - Math.cos(angle)), s.y * s.x * (1 - Math.cos(angle)) + s.z * Math.sin(angle), s.z * s.x * (1 - Math.cos(angle)) + s.y * Math.sin(angle), s.x * s.y * (1 - Math.cos(angle)) - s.z * Math.sin(angle), Math.cos(angle) + s.y * s.y * (1 - Math.cos(angle)), s.z * s.y * (1 - Math.cos(angle)) + s.x * Math.sin(angle), s.x * s.z * (1 - Math.cos(angle)) - s.y * Math.sin(angle), s.y * s.z * (1 - Math.cos(angle)) - s.x * Math.sin(angle), Math.cos(angle) + s.z * s.z * (1 - Math.cos(angle))]);
      // const end: Vec3 = rot.multiplyVec3(endpoint);
      // console.log("end!!!! " + end.xyz.toLocaleString());
      // this.animation.getScene().meshes[0].bones[this.highlightedBone].endpoint = nq.multiplyVec3(Vec3.difference(endpoint, joint)).add(joint);
      // this.animation.getScene().meshes[0].bones[this.highlightedBone].endpoint = Vec3.sum(Vec3.sum(this.animation.getScene().meshes[0].bones[this.highlightedBone].initialEndpoint, Vec3.cross(Vec3.difference(Vec3.cross(this.animation.getScene().meshes[0].bones[this.highlightedBone].initialEndpoint, new Vec3(cq.xyz)), endpoint.scale(cq.w)), new Vec3(cq.xyz)).scale(2)), joint);
      // v + 2.0 * cross(cross(v, q.xyz) - q.w*v, q.xyz)
      // const newEndpoint: Vec3 = Vec3.sum(Vec3.sum(endpoint, Vec3.cross(Vec3.difference(Vec3.cross(endpoint, new Vec3(nq.xyz)), endpoint.scale(nq.w)), new Vec3(nq.xyz)).scale(2)), joint);
      // console.log("new endpoint " + this.animation.getScene().meshes[0].bones[this.highlightedBone].endpoint.xyz.toLocaleString());
      // console.log("position " + this.animation.getScene().meshes[0].bones[this.highlightedBone].position.xyz.toLocaleString());
      // this.animation.getScene().meshes[0].bonePositions[6 * this.highlightedBone] = this.animation.getScene().meshes[0].bones[this.highlightedBone].position.x;
      // this.animation.getScene().meshes[0].bonePositions[6 * this.highlightedBone + 1] = this.animation.getScene().meshes[0].bones[this.highlightedBone].position.y;
      // this.animation.getScene().meshes[0].bonePositions[6 * this.highlightedBone + 2] = this.animation.getScene().meshes[0].bones[this.highlightedBone].position.z;
      // this.animation.getScene().meshes[0].bonePositions[6 * this.highlightedBone + 3] = this.animation.getScene().meshes[0].bones[this.highlightedBone].endpoint.x;
      // this.animation.getScene().meshes[0].bonePositions[6 * this.highlightedBone + 4] = this.animation.getScene().meshes[0].bones[this.highlightedBone].endpoint.y;
      // this.animation.getScene().meshes[0].bonePositions[6 * this.highlightedBone + 5] = this.animation.getScene().meshes[0].bones[this.highlightedBone].endpoint.z;
      this.animation.getScene().meshes[0].update(this.highlightedBone);
    }
    else if (this.dragging) { // no highlighted bone; do normal rotations
      const dx = mouse.screenX - this.prevX;
      const dy = mouse.screenY - this.prevY;
      this.prevX = mouse.screenX;
      this.prevY = mouse.screenY;

      /* Left button, or primary button */
      const mouseDir: Vec3 = this.camera.right();
      mouseDir.scale(-dx);
      mouseDir.add(this.camera.up().scale(dy));
      mouseDir.normalize();

      if (dx === 0 && dy === 0) {
        return;
      }

      switch (mouse.buttons) {
        case 1: {
          let rotAxis: Vec3 = Vec3.cross(this.camera.forward(), mouseDir);
          rotAxis = rotAxis.normalize();

          if (this.fps) {
            this.camera.rotate(rotAxis, GUI.rotationSpeed);
          } else {
            this.camera.orbitTarget(rotAxis, GUI.rotationSpeed);
          }
          break;
        }
        case 2: {
          /* Right button, or secondary button */
          this.camera.offsetDist(Math.sign(mouseDir.y) * GUI.zoomSpeed);
          break;
        }
        default: {
          break;
        }
      }
    } 
    else { // hovering
      var intersection: [number, number] = [Infinity, Infinity];
      this.animation.getScene().meshes[0].bones.forEach((bone, index) => {
        intersection = this.getCylinderIntersection(intersection, p, v, bone, index);
      });
      this.highlightedT = intersection[0];
      this.highlightedBone = intersection[1];
      this.animation.getScene().meshes[0].setBoneHighlightIndex(this.highlightedBone);
    }

    // TODO write the recursive function for rotation
  }
    
    

  public getModeString(): string {
    switch (this.mode) {
      case Mode.edit: { return "edit: " + this.getNumKeyFrames() + " keyframes"; }
      case Mode.playback: { return "playback: " + this.getTime().toFixed(2) + " / " + this.getMaxTime().toFixed(2); }
    }
  }

  /**
   * Callback function for the end of a drag event
   * @param mouse
   */
  public dragEnd(mouse: MouseEvent): void {
    // TODO
    // Maybe your bone highlight/dragging logic needs to do stuff here too
    this.dragging = false;
    this.draggingBone = false;
    this.prevX = 0;
    this.prevY = 0;
  }

  /**
   * Callback function for a key press event
   * @param key
   */
  public onKeydown(key: KeyboardEvent): void {
    switch (key.code) {
      case "Digit1": {
        this.animation.setScene("/static/assets/skinning/split_cube.dae");
        break;
      }
      case "Digit2": {
        this.animation.setScene("/static/assets/skinning/long_cubes.dae");
        break;
      }
      case "Digit3": {
        this.animation.setScene("/static/assets/skinning/simple_art.dae");
        break;
      }      
      case "Digit4": {
        this.animation.setScene("/static/assets/skinning/mapped_cube.dae");
        break;
      }
      case "Digit5": {
        this.animation.setScene("/static/assets/skinning/robot.dae");
        break;
      }
      case "Digit6": {
        this.animation.setScene("/static/assets/skinning/head.dae");
        break;
      }
      case "Digit7": {
        this.animation.setScene("/static/assets/skinning/wolf.dae");
        break;
      }
      case "KeyW": {
        this.camera.offset(
            this.camera.forward().negate(),
            GUI.zoomSpeed,
            true
          );
        break;
      }
      case "KeyA": {
        this.camera.offset(this.camera.right().negate(), GUI.zoomSpeed, true);
        break;
      }
      case "KeyS": {
        this.camera.offset(this.camera.forward(), GUI.zoomSpeed, true);
        break;
      }
      case "KeyD": {
        this.camera.offset(this.camera.right(), GUI.zoomSpeed, true);
        break;
      }
      case "KeyR": {
        this.animation.reset();
        break;
      }
      case "ArrowLeft": {
        this.camera.roll(GUI.rollSpeed, false);
        break;
      }
      case "ArrowRight": {
        if(!this.draggingBone) this.camera.roll(GUI.rollSpeed, true);
        else 
        {
          var end: Vec3 = this.animation.getScene().meshes[0].bones[this.highlightedBone].initialEndpoint;
          var start: Vec3 = this.animation.getScene().meshes[0].bones[this.highlightedBone].initialPosition;
          var axis: Vec3 = Vec3.difference(end, start).normalize();
          var angle: number = 0.1;
          var nq: Quat = Quat.fromAxisAngle(axis, angle);
          var cq: Quat = this.animation.getScene().meshes[0].bones[this.highlightedBone].rotation;
          //yconsole.log("roll: " + nq.xyzw);
          this.animation.getScene().meshes[0].bones[this.highlightedBone].rotation = cq.multiply(nq, cq );
          this.animation.getScene().meshes[0].update(this.highlightedBone);
        }
        break;
      }
      case "ArrowUp": {
        this.camera.offset(this.camera.up(), GUI.zoomSpeed, true);
        break;
      }
      case "ArrowDown": {
        this.camera.offset(this.camera.up().negate(), GUI.zoomSpeed, true);
        break;
      }
      case "KeyK": {
        if (this.mode === Mode.edit) {
            // TODO
            // Add keyframe
        }
        break;
      }      
      case "KeyP": {
        if (this.mode === Mode.edit && this.getNumKeyFrames() > 1)
        {
          this.mode = Mode.playback;
          this.time = 0;
        } else if (this.mode === Mode.playback) {
          this.mode = Mode.edit;
        }
        break;
      }
      default: {
        console.log("Key : '", key.code, "' was pressed.");
        break;
      }
    }
  }

  /**
   * Registers all event listeners for the GUI
   * @param canvas The canvas being used
   */
  private registerEventListeners(canvas: HTMLCanvasElement): void {
    /* Event listener for key controls */
    window.addEventListener("keydown", (key: KeyboardEvent) =>
      this.onKeydown(key)
    );

    /* Event listener for mouse controls */
    canvas.addEventListener("mousedown", (mouse: MouseEvent) =>
      this.dragStart(mouse)
    );

    canvas.addEventListener("mousemove", (mouse: MouseEvent) =>
      this.drag(mouse)
    );

    canvas.addEventListener("mouseup", (mouse: MouseEvent) =>
      this.dragEnd(mouse)
    );

    /* Event listener to stop the right click menu */
    canvas.addEventListener("contextmenu", (event: any) =>
      event.preventDefault()
    );
  }
}
