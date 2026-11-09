const vertex = `
attribute vec2 paper;
uniform float progress;
uniform float direction;
uniform float grip;
varying vec2 ink;
varying float curvature;
varying float folded;
void main() {
  ink = paper;
  float x = direction > 0.0 ? paper.x : 1.0 - paper.x;
  float r = 0.067 + 0.061 * sin(progress * 3.14159);
  float bias = (0.5 - grip) * 0.51 * sin(progress * 3.14159);
  float fold = mix(1.005, -0.34, progress) + (paper.y - 0.5) * bias;
  float distanceFromFold = max(0.0, x - fold);
  float angle = min(3.14159, distanceFromFold / r);
  float height = r * (1.0 - cos(angle));
  if (x > fold) x = fold + r * sin(angle) - max(0.0, distanceFromFold - r * 3.14159);
  float y = paper.y + height * (0.55 * (grip - paper.y) + 0.15 * (grip - 0.5));
  if (direction < 0.0) x = 1.0 - x;
  gl_Position = vec4(x * 2.0 - 1.0, 1.0 - y * 2.0, -height * 1.5, 1.0);
  curvature = sin(angle);
  folded = smoothstep(1.53, 1.68, angle);
}`;
const fragment = `
precision mediump float;
uniform sampler2D page;
varying vec2 ink;
varying float curvature;
varying float folded;
void main() {
  vec3 printed = texture2D(page, ink).rgb;
  vec3 reverse = mix(vec3(0.985, 0.953, 0.881), printed, 0.12);
  vec3 color = mix(printed, reverse, folded);
  float light = 1.0 - curvature * 0.29 + pow(curvature, 7.0) * 0.18;
  gl_FragColor = vec4(color * light, 1.0);
}`;

export function makePaper(canvas:HTMLCanvasElement) {
  const gl=canvas.getContext('webgl',{alpha:true, antialias:true, powerPreference:'low-power'});
  if(!gl)return null;
  const program=gl.createProgram();
  if(!program)return null;
  for(const [type,source] of [[gl.VERTEX_SHADER,vertex],[gl.FRAGMENT_SHADER,fragment]] as const){
    const shader=gl.createShader(type);
    if(!shader)return null;
    gl.shaderSource(shader,source);
    gl.compileShader(shader);
    if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS)){gl.deleteShader(shader);return null;}
    gl.attachShader(program,shader);
    gl.deleteShader(shader);
  }
  gl.linkProgram(program);
  if(!gl.getProgramParameter(program,gl.LINK_STATUS))return null;
  gl.useProgram(program);
  const vertices:number[]=[], indices:number[]=[];
  const across=64,down=12;
  for(let y=0;y<=down;y++)for(let x=0;x<=across;x++)vertices.push(x/across,y/down);
  for(let y=0;y<down;y++)for(let x=0;x<across;x++){
    const a=y*(across+1)+x,b=a+across+1;
    indices.push(a,b,a+1,a+1,b,b+1);
  }
  gl.bindBuffer(gl.ARRAY_BUFFER,gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(vertices),gl.STATIC_DRAW);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,gl.createBuffer());
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,new Uint16Array(indices),gl.STATIC_DRAW);
  const position=gl.getAttribLocation(program,'paper');
  gl.enableVertexAttribArray(position);
  gl.vertexAttribPointer(position,2,gl.FLOAT,false,0,0);
  const progress=gl.getUniformLocation(program,'progress');
  const direction=gl.getUniformLocation(program,'direction');
  const grip=gl.getUniformLocation(program,'grip');
  gl.uniform1i(gl.getUniformLocation(program,'page'),0);
  gl.activeTexture(gl.TEXTURE0);
  const texture=gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D,texture);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
  gl.enable(gl.DEPTH_TEST);
  gl.clearColor(0,0,0,0);
  return {
    use(image:HTMLImageElement|HTMLCanvasElement) {
      if(gl.isContextLost())return false;
      try{
        gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,image);
        return gl.getError()===gl.NO_ERROR;
      }catch{return false;}
    },
    draw(value:number,side:number,anchor:number){
      const ratio=Math.min(devicePixelRatio||1,1.75);
      const width=Math.max(1,Math.round(canvas.clientWidth*ratio));
      const height=Math.max(1,Math.round(canvas.clientHeight*ratio));
      if(canvas.width!==width||canvas.height!==height){canvas.width=width;canvas.height=height;}
      gl.viewport(0,0,width,height);
      gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
      gl.uniform1f(progress,value);
      gl.uniform1f(direction,side);
      gl.uniform1f(grip,anchor);
      gl.drawElements(gl.TRIANGLES,indices.length,gl.UNSIGNED_SHORT,0);
    },
  };
}
