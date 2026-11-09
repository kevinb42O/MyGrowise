const vertex = `
attribute vec2 paper;
uniform mediump float progress;
uniform mediump float direction;
uniform mediump float grip;
uniform mediump float shadowPass;
varying mediump vec2 ink;
varying mediump float bend;
void main() {
  ink = paper;
  float x = direction > 0.0 ? paper.x : 1.0 - paper.x;
  float lift = sin(progress * 3.14159);
  float radius = 0.085 + 0.075 * lift;
  float bias = (0.5 - grip) * 0.38 * lift;
  float fold = mix(1.005, -0.34, progress) + (paper.y - 0.5) * bias;
  float distanceFromFold = max(0.0, x - fold);
  float angle = min(3.14159, distanceFromFold / radius);
  float height = radius * (1.0 - cos(angle));
  bend = angle;
  if (shadowPass > 0.5) {
    gl_Position = vec4(paper.x * 2.0 - 1.0, 1.0 - paper.y * 2.0, 0.0, 1.0);
    return;
  }
  if (x > fold) x = fold + radius * sin(angle) - max(0.0, distanceFromFold - radius * 3.14159);
  float y = paper.y + height * (0.38 * (grip - paper.y) + 0.10 * (grip - 0.5));
  if (direction < 0.0) x = 1.0 - x;
  // A small perspective lift gives the curled edge depth without moving the book.
  float perspective = 1.0 + height * 0.16;
  gl_Position = vec4((x * 2.0 - 1.0) * perspective, (1.0 - y * 2.0) * perspective, -height * 1.5, 1.0);
}`;
const fragment = `
precision mediump float;
uniform sampler2D page;
uniform mediump float progress;
uniform mediump float direction;
uniform mediump float grip;
uniform mediump float shadowPass;
varying mediump vec2 ink;
varying mediump float bend;
void main() {
  if (shadowPass > 0.5) {
    float lift = sin(progress * 3.14159);
    float radius = 0.085 + 0.075 * lift;
    float fold = mix(1.005, -0.34, progress) + (ink.y - 0.5) * (0.5 - grip) * 0.38 * lift;
    float x = direction > 0.0 ? ink.x : 1.0 - ink.x;
    float distance = (x - fold - radius * 0.65) / (0.025 + radius * 0.55);
    float shadow = exp(-distance * distance * 1.8) * 0.28 * lift;
    gl_FragColor = vec4(0.13, 0.10, 0.07, shadow);
    return;
  }
  vec3 printed = texture2D(page, ink).rgb;
  float reverseSide = smoothstep(1.48, 1.66, bend);
  vec3 reverse = mix(vec3(0.985, 0.963, 0.910), printed, 0.055);
  vec3 color = mix(printed, reverse, reverseSide);
  // Broad soft shading across the bend, with a narrow highlight on its crest.
  float curve = sin(bend);
  float shade = 1.0 - curve * 0.22;
  float highlight = exp(-pow((bend - 0.85) / 0.24, 2.0)) * 0.12;
  color = color * shade + vec3(1.0, 0.97, 0.89) * highlight;
  gl_FragColor = vec4(color, 1.0);
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
  const across=128,down=24;
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
  const shadowPass=gl.getUniformLocation(program,'shadowPass');
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
  gl.enable(gl.BLEND);
  gl.blendFuncSeparate(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA,gl.ONE,gl.ONE_MINUS_SRC_ALPHA);
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
      gl.uniform1f(shadowPass,1);
      gl.drawElements(gl.TRIANGLES,indices.length,gl.UNSIGNED_SHORT,0);
      gl.clear(gl.DEPTH_BUFFER_BIT);
      gl.uniform1f(shadowPass,0);
      gl.drawElements(gl.TRIANGLES,indices.length,gl.UNSIGNED_SHORT,0);
    },
  };
}
