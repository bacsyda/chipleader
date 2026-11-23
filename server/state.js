import { publicState } from './logic.js';
import { phomState } from './phom.js';

/** Trạng thái gửi cho client, rẽ nhánh theo loại phòng. */
export const stateOf = (room) => (room.type === 'phom' ? phomState(room) : { ...publicState(room), type: 'poker' });
