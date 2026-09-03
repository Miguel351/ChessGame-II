// ==================== Sabitler ====================
const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
const PIECE_UNICODE = {
  w: { k: '♔', q: '♕', r: '♖', b: '♗', n: '♘', p: '♙' },
  b: { k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟' },
};
const ROOK_DIRS = [[-1, 0], [1, 0], [0, -1], [0, 1]];
const BISHOP_DIRS = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
const QUEEN_DIRS = ROOK_DIRS.concat(BISHOP_DIRS); // aynı deltalar kral için de kullanılır
const KNIGHT_DELTAS = [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]];

function inBounds(r, c) { return r >= 0 && r < 8 && c >= 0 && c < 8; }
function opp(color) { return color === 'w' ? 'b' : 'w'; }
function squareName(r, c) { return FILES[c] + (8 - r); }

// PNG'ler pieces/<renk><tip>.png olarak aranır (örn. pieces/wn.png); bulunamazsa unicode sembole düşer.
const PIECE_IMG_DIR = 'pieces';
function pieceImgSrc(color, type) { return `${PIECE_IMG_DIR}/${color}${type}.png`; }
function createPieceElement(color, type) {
  const wrapper = document.createElement('span');
  wrapper.className = 'piece piece-' + color;
  const img = document.createElement('img');
  img.src = pieceImgSrc(color, type);
  img.alt = color + type;
  img.draggable = false;
  img.className = 'piece-img piece-img-' + type;
  img.onerror = () => {
    img.remove();
    wrapper.textContent = PIECE_UNICODE[color][type];
  };
  wrapper.appendChild(img);
  return wrapper;
}

// ==================== Tahta yardımcıları ====================
function createInitialBoard() {
  const back = ['r', 'n', 'b', 'q', 'k', 'b', 'n', 'r'];
  const board = Array.from({ length: 8 }, () => Array(8).fill(null));
  for (let c = 0; c < 8; c++) {
    board[0][c] = { color: 'b', type: back[c] };
    board[1][c] = { color: 'b', type: 'p' };
    board[6][c] = { color: 'w', type: 'p' };
    board[7][c] = { color: 'w', type: back[c] };
  }
  return board;
}

function cloneBoard(board) {
  return board.map(row => row.map(p => (p ? { ...p } : null)));
}

function findKing(board, color) {
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const p = board[r][c];
      if (p && p.color === color && p.type === 'k') return { r, c };
    }
  }
  return null;
}

// Bir taşın (işgal durumundan bağımsız) "kontrol ettiği" kareler: saldırı/savunma deseni.
function pieceControls(board, r, c) {
  const piece = board[r][c];
  if (!piece) return [];
  const squares = [];

  const slide = (dirs) => {
    for (const [dr, dc] of dirs) {
      let nr = r + dr, nc = c + dc;
      while (inBounds(nr, nc)) {
        squares.push({ r: nr, c: nc });
        if (board[nr][nc]) break; // taş burada duruyor ama kareyi yine de kontrol ediyor
        nr += dr; nc += dc;
      }
    }
  };

  switch (piece.type) {
    case 'p': {
      const dir = piece.color === 'w' ? -1 : 1;
      for (const dc of [-1, 1]) {
        const nr = r + dir, nc = c + dc;
        if (inBounds(nr, nc)) squares.push({ r: nr, c: nc });
      }
      break;
    }
    case 'n':
      for (const [dr, dc] of KNIGHT_DELTAS) {
        const nr = r + dr, nc = c + dc;
        if (inBounds(nr, nc)) squares.push({ r: nr, c: nc });
      }
      break;
    case 'b': slide(BISHOP_DIRS); break;
    case 'r': slide(ROOK_DIRS); break;
    case 'q': slide(QUEEN_DIRS); break;
    case 'k':
      for (const [dr, dc] of QUEEN_DIRS) {
        const nr = r + dr, nc = c + dc;
        if (inBounds(nr, nc)) squares.push({ r: nr, c: nc });
      }
      break;
  }
  return squares;
}

