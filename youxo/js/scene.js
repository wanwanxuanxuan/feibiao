/* ============================================================
    《超级家长模拟器》 — 3D 舞台层 (three.js)
    纯程序化建模：客厅 / 卧室 / 楼道 / 夜街
    ============================================================ */
import * as THREE from 'three';

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const rand = (a, b) => a + Math.random() * (b - a);

/* ---------------- 画布贴图工具 ---------------- */
function makeTex(w, h, draw, repeat) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  draw(g, w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
  return t;
}

function woodTex() {
  return makeTex(512, 512, (g, w, h) => {
    g.fillStyle = '#6b4a2e'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 8; i++) {
      const y = i * 64;
      g.fillStyle = i % 2 ? '#7a5535' : '#5f4128';
      g.fillRect(0, y, w, 62);
      g.strokeStyle = 'rgba(0,0,0,.45)'; g.lineWidth = 2;
      g.strokeRect(-1, y, w + 2, 62);
      for (let k = 0; k < 26; k++) {
        g.strokeStyle = `rgba(0,0,0,${rand(.03, .1)})`; g.lineWidth = rand(.6, 1.6);
        g.beginPath();
        const yy = y + rand(4, 58);
        g.moveTo(0, yy); g.bezierCurveTo(w * .3, yy + rand(-4, 4), w * .7, yy + rand(-4, 4), w, yy);
        g.stroke();
      }
    }
  }, [4, 4]);
}

function plasterTex(base) {
  return makeTex(256, 256, (g, w, h) => {
    g.fillStyle = base; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 2600; i++) {
      g.fillStyle = `rgba(0,0,0,${rand(0, .05)})`;
      g.fillRect(rand(0, w), rand(0, h), rand(1, 3), rand(1, 3));
      g.fillStyle = `rgba(255,255,255,${rand(0, .04)})`;
      g.fillRect(rand(0, w), rand(0, h), rand(1, 2), rand(1, 2));
    }
  }, [2, 2]);
}

function rugTex() {
  return makeTex(256, 256, (g, w, h) => {
    g.fillStyle = '#7d3b34'; g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(240,210,160,.55)'; g.lineWidth = 6;
    g.strokeRect(16, 16, w - 32, h - 32);
    g.strokeStyle = 'rgba(240,210,160,.35)'; g.lineWidth = 3;
    g.strokeRect(30, 30, w - 60, h - 60);
    g.save(); g.translate(w / 2, h / 2); g.rotate(Math.PI / 4);
    g.strokeStyle = 'rgba(240,210,160,.3)'; g.lineWidth = 4;
    g.strokeRect(-56, -56, 112, 112); g.restore();
  });
}

