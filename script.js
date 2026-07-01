import { createApp } from 'https://unpkg.com/vue@3.0.11/dist/vue.esm-browser.prod.js'
import { lerp, BufferGeometry, Camera, EffectComposer, Points, Renderer, RenderPass, Scene, ShaderMaterial, Texture, UnrealBloomPass, ZoomBlurPass } from 'https://unpkg.com/troisjs@0.3.0-beta.4/build/trois.module.cdn.min.js'
import { Clock, Color, MathUtils, Vector3 } from 'https://unpkg.com/three@0.127.0/build/three.module.js'

const { randFloat: rnd, randInt, randFloatSpread: rndFS } = MathUtils

// SHADERS
const vertexShader = `
  uniform float uTime;
  attribute vec3 color;
  attribute float size;
  varying vec4 vColor;
  void main(){
    vColor = vec4(color, 1.0);
    vec3 p = vec3(position);
    p.z = -150. + mod(position.z + uTime, 300.);
    vec4 mvPosition = modelViewMatrix * vec4( p, 1.0 );
    gl_PointSize = size * (-50.0 / mvPosition.z);
    gl_Position = projectionMatrix * mvPosition;
  }
`
const fragmentShader = `
  uniform sampler2D uTexture;
  varying vec4 vColor;
  void main() {
    gl_FragColor = vColor * texture2D(uTexture, gl_PointCoord);
  }
`

// 🌌 THREE.JS & VUE 3 GRAPHICS CORE
createApp({
  template: `
    <Renderer ref="renderer" pointer resize="window">
      <Camera :position="{ z: 0 }" :fov="50" />
      <Scene>
        <Points ref="points" :position="{ z: -150 }">
          <BufferGeometry :attributes="attributes" />
          <ShaderMaterial :blending="2" :depth-test="false" :uniforms="uniforms" :vertex-shader="vertexShader" :fragment-shader="fragmentShader">
            <Texture src="https://assets.codepen.io/33787/sprite.png" uniform="uTexture" />
          </ShaderMaterial>
        </Points>
      </Scene>
      <EffectComposer>
        <RenderPass />
        <UnrealBloomPass :strength="2" :radius="0" :threshold="0" />
        <ZoomBlurPass :strength="zoomStrength" />
      </EffectComposer>
    </Renderer>
    <button class="gateway-btn" @click="enterSystem" @mouseenter="targetTimeCoef = 70" @mouseleave="targetTimeCoef = 1">Ulemdo Core Tizimi</button>
  `,
  components: { BufferGeometry, Camera, EffectComposer, Points, Renderer, RenderPass, Scene, ShaderMaterial, Texture, UnrealBloomPass, ZoomBlurPass },
  setup() {
    const POINTS_COUNT = 40000
    // ULEMDO BRANDING COLOR PALETTE (Neon Orange and Pure White)
    const ulemdoPalette = ['#FF5A16', '#FFFFFF', '#FF7A45', '#E2E8F0']

    const positions = new Float32Array(POINTS_COUNT * 3)
    const colors = new Float32Array(POINTS_COUNT * 3)
    const sizes = new Float32Array(POINTS_COUNT)
    const v3 = new Vector3(), color = new Color()

    for (let i = 0; i < POINTS_COUNT; i++) {
      v3.set(rndFS(200), rndFS(200), rndFS(300))
      v3.toArray(positions, i * 3)
      color.set(ulemdoPalette[Math.floor(rnd(0, ulemdoPalette.length))])
      color.toArray(colors, i * 3)
      sizes[i] = rnd(4, 15)
    }

    const attributes = [
      { name: 'position', array: positions, itemSize: 3 },
      { name: 'color', array: colors, itemSize: 3 },
      { name: 'size', array: sizes, itemSize: 1 },
    ]

    const uniforms = { uTime: { value: 0 } }
    const clock = new Clock()
    const timeCoef = 1, targetTimeCoef = 1

    return { POINTS_COUNT, attributes, uniforms, vertexShader, fragmentShader, clock, timeCoef, targetTimeCoef }
  },
  data() { return { zoomStrength: 0 } },
  mounted() {
    const renderer = this.$refs.renderer
    const positionN = renderer.three.pointer.positionN
    const points = this.$refs.points.points

    renderer.onBeforeRender(() => {
      this.timeCoef = lerp(this.timeCoef, this.targetTimeCoef, 0.02)
      this.uniforms.uTime.value += this.clock.getDelta() * this.timeCoef * 4
      this.zoomStrength = this.timeCoef * 0.003

      const da = 0.05
      const tiltX = lerp(points.rotation.x, positionN.y * da, 0.02)
      const tiltY = lerp(points.rotation.y, -positionN.x * da, 0.02)
      points.rotation.set(tiltX, tiltY, 0)
    })
  },
  methods: {
    enterSystem() {
      // 3D canvas va portal tugmasini vizual o'chirish
      document.querySelector('canvas').style.display = 'none';
      document.querySelector('.gateway-btn').style.display = 'none';
      
      // Haqiqiy xavfsiz veb-saytni yuklash va ko'rsatish
      const coreSite = document.getElementById('ulemdo-core-site');
      coreSite.classList.remove('system-hidden');
      coreSite.style.opacity = '1';
      coreSite.style.transform = 'scale(1)';
      
      // Global sayt dasturlarini ishga tushirish
      initializeCoreStore();
    }
  }
}).mount('#app')

// ========================================================
// 🛡️ ULEMDO CORE SECURITY & DATA APPLICATION LOGIC
// ========================================================
function escapeHTML(str) {
    if (!str) return '';
    return str.replace(/[&<>"']/g, match => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#x27;'
    })[match]);
}

window.showPage = function(pageId) {
    document.querySelectorAll('.page').forEach(p => p.classList.add('hidden'));
    document.getElementById(`page-${pageId}`).classList.remove('hidden');
}

window.openModal = function(id) { document.getElementById(id).classList.remove('hidden'); }
window.closeModal = function(id) { document.getElementById(id).classList.add('hidden'); }

function initializeCoreStore() {
    console.log("Ulemdo Core xavfsiz muhiti yuklandi... 🛰️");
    // Bu yerda serveringizdan do'konlar va mahsulotlarni yuklash funksiyalarini chaqirishingiz mumkin
}
