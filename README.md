<div align="center">
  <h1>✨ Morphogenetic V1.0</h1>
  <p><strong>A Real-Time Audiovisual Synthesis & Particle Simulation Engine</strong></p>
  
  <p>
    <a href="https://jmiles.icu/morphogeneric/index.html"><strong>🔴 PLAY THE LIVE DEMO</strong></a>
  </p>
</div>

---

## 🌌 Overview

**Morphogenetic V1.0** is an experimental, browser-based research project exploring the intersection of **computational physics**, **procedural geometry**, and **sound-driven interaction**.

It renders and simulates hundreds of thousands of particles—up to **262,000 (512×512 grids)** and beyond—entirely on the GPU. By delegating all motion calculations to fragment shaders, it bypasses CPU bottlenecks, allowing for silky-smooth, high-density audiovisual experiences that react in real-time to your microphone or uploaded audio files.

---

## 🚀 Try It Out

Experience the live visualizer directly in your browser:
&rarr; **[Play Morphogenetic V1.0 Live](https://jmiles.icu/morphogeneric/index.html)**

> **Requirements:** A modern browser with **WebGL 2.0** support is required (Chrome, Edge, Firefox, or Safari).

---

## ⚙️ How It Works

The system is built upon three foundational pillars:

### 1. GPU-Based Particle Simulation (GPGPU)
Each particle's position, velocity, and physics data are encoded into floating-point textures. Operations run continuously on the GPU through custom fragment shaders. This parallelized architecture ensures breathtaking performance on enormous data sets.

### 2. Physics-Driven Emergent Motion
There are no static 3D models. The geometry is entirely emergent, forged by mathematically defined forces intertwining in real-time space:
* **Harmonic Attraction Fields**
* **Kinetic Damping**
* **Vortex and Fluidic Forces**
* **Toroidal Implicit Constraints**
* **Divergence-Free Curl Noise**

### 3. Audio-Reactive Parameter Mapping
Instead of directly moving particles to the beat, the audio signal (via the Web Audio API) is analyzed and separated into frequency bands (Lows, Mids, Highs). These signals natively modulate the physical forces of the system—altering friction, gravity, magnetic pull, and spatial constraints—resulting in organic and physically coherent structural transformations.

---

## 📐 The Mathematical Model

Morphogenetic V1.0 relies on a **Semi-Implicit Euler** numeric integration scheme running entirely on fragment shaders. The dynamic behavior of each particle is governed by a unified force equation:

$$ \mathbf{F}_{total} = \mathbf{F}_{harmonic} + \mathbf{F}_{damping} + \mathbf{F}_{vortex} + \mathbf{F}_{noise} + \mathbf{F}_{audio} + \mathbf{F}_{surface} + \mathbf{F}_{field} $$

### Key Forces Breakdown

* **Harmonic Restoring Force** ($\mathbf{F}_{harmonic} = -k(t)\mathbf{x}$): A global elastic pull dragging particles toward the origin, modulated by audio intensity.
* **Kinetic Damping** ($\mathbf{F}_{damping} = -\gamma \mathbf{v}$): Energy dissipation to prevent numerical divergence and float explosions.
* **Vortex Field** ($\mathbf{F}_{vortex} = \omega \times \mathbf{x}$): Introduces controlled global rotation around the core.
* **Toroidal Morphogenesis**: Particles are organically attracted to a dynamic toroidal surface defined by implicit coordinates:
  $$ X(\theta, \phi) = (R + r \cos\phi) \cos\theta $$
  $$ Y(\theta, \phi) = (R + r \cos\phi) \sin\theta $$
  $$ Z(\theta, \phi) = r \sin\phi $$
* **Implicit Field Gradient**: $\mathbf{F}_{field} = -\beta \frac{\nabla S}{|\nabla S| + \epsilon}$ utilizes soft-normalized gradients to pull particles into the shape matrix without visual tearing.
* **Curl Noise Turbulence**: $\mathbf{v}_{curl} = \nabla \times \mathbf{P}$ injects divergence-free erratic motion, simulating incredibly realistic fluid dynamics on the micro-level.

---

## 🎛️ Controls & UI

The minimalist graphical interface allows you to craft your own audiovisual world:

* **Audio Input:** Use your microphone for live interaction, or upload an `.mp3`/`.wav` file.
* **Auto Mode:** Let the system intelligently drive the parameters based purely on the audio spectrum.
* **View Modes:** Toggle between default glow, velocity-colored motion, or a sleek grayscale display.
* **Complex Parameters:** Tweak variables like Harmonic intensity ($k$), Damping ($\gamma$), Vortex ($\omega$), Noise Amplitudes, and Symmetry nodes in real-time.
* **Presets:** Jump instantly into pre-configured states like *Nebula*, *Crystal*, or *Movie*.
* **Customization:** Apply different base colored glows to color-match your mood or branding.

*(Pro-Tip: Press `H` to hide the UI for a clean, distraction-free view.)*

---

## 🛠️ Technical Philosophy

This project strictly adheres to the following principles:
* **100% GPU Parallelization**
* **Deterministic, coherent math models over random visual noise**
* **Scalability to multi-user environments and high-end screens** 
* **Clean, logical mappings between sound frequencies and physics**

---

## 📜 Development Status

This platform is a private, independent, long-term project. It's built iteratively with continuous research aimed at boosting performance limits, polishing physical fidelity, and perfecting audiovisual translation techniques.

---

<p align="center">
  <br/>
  <i>Developed with ❤️ for the web.</i>
</p>
