import { Camera } from "../lib/webglutils/Camera.js";
import { CanvasAnimation } from "../lib/webglutils/CanvasAnimation.js";
import { SkinningAnimation } from "./App.js";
import { Mat4, Vec3, Vec4, Vec2, Mat2, Quat } from "../lib/TSM.js";
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
  public highlightedBone: number = Infinity;
  // public cont: boolean = false;
  public curDist: number = 0;
  public poCylin: Vec3 = new Vec3();

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

  /**
   * The callback function for a drag event.
   * This event happens after dragStart and
   * before dragEnd.
   * @param mouse
   */
  public drag(mouse: MouseEvent): void {
    let x = mouse.offsetX;
    let y = mouse.offsetY;
    
    
    // mouse from screen to ndc to world
    const ndx: number = 2 * (x + 0.5)/this.width - 1;
    const ndy: number = 1 - (2 * (y + 0.5)/this.viewPortHeight);
    const mouseWorld: Vec4 = this.viewMatrix().inverse().multiply(this.projMatrix().inverse()).multiplyVec4(new Vec4([ndx, ndy, -1, 1]));
    mouseWorld.scale(1.0/mouseWorld.w);
    mouseWorld.y

    // ray-cylinder intersection
    const p: Vec3 = this.camera.pos();
    const v: Vec3 = Vec3.direction(new Vec3(mouseWorld.xyz), p);

    var intersection: [number, number] = [Infinity, Infinity];
    this.animation.getScene().meshes[0].bones.forEach((bone, index) => {
      const pa: Vec3 = bone.position;
      const va: Vec3 = Vec3.direction(bone.endpoint, bone.position);

      const p1: Vec3 = bone.position;
      const p2: Vec3 = bone.endpoint;

      const dp: Vec3 = Vec3.difference(p, pa);

      const r: number = 0.1;

      var temp: Vec3 = new Vec3();

      const a: number = Vec3.difference(v, va.scale(Vec3.dot(v, va), temp)).squaredLength();
      const check: Vec3 = Vec3.difference(v, va.scale(Vec3.dot(v, va), temp));
      const check2: Vec3 = Vec3.difference(dp, va.scale(Vec3.dot(dp, va), temp));
      const b: number = 2.0 * Vec3.dot(check, check2);
      const c: number = Vec3.difference(dp, va.scale(Vec3.dot(dp, va), temp)).squaredLength() - r * r;

      var discriminant: number = b * b - 4.0 * a * c;

      if (a == 0.0 || discriminant < 0.0) {
        return;
      }

      discriminant = Math.sqrt(discriminant);
      const t2 = (-b + discriminant) / (2.0 * a);
      if(t2 <= 0.0) {
        return;
      }

      const t1 = (-b - discriminant) / (2.0 * a);
      if(t1 > 0.0) {
        const q1: Vec3 = Vec3.sum(p, v.scale(t1, temp));
        if(t1 < intersection[0] && Vec3.dot(Vec3.difference(q1, p1), Vec3.difference(p2, p1)) >= 0 && Vec3.dot(Vec3.difference(q1, p1), Vec3.difference(p2, p1)) <= Vec3.dot(Vec3.difference(p2, p1), Vec3.difference(p2, p1))) {
          intersection = [t1, index];
          return;
        }
      }

      const q2: Vec3 = Vec3.sum(p, v.scale(t2, temp));
      if(t2 < intersection[0] && Vec3.dot(Vec3.difference(q2, p1), Vec3.difference(p2, p1)) >= 0 && Vec3.dot(Vec3.difference(q2, p1), Vec3.difference(p2, p1)) <= Vec3.dot(Vec3.difference(p2, p1), Vec3.difference(p2, p1))) {
        intersection = [t2, index];
        return;
      }
      
    });
    this.animation.getScene().meshes[0].setBoneHighlightIndex(intersection[1]);
    this.highlightedBone = intersection[1];
    if (this.dragging && !this.draggingBone) { // no highlighted bone; do normal rotations
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
    else if(this.draggingBone) { // dragging highlighted bone
      var qnew = new Quat();
      // console.log("bone" + intersection[1]);
      if(mouse.buttons == 1)
      {
        // this.cont = true;
        var j: Vec3 = this.animation.getScene().meshes[0].bones[intersection[1]].position;
        var curend: Vec3 = this.animation.getScene().meshes[0].bones[intersection[1]].endpoint;
        var t: number = Infinity;
        var temp2: Vec3 = new Vec3();
        var axis: Vec3 = new Vec3();
        var angle: number = 0;
        
        console.log("start bone drag" + this.startBoneDrag);
        if(this.startBoneDrag) {
          this.startBoneDrag = false;
          
          this.poCylin = Vec3.sum(p, v.scale(intersection[0], temp2)); // point on cylinder
          
          this.poCylin = Vec3.difference(this.poCylin, j); // local coords of point on cylinder

          var boneDir = Vec3.difference(curend, j).normalize();

          this.curDist = Vec3.dot(this.poCylin, boneDir); // how far corresponding bone is from joint
          
        }
        else  {
          var disc: number = Math.pow(Vec3.dot(v, Vec3.difference(p, j)), 2) - (Vec3.squaredDistance(p, j) - Math.pow(this.curDist, 2));
          if(disc >= 0) {
            t = -1 * Vec3.dot(v, Vec3.difference(p , j)) + Math.sqrt(disc);
            console.log("t " + t);
            var newend: Vec3 = p.add(v.scale(t, temp2), temp2);
            axis = Vec3.cross(curend.subtract(j), newend.subtract(j)).normalize();
            angle = Math.acos(Vec3.dot(newend.normalize(), curend.normalize()));
            
            console.log("v " + v.xyz.toLocaleString());
            console.log("")
            console.log("angle " + angle);
            console.log("prev loc " + curend.xyz.toLocaleString());
            console.log("new location " + newend.xyz.toLocaleString());   
            console.log("axis " + axis.xyz.toLocaleString());
            console.log("cur dist " + this.curDist);

            var nq: Quat = Quat.fromAxisAngle(axis, angle);
            var cq: Quat = nq.multiply(this.animation.getScene().meshes[0].bones[intersection[1]].rotation);
            this.animation.getScene().meshes[0].bones[intersection[1]].rotation = cq;
            this.animation.getScene().meshes[0].bones[intersection[1]].endpoint = nq.multiplyVec3(curend).add(j);
          }
        }  
      }
      else { // hovering
        // this.cont = false;
      }


      

      
      //TO DO write the recursive function for rotation
    }
    
    // TODO
    // You will want logic here:
    // 1) To highlight a bone, if the mouse is hovering over a bone;
    // 2) To rotate a bone, if the mouse button is pressed and currently highlighting a bone.

    
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
    this.dragging = false;
    this.draggingBone = false;
    this.prevX = 0;
    this.prevY = 0;
    
    // TODO
    // Maybe your bone highlight/dragging logic needs to do stuff here too
    // this.first = true;
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
        this.camera.roll(GUI.rollSpeed, true);
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
