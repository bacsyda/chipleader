# Poker Chip – server

Quản lý chip và pot cho nhóm bạn chơi poker ngoài đời. Không có bài, không có luật poker.
Có hai loại phòng: **Poker** (chip, pot, blind) và **Phỏm** (sổ ghi nợ giữa các người chơi).


## Cấu trúc
- `client/`: giao diện React + Vite. `npm run dev` trong `client/` (kèm `npm start` ở thư mục gốc) để chạy dev.
- `server/logic.js`: luật chơi thuần túy. Log là nguồn sự thật, chip/pot/bảng cược tính lại từ log.
- `server/rooms.js`: tạo/vào/rejoin/rời phòng, chuyển quyền chủ phòng, dọn phòng bỏ trống, `list()` cho màn hình chính.
- `server/phom.js`: phòng Phỏm (sổ nợ `debts`, `sendDebt`). `server/state.js`: chọn trạng thái gửi client theo `room.type`.
- `shared/debts.js`: `owed` (số ở hàng một người) và `net` (tổng lãi/âm của mình), dùng chung server, client, test.
- `server/index.js`: HTTP (phục vụ `client/dist` khi có) và Socket.IO.
- `shared/chips.js`: mệnh giá chip, chia chip khi nạp, `transfer` (chuyển đúng chip thật giữa hai đống, đổi tiền lẻ khi cần).
- `shared/betting.js`: tính Call / Raise từ tổng cược (dùng chung server, client, test).
- `shared/history.js`: cỡ cửa sổ lịch sử và `mergeRows` (ghép bản tải thêm với cửa sổ mới nhất).
- `client/src/anim.js`, `geometry.js`, `useChipAnim.js`: hoạt ảnh chip bay (phần thuần có test, phần DOM/React).
- `test/`: test bằng `node --test`, không cần cài thêm gì.

## Sự kiện (client → server, có ack `{ok, error?}`)
| Sự kiện | Dữ liệu |
|---|---|
| `rooms:list` | → ack `{ok, rooms: [{id, type, host, count, max, full, blinds?}]}`, chỉ đọc, không cần đã vào phòng |
| `room:create` | `{name, type: 'poker' \| 'phom', smallBlind, bigBlind}` → `{roomId, playerId, token}` (mã phòng 5 chữ số; Phỏm không cần blind) |
| `debt:send` | `{toId, amount}` (chỉ phòng Phỏm; ghi nợ thêm `amount` nguyên dương ≤ 1.000.000 cho người đó) |
| `room:join` | `{roomId, name}` → như trên (vào bằng mã hoặc bấm phòng trong danh sách, không cần chọn loại) |
| `room:rejoin` | `{roomId, token}` |
| `room:leave` | |
| `chips:add` | `{amount}` (chỉ cộng cho chính mình, và chỉ khi pot = 0) |
| `bet:place` | `{amount}` hoặc `{blind: 'small' \| 'big'}` (số chip do phòng quy định) |
| `pot:take` | `{amount \| 'all', version}` |
| `log:tail` | `{count}` → ack `{ok, total, entries}`: `count` giao dịch cuối (tối đa 1000), chỉ đọc |
| `tx:undo` | `{txId}` (chỉ chủ phòng) |

Server phát `room:state` mỗi khi có thay đổi, và `room:error {code}` khi bị từ chối.
`room:state` chứa toàn bộ trạng thái (pot, chip, người chơi) nhưng `log` chỉ có 50 giao dịch cuối, kèm `logTotal` là tổng số, nên payload không tăng theo độ dài ván (chip, pot vẫn tính trên toàn bộ log).
Màn Lịch sử có nút "Xem thêm" gọi `log:tail`. Client xác định giao dịch mới theo `id` (không theo độ dài log).
Bản ghi `undo` kèm `ref` (loại, tên, blind, số chip của giao dịch bị hoàn tác) vì giao dịch đó có thể nằm ngoài cửa sổ.
`canUndo` (nút Hoàn tác) chỉ tính cho 20 giao dịch cuối; server vẫn kiểm tra đầy đủ khi nhận `tx:undo`.
Mã lỗi: `room_not_found, room_full, name_taken, bad_name, bad_token, not_in_room, not_member, bad_amount, over_cap,
pot_not_empty, bad_blinds, wrong_type, bad_type, bad_target, blind_posted, insufficient_chips, over_max, pot_changed, not_host, tx_not_found, already_undone, undo_blocked, server_error` (lỗi không lường trước ở server).

## Triển khai Render (free)
Web Service, Build `npm install && npm run build`, Start `npm start` (build tạo `client/dist`, server tự phục vụ). Phòng nằm trong bộ nhớ nên mất khi server ngủ hoặc deploy lại.

## Âm thanh
`client/src/sound.js` tạo âm thanh bằng Web Audio (tố, lấy pot, nạp chip, bấm nút, hoàn tác, lỗi), không có file âm thanh. Mở khóa ở lần chạm đầu tiên; nút loa ở thanh trên bàn bật/tắt và được nhớ lại.

## Chip vật lý
Mỗi người có một chồng chip thật (`chipMap`) và pot có một đống (`potChips`), đều tính lại từ log. Nạp chip chia thành nhiều mệnh giá.
Tố chuyển ĐÚNG những chip đó từ chồng người tố sang pot (tố 30 từ chồng có chip 10 thì đi 3 chip 10); thiếu chip nhỏ thì đổi tiền lẻ.
Lấy pot chuyển chip từ pot về chồng người lấy. Mỗi giao dịch trong `log` kèm `chips` = chip đã đi, để client vẽ:
từng chip bay từ đỉnh chồng nguồn đến đỉnh chồng đích, chạm đích mới cộng vào chồng.

## Call / Raise
Call = tổng cược cao nhất trừ tổng cược của mình (A tố 20, B tố 30 thì A call 10). Raise ×N = nâng tổng cược của mình lên N lần mức cao nhất.

## Phòng Phỏm
Ghi nợ giữa các người chơi, không có hoàn tác và lịch sử. Server lưu `room.debts[A][B]` = tổng A đã Gửi cho B.
Số ở hàng B trên máy A = A đã gửi B − B đã gửi A: dương là A nợ B, âm là B nợ A. Ô trên cùng là tổng của mình (lãi nếu dương, âm nếu âm).
Trả nợ = người kia Gửi ngược lại. Mỗi lần Gửi có popup xác nhận. Người rời phòng thì các khoản nợ của họ bị xóa.
Trạng thái phòng Phỏm gửi chung cho mọi người trong phòng (không riêng từng người).

## Màn hình chính
Có danh sách phòng đang có trên server (làm mới mỗi 4 giây); bấm vào phòng để vào luôn, không cần nhập mã, nhưng vẫn cần nhập tên.
