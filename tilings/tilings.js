"use strict"

let Tilings = {};

const PI = Math.acos(-1)
const TRIANGLE = "TRIANGLE"
const VODERBERG = "VODERBERG"
const SYMMETRIC = "SYMMETRIC"
const ASYMMETRIC = "ASYMMETRIC"

let N = 12 // Sector angle is PI/N
let offset = 0, level = 2
let ncolors = 3;
let coloroffset = 0;
let zoom = 0;

let type = null
let mousepos = null

// Complex number functions, represented as arrays of 2 elements
let cmul2 = (z,w) => [z[0]*w[0]-z[1]*w[1],z[0]*w[1]+z[1]*w[0]]
let cmul = (w,...zs) => zs.reduce(cmul2,w)
let cadd2 = (z,w) => [z[0]+w[0],z[1]+w[1]]
let cadd = (w,...zs) => zs.reduce(cadd2,w)
let mul = (xs,y) => xs.map(x=>x*y)
let div = (xs,y) => xs.map(x=>x/y)
let cminus = z => mul(z,-1)
let csub = (z,w) => cadd(z,cminus(w))
let cconj = z => [z[0],-z[1]]
let xrefl = z => [-z[0],z[1]]
let expi = t => [Math.cos(t),Math.sin(t)]
let rotate = (a,theta) => cmul(a,expi(theta))
let mid = (a,b) => mul(cadd(a,b),0.5)
let length = (z) => Math.sqrt(dot(z,z))
let dot = (z,w) => z[0]*w[0]+z[1]*w[1] // For arbitrary vectors?

//let inverse2 = m => div([m[3],-m[1],-m[2],m[0]],m[0]*m[3]-m[1]*m[2])
//let mmul = (m,z) => [m[0]*z[0]+m[2]*z[1],m[1]*z[0]+m[3]*z[1]]
let det = (a,b) => a[0]*b[1]-a[1]*b[0]

// Barycentric coordinates
let applybary = (bary,a,b,c) => cadd(mul(a,bary[0]),mul(b,bary[1]),mul(c,bary[2]))
let getbary = (z,a,b,c) => {
    z = csub(z,a), b = csub(b,a), c = csub(c,a) // Rebase at a
    let d = det(b,c), q = det(z,c)/d, r = det(b,z)/d // Cramer
    return [1-q-r,q,r]
}

const palette = ["#FE2712","#FC600A","#FB9902","#FCCC1A","#FEFE33","#B2D732",
                 "#66B032","#347C98","#0247FE","#4424D6","#8601AF","#C21460"]
const palette1 = ["rgb(255,0,0)","rgb(255,255,0)","rgb(0,255,0)",
                  "rgb(0,255,255)","rgb(0,0,255)","rgb(255,0,255)",
                  "rgb(255,255,255)","rgb(100,100,100)"]

function getcolor(index) {
    index %= ncolors;
    if (ncolors <= 6) index *= 2
    index += coloroffset
    return palette[index%palette.length]
}

function drawtriangle(ctx,points,a,b,c,index) {
    ctx.fillStyle = getcolor(index);
    ctx.beginPath();
    for (let i in points) {
        let point = applybary(points[i],a,b,c)
        if (i == 0) ctx.moveTo(...point)
        else ctx.lineTo(...point)
    }
    ctx.closePath()
    ctx.fill()
    ctx.stroke()
}

function f(ctx,points,a,b,c,level,index) {
    if (level == 0) {
        drawtriangle(ctx,points,a,b,c,index);
    } else {
        index *= 4
        let ab = mid(a,b)
        let bc = mid(b,c)
        let ca = mid(c,a)
        if (type == SYMMETRIC && level == 1) {
            drawtriangle(ctx,points,a,ab,ca,index+0);
            drawtriangle(ctx,points,ab,bc,b,index+1);
            drawtriangle(ctx,points,bc,ca,ab,index+2);
            drawtriangle(ctx,points,ca,c,bc,index+3);
        } else {
            f(ctx,points,a,ab,ca,level-1,index+0);
            f(ctx,points,ab,b,bc,level-1,index+1);
            f(ctx,points,bc,ca,ab,level-1,index+2);
            f(ctx,points,ca,bc,c,level-1,index+3);
        }
    }
}

// Return list of barycentric coordinates (based on reference triangle)
// of the polygon to be drawn for each triangle region.
function triangle(canvas,theta) {
    return [[1,0,0],[0,1,0],[0,0,1]]
}

function symmetric(canvas,theta) {
    let A = [1,0], B = [-1,0];
    let f = z => cadd(A,rotate(csub(z,A),theta))
    let C = f(B)
    let X = [0.5,0.25], Y = [0,0.33]
    if (mousepos) X = [mousepos[0]/canvas.width,mousepos[1]/canvas.height]
    let s = [A,X,Y,xrefl(X),B,C,f(xrefl(X)),f(Y),f(X)]
    return s.map(p => getbary(p,A,B,C));
}

function asymmetric(canvas,theta) {
    let A = [1,0], B = [-1,0];
    let f = z => cadd(A,rotate(csub(z,A),theta))
    let C = f(B)
    let X = [0.5,0.25]
    if (mousepos) X = [mousepos[0]/canvas.width,mousepos[1]/canvas.height]
    let s = [A,X,cminus(X),B,C,f(cminus(X)),f(X)]
    return s.map(p => getbary(p,A,B,C));
}