function awardTex(title, name) {
  return makeTex(320, 440, (g, w, h) => {
    g.fillStyle = '#efe4c8'; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#b23a2e'; g.lineWidth = 8; g.strokeRect(12, 12, w - 24, h - 24);
    g.fillStyle = '#b23a2e'; g.font = 'bold 42px serif'; g.textAlign = 'center';
    g.fillText(title, w / 2, 96);
    g.font = '20px serif'; g.fillStyle = '#5a4630';
    g.fillText(name, w / 2, 150);
    g.font = '15px serif';
    g.fillText('兹证明该同学在家', w / 2, 210);
    g.fillText('表现优秀，特发此状', w / 2, 234);
    g.fillText('以资鼓励', w / 2, 258);
    g.fillStyle = '#8a2a20';
    g.beginPath(); g.arc(w / 2, h - 78, 40, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#efe4c8'; g.font = 'bold 14px serif';
    g.fillText('家长委员会', w / 2 - 10, h - 74);
  });
}

function bannerTex() {
  return makeTex(360, 150, (g, w, h) => {
    g.fillStyle = '#b3171b'; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#f2d675'; g.lineWidth = 4; g.strokeRect(8, 8, w - 16, h - 16);
    g.fillStyle = '#f2d675'; g.font = 'bold 44px serif'; g.textAlign = 'center';
    g.fillText('优秀家长', w / 2, 66);
    g.font = '18px serif'; g.fillText('打是亲 骂是爱', w / 2, 108);
  });
}

function oldPhotoTex(back) {
  return makeTex(300, 400, (g, w, h) => {
    if (back) {
      g.fillStyle = '#d9cba8'; g.fillRect(0, 0, w, h);
      g.strokeStyle = 'rgba(0,0,0,.18)'; g.lineWidth = 2; g.strokeRect(6, 6, w - 12, h - 12);
      g.save(); g.translate(w / 2, h / 2); g.rotate(-0.06);
      g.fillStyle = '#3a3128'; g.font = '17px "PingFang SC", sans-serif'; g.textAlign = 'center';
      g.fillText('爸/妈，你打我时', 0, -26);
      g.fillText('手也在抖。', 0, 2);
      g.fillText('下次别抖了，怪疼的。', 0, 34);
      g.restore();
      return;
    }
    // 泛黄老照片：门框上吊打孩子的剪影
    const grd = g.createLinearGradient(0, 0, 0, h);
    grd.addColorStop(0, '#c9b184'); grd.addColorStop(1, '#8d7550');
    g.fillStyle = grd; g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(60,45,30,.9)';
    g.fillRect(30, 40, 18, 320); g.fillRect(252, 40, 18, 320); g.fillRect(30, 40, 240, 22);
    // 小孩剪影（吊着）
    g.fillStyle = '#3b2b1c';
    g.beginPath(); g.arc(150, 150, 26, 0, Math.PI * 2); g.fill();
    g.fillRect(126, 176, 48, 84);
    g.fillRect(112, 186, 16, 74); g.fillRect(172, 186, 16, 74);
    g.fillRect(128, 258, 18, 62); g.fillRect(154, 258, 18, 62);
    g.strokeStyle = '#3b2b1c'; g.lineWidth = 6;
    g.beginPath(); g.moveTo(150, 100); g.lineTo(150, 126); g.stroke();
    // 大人剪影举棍
    g.fillStyle = '#2b2016';
    g.beginPath(); g.arc(232, 300, 24, 0, Math.PI * 2); g.fill();
    g.fillRect(210, 324, 46, 70);
    g.save(); g.translate(210, 340); g.rotate(-0.8); g.fillRect(0, -8, 96, 12); g.restore();
    // 发霉噪点
    for (let i = 0; i < 1400; i++) {
      g.fillStyle = `rgba(90,70,40,${rand(0, .18)})`;
      g.fillRect(rand(0, w), rand(0, h), rand(1, 4), rand(1, 4));
    }
  });
}

function cityViewTex() {
  return makeTex(512, 512, (g, w, h) => {
    const grd = g.createLinearGradient(0, 0, 0, h);
    grd.addColorStop(0, '#08101f'); grd.addColorStop(.55, '#12233f'); grd.addColorStop(1, '#1d3350');
    g.fillStyle = grd; g.fillRect(0, 0, w, h);
    g.fillStyle = '#0a1526';
    let x = 0;
    while (x < w) {
      const bw = rand(38, 78), bh = rand(120, 380);
      g.fillRect(x, h - bh, bw, bh);
      for (let yy = h - bh + 12; yy < h - 14; yy += 20) {
        for (let xx = x + 8; xx < x + bw - 10; xx += 16) {
          if (Math.random() > .45) {
            g.fillStyle = Math.random() > .5 ? 'rgba(255,214,150,.85)' : 'rgba(150,205,255,.7)';
            g.fillRect(xx, yy, 6, 9);
          } else g.fillStyle = '#0a1526';
        }
        g.fillStyle = '#0a1526';
      }
      x += bw + rand(4, 14);
    }
    // 月亮
    g.fillStyle = 'rgba(240,240,220,.85)';
    g.beginPath(); g.arc(400, 90, 26, 0, Math.PI * 2); g.fill();
  });
}

function tvNewsTex() {
  return makeTex(512, 288, (g, w, h) => {
    g.fillStyle = '#0a1c33'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#12365e'; g.fillRect(0, 0, w, 40);
    g.fillStyle = '#cfe4ff'; g.font = 'bold 22px sans-serif';
    g.fillText('本地新闻 · 直播', 18, 28);
    g.fillStyle = 'rgba(200,215,235,.16)';
    g.beginPath(); g.arc(w * .34, h * .5, 62, 0, Math.PI * 2); g.fill();
    g.fillStyle = 'rgba(200,215,235,.1)';
    g.beginPath(); g.arc(w * .68, h * .58, 76, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#eaf2ff'; g.font = '17px sans-serif';
    g.fillText('青少年心理健康问题引发关注', 24, h - 74);
    g.fillText('专家呼吁家长关注沟通方式', 24, h - 50);
    g.fillStyle = '#c02020'; g.fillRect(0, h - 34, w, 34);
    g.fillStyle = '#fff'; g.font = 'bold 18px sans-serif';
    g.fillText('别让「都是为你好」变成伤害', 20, h - 11);
  });
}

function tvShowTex() {
  return makeTex(512, 288, (g, w, h) => {
    g.fillStyle = '#1a0f2e'; g.fillRect(0, 0, w, h);
    const grd = g.createRadialGradient(w * .5, h * .4, 20, w * .5, h * .4, 300);
    grd.addColorStop(0, 'rgba(255,120,180,.55)'); grd.addColorStop(1, 'rgba(40,10,60,0)');
    g.fillStyle = grd; g.fillRect(0, 0, w, h);
    g.fillStyle = '#ffe3a8'; g.font = 'bold 30px serif'; g.textAlign = 'center';
    g.fillText('综 艺 · 超 级 家 长', w / 2, 44);
    // 哭泣家长剪影
    g.fillStyle = '#0d0716';
    g.beginPath(); g.arc(w / 2, 128, 30, 0, Math.PI * 2); g.fill();
    g.fillRect(w / 2 - 32, 156, 64, 62);
    g.fillStyle = 'rgba(120,220,255,.9)';
    g.fillRect(w / 2 - 16, 132, 4, 26); g.fillRect(w / 2 + 12, 132, 4, 26);
    g.fillStyle = '#fff'; g.font = '20px serif'; g.textAlign = 'center';
    g.fillText('「我都是为他好啊！」', w / 2, h - 34);
    for (let i = 0; i < 40; i++) {
      g.fillStyle = `rgba(255,220,120,${rand(.1, .5)})`;
      g.beginPath(); g.arc(rand(20, w - 20), h - 16 + rand(-6, 6), rand(1, 3), 0, Math.PI * 2); g.fill();
    }
  });
}

function monitorTex(kind) {
  return makeTex(512, 320, (g, w, h) => {
    if (kind === 'search') {
      g.fillStyle = '#f2f3f5'; g.fillRect(0, 0, w, h);
      g.fillStyle = '#fff'; g.fillRect(120, 44, 320, 40);
      g.fillStyle = '#333'; g.font = '17px sans-serif';
      g.fillText('被打后耳朵耳鸣怎么办', 132, 70);
      g.strokeStyle = '#4a90e2'; g.lineWidth = 2; g.strokeRect(120, 44, 320, 40);
      g.fillStyle = '#666'; g.font = '15px sans-serif';
      const rows = ['· 耳鸣多久能恢复？需要就医吗', '· 耳朵被打后听力下降的处理方法', '· 外伤性鼓膜穿孔的自我判断', '· 未成年人遭家暴如何求助', '· 12338 妇女维权热线是干什么的'];
      rows.forEach((r, i) => { g.fillText(r, 132, 118 + i * 34); });
      g.fillStyle = '#c0392b'; g.font = 'bold 15px sans-serif';
      g.fillText('搜索历史 · 未清除', 132, 300);
    } else {
      g.fillStyle = '#06121a'; g.fillRect(0, 0, w, h);
      g.fillStyle = '#0e2230'; g.fillRect(0, 0, w, 34);
      g.fillStyle = '#8fe6ff'; g.font = 'bold 16px sans-serif';
      g.fillText('亚索 · 排位赛  12min', 14, 23);
      g.strokeStyle = 'rgba(120,220,255,.4)'; g.lineWidth = 2;
      for (let i = 0; i < 5; i++) { g.beginPath(); g.moveTo(i * 110, 34); g.lineTo(i * 60, h); g.stroke(); }
      g.fillStyle = 'rgba(255,90,90,.85)';
      g.beginPath(); g.arc(w * .72, h * .62, 16, 0, Math.PI * 2); g.fill();
      g.fillStyle = 'rgba(90,220,160,.9)';
      g.beginPath(); g.arc(w * .3, h * .7, 16, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#eaf6ff'; g.font = 'bold 20px sans-serif';
      g.fillText('敌军还有五秒到达战场', 150, h - 30);
    }
  });
}

function phoneTex() {
  return makeTex(256, 512, (g, w, h) => {
    g.fillStyle = '#0a1830'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#123a63'; g.fillRect(0, 0, w, 60);
    g.fillStyle = '#9fd8ff'; g.font = 'bold 18px sans-serif';
    g.fillText('敌军还有五秒到达战场', 16, 38);
    for (let i = 0; i < 6; i++) {
      g.fillStyle = i % 2 ? 'rgba(120,200,255,.25)' : 'rgba(90,160,255,.18)';
      g.fillRect(16, 84 + i * 62, w - 32, 48);
    }
    g.fillStyle = 'rgba(255,255,255,.9)'; g.font = 'bold 22px sans-serif';
    g.fillText('❚❚ 暂停', 80, h - 40);
  });
}

function crackPhoneTex() {
  return makeTex(256, 512, (g, w, h) => {
    g.fillStyle = '#0a1830'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#123a63'; g.fillRect(0, 0, w, 60);
    g.fillStyle = 'rgba(159,216,255,.5)'; g.font = 'bold 18px sans-serif';
    g.fillText('敌军还有五秒到达战场', 16, 38);
    g.strokeStyle = 'rgba(230,245,255,.95)'; g.lineWidth = 2;
    for (let i = 0; i < 22; i++) {
      g.beginPath();
      let x = w / 2 + rand(-30, 30), y = h / 2 + rand(-40, 40);
      g.moveTo(x, y);
      for (let k = 0; k < 4; k++) { x += rand(-70, 70); y += rand(-70, 70); g.lineTo(x, y); }
      g.stroke();
    }
    g.fillStyle = 'rgba(0,0,0,.6)';
    for (let i = 0; i < 6; i++) g.fillRect(rand(0, w - 40), rand(0, h - 30), rand(20, 60), rand(14, 40));
  });
}

function glowTex(color) {
  return makeTex(128, 128, (g, w, h) => {
    const grd = g.createRadialGradient(w / 2, h / 2, 2, w / 2, h / 2, w / 2);
    grd.addColorStop(0, color); grd.addColorStop(.35, color.replace(/[\d.]+\)$/, '0.35)')); grd.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grd; g.fillRect(0, 0, w, h);
  });
}

function dotTex() {
  return makeTex(64, 64, (g, w, h) => {
    const grd = g.createRadialGradient(w / 2, h / 2, 1, w / 2, h / 2, w / 2);
    grd.addColorStop(0, 'rgba(255,240,210,.9)'); grd.addColorStop(1, 'rgba(255,240,210,0)');
    g.fillStyle = grd; g.fillRect(0, 0, w, h);
  });
}

/* ---------------- 光源 / 材质小工具 ---------------- */
function stdMat(color, o = {}) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: o.rough ?? 0.8,
    metalness: o.metal ?? 0.06,
    emissive: o.em ?? 0x000000,
    emissiveIntensity: o.ei ?? 1,
    transparent: !!o.tr,
    opacity: o.op ?? 1,
    side: o.side ?? THREE.FrontSide,
    map: o.map ?? null,
    roughnessMap: o.roughMap ?? null,
  });
}
function box(w, h, d, mat) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.castShadow = true; m.receiveShadow = true;
  return m;
}
function put(o, x, y, z, rx = 0, ry = 0, rz = 0) {
  o.position.set(x, y, z); o.rotation.set(rx, ry, rz);
  return o;
}
function emissivePlane(w, h, tex, ei = 1) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h),
    new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }));
  m.material.color.multiplyScalar(ei);
  return m;
}

