import * as THREE from 'three'
import { AudioData } from './audio'

export interface GPGPUOptions {
  size: number
  renderer: THREE.WebGLRenderer
}

export class GPGPUManager {
  private size: number
  private renderer: THREE.WebGLRenderer
  private scene: THREE.Scene
  private camera: THREE.Camera

  public posRes: { read: THREE.WebGLRenderTarget, write: THREE.WebGLRenderTarget }
  public velRes: { read: THREE.WebGLRenderTarget, write: THREE.WebGLRenderTarget }
  public parametricRes: THREE.WebGLRenderTarget

  private velMaterial: THREE.ShaderMaterial
  private posMaterial: THREE.ShaderMaterial
  private mesh: THREE.Mesh

  constructor(options: GPGPUOptions) {
    this.size = options.size
    this.renderer = options.renderer

    this.scene = new THREE.Scene()
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)

    const gl = this.renderer.getContext() as WebGL2RenderingContext
    const supportsHDR = !!gl.getExtension('EXT_color_buffer_float')

    const createRenderTarget = () => new THREE.WebGLRenderTarget(this.size, this.size, {
      minFilter: THREE.NearestFilter,
      magFilter: THREE.NearestFilter,
      format: THREE.RGBAFormat,
      type: supportsHDR ? THREE.FloatType : THREE.HalfFloatType,
      stencilBuffer: false,
      depthBuffer: false
    })

    this.posRes = { read: createRenderTarget(), write: createRenderTarget() }
    this.velRes = { read: createRenderTarget(), write: createRenderTarget() }
    this.parametricRes = createRenderTarget()

