import { Camera } from "../lib/webglutils/Camera.js";
import { Vec3, Vec4, Quat } from "../lib/TSM.js";
export var Mode;
(function (Mode) {
    Mode[Mode["playback"] = 0] = "playback";
    Mode[Mode["edit"] = 1] = "edit";
})(Mode || (Mode = {}));
/**
 * Handles Mouse and Button events along with
 * the the camera.
 */
class GUI {
    /**
     *
     * @param canvas required to get the width and height of the canvas
     * @param animation required as a back pointer for some of the controls
     * @param sponge required for some of the controls
     */
    constructor(canvas, animation) {
        this.hoverX = 0;
        this.hoverY = 0;
        this.first = true;
        this.cont = false;
        this.curDist = 0;
        this.poCylin = new Vec3();
        this.height = canvas.height;
        this.viewPortHeight = this.height - 200;
        this.width = canvas.width;
        this.prevX = 0;
        this.prevY = 0;
        this.animation = animation;
        this.reset();
        this.registerEventListeners(canvas);
    }
    getNumKeyFrames() {
        // TODO
        // Used in the status bar in the GUI
        return 0;
    }
    getTime() { return this.time; }
    getMaxTime() {
        // TODO
        // The animation should stop after the last keyframe
        return 0;
    }
    /**
     * Resets the state of the GUI
     */
    reset() {
        this.fps = false;
        this.dragging = false;
        this.time = 0;
        this.mode = Mode.edit;
        this.camera = new Camera(new Vec3([0, 0, -6]), new Vec3([0, 0, 0]), new Vec3([0, 1, 0]), 45, this.width / this.viewPortHeight, 0.1, 1000.0);
    }
    /**
     * Sets the GUI's camera to the given camera
     * @param cam a new camera
     */
    setCamera(pos, target, upDir, fov, aspect, zNear, zFar) {
        this.camera = new Camera(pos, target, upDir, fov, aspect, zNear, zFar);
    }
    /**
     * Returns the view matrix of the camera
     */
    viewMatrix() {
        return this.camera.viewMatrix();
    }
    /**
     * Returns the projection matrix of the camera
     */
    projMatrix() {
        return this.camera.projMatrix();
    }
    /**
     * Callback function for the start of a drag event.
     * @param mouse
     */
    dragStart(mouse) {
        if (mouse.offsetY > 600) {
            // outside the main panel
            return;
        }
        // TODO
        // Some logic to rotate the bones, instead of moving the camera, if there is a currently highlighted bone
        this.dragging = true;
        this.first = true;
        this.prevX = mouse.screenX;
        this.prevY = mouse.screenY;
    }
    incrementTime(dT) {
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
    drag(mouse) {
        let x = mouse.offsetX;
        let y = mouse.offsetY;
        // mouse from screen to ndc to world
        const ndx = 2 * (x + 0.5) / this.width - 1;
        const ndy = 1 - (2 * (y + 0.5) / this.viewPortHeight);
        const mouseWorld = this.viewMatrix().inverse().multiply(this.projMatrix().inverse()).multiplyVec4(new Vec4([ndx, ndy, -1, 1]));
        mouseWorld.scale(1.0 / mouseWorld.w);
        mouseWorld.y;
        // ray-cylinder intersection
        const p = this.camera.pos();
        const v = Vec3.direction(new Vec3(mouseWorld.xyz), p);
        var intersection = [Infinity, Infinity];
        this.animation.getScene().meshes[0].bones.forEach((bone, index) => {
            const pa = bone.position;
            const va = Vec3.direction(bone.endpoint, bone.position);
            const p1 = bone.position;
            const p2 = bone.endpoint;
            const dp = Vec3.difference(p, pa);
            const r = 0.1;
            var temp = new Vec3();
            const a = Vec3.difference(v, va.scale(Vec3.dot(v, va), temp)).squaredLength();
            const check = Vec3.difference(v, va.scale(Vec3.dot(v, va), temp));
            const check2 = Vec3.difference(dp, va.scale(Vec3.dot(dp, va), temp));
            const b = 2.0 * Vec3.dot(check, check2);
            const c = Vec3.difference(dp, va.scale(Vec3.dot(dp, va), temp)).squaredLength() - r * r;
            var discriminant = b * b - 4.0 * a * c;
            if (a == 0.0 || discriminant < 0.0) {
                return;
            }
            discriminant = Math.sqrt(discriminant);
            const t2 = (-b + discriminant) / (2.0 * a);
            if (t2 <= 0.0) {
                return;
            }
            const t1 = (-b - discriminant) / (2.0 * a);
            if (t1 > 0.0) {
                const q1 = Vec3.sum(p, v.scale(t1, temp));
                if (t1 < intersection[0] && Vec3.dot(Vec3.difference(q1, p1), Vec3.difference(p2, p1)) >= 0 && Vec3.dot(Vec3.difference(q1, p1), Vec3.difference(p2, p1)) <= Vec3.dot(Vec3.difference(p2, p1), Vec3.difference(p2, p1))) {
                    intersection = [t1, index];
                    return;
                }
            }
            const q2 = Vec3.sum(p, v.scale(t2, temp));
            if (t2 < intersection[0] && Vec3.dot(Vec3.difference(q2, p1), Vec3.difference(p2, p1)) >= 0 && Vec3.dot(Vec3.difference(q2, p1), Vec3.difference(p2, p1)) <= Vec3.dot(Vec3.difference(p2, p1), Vec3.difference(p2, p1))) {
                intersection = [t2, index];
                return;
            }
        });
        this.animation.getScene().meshes[0].setBoneHighlightIndex(intersection[1]);
        if (this.dragging && intersection[1] == Infinity && this.first && this.cont) {
            this.first = true;
            const dx = mouse.screenX - this.prevX;
            const dy = mouse.screenY - this.prevY;
            this.prevX = mouse.screenX;
            this.prevY = mouse.screenY;
            /* Left button, or primary button */
            const mouseDir = this.camera.right();
            mouseDir.scale(-dx);
            mouseDir.add(this.camera.up().scale(dy));
            mouseDir.normalize();
            if (dx === 0 && dy === 0) {
                return;
            }
            switch (mouse.buttons) {
                case 1: {
                    let rotAxis = Vec3.cross(this.camera.forward(), mouseDir);
                    rotAxis = rotAxis.normalize();
                    if (this.fps) {
                        this.camera.rotate(rotAxis, GUI.rotationSpeed);
                    }
                    else {
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
        else if (intersection[1] != Infinity) {
            var qnew = new Quat();
            // console.log("bone" + intersection[1]);
            if (mouse.buttons == 1) {
                this.cont = true;
                var j = this.animation.getScene().meshes[0].bones[intersection[1]].position;
                var curend = this.animation.getScene().meshes[0].bones[intersection[1]].endpoint;
                var t = Infinity;
                var temp2 = new Vec3();
                var axis = new Vec3();
                var angle = 0;
                console.log("first" + this.first);
                if (this.first) {
                    this.first = false;
                    this.poCylin = Vec3.sum(p, v.scale(intersection[0], temp2)); // point on cylinder
                    this.poCylin = Vec3.difference(this.poCylin, j); // local coords of point on cylinder
                    var boneDir = Vec3.difference(curend, j).normalize();
                    this.curDist = Vec3.dot(this.poCylin, boneDir); // how far corresponding bone is from joint
                }
                else {
                    var disc = Math.pow(Vec3.dot(v, Vec3.difference(p, j)), 2) - (Vec3.squaredDistance(p, j) - Math.pow(this.curDist, 2));
                    if (disc >= 0) {
                        t = -1 * Vec3.dot(v, Vec3.difference(p, j)) + Math.sqrt(disc);
                        console.log("t " + t);
                        var newend = p.add(v.scale(t, temp2), temp2);
                        axis = Vec3.cross(curend.subtract(j), newend.subtract(j)).normalize();
                        angle = Math.acos(Vec3.dot(newend.normalize(), curend.normalize()));
                        console.log("v " + v.xyz.toLocaleString());
                        console.log("");
                        console.log("angle " + angle);
                        console.log("prev loc " + curend.xyz.toLocaleString());
                        console.log("new location " + newend.xyz.toLocaleString());
                        console.log("axis " + axis.xyz.toLocaleString());
                        console.log("cur dist " + this.curDist);
                        var nq = Quat.fromAxisAngle(axis, angle);
                        var cq = nq.multiply(this.animation.getScene().meshes[0].bones[intersection[1]].rotation);
                        this.animation.getScene().meshes[0].bones[intersection[1]].rotation = cq;
                        this.animation.getScene().meshes[0].bones[intersection[1]].endpoint = nq.multiplyVec3(curend).add(j);
                    }
                }
            }
            else {
                this.first = true;
                this.cont = false;
            }
            //TO DO write the recursive function for rotation
        }
        // TODO
        // You will want logic here:
        // 1) To highlight a bone, if the mouse is hovering over a bone;
        // 2) To rotate a bone, if the mouse button is pressed and currently highlighting a bone.
    }
    getModeString() {
        switch (this.mode) {
            case Mode.edit: {
                return "edit: " + this.getNumKeyFrames() + " keyframes";
            }
            case Mode.playback: {
                return "playback: " + this.getTime().toFixed(2) + " / " + this.getMaxTime().toFixed(2);
            }
        }
    }
    /**
     * Callback function for the end of a drag event
     * @param mouse
     */
    dragEnd(mouse) {
        this.dragging = false;
        this.prevX = 0;
        this.prevY = 0;
        // TODO
        // Maybe your bone highlight/dragging logic needs to do stuff here too
    }
    /**
     * Callback function for a key press event
     * @param key
     */
    onKeydown(key) {
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
                this.camera.offset(this.camera.forward().negate(), GUI.zoomSpeed, true);
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
                if (this.mode === Mode.edit && this.getNumKeyFrames() > 1) {
                    this.mode = Mode.playback;
                    this.time = 0;
                }
                else if (this.mode === Mode.playback) {
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
    registerEventListeners(canvas) {
        /* Event listener for key controls */
        window.addEventListener("keydown", (key) => this.onKeydown(key));
        /* Event listener for mouse controls */
        canvas.addEventListener("mousedown", (mouse) => this.dragStart(mouse));
        canvas.addEventListener("mousemove", (mouse) => this.drag(mouse));
        canvas.addEventListener("mouseup", (mouse) => this.dragEnd(mouse));
        /* Event listener to stop the right click menu */
        canvas.addEventListener("contextmenu", (event) => event.preventDefault());
    }
}
GUI.rotationSpeed = 0.05;
GUI.zoomSpeed = 0.1;
GUI.rollSpeed = 0.1;
GUI.panSpeed = 0.1;
export { GUI };
//# sourceMappingURL=Gui.js.map