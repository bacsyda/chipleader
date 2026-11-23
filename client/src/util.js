export const fmt = (n) => n.toLocaleString('vi-VN');

const COLORS = ['#F2A65A', '#6FA8E0', '#EA8573', '#B79BE0', '#7FD8B4', '#E6D36F', '#E58FB4', '#8FC9E8'];
export const colorOf = (room, id) => COLORS[Math.max(0, room.players.findIndex((p) => p.id === id)) % COLORS.length];

// Nhãn nhỏ trên bàn: từ một triệu trở lên viết gọn (1,24M) để không tràn.
export const short = (n) => (n >= 1e6 ? `${(n / 1e6).toLocaleString('vi-VN', { maximumFractionDigits: 2 })}M` : fmt(n));
