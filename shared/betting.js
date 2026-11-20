// Tính số chip phải thêm khi Call / Raise. Dùng chung cho client và test.
// `players` là publicState().players, mỗi người có { id, totalBet } (tổng đã tố trong ván).

/** Tổng cược cao nhất hiện tại. */
export const highestBet = (players) => Math.max(0, ...players.map((p) => p.totalBet ?? 0));

const bet = (players, id) => players.find((p) => p.id === id)?.totalBet ?? 0;

/** Call: bù phần còn thiếu để bằng người tố cao nhất. Ví dụ A đã tố 20, B tố 30 thì A call 10. */
export const toCall = (players, id) => Math.max(0, highestBet(players) - bet(players, id));

/** Raise ×N: nâng tổng cược của mình lên N lần mức cao nhất. Trả về số chip phải thêm. */
export const raiseAmount = (players, id, times) => Math.max(0, highestBet(players) * times - bet(players, id));
