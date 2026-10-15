// Art direction as data. A skin decides how every material's cell tile is painted, the
// colors of the well behind the board, and how loose materials (water, sand, mud) are
// shaded. The renderer never hard-codes a color: swap the skin and the whole board changes.

import { hex } from './color.js';

const pal = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, Object.fromEntries(Object.entries(v).map(([n, c]) => [n, typeof c === 'string' ? hex(c) : c]))]));

// The shipping look: chunky voxel cubes with pixel-art faces, a glossy candy bevel and a
// dark navy well so the materials carry all the color.
export const TOYBOX = {
  id: 'toybox',
  name: 'Toybox',
  mode: 'pixel',
  texels: 16, // pixel-art texels across one cell face (fine, like an HD texture pack)
  radius: 0.12, // corner radius, share of a cell
  gloss: 0.34,
  bevel: 2, // texels of highlight / shadow band
  shadow: 0.42, // drop shadow strength behind blocks
  wall: { top: hex('#34479a'), bottom: hex('#1e2a5e'), grid: 'rgba(150,180,255,0.08)', rim: 'rgba(120,160,255,0.35)' },
  mats: pal({
    fire: { base: '#ff7b1c', light: '#ffd65a', dark: '#c2360c', edge: '#6e1a05', glow: '#ff9a2e' },
    water: { base: '#2f8cff', light: '#bfe8ff', dark: '#1550c8', edge: '#0b2f80' },
    wood: { base: '#c98a4b', light: '#eab275', dark: '#8a5528', edge: '#4a2a10' },
    wetwood: { base: '#6e5038', light: '#93704f', dark: '#432f20', edge: '#24170e', drop: '#8fd7ff' },
    ice: { base: '#a6e6ff', light: '#f0fcff', dark: '#5fb6e4', edge: '#2a76a8' },
    sand: { base: '#f3c96d', light: '#ffe6a3', dark: '#c99641', edge: '#7d5a22' },
    glass: { base: '#9fe8ff', light: '#ffffff', dark: '#5fc0e0', edge: '#d8f8ff' },
    stone: { base: '#9198a6', light: '#c3c8d2', dark: '#5f6573', edge: '#30343e' },
    brick: { base: '#c9533c', light: '#ec8164', dark: '#8f3122', edge: '#4d170e', mortar: '#ead7bb' },
    mud: { base: '#6a4224', light: '#a87a4e', dark: '#3a2312', edge: '#24150a' },
  }),
};

// Direction B: "Arcana". Every material is a carved rune tile with a glowing sigil, in a
// dusk tower. Reads instantly, but abstracts the physical materials away.
export const ARCANA = {
  id: 'arcana',
  name: 'Arcana',
  mode: 'sigil',
  texels: 8,
  radius: 0.16,
  gloss: 0.12,
  bevel: 1,
  shadow: 0.55,
  wall: { top: hex('#2a1640'), bottom: hex('#120a22'), grid: 'rgba(210,160,255,0.06)', rim: 'rgba(255,190,110,0.4)' },
  mats: pal({
    fire: { base: '#e2462c', light: '#ffc46b', dark: '#7c1a12', edge: '#2c0a08', glow: '#ff7a3a' },
    water: { base: '#2c6fe0', light: '#9fd0ff', dark: '#163f8c', edge: '#0a1c44' },
    wood: { base: '#8a5a2e', light: '#e2b06a', dark: '#4e3016', edge: '#22140a' },
    wetwood: { base: '#3f4a52', light: '#8fb4c8', dark: '#232a30', edge: '#101418', drop: '#9fd0ff' },
    ice: { base: '#6fc7e8', light: '#e8fbff', dark: '#2f7fa8', edge: '#123a50' },
    sand: { base: '#d8a64e', light: '#ffe2a0', dark: '#8c6326', edge: '#3a2810' },
    glass: { base: '#9fe8e0', light: '#ffffff', dark: '#3f9a92', edge: '#d4fff8' },
    stone: { base: '#6c6f80', light: '#b4b8c8', dark: '#3a3c48', edge: '#16171c' },
    brick: { base: '#a83c34', light: '#f08070', dark: '#5e1c18', edge: '#240a08', mortar: '#d8b8a0' },
    mud: { base: '#5a3a24', light: '#a07850', dark: '#2c1c10', edge: '#140c06' },
  }),
};

// Direction C: "Clay". Soft matte toy blocks with big rounded corners and soft occlusion,
// in a pastel diorama. Calm and premium, lower energy.
export const CLAY = {
  id: 'clay',
  name: 'Clay',
  mode: 'clay',
  texels: 8,
  radius: 0.24,
  gloss: 0.1,
  bevel: 1,
  shadow: 0.25,
  wall: { top: hex('#5f8f8a'), bottom: hex('#3f6b69'), grid: 'rgba(255,255,255,0.07)', rim: 'rgba(255,255,255,0.4)' },
  mats: pal({
    fire: { base: '#ff8a5c', light: '#ffd29a', dark: '#d9573a', edge: '#a8402a', glow: '#ffb27a' },
    water: { base: '#5aa8f0', light: '#cfe9ff', dark: '#3a7fcc', edge: '#2a5f9c' },
    wood: { base: '#d9a066', light: '#f2c99a', dark: '#b07a44', edge: '#8a5a30' },
    wetwood: { base: '#8a7a6c', light: '#b4a698', dark: '#665a4e', edge: '#4c4238', drop: '#cfe9ff' },
    ice: { base: '#bfeaf5', light: '#f4fdff', dark: '#8fcfe0', edge: '#6aaec0' },
    sand: { base: '#f6dc9c', light: '#fff2cc', dark: '#d9b86a', edge: '#b0904a' },
    glass: { base: '#e6fbff', light: '#ffffff', dark: '#a8dde8', edge: '#ffffff' },
    stone: { base: '#a9adb8', light: '#d6d9e0', dark: '#82868f', edge: '#62656d' },
    brick: { base: '#e07a62', light: '#f6ad98', dark: '#b85640', edge: '#8c3e2c', mortar: '#f6e6d2' },
    mud: { base: '#8c6446', light: '#bc9472', dark: '#664630', edge: '#4c3222' },
  }),
};

export const SKINS = { toybox: TOYBOX, arcana: ARCANA, clay: CLAY };

export const MATERIALS = ['fire', 'water', 'wood', 'wetwood', 'ice', 'sand', 'glass', 'stone', 'brick', 'mud'];
export const LOOSE = new Set(['water', 'sand', 'mud']);
export const RIGID = new Set(['stone', 'ice', 'glass', 'brick', 'wood', 'wetwood', 'fire']);
