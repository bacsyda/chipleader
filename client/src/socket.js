import { io } from 'socket.io-client';

export const socket = io();
export const call = (event, data = {}) => new Promise((resolve) => socket.emit(event, data, resolve));

export const ERR = {
  room_not_found: 'Không tìm thấy phòng này',
  room_full: 'Phòng đã đủ người',
  name_taken: 'Tên này đã có người dùng trong phòng',
  bad_name: 'Tên cần từ 1 đến 8 ký tự',
  bad_token: 'Không nối lại được phòng cũ',
  not_in_room: 'Bạn chưa ở trong phòng',
  not_member: 'Bạn không còn trong phòng',
  bad_amount: 'Số không hợp lệ',
  pot_not_empty: 'Chỉ nạp chip khi pot trống (hết ván)',
  bad_blinds: 'Big blind phải lớn hơn hoặc bằng small blind',
  blind_posted: 'Blind này đã có người đặt rồi',
  over_cap: 'Mỗi lần nạp tối đa 1.000.000 chip',
  insufficient_chips: 'Bạn không đủ chip',
  over_max: 'Vượt mức bạn được lấy',
  pot_changed: 'Pot vừa thay đổi, hãy mở lại bảng lấy chip',
  not_host: 'Chỉ chủ phòng được hoàn tác',
  tx_not_found: 'Không tìm thấy giao dịch',
  already_undone: 'Giao dịch này đã được hoàn tác',
  undo_blocked: 'Không hoàn tác được vì sẽ làm ai đó âm chip',
  wrong_type: 'Thao tác này không dùng được ở loại phòng này',
  bad_type: 'Loại phòng không hợp lệ',
  bad_target: 'Không gửi được cho người này',
  server_error: 'Máy chủ gặp lỗi, thử lại sau',
};
