import './style.css'
import * as THREE from 'three'
import { GPGPUManager } from './gpgpu'
import { ParticleSystem } from './particles'
import { AudioEngine } from './audio'
import config from './presets.json'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'

class Engine {
  private scene: THREE.Scene
  private camera: THREE.PerspectiveCamera
  private renderer: THREE.WebGLRenderer
  private controls: OrbitControls | null = null
  private clock: THREE.Clock
  private fpsOverlay: HTMLDivElement
  private particleCountOverlay: HTMLDivElement

  // GPGPU
  private gpgpu: GPGPUManager | null = null
  private gpgpuSize: number = 512 // Full target: 262k particles
  private accumulator: number = 0
  private readonly dt: number = 1 / 60

  // Particles
  private particles: ParticleSystem | null = null

  // Audio
  private audio: AudioEngine
  private autoMode: boolean = false

  constructor() {
    this.scene = new THREE.Scene()
    this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000)
    this.camera.position.z = 2

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance'
    })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.renderer.setSize(window.innerWidth, window.innerHeight)

    const container = document.createElement('div')
    container.id = 'canvas-container'
    document.getElementById('app')?.appendChild(container)
    container.appendChild(this.renderer.domElement)

    this.controls = new OrbitControls(this.camera, this.renderer.domElement)
    this.controls.enableDamping = true
    this.controls.dampingFactor = 0.05
    this.controls.minDistance = 0.5
    this.controls.maxDistance = 10

    this.clock = new THREE.Clock()
    this.audio = new AudioEngine()

    // UI Setup
    this.setupUI()
    this.fpsOverlay = document.getElementById('fps-counter') as HTMLDivElement
    this.particleCountOverlay = document.getElementById('particle-count') as HTMLDivElement

    // Diagnostics & GPGPU Init
    if (this.checkCapabilities()) {
      this.initGPGPU()
      this.initParticles()

      // Load default preset after GPGPU is ready
      this.loadPreset('default')
    }

    // Events
    window.addEventListener('resize', this.onResize.bind(this))

    this.animate()
  }

  private setupUI() {
    const uiOverlay = document.createElement('div')
    uiOverlay.id = 'ui-overlay'
    uiOverlay.innerHTML = `
      <div id="splash-screen">
        <button id="btn-start" class="start-btn">Start Simulation</button>
        <div class="about-referral-container">
          <a href="about.html" class="about-referral-link">
            <span class="about-text">About Us</span>
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="5" y1="12" x2="19" y2="12"></line>
              <polyline points="12 5 19 12 12 19"></polyline>
            </svg>
          </a>
        </div>
      </div>
      <button id="mobile-menu-toggle" class="mobile-menu-btn" aria-label="Toggle Menu">
        <svg id="mobile-menu-icon" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="15 18 9 12 15 6"></polyline>
        </svg>
      </button>
      <div class="ui-header">
        <h1 class="ui-title">Morphogenesis</h1>
        <div class="ui-stats">
          FPS: <span id="fps-counter">0</span><br>
          PARTICLES: <span id="particle-count">0</span>
        </div>
      </div>
      <div class="sidebar" id="sidebar">
        <h2 style="margin-top: 0; font-size: 1rem;">Simulation Controls</h2>
        <p style="font-size: 0.8rem; opacity: 0.6;">System initialized.</p>
        
        <div class="control-group" style="margin-bottom: 24px; display: flex; flex-direction: column; gap: 10px;">
          <button id="btn-audio" class="ui-btn">Enable Microphone</button>
          <button id="btn-upload" class="ui-btn" style="border-color: rgba(74, 222, 128, 0.4); color: #4ade80;">Upload Audio (Max 25MB)</button>
          <input type="file" accept="audio/*" id="audio-upload" hidden>
          <button id="btn-auto" class="ui-btn">Auto Mode: OFF</button>
        </div>

        <div class="control-group">
          <label>View Mode</label>
          <select id="debug-mode" class="ui-select">
            <option value="1" selected>Velocity (Motion)</option>
            <option value="0">Default (Glow)</option>
            <option value="2">Gray Scale</option>
          </select>
        </div>

        <div class="control-group">
          <label>Particle Count</label>
          <select id="particle-select" class="ui-select">
            <option value="128">16k (Fast)</option>
            <option value="256">65k (Smooth)</option>
            <option value="512" selected>262k (Detailed)</option>
            <option value="1024">1M (Heavy)</option>
          </select>
        </div>

        <div id="color-selection-group" class="control-group" style="display: none;">
          <label>Glow Color</label>
          <div class="color-track">
            <button class="color-btn active" data-color="#ffcc33" style="background: #ffcc33;"></button>
            <button class="color-btn" data-color="#ff4444" style="background: #ff4444;"></button>
            <button class="color-btn" data-color="#4444ff" style="background: #4444ff;"></button>
            <button class="color-btn" data-color="#4ade80" style="background: #4ade80;"></button>
            <button class="color-btn" data-color="#00f2ff" style="background: #00f2ff;"></button>
          </div>
        </div>

        <hr style="border: 0; border-top: 1px solid rgba(255,255,255,0.1); margin: 20px 0;">

        <div class="control-group">
          <div class="label-row">
            <label>Harmonic (k)</label>
            <span id="val-k">0.1</span>
          </div>
          <input type="range" id="input-k" min="0" max="2" step="0.01" value="0.1">
        </div>

        <div class="control-group">
          <div class="label-row">
            <label>Damping (γ)</label>
            <span id="val-gamma">0.5</span>
          </div>
          <input type="range" id="input-gamma" min="0" max="5" step="0.01" value="0.5">
        </div>

        <div class="control-group" data-auto-target="omega">
          <div class="label-row">
            <label>Vortex (ω)</label>
            <span id="val-omega">0.2</span>
          </div>
          <input type="range" id="input-omega" min="0" max="5" step="0.01" value="0.2">
        </div>

        <div class="control-group" data-auto-target="noiseAmp">
          <div class="label-row">
            <label>Noise Amp</label>
            <span id="val-noiseAmp">0.05</span>
          </div>
          <input type="range" id="input-noiseAmp" min="0" max="2" step="0.01" value="0.05">
        </div>

        <hr style="border: 0; border-top: 1px solid rgba(255,255,255,0.1); margin: 20px 0;">

        <div class="control-group" data-auto-target="radiusMajor">
          <div class="label-row">
            <label>Major Radius</label>
            <span id="val-radiusMajor">1.00</span>
          </div>
          <input type="range" id="input-radiusMajor" min="0" max="5" step="0.05" value="1.0">
        </div>

        <div class="control-group" data-auto-target="radiusMinor">
          <div class="label-row">
            <label>Minor Radius</label>
            <span id="val-radiusMinor">0.40</span>
          </div>
          <input type="range" id="input-radiusMinor" min="0" max="2" step="0.05" value="0.4">
        </div>

        <div class="control-group">
          <div class="label-row">
            <label>Constraint (α)</label>
            <span id="val-alpha">1.00</span>
          </div>
          <input type="range" id="input-alpha" min="0" max="5" step="0.1" value="1.0">
        </div>

        <div class="control-group">
          <div class="label-row">
            <label>Field (β)</label>
            <span id="val-beta">0.50</span>
          </div>
          <input type="range" id="input-beta" min="0" max="2" step="0.01" value="0.5">
        </div>

        <div class="control-group" data-auto-target="n">
          <div class="label-row">
            <label>Symmetry (n)</label>
            <span id="val-n">4.00</span>
          </div>
          <input type="range" id="input-n" min="1" max="12" step="1" value="4">
        </div>

        <div class="control-group" data-auto-target="m">
          <div class="label-row">
            <label>Symmetry (m)</label>
            <span id="val-m">2.00</span>
          </div>
          <input type="range" id="input-m" min="1" max="12" step="1" value="2">
        </div>

        <hr>

        <div class="control-group">
          <label>Presets</label>
          <div class="preset-grid">
            <button class="ui-btn preset-btn" data-preset="nebula">Nebula</button>
            <button class="ui-btn preset-btn" data-preset="movie">Movie</button>
            <button class="ui-btn preset-btn" data-preset="crystal">Crystal</button>
            <button class="ui-btn preset-btn" data-preset="default">Default</button>
          </div>
        </div>

        <button id="btn-reset" class="ui-btn" style="margin-top: 10px; border-color: rgba(239, 68, 68, 0.4); color: #ef4444;">Reset Simulation</button>
      </div>
    `
    document.getElementById('app')?.appendChild(uiOverlay)

    const audioBtn = document.getElementById('btn-audio') as HTMLButtonElement
    audioBtn?.addEventListener('click', async () => {
      try {
        const isActive = await this.audio.toggle()
        if (isActive) {
          audioBtn.innerText = 'Audio: ON'
          audioBtn.style.color = '#4ade80'
          audioBtn.style.borderColor = '#4ade80'
        } else {
          audioBtn.innerText = 'Audio: OFF'
          audioBtn.style.color = '#fff'
          audioBtn.style.borderColor = 'rgba(255,255,255,0.2)'
        }
      } catch (err) {
        alert('Audio toggle failed. Check permission.')
      }
    })

    const uploadBtn = document.getElementById('btn-upload') as HTMLButtonElement
    const fileInput = document.getElementById('audio-upload') as HTMLInputElement

    uploadBtn?.addEventListener('click', () => {
      fileInput.click()
    })

    fileInput?.addEventListener('change', () => {
      const file = fileInput.files?.[0]
      if (!file) return

      // Validate size (max 25MB)
      if (file.size > 25 * 1024 * 1024) {
        alert('File too large (max 25MB)')
        return
      }

      // Stop microphone if active
      if (this.audio.isMicrophoneActive) {
        this.audio.stopMicrophone()
        audioBtn.innerText = 'Audio: OFF'
        audioBtn.style.color = '#fff'
        audioBtn.style.borderColor = 'rgba(255,255,255,0.2)'
      }

      const audioURL = URL.createObjectURL(file)
      let playerContainer = document.getElementById('custom-audio-player')
      let audio = document.getElementById('audio-player') as HTMLAudioElement

      if (!playerContainer) {
        playerContainer = document.createElement('div')
        playerContainer.id = 'custom-audio-player'
        playerContainer.innerHTML = `
          <button id="cap-play-btn" class="cap-play-btn">
            <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
          </button>
          <div class="cap-details">
            <div class="cap-header">
              <span id="cap-title">Track Name</span>
              <span id="cap-time">0:00 / 0:00</span>
            </div>
            <input type="range" id="cap-progress" value="0" min="0" max="100" step="0.1">
          </div>
          <audio id="audio-player" style="display: none;" crossorigin="anonymous"></audio>
        `
        document.body.appendChild(playerContainer)

        audio = document.getElementById('audio-player') as HTMLAudioElement
        const playBtn = document.getElementById('cap-play-btn') as HTMLButtonElement
        const progress = document.getElementById('cap-progress') as HTMLInputElement
        const timeDisplay = document.getElementById('cap-time') as HTMLSpanElement

        playBtn.onclick = () => {
          if (audio.paused) audio.play()
          else audio.pause()
        }

        audio.onplay = () => {
          playBtn.classList.add('is-playing')
          playBtn.innerHTML = '<svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>'
        }
        audio.onpause = () => {
          playBtn.classList.remove('is-playing')
          playBtn.innerHTML = '<svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>'
        }

        const formatTime = (s: number) => {
          if (isNaN(s)) return '0:00'
          const mins = Math.floor(s / 60)
          const secs = Math.floor(s % 60).toString().padStart(2, '0')
          return `${mins}:${secs}`
        }

        audio.ontimeupdate = () => {
          if (audio.duration) {
            progress.value = ((audio.currentTime / audio.duration) * 100).toString()
            timeDisplay.innerText = `${formatTime(audio.currentTime)} / ${formatTime(audio.duration)}`
          }
        }

        audio.onended = () => {
          audio.currentTime = 0
          audio.play()
        }

        progress.oninput = (e) => {
          const val = parseFloat((e.target as HTMLInputElement).value)
          audio.currentTime = (val / 100) * audio.duration
        }
      } else {
        URL.revokeObjectURL(audio.src)
        // Reset player UI
        const playBtn = document.getElementById('cap-play-btn') as HTMLButtonElement
        const progress = document.getElementById('cap-progress') as HTMLInputElement
        const timeDisplay = document.getElementById('cap-time') as HTMLSpanElement

        if (playBtn) {
          playBtn.classList.remove('is-playing')
          playBtn.innerHTML = '<svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>'
        }
        if (progress) progress.value = "0"
        if (timeDisplay) timeDisplay.innerText = "0:00 / 0:00"
      }

      const titleDisplay = document.getElementById('cap-title') as HTMLSpanElement
      if (titleDisplay) {
        titleDisplay.innerText = file.name
      }

      audio.src = audioURL
      audio.load() // Explicitly load to reset internal media state
      audio.play()

      this.audio.initFromElement(audio)
    })

    const setupSlider = (id: string, key: string, valId: string) => {
      const input = document.getElementById(id) as HTMLInputElement
      const display = document.getElementById(valId) as HTMLSpanElement
      input?.addEventListener('input', (e) => {
        const val = parseFloat((e.target as HTMLInputElement).value)
        display.innerText = val.toFixed(2)
        this.gpgpu?.setParams({ [key]: val })
      })
    }

    setupSlider('input-k', 'k', 'val-k')
    setupSlider('input-gamma', 'gamma', 'val-gamma')
    setupSlider('input-omega', 'omega', 'val-omega')
    setupSlider('input-noiseAmp', 'noiseAmp', 'val-noiseAmp')
    setupSlider('input-radiusMajor', 'radiusMajor', 'val-radiusMajor')
    setupSlider('input-radiusMinor', 'radiusMinor', 'val-radiusMinor')
    setupSlider('input-alpha', 'alpha', 'val-alpha')
    setupSlider('input-beta', 'beta', 'val-beta')
    setupSlider('input-n', 'n', 'val-n')
    setupSlider('input-m', 'm', 'val-m')

    const mobileMenuToggle = document.getElementById('mobile-menu-toggle')
    const sidebar = document.getElementById('sidebar')
    const mobileMenuIcon = document.getElementById('mobile-menu-icon')

    if (window.innerWidth <= 768) {
      sidebar?.classList.add('collapsed')
      if (mobileMenuIcon) {
        mobileMenuIcon.innerHTML = '<polyline points="15 18 9 12 15 6"></polyline>'
      }
    }

    mobileMenuToggle?.addEventListener('click', () => {
      sidebar?.classList.toggle('collapsed')
      const isCollapsed = sidebar?.classList.contains('collapsed')
      if (mobileMenuIcon) {
        if (isCollapsed) {
          mobileMenuIcon.innerHTML = '<polyline points="15 18 9 12 15 6"></polyline>'
        } else {
          mobileMenuIcon.innerHTML = '<polyline points="9 18 15 12 9 6"></polyline>'
        }
      }
    })

    const startBtn = document.getElementById('btn-start')
    const splash = document.getElementById('splash-screen')
    startBtn?.addEventListener('click', () => {
      splash?.classList.add('hidden')
    })

    const autoBtn = document.getElementById('btn-auto') as HTMLButtonElement
    autoBtn?.addEventListener('click', () => {
      this.autoMode = !this.autoMode
      autoBtn.innerText = `Auto Mode: ${this.autoMode ? 'ON' : 'OFF'}`
      autoBtn.style.borderColor = this.autoMode ? '#4ade80' : 'rgba(255,255,255,0.2)'
      autoBtn.style.color = this.autoMode ? '#4ade80' : '#fff'

      // Toggle visibility of automated parameters
      const targets = document.querySelectorAll('[data-auto-target]')
      targets.forEach(el => {
        (el as HTMLElement).style.display = this.autoMode ? 'none' : 'block'
      })
    })

    const debugSelect = document.getElementById('debug-mode') as HTMLSelectElement
    const colorGroup = document.getElementById('color-selection-group') as HTMLDivElement

    debugSelect?.addEventListener('change', (e) => {
      const mode = parseInt((e.target as HTMLSelectElement).value)
      this.particles?.setDebugMode(mode)

      // Show color group only in Glow mode (0)
      if (colorGroup) colorGroup.style.display = mode === 0 ? 'block' : 'none'
    })

    // Initial check for color group
    if (colorGroup) colorGroup.style.display = debugSelect.value === '0' ? 'block' : 'none'

    const particleSelect = document.getElementById('particle-select') as HTMLSelectElement
    particleSelect?.addEventListener('change', (e) => {
      const size = parseInt((e.target as HTMLSelectElement).value)
      this.reinitSystem(size)
    })

    // Color Handlers
    document.querySelectorAll('.color-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const target = e.target as HTMLButtonElement
        const color = target.dataset.color
        if (color) {
          this.particles?.setBaseColor(color)

          // UI Feedback
          document.querySelectorAll('.color-btn').forEach(b => b.classList.remove('active'))
          target.classList.add('active')
        }
      })
    })

    // Preset Handlers
    document.querySelectorAll('.preset-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const preset = (e.target as HTMLButtonElement).dataset.preset
        if (preset) this.loadPreset(preset)
      })
    })

    document.getElementById('btn-reset')?.addEventListener('click', () => {
      location.reload()
    })

    // Hide UI toggle (H key)
    window.addEventListener('keydown', (e) => {
      if (e.key.toLowerCase() === 'h') {
        const ui = document.getElementById('ui-overlay')
        if (ui) ui.style.display = ui.style.display === 'none' ? 'flex' : 'none'
      }
    })
  }

  private updateAutoMode(audio: any, time: number) {
    if (!this.autoMode) return

    const targetParams: Record<string, number> = {
      n: Math.floor(4 + audio.mid * 8 + Math.sin(time * 0.2) * 2),
      m: Math.floor(2 + audio.low * 6 + Math.cos(time * 0.3) * 2),
      radiusMajor: 0.8 + audio.all * 1.5 + Math.sin(time * 0.5) * 0.2,
      radiusMinor: 0.3 + audio.mid * 0.8 + Math.cos(time * 0.4) * 0.1,
      noiseAmp: 0.05 + audio.high * 0.4,
      omega: 0.1 + audio.low * 1.0
    }

    this.gpgpu?.setParams(targetParams)

    // Sync UI Sliders for visual feedback
    Object.entries(targetParams).forEach(([key, val]) => {
      const input = document.getElementById(`input-${key}`) as HTMLInputElement
      const display = document.getElementById(`val-${key}`) as HTMLSpanElement
      if (input) input.value = val.toString()
      if (display) display.innerText = val.toFixed(2)
    })
  }

  private loadPreset(name: string) {
    const p = (config.presets as any)[name]
    if (!p) return

    this.gpgpu?.setParams(p)

    // Sync UI
    Object.entries(p).forEach(([key, val]) => {
      const input = document.getElementById(`input-${key}`) as HTMLInputElement
      const display = document.getElementById(`val-${key}`) as HTMLSpanElement
      if (input) input.value = (val as number).toString()
      if (display) display.innerText = (val as number).toFixed(2)
    })
  }

  private checkCapabilities(): boolean {
    const gl = this.renderer.getContext() as WebGL2RenderingContext

    if (!this.renderer.capabilities.isWebGL2) {
      console.error('WebGL2 not supported')
      alert('This application requires WebGL2.')
      return false
    }

    const floatLinear = gl.getExtension('OES_texture_float_linear')
    const colorBufFloat = gl.getExtension('EXT_color_buffer_float')

    console.log('--- GPU CAPABILITIES ---')
    console.log('WebGL2:', true)
    console.log('OES_texture_float_linear:', !!floatLinear)
    console.log('EXT_color_buffer_float:', !!colorBufFloat)
    console.log('Max Texture Size:', gl.getParameter(gl.MAX_TEXTURE_SIZE))
    console.log('------------------------')
    return true
  }

  private initGPGPU() {
    this.gpgpu = new GPGPUManager({
      size: this.gpgpuSize,
      renderer: this.renderer
    })

    if (this.particleCountOverlay) {
      this.particleCountOverlay.innerText = (this.gpgpuSize * this.gpgpuSize).toLocaleString()
    }
  }

  private initParticles() {
    this.particles = new ParticleSystem({
      size: this.gpgpuSize,
      scene: this.scene
    })
  }

  private reinitSystem(size: number) {
    this.gpgpuSize = size

    // Dispose old systems
    this.gpgpu?.dispose()
    this.particles?.dispose()

    // Re-init
    this.initGPGPU()
    this.initParticles()

    // Restore state - use the current UI values to avoid resetting visual state
    const currentParams: any = {}
    const controls = ['k', 'gamma', 'omega', 'noiseAmp', 'radiusMajor', 'radiusMinor', 'alpha', 'beta', 'n', 'm']
    controls.forEach(key => {
      const input = document.getElementById(`input-${key}`) as HTMLInputElement
      if (input) currentParams[key] = parseFloat(input.value)
    })
    this.gpgpu?.setParams(currentParams)

    // Sync debug mode
    const debugMode = parseInt((document.getElementById('debug-mode') as HTMLSelectElement).value)
    this.particles?.setDebugMode(debugMode)

    // Sync color
    const activeColorBtn = document.querySelector('.color-btn.active') as HTMLElement
    if (activeColorBtn && activeColorBtn.dataset.color) {
      this.particles?.setBaseColor(activeColorBtn.dataset.color)
    }
  }

  private onResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight
    this.camera.updateProjectionMatrix()
    this.renderer.setSize(window.innerWidth, window.innerHeight)
  }

  private animate() {
    requestAnimationFrame(this.animate.bind(this))

    const frameDelta = this.clock.getDelta()
    const elapsedTime = this.clock.elapsedTime

    if (this.fpsOverlay) {
      this.fpsOverlay.innerText = Math.round(1 / frameDelta).toString()
    }

    // Update Audio
    const audioData = this.audio.update(frameDelta)

    // Auto Mode Logic
    this.updateAutoMode(audioData, elapsedTime)

    if (this.controls) this.controls.update()

    // GPGPU Step
    if (this.gpgpu) {
      this.gpgpu.updateAudio(audioData)

      this.accumulator += Math.min(frameDelta, 0.1)
      while (this.accumulator >= this.dt) {
        this.gpgpu.step(this.dt, elapsedTime)
        this.accumulator -= this.dt
      }

      // Sync particles with GPGPU results
      if (this.particles) {
        this.particles.updateAudio(audioData)
        this.particles.update(
          this.gpgpu.posRes.read.texture,
          this.gpgpu.velRes.read.texture,
          this.gpgpu.parametricRes.texture
        )
      }
    }

    // Scene rotation
    this.scene.rotation.y = elapsedTime * 0.1
    this.scene.rotation.x = elapsedTime * 0.05

    this.renderer.render(this.scene, this.camera)
  }
}

new Engine()