function isSquareAttackedBy(board, r, c, byColor) {
  for (let rr = 0; rr < 8; rr++) {
    for (let cc = 0; cc < 8; cc++) {
      const p = board[rr][cc];
      if (p && p.color === byColor) {
        const squares = pieceControls(board, rr, cc);
        if (squares.some(s => s.r === r && s.c === c)) return true;
      }
    }
  }
  return false;
}

function computeControlMap(board) {
  const map = Array.from({ length: 8 }, () => Array.from({ length: 8 }, () => ({ w: 0, b: 0 })));
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const p = board[r][c];
      if (!p) continue;
      for (const s of pieceControls(board, r, c)) {
        map[s.r][s.c][p.color]++;
      }
    }
  }
  return map;
}

// ==================== Hamle üretimi ====================
function applyMoveToBoard(board, move) {
  const newBoard = cloneBoard(board);
  const piece = newBoard[move.from.r][move.from.c];
  newBoard[move.from.r][move.from.c] = null;

  if (move.isEnPassant) {
    newBoard[move.from.r][move.to.c] = null;
  }

  newBoard[move.to.r][move.to.c] = move.promotion
    ? { color: piece.color, type: move.promotion }
    : piece;

  if (move.castle) {
    const row = move.from.r;
    if (move.castle === 'K') {
      newBoard[row][5] = newBoard[row][7];
      newBoard[row][7] = null;
    } else {
      newBoard[row][3] = newBoard[row][0];
      newBoard[row][0] = null;
    }
  }
  return newBoard;
}

function generatePseudoLegalMoves(state, r, c) {
  const board = state.board;
  const piece = board[r][c];
  if (!piece) return [];
  const color = piece.color;
  const moves = [];

  const pushPawnMove = (to, extra) => {
    const promoRow = color === 'w' ? 0 : 7;
    if (to.r === promoRow) {
      for (const promo of ['q', 'r', 'b', 'n']) {
        moves.push({ from: { r, c }, to, promotion: promo, ...extra });
      }
    } else {
      moves.push({ from: { r, c }, to, ...extra });
    }
  };

  if (piece.type === 'p') {
    const dir = color === 'w' ? -1 : 1;
    const startRow = color === 'w' ? 6 : 1;
    const oneR = r + dir;
    if (inBounds(oneR, c) && !board[oneR][c]) {
      pushPawnMove({ r: oneR, c });
      const twoR = r + 2 * dir;
      if (r === startRow && !board[twoR][c]) {
        moves.push({ from: { r, c }, to: { r: twoR, c }, isDoublePawn: true });
      }
    }
    for (const dc of [-1, 1]) {
      const nr = r + dir, nc = c + dc;
      if (!inBounds(nr, nc)) continue;
      const target = board[nr][nc];
      if (target && target.color !== color) {
        pushPawnMove({ r: nr, c: nc });
      } else if (!target && state.enPassant && state.enPassant.r === nr && state.enPassant.c === nc) {
        moves.push({ from: { r, c }, to: { r: nr, c: nc }, isEnPassant: true });
      }
    }
  } else if (piece.type === 'n') {
    for (const [dr, dc] of KNIGHT_DELTAS) {
      const nr = r + dr, nc = c + dc;
      if (!inBounds(nr, nc)) continue;
      const target = board[nr][nc];
      if (!target || target.color !== color) moves.push({ from: { r, c }, to: { r: nr, c: nc } });
    }
  } else if (piece.type === 'k') {
    for (const [dr, dc] of QUEEN_DIRS) {
      const nr = r + dr, nc = c + dc;
      if (!inBounds(nr, nc)) continue;
      const target = board[nr][nc];
      if (!target || target.color !== color) moves.push({ from: { r, c }, to: { r: nr, c: nc } });
    }
    const rights = state.castling[color];
    const row = color === 'w' ? 7 : 0;
    const enemy = opp(color);
    if (r === row && c === 4) {
      if (rights.K && !board[row][5] && !board[row][6] &&
          board[row][7] && board[row][7].type === 'r' && board[row][7].color === color &&
          !isSquareAttackedBy(board, row, 4, enemy) &&
          !isSquareAttackedBy(board, row, 5, enemy) &&
          !isSquareAttackedBy(board, row, 6, enemy)) {
        moves.push({ from: { r, c }, to: { r: row, c: 6 }, castle: 'K' });
      }
      if (rights.Q && !board[row][1] && !board[row][2] && !board[row][3] &&
          board[row][0] && board[row][0].type === 'r' && board[row][0].color === color &&
          !isSquareAttackedBy(board, row, 4, enemy) &&
          !isSquareAttackedBy(board, row, 3, enemy) &&
          !isSquareAttackedBy(board, row, 2, enemy)) {
        moves.push({ from: { r, c }, to: { r: row, c: 2 }, castle: 'Q' });
      }
    }
  } else {
    const dirs = piece.type === 'b' ? BISHOP_DIRS : piece.type === 'r' ? ROOK_DIRS : QUEEN_DIRS;
    for (const [dr, dc] of dirs) {
      let nr = r + dr, nc = c + dc;
      while (inBounds(nr, nc)) {
        const target = board[nr][nc];
        if (!target) {
          moves.push({ from: { r, c }, to: { r: nr, c: nc } });
        } else {
          if (target.color !== color) moves.push({ from: { r, c }, to: { r: nr, c: nc } });
          break;
        }
        nr += dr; nc += dc;
      }
    }
  }
  return moves;
}