    // Mesh for simulation pass
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2))
    this.scene.add(this.mesh)

    // Initial Shaders (Semi-Implicit Euler + Forces + Morphogenesis)
    this.velMaterial = new THREE.ShaderMaterial({
      uniforms: {
        u_posTex: { value: null },
        u_velTex: { value: null },
        u_paramTex: { value: null },
        u_dt: { value: 1 / 60 },
        u_time: { value: 0 },
        u_maxVel: { value: 10.0 },
        u_audioLow: { value: 0 },
        u_audioMid: { value: 0 },
        u_audioHigh: { value: 0 },
        u_audioAll: { value: 0 },
        u_audioSub: { value: 0 },
        u_audioPeak: { value: 0 },

        // Physical Constants
        u_k: { value: 0.1 },        // Harmonic
        u_gamma: { value: 0.5 },    // Damping
        u_omega: { value: 0.2 },    // Vortex
        u_noiseFreq: { value: 1.5 },
        u_noiseAmp: { value: 0.05 },

        // Morphogenesis (Torus)
        u_radiusMajor: { value: 1.0 },
        u_radiusMinor: { value: 0.4 },
        u_alpha: { value: 1.0 },    // Surface constraint strength
        u_beta: { value: 0.5 },     // Field strength
        u_maxGrad: { value: 5.0 },  // Gradient clamping
        u_n: { value: 4.0 },        // Symmetry n
        u_m: { value: 2.0 }         // Symmetry m
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform sampler2D u_posTex;
        uniform sampler2D u_velTex;
        uniform sampler2D u_paramTex;
        uniform float u_dt;
        uniform float u_time;
        uniform float u_maxVel;
        
        uniform float u_audioLow;
        uniform float u_audioMid;
        uniform float u_audioHigh;
        uniform float u_audioAll;
        uniform float u_audioSub;
        uniform float u_audioPeak;
        
        uniform float u_k;
        uniform float u_gamma;
        uniform float u_omega;
        uniform float u_noiseFreq;
        uniform float u_noiseAmp;
        
        uniform float u_radiusMajor;
        uniform float u_radiusMinor;
        uniform float u_alpha;
        uniform float u_beta;
        uniform float u_maxGrad;
        uniform float u_n;
        uniform float u_m;
        
        varying vec2 vUv;

        // --- Simplex Noise 3D ---
        vec4 permute(vec4 x){return mod(((x*34.0)+1.0)*x, 289.0);}
        vec4 taylorInvSqrt(vec4 r){return 1.79284291400159 - 0.85373472095314 * r;}
        float snoise(vec3 v){ 
          const vec2  C = vec2(1.0/6.0, 1.0/3.0) ;
          const vec4  D = vec4(0.0, 0.5, 1.0, 2.0);
          vec3 i  = floor(v + dot(v, C.yyy) );
          vec3 x0 =   v - i + dot(i, C.xxx) ;
          vec3 g = step(x0.yzx, x0.xyz);
          vec3 l = 1.0 - g;
          vec3 i1 = min( g.xyz, l.zxy );
          vec3 i2 = max( g.xyz, l.zxy );
          vec3 x1 = x0 - i1 + 1.0 * C.xxx;
          vec3 x2 = x0 - i2 + 2.0 * C.xxx;
          vec3 x3 = x0 - 1.0 + 3.0 * C.xxx;
          i = mod(i, 289.0); 
          vec4 p = permute( permute( permute( 
                     i.z + vec4(0.0, i1.z, i2.z, 1.0 ))
                   + i.y + vec4(0.0, i1.y, i2.y, 1.0 )) 
                   + i.x + vec4(0.0, i1.x, i2.x, 1.0 ));
          float n_ = 1.0/7.0;
          vec3  ns = n_ * D.wyz - D.xzx;
          vec4 j = p - 49.0 * floor(p * ns.z *ns.z);
          vec4 x_ = floor(j * ns.z);
          vec4 y_ = floor(j - 7.0 * x_ );
          vec4 x = x_ *ns.x + ns.yyyy;
          vec4 y = y_ *ns.x + ns.yyyy;
          vec4 h = 1.0 - abs(x) - abs(y);
          vec4 b0 = vec4( x.xy, y.xy );
          vec4 b1 = vec4( x.zw, y.zw );
          vec4 s0 = floor(b0)*2.0 + 1.0;
          vec4 s1 = floor(b1)*2.0 + 1.0;
          vec4 sh = -step(h, vec4(0.0));
          vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy ;
          vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww ;
          vec3 p0 = vec3(a0.xy,h.x);
          vec3 p1 = vec3(a0.zw,h.y);
          vec3 p2 = vec3(a1.xy,h.z);
          vec3 p3 = vec3(a1.zw,h.w);
          vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2, p2), dot(p3,p3)));
          p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
          vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
          m = m * m;
          return 42.0 * dot( m*m, vec4( dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3) ) );
        }

        vec3 getCurl(vec3 p) {
          float e = 0.01;
          vec3 dx = vec3(e, 0.0, 0.0);
          vec3 dy = vec3(0.0, e, 0.0);
          vec3 dz = vec3(0.0, 0.0, e);
          
          float pnx = snoise(p + dx); float pny = snoise(p + dy); float pnz = snoise(p + dz);
          float nnx = snoise(p - dx); float nny = snoise(p - dy); float nnz = snoise(p - dz);
          
          float x = (pny - nny) - (pnz - nnz);
          float y = (pnz - nnz) - (pnx - nnx);
          float z = (pnx - nnx) - (pny - nny);
          
          return normalize(vec3(x, y, z));
        }

        void main() {
          vec4 posData = texture2D(u_posTex, vUv);
          vec4 velData = texture2D(u_velTex, vUv);
          vec4 param = texture2D(u_paramTex, vUv);
          
          vec3 pos = posData.xyz;
          vec3 vel = velData.xyz;
          
          float theta = param.x;
          float phi = param.y;

          vec3 force = vec3(0.0);
          
          // --- MORPHOGENESIS: Toroidal Target ---
          float R = u_radiusMajor + u_audioLow * 1.0; // Boosted major modulation
          float r = u_radiusMinor * (1.0 + sin(u_n * theta) * sin(u_m * phi + u_time) * u_audioMid * 1.5); // Boosted structural warp (1.5)
          
          vec3 target;
          target.x = (R + r * cos(phi)) * cos(theta);
          target.y = (R + r * cos(phi)) * sin(theta);
          target.z = r * sin(phi);
          
          // 0. Surface Constraint (Harmonic toward target)
          force += -u_alpha * (pos - target);

          // --- IMPLICIT FIELD: S-Field Gradient ---
          float A = dot(pos, pos) + R*R - r*r;
          vec3 gradS = 4.0 * A * pos - 8.0 * R*R * vec3(pos.x, pos.y, 0.0);
          
          // Apply field force with epsilon for stability (branchless)
          float gradLen = length(gradS);
          force += -u_beta * (gradS / (gradLen + 1e-6)) * min(gradLen, u_maxGrad);

          // 1. Harmonic (Target Center)
          force += -u_k * pos;
          
          // 2. Damping (with Kick effect: reduce damping during peaks)
          float kick = step(0.8, u_audioLow) * 0.5; // If audio > 0.8, reduced damping by 50%
          float damping = u_gamma * (1.0 - u_audioMid * 0.5) * (1.0 - kick);
          force += -damping * vel;
          
          // 3. Vortex (around Y axis)
          force += cross(vec3(0.0, 1.0, 0.0), normalize(pos + 1e-6)) * u_omega * u_audioLow;
          
          // 4. Curl Noise
          force += getCurl(pos * u_noiseFreq + u_time * 0.1) * u_noiseAmp * (1.0 + u_audioHigh);

          // Audio Expansion Impulse: Non-linear response (Peak-based)
          // We use u_audioPeak squared for a punchier "kick" effect
          float expansion = pow(u_audioPeak, 1.5) * 6.0;
          force += normalize(pos + 1e-6) * expansion;
          
          // Sub-bass rumbles: shakes the structure
          force += vec3(snoise(pos + u_time), snoise(pos - u_time), snoise(pos * 0.5)) * u_audioSub * 2.0;

          // Apply force
          vel += force * u_dt;

          // Branchless velocity clamping
          float speed = length(vel);
          vel = normalize(vel + 1e-6) * min(speed, u_maxVel);

          gl_FragColor = vec4(vel, velData.w);
        }
      `
    })

    this.posMaterial = new THREE.ShaderMaterial({
      uniforms: {
        u_posTex: { value: null },
        u_velTex: { value: null },
        u_dt: { value: 1 / 60 }
      },
      vertexShader: this.velMaterial.vertexShader,
      fragmentShader: `
        uniform sampler2D u_posTex;
        uniform sampler2D u_velTex;
        uniform float u_dt;
        varying vec2 vUv;

        void main() {
          vec4 pos = texture2D(u_posTex, vUv);
          vec4 vel = texture2D(u_velTex, vUv); // This is updated velocity v(t+dt)
          
          pos.xyz += vel.xyz * u_dt;
          
          gl_FragColor = pos;
        }
      `
    })

    this.initData()
  }

  public updateAudio(data: AudioData) {
    this.velMaterial.uniforms.u_audioLow.value = data.low
    this.velMaterial.uniforms.u_audioMid.value = data.mid
    this.velMaterial.uniforms.u_audioHigh.value = data.high
    this.velMaterial.uniforms.u_audioAll.value = data.all
    this.velMaterial.uniforms.u_audioSub.value = data.sub
    this.velMaterial.uniforms.u_audioPeak.value = data.peak
  }

  public setParams(params: {
    k?: number, gamma?: number, omega?: number, noiseFreq?: number, noiseAmp?: number,
    radiusMajor?: number, radiusMinor?: number, alpha?: number, beta?: number, maxGrad?: number,
    n?: number, m?: number
  }) {
    if (params.k !== undefined) this.velMaterial.uniforms.u_k.value = params.k
    if (params.gamma !== undefined) this.velMaterial.uniforms.u_gamma.value = params.gamma
    if (params.omega !== undefined) this.velMaterial.uniforms.u_omega.value = params.omega
    if (params.noiseFreq !== undefined) this.velMaterial.uniforms.u_noiseFreq.value = params.noiseFreq
    if (params.noiseAmp !== undefined) this.velMaterial.uniforms.u_noiseAmp.value = params.noiseAmp
    if (params.radiusMajor !== undefined) this.velMaterial.uniforms.u_radiusMajor.value = params.radiusMajor
    if (params.radiusMinor !== undefined) this.velMaterial.uniforms.u_radiusMinor.value = params.radiusMinor
    if (params.alpha !== undefined) this.velMaterial.uniforms.u_alpha.value = params.alpha
    if (params.beta !== undefined) this.velMaterial.uniforms.u_beta.value = params.beta
    if (params.maxGrad !== undefined) this.velMaterial.uniforms.u_maxGrad.value = params.maxGrad
    if (params.n !== undefined) this.velMaterial.uniforms.u_n.value = params.n
    if (params.m !== undefined) this.velMaterial.uniforms.u_m.value = params.m
  }

  private initData() {
    const total = this.size * this.size
    const posData = new Float32Array(total * 4)
    const velData = new Float32Array(total * 4)
    const paramData = new Float32Array(total * 4)

    for (let i = 0; i < total; i++) {
      // Position: Random sphere expansion
      const theta = Math.random() * Math.PI * 2
      const phi = Math.acos(2 * Math.random() - 1)
      const r = 0.1
      posData[i * 4 + 0] = r * Math.sin(phi) * Math.cos(theta)
      posData[i * 4 + 1] = r * Math.sin(phi) * Math.sin(theta)
      posData[i * 4 + 2] = r * Math.cos(phi)
      posData[i * 4 + 3] = 1.0 // Energy

      // Velocity: random small initial
      velData[i * 4 + 0] = (Math.random() - 0.5) * 0.01
      velData[i * 4 + 1] = (Math.random() - 0.5) * 0.01
      velData[i * 4 + 2] = (Math.random() - 0.5) * 0.01
      velData[i * 4 + 3] = 0.0

      // Parametric: Uniform theta, phi
      const u = (i % this.size) / this.size
      const v = Math.floor(i / this.size) / this.size
      paramData[i * 4 + 0] = u * Math.PI * 2
      paramData[i * 4 + 1] = v * Math.PI * 2
      paramData[i * 4 + 2] = Math.random() // Seed
      paramData[i * 4 + 3] = 1.0 // Tier
    }

    const setTextureData = (data: Float32Array, target: THREE.WebGLRenderTarget) => {
      const tex = new THREE.DataTexture(data, this.size, this.size, THREE.RGBAFormat, THREE.FloatType)
      tex.needsUpdate = true
      this.renderer.setRenderTarget(target)
      this.renderer.render(new THREE.Scene().add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.MeshBasicMaterial({ map: tex }))), this.camera)
    }

    setTextureData(posData, this.posRes.read)
    setTextureData(posData, this.posRes.write)
    setTextureData(velData, this.velRes.read)
    setTextureData(velData, this.velRes.write)
    setTextureData(paramData, this.parametricRes)

    this.renderer.setRenderTarget(null)
  }

  public step(dt: number, time: number) {
    // Pass 1: Velocity
    this.mesh.material = this.velMaterial
    this.velMaterial.uniforms.u_posTex.value = this.posRes.read.texture
    this.velMaterial.uniforms.u_velTex.value = this.velRes.read.texture
    this.velMaterial.uniforms.u_paramTex.value = this.parametricRes.texture
    this.velMaterial.uniforms.u_dt.value = dt
    this.velMaterial.uniforms.u_time.value = time
    this.renderer.setRenderTarget(this.velRes.write)
    this.renderer.render(this.scene, this.camera)

    // Swap Vel
    let tmp = this.velRes.read
    this.velRes.read = this.velRes.write
    this.velRes.write = tmp

    // Pass 2: Position
    this.mesh.material = this.posMaterial
    this.posMaterial.uniforms.u_posTex.value = this.posRes.read.texture
    this.posMaterial.uniforms.u_velTex.value = this.velRes.read.texture
    this.posMaterial.uniforms.u_dt.value = dt
    this.renderer.setRenderTarget(this.posRes.write)
    this.renderer.render(this.scene, this.camera)

    // Swap Pos
    tmp = this.posRes.read
    this.posRes.read = this.posRes.write
    this.posRes.write = tmp

    this.renderer.setRenderTarget(null)
  }

  public dispose() {
    this.posRes.read.dispose()
    this.posRes.write.dispose()
    this.velRes.read.dispose()
    this.velRes.write.dispose()
    this.parametricRes.dispose()
    this.velMaterial.dispose()
    this.posMaterial.dispose()
    this.mesh.geometry.dispose()
    this.scene.clear()
  }
}