/* ---------------- 小杰（低压多边形角色） ---------------- */
function buildKid() {
  const kid = new THREE.Group();
  const skin = stdMat(0xe8b48c, { rough: .85 });
  const hoodie = stdMat(0x2f5d63, { rough: .9 });
  const pants = stdMat(0x33364a, { rough: .95 });
  const hair = stdMat(0x14161c, { rough: .9 });

  const hips = new THREE.Group(); hips.position.y = 0.86; kid.add(hips);
  const torso = box(0.46, 0.6, 0.28, hoodie); torso.position.y = 0.3; hips.add(torso);
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.1, 10), skin);
  neck.position.y = 0.64; hips.add(neck);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.155, 20, 16), skin);
  head.position.y = 0.78; head.castShadow = true; hips.add(head);
  const hairM = new THREE.Mesh(new THREE.SphereGeometry(0.162, 20, 16, 0, Math.PI * 2, 0, Math.PI * 0.62), hair);
  hairM.position.y = 0.8; hips.add(hairM);
  const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.022, 8, 8), stdMat(0x101014));
  eyeL.position.set(-0.055, 0.79, 0.14); hips.add(eyeL);
  const eyeR = eyeL.clone(); eyeR.position.x = 0.055; hips.add(eyeR);

  function arm(side) {
    const g = new THREE.Group();
    g.position.set(0.27 * side, 0.55, 0);
    const up = box(0.11, 0.26, 0.12, hoodie); up.position.y = -0.13; g.add(up);
    const lo = box(0.1, 0.26, 0.11, hoodie); lo.position.y = -0.39; g.add(lo);
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.058, 10, 8), skin);
    hand.position.y = -0.55; g.add(hand);
    hips.add(g);
    return g;
  }
  const armL = arm(-1), armR = arm(1);

  function leg(side) {
    const g = new THREE.Group();
    g.position.set(0.13 * side, 0.86, 0);
    const up = box(0.15, 0.44, 0.16, pants); up.position.y = -0.22; g.add(up);
    const lo = box(0.14, 0.42, 0.15, pants); lo.position.y = -0.66; g.add(lo);
    const foot = box(0.14, 0.1, 0.26, stdMat(0x1b1b22)); foot.position.set(0, -0.86, 0.05); g.add(foot);
    kid.add(g);
    return g;
  }
  const legL = leg(-1), legR = leg(1);

  // 手机（发光）
  const phone = new THREE.Group();
  const body = box(0.075, 0.15, 0.012, stdMat(0x0c0c10, { rough: .4, metal: .3 }));
  const scr = emissivePlane(0.066, 0.138, phoneTex(), 1.5); scr.position.z = 0.008;
  phone.add(body, scr);
  const phoneLight = new THREE.PointLight(0x7fd0ff, 0.5, 1.4);
  phone.add(phoneLight);
  kid.userData.phone = phone;
  kid.userData.phoneScreen = scr;

  kid.userData.parts = { hips, torso, head, armL, armR, legL, legR, hairM, eyeL, eyeR };
  kid.userData.pose = function (name) {
    const p = kid.userData.parts;
    const reset = () => {
      p.hips.rotation.set(0, 0, 0); p.hips.position.set(0, 0.86, 0);
      p.armL.rotation.set(0, 0, 0.12); p.armR.rotation.set(0, 0, -0.12);
      p.legL.rotation.set(0, 0, 0); p.legR.rotation.set(0, 0, 0);
      p.head.rotation.set(0, 0, 0); p.torso.rotation.set(0, 0, 0);
    };
    reset();
    if (name === 'sit') {
      p.hips.position.y = 0.5;
      p.legL.rotation.x = -1.35; p.legR.rotation.x = -1.35;
      p.armL.rotation.x = -0.75; p.armR.rotation.x = -0.75;
      if (phone.parent) { phone.parent.remove(phone); }
      phone.position.set(0, -0.62, 0.02); phone.rotation.x = -0.9; p.armR.add(phone);
    } else if (name === 'sit_desk') {
      p.hips.position.y = 0.5;
      p.legL.rotation.x = -1.4; p.legR.rotation.x = -1.35;
      p.armL.rotation.x = -1.0; p.armR.rotation.x = -1.0;
    } else if (name === 'kneel') {
      p.hips.position.y = 0.42;
      p.legL.rotation.x = 2.0; p.legR.rotation.x = 2.0;
      p.armL.rotation.x = -0.2; p.armR.rotation.x = -0.2;
      p.torso.rotation.x = 0.18;
    } else if (name === 'curl') {
      p.hips.position.y = 0.36;
      p.legL.rotation.x = -2.2; p.legR.rotation.x = -2.0;
      p.torso.rotation.x = 0.5; p.head.rotation.x = 0.4;
      p.armL.rotation.x = -1.5; p.armR.rotation.x = -1.5;
    } else if (name === 'lie') {
      p.hips.position.y = 0.3;
      p.torso.rotation.x = -1.5; p.head.rotation.x = -0.3;
      p.legL.rotation.x = -0.2; p.legR.rotation.x = -0.2;
    } else {
      p.armL.rotation.x = 0.05; p.armR.rotation.x = 0.05;
    }
    return kid;
  };
  kid.userData.pose('stand');
  return kid;
}

/* ============================================================
   World
   ============================================================ */
