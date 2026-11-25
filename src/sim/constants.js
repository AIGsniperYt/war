export const TEAM_RED = 0;
export const TEAM_BLUE = 1;

export const FIXED_DT = 1 / 60;
export const MAX_FRAME_DT = 0.1;
export const MAX_STEPS_PER_FRAME = 6;

export const SOLDIER_RADIUS = 6;
export const SOLDIER_DIAMETER = SOLDIER_RADIUS * 2;
export const SOLDIER_DIAMETER_SQ = SOLDIER_DIAMETER * SOLDIER_DIAMETER;

export const DEFAULT_SPEED = 42;
export const DEFAULT_ACCEL = 120;
export const DEFAULT_TURN_SPEED = Math.PI * 1.8;
export const DEFAULT_HP = 100;
export const DEFAULT_STAMINA = 100;
export const DEFAULT_STAMINA_REGEN = 12;
export const DEFAULT_REACTION_INTERVAL = 0.22;
export const DEFAULT_PERCEPTION_RANGE = 180;
export const DEFAULT_FOV = Math.PI * 1.35;
export const DEFAULT_AGGRESSION = 0.5;

export const SPATIAL_CELL_SIZE = 36;
export const MAX_SOLDIERS = 6000;

export const PHASE_DEPLOYMENT = 'deployment';
export const PHASE_RUNNING = 'running';
export const PHASE_ENDED = 'ended';

export const ACTION_PHASE_IDLE = 0;
export const ACTION_PHASE_WINDUP = 1;
export const ACTION_PHASE_ACTIVE = 2;
export const ACTION_PHASE_RECOVERY = 3;

export const ACTION_NONE = 0;
export const ACTION_STRIKE = 1;
export const ACTION_BLOCK = 2;
export const ACTION_BARGE = 3;
export const ACTION_KICK = 4;
