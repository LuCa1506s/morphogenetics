import * as THREE from 'three'

export interface ParticleSystemOptions {
  size: number
  scene: THREE.Scene
}

export class ParticleSystem {
  private size: number
  private scene: THREE.Scene
  private geometry: THREE.BufferGeometry
  private material: THREE.ShaderMaterial
  private points: THREE.Points

  constructor(options: ParticleSystemOptions) {
    this.size = options.size
    this.scene = options.scene

    this.geometry = this.createGeometry()
    this.material = this.createMaterial()
    this.points = new THREE.Points(this.geometry, this.material)
    this.points.frustumCulled = false // Logic managed via shaders or global bounding box
    this.scene.add(this.points)
  }

  private createGeometry(): THREE.BufferGeometry {
    const geo = new THREE.BufferGeometry()
    const total = this.size * this.size
    const uvs = new Float32Array(total * 2)

    for (let i = 0; i < total; i++) {
      const u = (i % this.size) / this.size
      const v = Math.floor(i / this.size) / this.size
      uvs[i * 2 + 0] = u
      uvs[i * 2 + 1] = v
    }

    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(total * 3), 3))
    geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2))

    return geo
  }

  private createMaterial(): THREE.ShaderMaterial {
    return new THREE.ShaderMaterial({
      uniforms: {
        u_posTex: { value: null },
        u_velTex: { value: null },
        u_paramTex: { value: null },
        u_pixelRatio: { value: window.devicePixelRatio },
        u_size: { value: 2.0 },
        u_debugMode: { value: 1 }, // Default to Velocity (1)
        u_baseColor: { value: new THREE.Color(1.0, 0.8, 0.2) }, // Default Yellow
        u_audioLow: { value: 0 }
      },
      vertexShader: `
        uniform sampler2D u_posTex;
        uniform sampler2D u_velTex;
        uniform float u_pixelRatio;
        uniform float u_size;
        uniform float u_audioLow;
        varying vec2 vUv;
        varying vec3 vVel;
        varying float vEnergy;
        varying float vAudio;

        void main() {
          vUv = uv;
          vec4 posData = texture2D(u_posTex, vUv);
          vec4 velData = texture2D(u_velTex, vUv);
          
          vVel = velData.xyz;
          vEnergy = posData.w;
          vAudio = u_audioLow;

          vec4 mvPosition = modelViewMatrix * vec4(posData.xyz, 1.0);
          
          // Size attenuation + Audio scale boost
          float audioScale = 1.0 + u_audioLow * 2.0;
          gl_PointSize = u_size * u_pixelRatio * (1.0 / -mvPosition.z) * (1.0 + vEnergy * 0.5) * audioScale;
          
          // Point size cap to mitigate overdraw near camera
          gl_PointSize = min(gl_PointSize, 128.0);
          
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        varying vec2 vUv;
        varying vec3 vVel;
        varying float vEnergy;
        varying float vAudio;
        uniform int u_debugMode;
        uniform vec3 u_baseColor;

        void main() {
          // Soft circular mask
          float dist = distance(gl_PointCoord, vec2(0.5));
          if (dist > 0.5) discard;
          
          float alpha = smoothstep(0.5, 0.0, dist);
          
          vec3 color = vec3(0.0);
          
          if (u_debugMode == 0) {
            // Default: Energy-based color (Blue -> White -> Selected Color)
            vec3 c1 = vec3(0.05, 0.1, 0.2); // Darker base
            vec3 c2 = vec3(1.0, 1.0, 1.0);
            vec3 c3 = u_baseColor;
            
            float t = clamp(vEnergy, 0.0, 1.0);
            if (t < 0.5) {
              color = mix(c1, c2, t * 2.0);
            } else {
              color = mix(c2, c3, (t - 0.5) * 2.0);
            }
            
            // Audio-driven exposure boost
            color *= (1.0 + vAudio * 2.5);
            
            // Speed boost
            color += length(vVel) * 0.3;
          } else if (u_debugMode == 1) {
            // Velocity debug
            color = normalize(vVel) * 0.5 + 0.5;
          } else if (u_debugMode == 2) {
            // Grayscale speed
            float speed = length(vVel);
            float t_speed = clamp(speed * 2.0, 0.0, 1.0);
            color = mix(vec3(0.8, 0.8, 0.8), vec3(1.0, 1.0, 1.0), t_speed);
          }
          
          gl_FragColor = vec4(color, alpha * 0.8);
        }
      `,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      depthTest: true
    })
  }

  public update(posTex: THREE.Texture, velTex: THREE.Texture, paramTex: THREE.Texture) {
    this.material.uniforms.u_posTex.value = posTex
    this.material.uniforms.u_velTex.value = velTex
    this.material.uniforms.u_paramTex.value = paramTex
  }

  public updateAudio(data: any) {
    this.material.uniforms.u_audioLow.value = data.low
  }

  public setDebugMode(mode: number) {
    this.material.uniforms.u_debugMode.value = mode
  }

  public setBaseColor(hex: string) {
    this.material.uniforms.u_baseColor.value.set(hex)
  }

  public dispose() {
    this.geometry.dispose()
    this.material.dispose()
    this.scene.remove(this.points)
  }
}