function generateAllLegalMoves(state, color) {
  const legal = [];
  const board = state.board;
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const p = board[r][c];
      if (!p || p.color !== color) continue;
      const pseudo = generatePseudoLegalMoves(state, r, c);
      for (const move of pseudo) {
        const testBoard = applyMoveToBoard(board, move);
        const kingPos = findKing(testBoard, color);
        if (!isSquareAttackedBy(testBoard, kingPos.r, kingPos.c, opp(color))) {
          legal.push(move);
        }
      }
    }
  }
  return legal;
}

function isInCheck(state, color) {
  const kingPos = findKing(state.board, color);
  if (!kingPos) return false;
  return isSquareAttackedBy(state.board, kingPos.r, kingPos.c, opp(color));
}

// Standart satranç notasyonu (SAN): sadece hedef kare + gerektiğinde belirsizlik giderme (dosya/sıra).
function moveNotation(state, move, piece, captured) {
  if (move.castle === 'K') return 'O-O';
  if (move.castle === 'Q') return 'O-O-O';
  const letters = { p: '', n: 'N', b: 'B', r: 'R', q: 'Q', k: 'K' };
  const toSq = squareName(move.to.r, move.to.c);
  const isCapture = !!captured || move.isEnPassant;
  let s = '';

  if (piece.type === 'p') {
    if (isCapture) s += FILES[move.from.c];
  } else {
    s += letters[piece.type];
    const others = (state.allLegalMoves || []).filter(m => {
      if (m.from.r === move.from.r && m.from.c === move.from.c) return false;
      if (m.to.r !== move.to.r || m.to.c !== move.to.c) return false;
      const p2 = state.board[m.from.r][m.from.c];
      return p2 && p2.type === piece.type && p2.color === piece.color;
    });
    if (others.length > 0) {
      const sameFile = others.some(m => m.from.c === move.from.c);
      const sameRank = others.some(m => m.from.r === move.from.r);
      if (!sameFile) s += FILES[move.from.c];
      else if (!sameRank) s += (8 - move.from.r);
      else s += squareName(move.from.r, move.from.c);
    }
  }

  if (isCapture) s += 'x';
  s += toSq;
  if (move.promotion) s += '=' + { q: 'Q', r: 'R', b: 'B', n: 'N' }[move.promotion];
  return s;
}

function makeMove(state, move) {
  const board = state.board;
  const piece = board[move.from.r][move.from.c];
  const captured = move.isEnPassant ? board[move.from.r][move.to.c] : board[move.to.r][move.to.c];

  if (piece.type === 'k') {
    state.castling[piece.color].K = false;
    state.castling[piece.color].Q = false;
  }
  if (piece.type === 'r') {
    const homeRow = piece.color === 'w' ? 7 : 0;
    if (move.from.r === homeRow && move.from.c === 0) state.castling[piece.color].Q = false;
    if (move.from.r === homeRow && move.from.c === 7) state.castling[piece.color].K = false;
  }
  if (captured && captured.type === 'r') {
    const homeRow = captured.color === 'w' ? 7 : 0;
    if (move.to.r === homeRow && move.to.c === 0) state.castling[captured.color].Q = false;
    if (move.to.r === homeRow && move.to.c === 7) state.castling[captured.color].K = false;
  }

  const notation = moveNotation(state, move, piece, captured);
  state.board = applyMoveToBoard(board, move);
  state.enPassant = move.isDoublePawn ? { r: (move.from.r + move.to.r) / 2, c: move.from.c } : null;

  if (captured) {
    if (captured.color === 'w') state.capturedWhite.push(captured.type);
    else state.capturedBlack.push(captured.type);
  }

  state.turn = opp(state.turn);
  if (state.turn === 'w') state.fullmoveNumber++;

  state.history.push({ notation, color: piece.color });
}

