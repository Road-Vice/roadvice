import * as THREE from 'three';
import { randomRoadPoint, HALF, LIM } from './world.js';

const dogBody = new THREE.BoxGeometry(0.42, 0.34, 0.8);
const dogHead = new THREE.BoxGeometry(0.24, 0.24, 0.3);
const dogSnout = new THREE.BoxGeometry(0.12, 0.12, 0.16);
const dogLeg = new THREE.BoxGeometry(0.08, 0.34, 0.08);
const dogTail = new THREE.BoxGeometry(0.07, 0.07, 0.34);
dogLeg.translate(0, -0.17, 0);
dogTail.translate(0, 0.05, -0.17);
const DOG_COLORS = [0x8a6a43, 0x2c2c30, 0xd8c9a8, 0xb06a3a, 0xf0f0f0];

export class Animals {
  constructor(scene, dogCount = 9, pigeonCount = 30) {
    this.dogs = [];
    for (let n = 0; n < dogCount; n++) {
      const mat = new THREE.MeshStandardMaterial({ color: DOG_COLORS[n % DOG_COLORS.length], roughness: 0.9 });
      const g = new THREE.Group();
      const body = new THREE.Mesh(dogBody, mat); body.position.y = 0.5; body.castShadow = true; g.add(body);
      const head = new THREE.Mesh(dogHead, mat); head.position.set(0, 0.62, 0.5); head.castShadow = true; g.add(head);
      const snout = new THREE.Mesh(dogSnout, mat); snout.position.set(0, 0.58, 0.7); g.add(snout);
      const tail = new THREE.Mesh(dogTail, mat); tail.position.set(0, 0.6, -0.5); g.add(tail);
      const legs = [];
      for (const [x, z] of [[-0.14, 0.26], [0.14, 0.26], [-0.14, -0.26], [0.14, -0.26]]) {
        const leg = new THREE.Mesh(dogLeg, mat);
        leg.position.set(x, 0.34, z); leg.castShadow = true;
        g.add(leg); legs.push(leg);
      }
      const p = randomRoadPoint();
      p.x += (Math.random() < 0.5 ? -1 : 1) * 7.5;
      p.z += (Math.random() < 0.5 ? -1 : 1) * 7.5;
      p.x = Math.max(-LIM + 2, Math.min(LIM - 2, p.x));
      p.z = Math.max(-LIM + 2, Math.min(LIM - 2, p.z));
      g.position.copy(p).setY(0);
      scene.add(g);
      this.dogs.push({ g, tail, legs, heading: Math.random() * 6.28, phase: Math.random() * 9,
        target: this.dogTarget(p), speed: 1.4 + Math.random() * 1.2, waitT: Math.random() * 3 });
    }

    this.pigeons = [];
    const pigGeo = new THREE.SphereGeometry(0.09, 6, 5);
    pigGeo.scale(1, 0.8, 1.5);
    this.pigInst = new THREE.InstancedMesh(pigGeo,
      new THREE.MeshStandardMaterial({ color: 0x9aa4b0, roughness: 0.8 }), pigeonCount);
    this.pigInst.castShadow = true;
    scene.add(this.pigInst);
    const home = randomRoadPoint();
    for (let n = 0; n < pigeonCount; n++) {
      this.pigeons.push({
        pos: new THREE.Vector3(home.x + (Math.random() - 0.5) * 10, 0, home.z + (Math.random() - 0.5) * 10),
        dir: Math.random() * 6.28, state: 'sol', t: Math.random() * 3,
        flyR: 5 + Math.random() * 8, flyH: 4 + Math.random() * 7, flyA: Math.random() * 6.28
      });
    }
    this.home = new THREE.Vector3(home.x, 0, home.z);
    this.moveHomeT = 20 + Math.random() * 20;
    this.dummy = new THREE.Object3D();
  }

  dogTarget(from) {
    const p = randomRoadPoint();
    p.x += (Math.random() < 0.5 ? -1 : 1) * 7.5;
    p.z += (Math.random() < 0.5 ? -1 : 1) * 7.5;
    return p;
  }

  update(dt, player) {
    for (const d of this.dogs) {
      if (d.waitT > 0) {
        d.waitT -= dt;
        d.phase += dt * 1.2;
      } else {
        const to = d.target.clone().sub(d.g.position).setY(0);
        const dist = to.length();
        if (dist < 1.5) { d.waitT = 2 + Math.random() * 4; d.target = this.dogTarget(d.g.position); }
        else {
          to.normalize();
          d.g.position.addScaledVector(to, d.speed * dt);
          d.heading = Math.atan2(to.x, to.z);
          d.phase += dt * 8;
        }
      }
      const pp = player.pos.distanceTo(d.g.position);
      if (pp < 4) d.waitT = 0;
      d.g.rotation.y = d.heading;
      const sw = Math.sin(d.phase) * 0.5;
      d.legs[0].rotation.x = sw; d.legs[1].rotation.x = -sw;
      d.legs[2].rotation.x = -sw; d.legs[3].rotation.x = sw;
      d.tail.rotation.y = Math.sin(d.phase * 2.4) * 0.5;
    }

    this.moveHomeT -= dt;
    if (this.moveHomeT <= 0) {
      this.moveHomeT = 20 + Math.random() * 25;
      const h = randomRoadPoint();
      this.home.set(h.x, 0, h.z);
    }

    const dm = this.dummy;
    let n = 0;
    for (const pig of this.pigeons) {
      pig.t -= dt;
      const dPl = pig.pos.distanceTo(player.pos);
      if (pig.state === 'sol') {
        if (dPl < 3.2 || (pig.t <= 0 && Math.random() < 0.4)) {
          pig.state = 'vol'; pig.t = 4 + Math.random() * 3;
          pig.flyA = Math.random() * 6.28;
        } else {
          pig.dir += (Math.random() - 0.5) * 2.4 * dt;
          pig.pos.x += Math.sin(pig.dir) * 0.7 * dt;
          pig.pos.z += Math.cos(pig.dir) * 0.7 * dt;
          const hop = Math.max(0, Math.sin(performance.now() / 130 + n * 2)) * 0.06;
          dm.position.set(pig.pos.x, hop, pig.pos.z);
          dm.rotation.set(0, pig.dir, 0);
          dm.scale.setScalar(1); dm.updateMatrix();
          this.pigInst.setMatrixAt(n, dm.matrix);
        }
      }
      if (pig.state === 'vol') {
        pig.flyA += dt * 1.9;
        pig.pos.x = this.home.x + Math.cos(pig.flyA) * pig.flyR;
        pig.pos.z = this.home.z + Math.sin(pig.flyA) * pig.flyR;
        pig.pos.y = pig.flyH + Math.sin(pig.flyA * 2.2) * 0.8;
        dm.position.copy(pig.pos);
        dm.rotation.set(0, -pig.flyA + Math.PI / 2, Math.sin(pig.flyA * 2.5) * 0.25);
        dm.scale.setScalar(1.15); dm.updateMatrix();
        this.pigInst.setMatrixAt(n, dm.matrix);
        if (pig.t <= 0 && dPl > 8) { pig.state = 'sol'; pig.pos.y = 0; }
      }
      n++;
    }
    this.pigInst.instanceMatrix.needsUpdate = true;
  }
}
