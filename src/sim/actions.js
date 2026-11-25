import {
  ACTION_BARGE, ACTION_BLOCK, ACTION_KICK, ACTION_STRIKE,
  DEFAULT_ACCEL, DEFAULT_AGGRESSION, DEFAULT_FOV, DEFAULT_HP, DEFAULT_PERCEPTION_RANGE,
  DEFAULT_REACTION_INTERVAL, DEFAULT_SPEED, DEFAULT_STAMINA, DEFAULT_STAMINA_REGEN, DEFAULT_TURN_SPEED
} from './constants.js';

export const STRIKE = {
  id: ACTION_STRIKE,
  name: 'Strike',
  reach: 14,
  arc: Math.PI * 0.55,
  windup: 0.18,
  active: 0.08,
  recovery: 0.32,
  damage: 18,
  displacement: 8,
  attackerAdvance: 0.15,
  staminaCost: 8,
  defensive: false,
};

export const BLOCK = {
  id: ACTION_BLOCK,
  name: 'Block',
  reach: 10,
  arc: Math.PI * 0.9,
  windup: 0.06,
  active: 0.28,
  recovery: 0.18,
  damage: 0,
  displacement: 0,
  attackerAdvance: 0,
  staminaCost: 6,
  defensive: true,
};

export const BARGE = {
  id: ACTION_BARGE,
  name: 'Barge',
  reach: 13,
  arc: Math.PI * 0.6,
  windup: 0.2,
  active: 0.12,
  recovery: 0.38,
  damage: 5,
  displacement: 34,
  attackerAdvance: 0.85,
  staminaCost: 14,
  defensive: false,
};

export const KICK = {
  id: ACTION_KICK,
  name: 'Kick',
  reach: 13,
  arc: Math.PI * 0.55,
  windup: 0.22,
  active: 0.1,
  recovery: 0.4,
  damage: 8,
  displacement: 30,
  attackerAdvance: 0.05,
  staminaCost: 12,
  defensive: false,
};

export const DEFAULT_CONFIG = {
  name: 'Infantry',
  speed: DEFAULT_SPEED,
  accel: DEFAULT_ACCEL,
  turnSpeed: DEFAULT_TURN_SPEED,
  hp: DEFAULT_HP,
  stamina: DEFAULT_STAMINA,
  staminaRegen: DEFAULT_STAMINA_REGEN,
  reactionInterval: DEFAULT_REACTION_INTERVAL,
  perceptionRange: DEFAULT_PERCEPTION_RANGE,
  fov: DEFAULT_FOV,
  aggression: DEFAULT_AGGRESSION,
  actions: [STRIKE, BLOCK, BARGE, KICK],
};

export function getAction(config, id) {
  for (let i = 0; i < config.actions.length; i++) {
    if (config.actions[i].id === id) return config.actions[i];
  }
  return null;
}