export class World {
  constructor(canvas) {
    this.canvas = canvas;
    this.clock = new THREE.Clock();
    this.lowPerf = window.matchMedia('(max-width: 900px), (pointer: coarse)').matches;
    this.dprCap = this.lowPerf ? 1.75 : 2;

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: !this.lowPerf, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, this.dprCap));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x05070c);
    this.scene.fog = new THREE.Fog(0x05070c, 8, 26);

    this.camera = new THREE.PerspectiveCamera(45, 1, 0.05, 120);
    this.camPos = new THREE.Vector3(2.6, 1.6, 3.2);
    this.camLook = new THREE.Vector3(0, 1.2, -1);
    this.camera.position.copy(this.camPos);

    // 环境光
    this.hemi = new THREE.HemisphereLight(0x8fb2ff, 0x2a2018, 0.6);
    this.scene.add(this.hemi);
    this.amb = new THREE.AmbientLight(0xffffff, 0.18);
    this.scene.add(this.amb);

    // 动画状态
    this.tween = null;
    this.shakeAmt = 0; this.shakeT = 0;
    this.pointer = { x: 0, y: 0, tx: 0, ty: 0 };
    this.time = 0;
    this.dust = null;

    // 交互
    this.pickables = [];
    this._pickResolve = null;
    this.raycaster = new THREE.Raycaster();

    this._buildAll();
    this._bindPointer();
    this.resize();
    window.addEventListener('resize', () => this.resize());

    this._loop = this._loop.bind(this);
    requestAnimationFrame(this._loop);
  }

  /* ---------- 场景搭建 ---------- */
  _buildAll() {
    this.kid = buildKid();
    this.sets = {
      living: this._buildLiving(),
      bedroom: this._buildBedroom(),
      corridor: this._buildCorridor(),
      city: this._buildCity(),
    };
    for (const k in this.sets) {
      this.sets[k].visible = false;
      this.scene.add(this.sets[k]);
    }
    this.kid.visible = false;
    this.scene.add(this.kid);
    this._addDust();
    this.set = 'living';
    this.sets.living.visible = true;
  }

  _roomShell(set, W, D, H, wallColor = '#2b2622') {
    const wallMat = stdMat(wallColor, { map: plasterTex(wallColor), rough: .95 });
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(W, D), stdMat(0xffffff, { map: woodTex(), rough: .78 }));
    floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; set.add(floor);
    const ceil = new THREE.Mesh(new THREE.PlaneGeometry(W, D), stdMat(0xd8d2c6, { rough: 1 }));
    ceil.rotation.x = Math.PI / 2; ceil.position.y = H; ceil.receiveShadow = true; set.add(ceil);
    const back = box(W, H, 0.12, wallMat); put(back, 0, H / 2, -D / 2 - 0.06); set.add(back);
    const left = box(0.12, H, D, wallMat); put(left, -W / 2 - 0.06, H / 2, 0); set.add(left);
    const right = box(0.12, H, D, wallMat); put(right, W / 2 + 0.06, H / 2, 0); set.add(right);
    const front = box(W, H, 0.12, wallMat); put(front, 0, H / 2, D / 2 + 0.06); set.add(front);
    return { W, D, H };
  }

  _buildLiving() {
    const set = new THREE.Group();
    const { H } = this._roomShell(set, 6.6, 5.6, 2.9, '#332b25');

    // 主灯
    const key = new THREE.DirectionalLight(0xffd9a0, 2.1);
    key.position.set(2.6, 3.4, 2.4);
    key.target.position.set(0, 0.6, -1);
    key.castShadow = true;
    const sc = this.lowPerf ? 1024 : 2048;
    key.shadow.mapSize.set(sc, sc);
    key.shadow.camera.left = -5; key.shadow.camera.right = 5;
    key.shadow.camera.top = 5; key.shadow.camera.bottom = -5;
    key.shadow.camera.near = 0.5; key.shadow.camera.far = 16;
    key.shadow.bias = -0.0016;
    set.add(key, key.target);
    const fill = new THREE.PointLight(0x9fc0ff, 6, 12, 1.6); fill.position.set(-2.4, 2.4, 1.6); set.add(fill);
    set.userData.key = key; set.userData.fill = fill;

    // 吊灯
    const lamp = new THREE.Group();
    lamp.add(new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.6, 8), stdMat(0x222222)));
    const shade = new THREE.Mesh(new THREE.ConeGeometry(0.34, 0.3, 20, 1, true), stdMat(0xe8dcc0, { em: 0xffbb66, ei: .25, side: THREE.DoubleSide }));
    shade.position.y = -0.4; lamp.add(shade);
    const bulb = new THREE.PointLight(0xffc882, 12, 9, 1.5); bulb.position.y = -0.55; lamp.add(bulb);
    put(lamp, 0, H - 0.3, 0); set.add(lamp);
    set.userData.lamp = bulb;

    // 电视 + 电视柜
    const stand = box(1.8, 0.5, 0.42, stdMat(0x3a2a1e, { rough: .6 })); put(stand, 0, 0.25, -2.3); set.add(stand);
    const tvFrame = box(1.72, 1.0, 0.08, stdMat(0x101014, { rough: .35, metal: .3 })); put(tvFrame, 0, 1.35, -2.5); set.add(tvFrame);
    this.tvNews = emissivePlane(1.6, 0.9, tvNewsTex(), 1.15); put(this.tvNews, 0, 1.35, -2.44); set.add(this.tvNews);
    this.tvShowTex = tvShowTex();
    const tvLight = new THREE.PointLight(0x6fa8ff, 1.6, 5, 1.6); tvLight.position.set(0, 1.4, -2.0); set.add(tvLight);
    this.tvLight = tvLight;

    // 沙发
    const sofaMat = stdMat(0x5a4636, { rough: .95 });
    const sofa = new THREE.Group();
    sofa.add(put(box(2.4, 0.42, 1.0, sofaMat), 0, 0.26, 0));
    sofa.add(put(box(2.4, 0.62, 0.22, sofaMat), 0, 0.7, -0.42));
    sofa.add(put(box(0.22, 0.6, 1.0, sofaMat), -1.1, 0.55, 0));
    sofa.add(put(box(0.22, 0.6, 1.0, sofaMat), 1.1, 0.55, 0));
    const cu1 = box(0.6, 0.5, 0.14, stdMat(0x6d5541)); put(cu1, -0.62, 0.72, -0.32, 0.12);
    const cu2 = box(0.6, 0.5, 0.14, stdMat(0x6d5541)); put(cu2, 0.62, 0.72, -0.32, -0.12);
    sofa.add(cu1, cu2);
    put(sofa, 0, 0, 0.75, 0, Math.PI, 0); // 面向电视(-z)
    set.add(sofa);

    // 茶几 + 泡面 + 手机
    const tableMat = stdMat(0x4a3423, { rough: .55 });
    const table = new THREE.Group();
    table.add(put(box(1.5, 0.06, 0.8, tableMat), 0, 0.42, 0));
    [[-0.65, -0.32], [0.65, -0.32], [-0.65, 0.32], [0.65, 0.32]].forEach(([x, z]) =>
      table.add(put(box(0.07, 0.42, 0.07, stdMat(0x2c2118)), x, 0.21, z)));
    const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.075, 0.14, 16), stdMat(0xe8e2d4, { rough: .6 }));
    cup.position.set(0.42, 0.52, 0.06); cup.castShadow = true; table.add(cup);
    const soup = new THREE.Mesh(new THREE.CylinderGeometry(0.095, 0.07, 0.02, 16), stdMat(0xb4552b, { em: 0x552010, ei: .3 }));
    soup.position.set(0.42, 0.585, 0.06); table.add(soup);
    table.add(put(box(0.22, 0.008, 0.012, stdMat(0xd8c8a8)), 0.22, 0.53, 0.12, 0, 0.5));
    const phone = new THREE.Group();
    phone.add(box(0.086, 0.17, 0.014, stdMat(0x0c0c10, { rough: .35, metal: .35 })));
    this.phoneScreen = emissivePlane(0.075, 0.158, phoneTex(), 1.5); this.phoneScreen.position.z = 0.009; phone.add(this.phoneScreen);
    const pLight = new THREE.PointLight(0x7fd0ff, 1.2, 1.6, 1.8); pLight.position.set(0, 0, 0.1); phone.add(pLight);
    put(phone, -0.28, 0.46, -0.06, -Math.PI / 2 + 0.18, 0.4, 0);
    phone.userData.name = 'phone';
    table.add(phone);
    this.tablePhone = phone;
    put(table, 0, 0, -0.55);
    set.add(table);
    this.pickables.push(phone);

    // 地毯
    const rug = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 2.6), stdMat(0xffffff, { map: rugTex(), rough: 1 }));
    rug.rotation.x = -Math.PI / 2; rug.position.set(0, 0.012, 0.1); rug.receiveShadow = true; set.add(rug);

    // 落地灯
    const fl = new THREE.Group();
    fl.add(put(new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.6, 8), stdMat(0x1c1c20)), 0, 0.8, 0));
    fl.add(put(new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.22, 0.3, 16, 1, true), stdMat(0xe8d8b8, { em: 0xffc06a, ei: .5, side: THREE.DoubleSide })), 0, 1.72, 0));
    const flLight = new THREE.PointLight(0xffb867, 9, 6.5, 1.6); flLight.position.set(0, 1.6, 0); fl.add(flLight);
    put(fl, 2.5, 0, -1.7); set.add(fl);
    set.userData.accent = [flLight];

    // 绿植
    const plant = new THREE.Group();
    plant.add(put(new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.12, 0.3, 12), stdMat(0x8a5a3a)), 0, 0.15, 0));
    for (let i = 0; i < 7; i++) {
      const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.09, rand(0.5, 0.9), 6), stdMat(0x2f6b3a, { rough: .9 }));
      put(leaf, rand(-0.12, 0.12), 0.5 + rand(0, 0.35), rand(-0.12, 0.12), rand(-0.35, 0.35), rand(0, 3), rand(-0.35, 0.35));
      plant.add(leaf);
    }
    put(plant, -2.7, 0, 2.0); set.add(plant);

    // 左墙：奖状 / 锦旗 / 泛黄老照片
    const wallX = -3.36;
    const a1 = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.85), new THREE.MeshStandardMaterial({ map: awardTex('奖状', '王小杰'), roughness: .95, emissive: 0x201808, emissiveIntensity: .35 }));
    put(a1, wallX, 1.75, -1.5, 0, Math.PI / 2, 0); a1.rotation.y = Math.PI / 2; set.add(a1);
    const a2 = a1.clone(); a2.material = a1.material.clone(); a2.material.map = awardTex('三好学生', '王小杰');
    put(a2, wallX, 1.75, -0.35); a2.rotation.y = Math.PI / 2; set.add(a2);
    const a3 = a1.clone(); a3.material = a1.material.clone(); a3.material.map = awardTex('优秀家长', '家长');
    put(a3, wallX, 1.75, 0.8); a3.rotation.y = Math.PI / 2; set.add(a3);
    const ban = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.38), new THREE.MeshStandardMaterial({ map: bannerTex(), roughness: .9, emissive: 0x200000, emissiveIntensity: .3 }));
    put(ban, wallX, 2.5, 0.22); ban.rotation.y = Math.PI / 2; set.add(ban);
    // 老照片（泛黄）
    const frame = box(0.03, 0.5, 0.38, stdMat(0x6a4a28));
    put(frame, wallX + 0.02, 1.1, 0.35); set.add(frame);
    this.oldPhotoFront = new THREE.Mesh(new THREE.PlaneGeometry(0.32, 0.44), new THREE.MeshStandardMaterial({ map: oldPhotoTex(false), roughness: .95 }));
    put(this.oldPhotoFront, wallX + 0.09, 1.1, 0.35); this.oldPhotoFront.rotation.y = Math.PI / 2; set.add(this.oldPhotoFront);
    this.oldPhotoBack = new THREE.Mesh(new THREE.PlaneGeometry(0.32, 0.44), new THREE.MeshStandardMaterial({ map: oldPhotoTex(true), roughness: .95 }));
    put(this.oldPhotoBack, wallX + 0.055, 1.1, 0.35); this.oldPhotoBack.rotation.y = -Math.PI / 2; set.add(this.oldPhotoBack);

    // 右墙：窗 + 夜景 + 窗帘 + 雨
    const win = new THREE.Group();
    win.add(put(box(0.05, 1.5, 2.3, stdMat(0x2a2622)), 0, 0, 0));
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(2.16, 1.36), new THREE.MeshBasicMaterial({ map: cityViewTex(), toneMapped: false }));
    put(glass, 0.04, 1.55, 0); glass.rotation.y = -Math.PI / 2; win.add(glass);
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex('rgba(120,170,255,0.5)'), blending: THREE.AdditiveBlending, depthWrite: false }));
    glow.scale.set(3.4, 3.4, 1); glow.position.set(-0.25, 1.55, 0); win.add(glow);
    const cur1 = box(0.3, 2.1, 0.62, stdMat(0x6b2b28, { rough: 1 })); put(cur1, -0.35, 1.35, -1.32);
    const cur2 = box(0.3, 2.1, 0.62, stdMat(0x6b2b28, { rough: 1 })); put(cur2, -0.35, 1.35, 1.32);
    win.add(cur1, cur2);
    put(win, 3.34, 0, 0); set.add(win);
    const winLight = new THREE.PointLight(0x5b86c9, 3, 7, 1.6); winLight.position.set(3.0, 1.7, 0); set.add(winLight);
    set.userData.accent.push(winLight);

    // 门（通向小杰房间）
    const door = box(0.9, 2.1, 0.08, stdMat(0x533b26, { rough: .7 }));
    put(door, -2.0, 1.05, 2.74); set.add(door);
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8), stdMat(0xd8c070, { metal: .8, rough: .3 }));
    put(knob, -1.65, 1.0, 2.68); set.add(knob);

    return set;
  }

  _buildBedroom() {
    const set = new THREE.Group();
    this._roomShell(set, 5.2, 4.8, 2.75, '#2a2732');

    const key = new THREE.DirectionalLight(0x9fb6e8, 1.1);
    key.position.set(-2.2, 3.2, 2.4); key.target.position.set(0.4, 0.8, -1);
    key.castShadow = true;
    const sc = this.lowPerf ? 1024 : 2048;
    key.shadow.mapSize.set(sc, sc);
    key.shadow.camera.left = -4; key.shadow.camera.right = 4;
    key.shadow.camera.top = 4; key.shadow.camera.bottom = -4;
    key.shadow.camera.near = 0.5; key.shadow.camera.far = 14;
    key.shadow.bias = -0.0016;
    set.add(key, key.target);
    set.userData.key = key;

    // 床
    const bed = new THREE.Group();
    bed.add(put(box(1.5, 0.32, 2.1, stdMat(0x4a3524, { rough: .9 })), 0, 0.24, 0));
    const mat = box(1.42, 0.2, 2.0, stdMat(0xdfd8cc, { rough: 1 })); put(mat, 0, 0.5, 0); bed.add(mat);
    const blanket = box(1.46, 0.16, 1.2, stdMat(0x3b5d8a, { rough: 1 })); put(blanket, 0, 0.64, 0.42); bed.add(blanket);
    const pillow = box(0.62, 0.16, 0.36, stdMat(0xf2ede2, { rough: 1 })); put(pillow, -0.3, 0.68, -0.78); bed.add(pillow);
    // 枕头下露出一角日记本
    const diary = box(0.26, 0.05, 0.34, stdMat(0x6a3f5c, { rough: .8 }));
    put(diary, -0.5, 0.75, -0.8, 0.1, 0.3, 0); diary.userData.name = 'diary';
    bed.add(diary); this.diary = diary; this.pickables.push(diary);
    put(bed, -1.25, 0, -0.35, 0, 0.06, 0); set.add(bed);

    // 床头柜 + 小夜灯
    const ns = box(0.5, 0.5, 0.42, stdMat(0x4a3524)); put(ns, -1.25, 0.25, 1.45); set.add(ns);
    const nl = new THREE.PointLight(0xffb066, 3.2, 4, 1.7); nl.position.set(-1.25, 0.75, 1.45); set.add(nl);
    set.userData.accent = [nl];

    // 书桌 + 电脑
    const desk = new THREE.Group();
    desk.add(put(box(1.7, 0.06, 0.72, stdMat(0x5b4530, { rough: .6 })), 0, 0.74, 0));
    [[-0.8, -0.3], [0.8, -0.3], [-0.8, 0.3], [0.8, 0.3]].forEach(([x, z]) =>
      desk.add(put(box(0.06, 0.74, 0.06, stdMat(0x33251a)), x, 0.37, z)));
    const mon = new THREE.Group();
    mon.add(box(0.62, 0.4, 0.05, stdMat(0x0d0d12, { rough: .3, metal: .4 })));
    this.monScreen = emissivePlane(0.56, 0.34, monitorTex('game'), 1.3); this.monScreen.position.z = 0.03; mon.add(this.monScreen);
    const mLight = new THREE.PointLight(0x66c8ff, 2.2, 3.2, 1.7); mLight.position.set(0, 0, 0.4); mon.add(mLight);
    this.monLight = mLight;
    put(mon, 0.1, 1.02, -0.3, -0.05, 0, 0); desk.add(mon);
    desk.add(box(0.06, 0.22, 0.06, stdMat(0x1a1a1f)).translateX(0.1).translateY(0.86).translateZ(-0.3));
    const kb = box(0.5, 0.03, 0.18, stdMat(0x22222a)); put(kb, 0.1, 0.78, 0.12); desk.add(kb);
    put(desk, 1.45, 0, -1.55, 0, Math.PI + 0.12, 0); set.add(desk);
    this.desk = desk;

    // 椅子
    const chair = new THREE.Group();
    chair.add(put(box(0.42, 0.06, 0.42, stdMat(0x2b2b33)), 0, 0.46, 0));
    chair.add(put(box(0.42, 0.5, 0.06, stdMat(0x2b2b33)), 0, 0.72, -0.19));
    [[-0.17, -0.17], [0.17, -0.17], [-0.17, 0.17], [0.17, 0.17]].forEach(([x, z]) =>
      chair.add(put(box(0.05, 0.46, 0.05, stdMat(0x1d1d24)), x, 0.23, z)));
    put(chair, 1.45, 0, -0.7); set.add(chair);

    // 书架
    const shelf = new THREE.Group();
    shelf.add(put(box(0.8, 1.7, 0.3, stdMat(0x4a3524)), 0, 0.85, 0));
    for (let i = 0; i < 3; i++) for (let j = 0; j < 5; j++) {
      const bk = box(0.09, rand(0.24, 0.34), 0.2, stdMat([0x8a3b2e, 0x2e6b5b, 0x8a7630, 0x3b4a8a][(i + j) % 4]));
      put(bk, -0.28 + j * 0.14, 0.28 + i * 0.5, 0.18); shelf.add(bk);
    }
    put(shelf, 2.1, 0, 1.5, 0, -0.3, 0); set.add(shelf);

    // 海报
    const poster = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 1.0), stdMat(0x1b2440, { em: 0x2a3a66, ei: .3 }));
    put(poster, -2.54, 1.7, 0.8); poster.rotation.y = Math.PI / 2; set.add(poster);

    // 窗（遮光帘 + 夜）
    const win = new THREE.Group();
    win.add(put(box(1.8, 1.3, 0.05, stdMat(0x22222a)), 0, 0, 0));
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(1.68, 1.18), new THREE.MeshBasicMaterial({ map: cityViewTex(), toneMapped: false }));
    put(glass, 0, 0, 0.04); win.add(glass);
    for (let i = 0; i < 8; i++) {
      win.add(put(box(1.76, 0.08, 0.02, stdMat(0x101014)), 0, 0.55 - i * 0.14, 0.07));
    }
    put(win, 1.15, 1.6, -2.34); set.add(win);

    // 门
    const door = box(0.88, 2.05, 0.08, stdMat(0x4a3524));
    put(door, 2.44, 1.02, 0.9, 0, -Math.PI / 2, 0); set.add(door);

    return set;
  }

  _buildCorridor() {
    const set = new THREE.Group();
    const wallMat = stdMat('#20222b', { map: plasterTex('#20222b'), rough: 1 });
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(3.0, 9), stdMat(0x54524c, { rough: .9 }));
    floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; set.add(floor);
    const ceil = new THREE.Mesh(new THREE.PlaneGeometry(3.0, 9), stdMat(0x3a3a42, { rough: 1 }));
    ceil.rotation.x = Math.PI / 2; ceil.position.y = 2.7; set.add(ceil);
    set.add(put(box(0.12, 2.7, 9, wallMat), -1.56, 1.35, 0));
    set.add(put(box(0.12, 2.7, 9, wallMat), 1.56, 1.35, 0));
    set.add(put(box(3.0, 2.7, 0.12, wallMat), 0, 1.35, -4.56));
    set.add(put(box(3.0, 2.7, 0.12, wallMat), 0, 1.35, 4.56));
    // 一扇门
    const d1 = box(0.86, 2.0, 0.08, stdMat(0x3a2a1e)); put(d1, -1.5, 1.0, -1.6, 0, Math.PI / 2, 0); set.add(d1);
    const d2 = box(0.86, 2.0, 0.08, stdMat(0x3a2a1e)); put(d2, 1.5, 1.0, 0.6, 0, -Math.PI / 2, 0); set.add(d2);
    // 声控灯
    const l1 = new THREE.PointLight(0xffcf8a, 5, 5, 1.7); l1.position.set(0, 2.5, -1.6); set.add(l1);
    const l2 = new THREE.PointLight(0xffcf8a, 4, 5, 1.7); l2.position.set(0, 2.5, 1.6); set.add(l2);
    set.userData.accent = [l1, l2];
    set.userData.key = new THREE.DirectionalLight(0xffd9a0, 0.7);
    set.add(set.userData.key); set.userData.key.position.set(0, 3, 2);
    // 长椅（派出所）
    const bench = new THREE.Group();
    bench.add(put(box(2.2, 0.08, 0.5, stdMat(0x6b6a63, { rough: .6, metal: .3 })), 0, 0.45, 0));
    bench.add(put(box(2.2, 0.5, 0.08, stdMat(0x6b6a63, { rough: .6, metal: .3 })), 0, 0.7, -0.24, -0.12, 0, 0));
    [[-0.95, 0], [0.95, 0]].forEach(([x]) => bench.add(put(box(0.08, 0.45, 0.45, stdMat(0x4a4a46)), x, 0.22, 0)));
    put(bench, 0.5, 0, -1.4); set.add(bench); this.bench = bench;
    // 警示牌
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.42),
      stdMat(0x123a6b, { em: 0x1b4f8f, ei: .5 }));
    put(sign, -1.44, 1.9, 0.6); sign.rotation.y = Math.PI / 2; set.add(sign);
    return set;
  }

  _buildCity() {
    const set = new THREE.Group();
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), stdMat(0x24262c, { rough: .95 }));
    ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; set.add(ground);
    // 马路 + 标线
    const road = new THREE.Mesh(new THREE.PlaneGeometry(7, 40), stdMat(0x1a1b20, { rough: .95 }));
    road.rotation.x = -Math.PI / 2; road.position.set(0, 0.01, 0); set.add(road);
    for (let i = -9; i < 9; i++) {
      const ln = new THREE.Mesh(new THREE.PlaneGeometry(0.18, 2.2), stdMat(0xc9c4ae, { em: 0x3a3830, ei: .4 }));
      ln.rotation.x = -Math.PI / 2; ln.position.set(0, 0.02, i * 3); set.add(ln);
    }
    // 楼房剪影
    for (let i = 0; i < 14; i++) {
      const w = rand(3, 7), h = rand(6, 16), d = rand(3, 7);
      const bmat = stdMat(0x141821, { rough: 1 });
      const b = box(w, h, d, bmat);
      put(b, (i % 2 ? 1 : -1) * rand(9, 22), h / 2, rand(-24, 6));
      set.add(b);
      // 亮窗
      const winTex = makeTex(64, 128, (g, ww, hh) => {
        g.fillStyle = '#0f131b'; g.fillRect(0, 0, ww, hh);
        for (let y = 4; y < hh - 6; y += 12) for (let x = 4; x < ww - 6; x += 10)
          if (Math.random() > .45) { g.fillStyle = Math.random() > .5 ? '#ffd48a' : '#9fd0ff'; g.fillRect(x, y, 6, 7); }
      });
      const winPlane = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.95, h * 0.9), new THREE.MeshBasicMaterial({ map: winTex, transparent: true, opacity: .5, toneMapped: false }));
      winPlane.position.copy(b.position); winPlane.position.y = h / 2;
      winPlane.position.x += (i % 2 ? -1 : 1) * (d / 2 + 0.02);
      winPlane.rotation.y = i % 2 ? -Math.PI / 2 : Math.PI / 2;
      set.add(winPlane);
    }
    // 路灯
    const sl = new THREE.Group();
    sl.add(put(new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 5.4, 10), stdMat(0x2a2c33)), 0, 2.7, 0));
    sl.add(put(box(1.0, 0.12, 0.16, stdMat(0x2a2c33)), 0.5, 5.35, 0));
    const head = box(0.4, 0.14, 0.24, stdMat(0xfff0cc, { em: 0xffd28a, ei: 1.4 })); put(head, 0.95, 5.3, 0); sl.add(head);
    const sll = new THREE.PointLight(0xffc27a, 18, 16, 1.5); sll.position.set(0.95, 5.1, 0); sl.add(sll);
    put(sl, -3.2, 0, -2); set.add(sl);
    // 天桥护栏
    const rail = new THREE.Group();
    rail.add(put(box(14, 0.1, 0.1, stdMat(0x3a3d45)), 0, 1.15, 0));
    rail.add(put(box(14, 0.1, 0.1, stdMat(0x3a3d45)), 0, 0.75, 0));
    for (let i = -7; i <= 7; i++) rail.add(put(box(0.08, 1.2, 0.08, stdMat(0x33363d)), i, 0.6, 0));
    put(rail, 0, 0, -5.5); set.add(rail);
    // 水泥管（无家可归）
    const pipe = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.1, 4, 24, 1, true), stdMat(0x6a6459, { rough: 1, side: THREE.DoubleSide }));
    put(pipe, 4.2, 1.0, 4.0, Math.PI / 2, 0, 0); set.add(pipe);
    const pipe2 = pipe.clone(); put(pipe2, 5.6, 0.6, 4.2, Math.PI / 2, 0, 0); set.add(pipe2);

    set.userData.key = new THREE.DirectionalLight(0x8fa8d8, 1.4);
    set.userData.key.position.set(-4, 8, 4); set.add(set.userData.key);
    set.userData.accent = [sl];
    set.add(new THREE.HemisphereLight(0x6a86c8, 0x101018, 0.5));
    // 雨
    this.rain = this._makeRain(1800);
    this.rain.position.set(0, 8, 0);
    set.add(this.rain);
    return set;
  }

  _makeRain(n) {
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(n * 3), vel = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      pos[i * 3] = rand(-20, 20); pos[i * 3 + 1] = rand(0, 16); pos[i * 3 + 2] = rand(-20, 20);
      vel[i] = rand(9, 16);
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const m = new THREE.PointsMaterial({ color: 0xa8c6e8, size: 0.07, transparent: true, opacity: .5, depthWrite: false });
    const p = new THREE.Points(geo, m);
    p.userData.vel = vel;
    return p;
  }

  _addDust() {
    const n = this.lowPerf ? 260 : 520;
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(n * 3), ph = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      pos[i * 3] = rand(-3.2, 3.2); pos[i * 3 + 1] = rand(0.2, 2.8); pos[i * 3 + 2] = rand(-2.8, 2.8);
      ph[i] = rand(0, Math.PI * 2);
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({ size: 0.035, map: dotTex(), transparent: true, opacity: .42, depthWrite: false, blending: THREE.AdditiveBlending });
    this.dust = new THREE.Points(geo, mat);
    this.dust.userData.ph = ph;
    this.scene.add(this.dust);
  }

  /* ---------- 镜头 ---------- */
  shots = {
    living: {
      wide: { pos: [3.0, 1.7, 3.7], look: [-0.3, 1.15, -1.7], fov: 42 },
      tv: { pos: [0.1, 1.35, 2.3], look: [0, 1.35, -2.5], fov: 40 },
      behind: { pos: [0.35, 1.62, 2.05], look: [0.05, 0.75, -0.5], fov: 44 },
      table: { pos: [-0.15, 1.15, 0.35], look: [-0.3, 0.5, -0.55], fov: 34 },
      scold: { pos: [2.1, 1.8, 2.0], look: [-0.8, 1.5, -2.3], fov: 46 },
      wall: { pos: [-1.5, 1.5, 1.0], look: [-3.3, 1.4, -0.4], fov: 30 },
      photo: { pos: [-2.0, 1.25, 1.3], look: [-3.3, 1.1, 0.35], fov: 26 },
      kneel: { pos: [2.4, 1.6, 1.9], look: [-0.6, 0.5, -0.55], fov: 46 },
      dinner: { pos: [1.7, 1.4, 1.9], look: [0.1, 0.85, -0.55], fov: 42 },
      sofa: { pos: [1.5, 1.5, 2.6], look: [0, 0.85, 0.4], fov: 44 },
      low: { pos: [0.0, 0.6, 1.2], look: [0, 0.6, -2.4], fov: 48 },
      crackwall: { pos: [0, 1.5, 1.6], look: [-3.3, 1.3, 0], fov: 44 },
    },
    bedroom: {
      wide: { pos: [2.3, 1.65, 2.1], look: [-0.4, 1.0, -1.1], fov: 44 },
      door: { pos: [2.0, 1.6, 1.9], look: [-0.6, 1.0, -1.3], fov: 46 },
      pillow: { pos: [-0.9, 1.05, 0.15], look: [-1.35, 0.66, -0.85], fov: 32 },
      desk: { pos: [0.55, 1.3, 0.35], look: [1.5, 1.05, -1.5], fov: 36 },
      night: { pos: [0.95, 1.3, 0.75], look: [-1.0, 0.75, -1.4], fov: 42 },
      confront: { pos: [1.5, 1.55, 1.25], look: [-0.5, 1.15, -1.6], fov: 46 },
      beddark: { pos: [1.6, 1.3, 0.9], look: [-1.2, 0.5, -1.3], fov: 44 },
      mother: { pos: [2.35, 1.5, 0.6], look: [-0.6, 0.9, -0.6], fov: 48 },
    },
    corridor: {
      wide: { pos: [0, 1.6, 3.2], look: [0, 1.25, -2.2], fov: 46 },
      kneel: { pos: [0.2, 1.75, 1.6], look: [0.1, 0.25, -1.2], fov: 40 },
      bench: { pos: [0.3, 1.4, 0.4], look: [0.5, 0.75, -1.5], fov: 40 },
      cold: { pos: [0, 1.9, 1.4], look: [0.4, 0.8, -1.4], fov: 48 },
    },
    city: {
      wide: { pos: [-1.6, 2.6, 7.5], look: [0.4, 1.6, -1.5], fov: 48 },
      bridge: { pos: [1.2, 2.2, 1.2], look: [-0.4, 1.0, -5.6], fov: 42 },
      street: { pos: [3.4, 1.4, 3.2], look: [-0.6, 1.4, -4.6], fov: 46 },
      pipe: { pos: [3.0, 1.1, 1.6], look: [4.4, 0.85, 3.6], fov: 40 },
      far: { pos: [-4.5, 2.0, 4.0], look: [1.0, 1.0, 2.0], fov: 50 },
    },
  };

  setCamera(setName, shotName, dur = 1.5) {
    const s = this.shots[setName] && this.shots[setName][shotName];
    if (!s) return;
    this.tween = {
      dur, t: 0,
      fromP: this.camera.position.clone(), toP: new THREE.Vector3(...s.pos),
      fromL: this.camLook.clone(), toL: new THREE.Vector3(...s.look),
      fromF: this.camera.fov, toF: s.fov,
    };
  }

  showSet(name, mood) {
    if (!this.sets[name]) return;
    for (const k in this.sets) this.sets[k].visible = k === name;
    this.set = name;
    if (mood) this.setMood(mood);
  }

  setMood(cfg) {
    const s = this.sets[this.set];
    if (cfg.bg != null) this.scene.background = new THREE.Color(cfg.bg);
    if (cfg.fog) { this.scene.fog.color.set(cfg.fog.color); this.scene.fog.near = cfg.fog.near; this.scene.fog.far = cfg.fog.far; }
    if (cfg.hemi) { this.hemi.color.set(cfg.hemi[0]); this.hemi.groundColor.set(cfg.hemi[1]); this.hemi.intensity = cfg.hemi[2]; }
    if (cfg.amb != null) this.amb.intensity = cfg.amb;
    if (cfg.exposure != null) this.renderer.toneMappingExposure = cfg.exposure;
    if (cfg.key && s && s.userData.key) {
      s.userData.key.color.set(cfg.key[0]);
      s.userData.key.intensity = cfg.key[1];
    }
    if (cfg.accent && s && s.userData.accent) {
      s.userData.accent.forEach((l, i) => {
        if (!cfg.accent[i]) return;
        if (l.isPointLight) { l.color.set(cfg.accent[i][0]); l.intensity = cfg.accent[i][1]; }
      });
    }
    if (cfg.tv != null && this.tvLight) this.tvLight.intensity = cfg.tv;
    if (cfg.mon != null && this.monLight) this.monLight.intensity = cfg.mon;
  }

  setTvScreen(kind) {
    if (!this.tvNews) return;
    if (kind === 'show') { this.tvNews.material.map = this.tvShowTex; this.tvNews.material.needsUpdate = true; }
    else { this.tvNews.material.map = tvNewsTex(); this.tvNews.material.color.setScalar(1.15); }
  }
  setMonitor(kind) {
    if (!this.monScreen) return;
    this.monScreen.material.map = monitorTex(kind);
    this.monScreen.material.needsUpdate = true;
  }
  crackPhone() {
    if (this.phoneScreen) { this.phoneScreen.material.map = crackPhoneTex(); this.phoneScreen.material.needsUpdate = true; }
  }
  flipOldPhoto(back) {
    if (!this.oldPhotoFront) return;
    this.oldPhotoFront.visible = !back;
    this.oldPhotoBack.visible = !!back;
  }

  /* ---------- 角色 ---------- */
  showKid(pose, pos = [0, 0, 0], rotY = 0) {
    this.kid.visible = true;
    this.kid.position.set(...pos);
    this.kid.rotation.set(0, rotY, 0);
    this.kid.userData.pose(pose);
  }
  hideKid() { this.kid.visible = false; }
  kidLookAt(x, y, z) {
    const dx = x - this.kid.position.x, dz = z - this.kid.position.z;
    const base = Math.atan2(dx, dz);
    this.kid.userData.parts.head.rotation.y = clamp(base - this.kid.rotation.y, -1.1, 1.1) * 0.7;
  }

  /* ---------- 特效 ---------- */
  shake(amount = 0.35, dur = 0.6) { this.shakeAmt = amount; this.shakeT = dur; this.shakeDur = dur; }

  shatterPhone(origin = new THREE.Vector3(0, 0.6, -0.5)) {
    const shards = [];
    for (let i = 0; i < (this.lowPerf ? 14 : 26); i++) {
      const g = new THREE.Mesh(
        new THREE.BoxGeometry(rand(0.02, 0.07), rand(0.01, 0.03), rand(0.02, 0.07)),
        new THREE.MeshStandardMaterial({ color: 0x9fd8ff, emissive: 0x2a6a99, emissiveIntensity: .6, roughness: .15, metalness: .3, transparent: true, opacity: .9 })
      );
      g.position.copy(origin).add(new THREE.Vector3(rand(-.1, .1), rand(-.05, .05), rand(-.1, .1)));
      this.scene.add(g);
      shards.push({ m: g, v: new THREE.Vector3(rand(-1.6, 1.6), rand(1.4, 3.2), rand(-1.6, 1.6)), r: new THREE.Vector3(rand(-8, 8), rand(-8, 8), rand(-8, 8)), life: 2.6 });
    }
    this._shards = shards;
  }

  setInteractable(name) {
    this.interactName = name;
    this._pickResolve = null;
    return new Promise((res) => { this._pickResolve = res; });
  }
  _tryPick(clientX, clientY) {
    const r = this.canvas.getBoundingClientRect();
    const ndc = new THREE.Vector2(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
    this.raycaster.setFromCamera(ndc, this.camera);
    const hits = this.raycaster.intersectObjects(this.pickables, true);
    if (hits.length && this._pickResolve) {
      let o = hits[0].object;
      while (o && !o.userData.name) o = o.parent;
      const nm = o ? o.userData.name : null;
      if (nm === this.interactName) { const r2 = this._pickResolve; this._pickResolve = null; r2(true); return true; }
    }
    return false;
  }

  _bindPointer() {
    const move = (x, y) => {
      this.pointer.tx = clamp((x / window.innerWidth - 0.5) * 2, -1, 1);
      this.pointer.ty = clamp((y / window.innerHeight - 0.5) * 2, -1, 1);
    };
    window.addEventListener('pointermove', (e) => move(e.clientX, e.clientY), { passive: true });
    window.addEventListener('pointerdown', (e) => {
      if (this._pickResolve) this._tryPick(e.clientX, e.clientY);
    }, { passive: true });
  }

  resize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.fov = this.camera.fov; // keep
    this.camera.updateProjectionMatrix();
  }

  /* ---------- 主循环 ---------- */
  _loop() {
    requestAnimationFrame(this._loop);
    const dt = Math.min(0.05, this.clock.getDelta());
    this.time += dt;

    // 镜头补间
    if (this.tween) {
      const tw = this.tween;
      tw.t += dt;
      const k = clamp(tw.t / tw.dur, 0, 1);
      const e = easeInOut(k);
      this.camera.position.lerpVectors(tw.fromP, tw.toP, e);
      this.camLook.lerpVectors(tw.fromL, tw.toL, e);
      this.camera.fov = lerp(tw.fromF, tw.toF, e);
      this.camera.updateProjectionMatrix();
      if (k >= 1) this.tween = null;
    }

    // 抖动
    let sx = 0, sy = 0;
    if (this.shakeT > 0) {
      this.shakeT -= dt;
      const a = this.shakeAmt * (this.shakeT / this.shakeDur);
      sx = rand(-a, a) * 0.14; sy = rand(-a, a) * 0.14;
    }
    // 呼吸 + 视差
    this.pointer.x = lerp(this.pointer.x, this.pointer.tx, dt * 2.2);
    this.pointer.y = lerp(this.pointer.y, this.pointer.ty, dt * 2.2);
    const br = Math.sin(this.time * 0.9) * 0.012;
    this.camera.position.set(
      this.camera.position.x + sx + this.pointer.x * 0.06,
      this.camera.position.y + sy + br + this.pointer.y * 0.045,
      this.camera.position.z
    );
    this.camera.lookAt(this.camLook);

    // 尘土
    if (this.dust && this.dust.visible) {
      const p = this.dust.geometry.attributes.position, ph = this.dust.userData.ph;
      for (let i = 0; i < ph.length; i++) {
        let y = p.array[i * 3 + 1] + dt * (0.05 + (i % 5) * 0.012);
        if (y > 2.85) y = 0.15;
        p.array[i * 3 + 1] = y;
        p.array[i * 3] += Math.sin(this.time * 0.6 + ph[i]) * dt * 0.05;
      }
      p.needsUpdate = true;
    }

    // 雨
    if (this.rain && this.set === 'city') {
      const p = this.rain.geometry.attributes.position, v = this.rain.userData.vel;
      for (let i = 0; i < v.length; i++) {
        let y = p.array[i * 3 + 1] - v[i] * dt;
        if (y < 0) y = 16;
        p.array[i * 3 + 1] = y;
      }
      p.needsUpdate = true;
    }

    // 碎屏碎片
    if (this._shards) {
      for (const s of this._shards) {
        s.life -= dt;
        s.v.y -= 9.6 * dt;
        s.m.position.addScaledVector(s.v, dt);
        s.m.rotation.x += s.r.x * dt; s.m.rotation.y += s.r.y * dt; s.m.rotation.z += s.r.z * dt;
        if (s.m.position.y < 0.03) { s.m.position.y = 0.03; s.v.y *= -0.28; s.v.x *= 0.7; s.v.z *= 0.7; }
        s.m.material.opacity = clamp(s.life / 1.2, 0, 1);
      }
      if (this._shards.every((s) => s.life <= 0)) {
        this._shards.forEach((s) => this.scene.remove(s.m));
        this._shards = null;
      }
    }

    // 手机屏幕脉动
    if (this.tablePhone && this.tablePhone.visible) { /* 静态即可 */ }

    this.renderer.render(this.scene, this.camera);
  }
}

export { oldPhotoTex, tvNewsTex, tvShowTex, monitorTex, cityViewTex, awardTex, bannerTex, phoneTex };
