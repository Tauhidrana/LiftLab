/** Scene layout in metres. Everything is derived from floor count and height. */
export function getDims(floors: number, floorHeight: number) {
  const maxPos = (floors - 1) * floorHeight
  const shaftTop = maxPos + 4.2 // overhead above the top landing
  const sheaveR = 0.5
  return {
    floors,
    H: floorHeight,
    maxPos,
    shaftTop,
    pitBottom: -1.6,
    shaft: { x0: -1.35, x1: 1.35, z0: -1.45, z1: 1.25 },
    building: { x0: -4.2, x1: 4.2, z0: -3.4, z1: 3.8 },
    car: { w: 1.6, d: 1.4, h: 2.4, z: 0.45, slingTop: 2.65 },
    door: { open: 0.9, carZ: 1.17, landingZ: 1.27 },
    carRailX: 0.98,
    cw: { w: 1.0, h: 1.4, d: 0.24, z: -1.0, railX: 0.62, topAtMax: 0.8 },
    sheave: { r: sheaveR, y: shaftTop + 0.85, z: -0.5 },
    hitchZ: 0,
    machine: { x0: -2.4, x1: 2.4, z0: -2.0, z1: 1.8, h: 2.9 },
    governor: { x: 1.15, r: 0.17, zA: 0.78, zB: 1.12 },
  }
}

export type Dims = ReturnType<typeof getDims>

export const cwTop = (d: Dims, carPos: number) => d.cw.topAtMax + (d.maxPos - carPos)