// ==================== Oyun durumu ====================
let game = null;

function newGame() {
  game = {
    board: createInitialBoard(),
    turn: 'w',
    castling: { w: { K: true, Q: true }, b: { K: true, Q: true } },
    enPassant: null,
    fullmoveNumber: 1,
    history: [],
    capturedWhite: [],
    capturedBlack: [],
    selected: null,
    legalMoves: [],
    controlledSquares: [],
    status: 'playing',
  };
  refreshLegalMoves();
  render();
}

function refreshLegalMoves() {
  game.allLegalMoves = generateAllLegalMoves(game, game.turn);
  if (game.allLegalMoves.length === 0) {
    game.status = isInCheck(game, game.turn) ? 'checkmate' : 'stalemate';
  } else {
    game.status = isInCheck(game, game.turn) ? 'check' : 'playing';
  }
}

function clearSelection() {
  game.selected = null;
  game.legalMoves = [];
  game.controlledSquares = [];
}

function selectSquare(r, c) {
  game.selected = { r, c };
  game.legalMoves = game.allLegalMoves.filter(m => m.from.r === r && m.from.c === c);
  game.controlledSquares = pieceControls(game.board, r, c);
}

function finalizeMove(move) {
  const piece = game.board[move.from.r][move.from.c];
  makeMove(game, move);
  clearSelection();
  refreshLegalMoves();
  if (game.status === 'checkmate' || game.status === 'check') {
    const last = game.history[game.history.length - 1];
    last.notation += game.status === 'checkmate' ? '#' : '+';
  }
  render();
}

function onSquareClick(r, c) {
  if (game.status === 'checkmate' || game.status === 'stalemate') return;
  const piece = game.board[r][c];

  if (game.selected) {
    const matches = game.legalMoves.filter(m => m.to.r === r && m.to.c === c);
    if (matches.length > 0) {
      if (matches.length > 1) {
        showPromotionModal(matches, finalizeMove);
      } else {
        finalizeMove(matches[0]);
      }
      return;
    }
    if (piece && piece.color === game.turn) {
      selectSquare(r, c);
      render();
      return;
    }
    clearSelection();
    render();
    return;
  }

  if (piece && piece.color === game.turn) {
    selectSquare(r, c);
    render();
  }
}

// ==================== Terfi modalı ====================
const promoModal = document.getElementById('promoModal');
const promoChoices = document.getElementById('promoChoices');

function showPromotionModal(matches, onChoose) {
  promoChoices.innerHTML = '';
  const order = ['q', 'r', 'b', 'n'];
  const color = game.board[matches[0].from.r][matches[0].from.c].color;
  for (const type of order) {
    const move = matches.find(m => m.promotion === type);
    if (!move) continue;
    const btn = document.createElement('button');
    btn.appendChild(createPieceElement(color, type));
    btn.addEventListener('click', () => {
      promoModal.classList.add('hidden');
      onChoose(move);
    });
    promoChoices.appendChild(btn);
  }
  promoModal.classList.remove('hidden');
}

// ==================== Render ====================
const boardEl = document.getElementById('board');
const statusEl = document.getElementById('status');
const moveListEl = document.getElementById('moveList');
const capturedByWhiteEl = document.getElementById('capturedByWhite');
const capturedByBlackEl = document.getElementById('capturedByBlack');
const controlMapToggle = document.getElementById('controlMapToggle');
const showControlWhiteToggle = document.getElementById('showControlWhite');
const showControlBlackToggle = document.getElementById('showControlBlack');
const showControlBothToggle = document.getElementById('showControlBoth');

