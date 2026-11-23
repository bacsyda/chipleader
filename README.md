# Chip Poker

Web app nhỏ giúp nhóm bạn quản lý chip và sổ nợ khi chơi bài ngoài đời. App không có bài và không có luật chơi, chỉ ghi chép.

Có hai loại phòng:

- **Poker**: mỗi người một chồng chip, tố, lấy pot, hoàn tác, lịch sử.
- **Phỏm**: sổ ghi nợ giữa các người chơi, xem lãi/âm của mình và của từng người, có lịch sử giao dịch.

Vào phòng bằng mã 5 số hoặc bấm chọn từ danh sách phòng ở màn hình chính.

## Chạy trên máy

Cần Node.js 20 trở lên.

```bash
npm install
npm run build      # build giao diện
npm start          # mở http://localhost:3000
```

Chạy chế độ phát triển: `npm run dev` (server) và `npm run dev` trong thư mục `client/` (giao diện).

Chạy test: `npm test`.

## Triển khai

Chạy được trên bất kỳ dịch vụ nào cho chạy Node.js liên tục (ví dụ Render):

- Build: `npm install && npm run build`
- Start: `npm start`

Phòng lưu trong bộ nhớ của server nên sẽ mất khi server khởi động lại hoặc ngủ.
Nếu đặt giao diện và server ở hai nơi khác nhau, dùng biến môi trường `CLIENT_ORIGIN` (ở server) và `VITE_SERVER_URL` (lúc build giao diện).

## Công nghệ

Node.js, Socket.IO, React, Vite.