function voderberg(canvas,theta) {
    let A = [1,0], B = [-1,0];
    let f = z => cadd(A,rotate(csub(z,A),theta))
    let C = f(B);
    let D = cadd(A,rotate(csub(B,A),-theta));
    let X = [-0.533,0.43] // For N = 16 - note -ve x coordinate!
    if (mousepos) X = [-mousepos[0]/canvas.width,mousepos[1]/canvas.height]
    let s = [A,cminus(D),cminus(X),X,D,B,f(X),f(cminus(X)),f(cminus(D))]
    return s.map(p => getbary(p,A,B,C));
}

Tilings.drawtiling = function(canvas) {
    //let info = getElementById("info")
    //let parameters = getElementById("parameters")
    function redisplay(ms) {
        let pdr = window.devicePixelRatio
        //if (pdr != 1) alert("PDR is " + pdr)
        type = parameters.tilingtype.value;
        N = Number(parameters.angle.value);
        offset = Number(parameters.offset.value);
        level = Number(parameters.level.value);
        ncolors = Number(parameters.ncolors.value);
        coloroffset = Number(parameters.coloroffset.value);
        let theta = PI/N
        let points = null;
        if (type == TRIANGLE) points = triangle(canvas,theta)
        else if (type == VODERBERG) points = voderberg(canvas,theta)
        else if (type == SYMMETRIC) points = symmetric(canvas,theta)
        else if (type == ASYMMETRIC) points = asymmetric(canvas,theta)
        else error("No type specified")
        let cwidth = canvas.clientWidth*pdr;
        let cheight = canvas.clientHeight*pdr;
        if (cwidth != canvas.width || cheight != canvas.height) {
            canvas.width = cwidth;
            canvas.height = cheight;
        }
        let ctx = canvas.getContext("2d");
        ctx.fillStyle = "#FFFF00";
        ctx.clearRect(0,0,cwidth,cheight);
        ctx.save();
        //ctx.fill("evenodd");
        // Now transform to sensible coordinates
        // Need to apply transform to eg. mouse position
        ctx.transform(0.5*cheight,0,0,-0.5*cheight,0.5*cwidth,0.5*cheight)
        let px = pdr/cheight;
        let scale = Math.exp(0.1*zoom);
        ctx.lineWidth = px/scale
        ctx.scale(scale,scale)
        for (let i = 0; i < 2*N; i++) {
            //if (i == N) ctx.translate(0,-0.05);
            let a = [0,0];
            let b = expi(i*theta)
            let c = expi((i+1)*theta)
            if (type == SYMMETRIC && offset%2 == 1 && i >= N) [b,c] = [c,b]
            let off = offset/(1<<(level+1))*(i < N ? -1 : 1);
            a[0] += off; b[0] += off; c[0] += off
            f(ctx,points,a,b,c,level,i)
        }
        ctx.restore();
        //window.requestAnimationFrame(redisplay);
    }
    let redraw = () => requestAnimationFrame(redisplay);
    window.addEventListener("load",redraw);
    window.addEventListener("resize",redraw);
    parameters.tilingtype.addEventListener("input",redraw);
    parameters.angle.addEventListener("input",redraw);
    parameters.offset.addEventListener("input",redraw);
    parameters.level.addEventListener("input",redraw);
    parameters.ncolors.addEventListener("input",redraw);
    parameters.coloroffset.addEventListener("input",redraw);
    let mousedown = false;
    function onMouseUpdate(e) {
        if (mousedown) {
            mousepos = [e.clientX,e.clientY];
            window.requestAnimationFrame(redisplay);
        }
    }
    window.addEventListener('mousemove', onMouseUpdate);
    window.addEventListener('mousedown',e => { mousedown = true; })
    window.addEventListener('mouseup',e => { mousedown = false; })
    function keydownHandler( event ) {
        // Handle key presses when control is pressed
        if (!event.ctrlKey || event.altKey) return;
        //console.log("Keydown: ", event.charCode, event.keyCode, event);
        let code = event.keyCode
	switch (code) {
        case 38:
            zoom++
            break;
        case 40:
            zoom--
            break;
        default: return;
	}
        requestAnimationFrame(redisplay);
        event.preventDefault();
    }
    let show = true;
    function keypressHandler(event) {
        // Ignore event if control key or alt key pressed.
        if (event.ctrlKey || event.altKey) return;
        let c = String.fromCharCode(event.charCode)
        //console.log("Keypress: ", c, event.charCode, event.keyCode, event);
        switch(c) {
        case '?': 
            show = !show
            controls.style.display = info.style.display = show ? "block" : "none"
            break;
        default: return;
        }
        event.preventDefault();
    }
    window.addEventListener('keydown',keydownHandler);
    window.addEventListener('keypress',keypressHandler);
    requestAnimationFrame(redisplay);
    console.log("Tilings Version 0.3")
}

let test = () => {
    let a = [1,2], b = [3,4], c = [5,5] // Not collinear!
    let p = div([1,2,3],6)
    let z = applybary(p,a,b,c);
    let p1 = getbary(z,a,b,c)
    let z1 = applybary(p1,a,b,c);
    console.assert(length(csub(z,z1)) < 1e-6)
}
test()