function render() {
  boardEl.innerHTML = '';
  const showControlMap = controlMapToggle.checked;
  const controlMap = showControlMap ? computeControlMap(game.board) : null;
  const kingInCheckPos = (game.status === 'check' || game.status === 'checkmate')
    ? findKing(game.board, game.turn) : null;

  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const sq = document.createElement('div');
      sq.className = 'square ' + ((r + c) % 2 === 0 ? 'light' : 'dark');

      if (game.selected && game.selected.r === r && game.selected.c === c) {
        sq.classList.add('selected');
      }
      if (game.controlledSquares.some(s => s.r === r && s.c === c)) {
        sq.classList.add('controlled');
      }
      if (kingInCheckPos && kingInCheckPos.r === r && kingInCheckPos.c === c) {
        sq.classList.add('check');
      }
      const legalMatch = game.legalMoves.find(m => m.to.r === r && m.to.c === c);
      if (legalMatch) {
        const isCapture = !!game.board[r][c] || legalMatch.isEnPassant;
        sq.classList.add(isCapture ? 'legal-capture' : 'legal-move');
      }
      if (showControlMap) {
        const cnt = controlMap[r][c];
        const isBoth = cnt.w > 0 && cnt.b > 0;
        const isWhiteOnly = cnt.w > 0 && cnt.b === 0;
        const isBlackOnly = cnt.b > 0 && cnt.w === 0;
        let colorClass = null;
        if (isBoth && showControlBothToggle.checked) { colorClass = 'control-both'; }
        else if (isWhiteOnly && showControlWhiteToggle.checked) { colorClass = 'control-white'; }
        else if (isBlackOnly && showControlBlackToggle.checked) { colorClass = 'control-black'; }
        if (colorClass) {
          const colorBadge = document.createElement('span');
          colorBadge.className = 'control-badge ' + colorClass;
          sq.appendChild(colorBadge);
          const badge = document.createElement('span');
          badge.className = 'control-count';
          badge.textContent = `${cnt.w}/${cnt.b}`;
          sq.appendChild(badge);
        }
      }

      const piece = game.board[r][c];
      if (piece) {
        sq.appendChild(createPieceElement(piece.color, piece.type));
      }

      sq.addEventListener('click', () => onSquareClick(r, c));
      boardEl.appendChild(sq);
    }
  }

  renderStatus();
  renderMoveList();
  renderCaptured();
}

function renderStatus() {
  const turnName = game.turn === 'w' ? 'Beyaz' : 'Siyah';
  let text;
  switch (game.status) {
    case 'checkmate': text = `Mat! ${turnName === 'Beyaz' ? 'Siyah' : 'Beyaz'} kazandı.`; break;
    case 'stalemate': text = 'Pat! Oyun berabere.'; break;
    case 'check': text = `Şah! Sıra ${turnName}'da.`; break;
    default: text = `Sıra ${turnName}'da.`;
  }
  statusEl.textContent = text;
}

function renderMoveList() {
  moveListEl.innerHTML = '';
  for (let i = 0; i < game.history.length; i += 2) {
    const li = document.createElement('li');
    const num = i / 2 + 1;
    const whiteMove = game.history[i] ? game.history[i].notation : '';
    const blackMove = game.history[i + 1] ? game.history[i + 1].notation : '';
    li.textContent = `${num}. ${whiteMove}  ${blackMove}`;
    moveListEl.appendChild(li);
  }
  moveListEl.scrollTop = moveListEl.scrollHeight;
}

function renderCaptured() {
  capturedByWhiteEl.textContent = game.capturedBlack.map(t => PIECE_UNICODE.b[t]).join(' ');
  capturedByBlackEl.textContent = game.capturedWhite.map(t => PIECE_UNICODE.w[t]).join(' ');
}

// ==================== Başlat ====================
document.getElementById('resetBtn').addEventListener('click', newGame);
controlMapToggle.addEventListener('change', render);
showControlWhiteToggle.addEventListener('change', render);
showControlBlackToggle.addEventListener('change', render);
showControlBothToggle.addEventListener('change', render);
newGame();
