
////////////////////////////////////////////////////////
//
//  Zara
//
// An open-source browser-based remake of
// the strategy game "Zarathustra":
// http://members.aol.com/deadmanx/zarathustra.html
//
////////////////////////////////////////////////////////

"use strict";

var SIZE_X    = 800;
var SIZE_Y    = 480;
var TILE_SIZE = 64;

var BOARD_X = 5;
var BOARD_Y = 5;

var backColor     = '#FFFFFF';
var tileColor     = '#EEEEEE';
var tileHighlight = '#FFAA00';
var tileOutline   = '#000000';
var blockColor    = '#CCCCCC';

var DIR_N = 0;
var DIR_E = 1;
var DIR_S = 2;
var DIR_W = 3;
var dirs     = [DIR_N, DIR_E, DIR_S, DIR_W];
var opposite = [DIR_S, DIR_W, DIR_N, DIR_E];

var around = [[-1,-1], [ 0,-1], [ 1,-1],
              [-1, 0],          [ 1, 0],
              [-1, 1], [ 0, 1], [ 1, 1]];

var ortho = [
	[ 0,-1],
	[ 1, 0],
	[ 0, 1],
	[-1, 0],
];

function pos(x, y)   { return { x : x, y : y }; }
function poseq(a, b) { return a.x == b.x && a.y == b.y; }
function sum(x, y)   { return x + y; }
function notNull(x)  { return x != null; }
function isNull(x)   { return x == null; }

function inBox(pos, w, h, t) {
	return !((t.x < pos.x) ||
		     (t.y < pos.y) ||
		     (t.x > pos.x + w) ||
		     (t.y > pos.y + h));
}

function inTile(pos, mouse) {
	return inBox(pos, TILE_SIZE, TILE_SIZE, mouse);
}

////////////////////////////////////////////////////////
//
//  Drawing
//
////////////////////////////////////////////////////////

var c = document.getElementById('target');
var g = c.getContext('2d');
var gfx = {};

function loadGraphics(onready, images) {
	var pending = images.length;
	images.forEach(function(i) {
		gfx[i] = new Image();
		gfx[i].onload = function() {
			pending--;
			if (pending <= 0) { onready(); }
		}
		gfx[i].src = 'images/' + i;
	});
}

function drawRotated(sheet, tile, dir, w, h, x, y) {
	g.save();
	g.translate(x, y);
	switch(dir) {
		case 0:
			// nothing to do.
			break;
		case 1:
			g.rotate(0.5 * Math.PI);
			g.translate(0, -h);
			break;
		case 2:
			g.rotate(1.0 * Math.PI);
			g.translate(-w, -h);
			break;
		case 3:
			g.rotate(1.5 * Math.PI);
			g.translate(-w, 0);
			break;
		default:
			throw new Error("invalid tile rotation");
	}
	var ix = Math.floor(gfx[sheet].width  / w);
	var iy = Math.floor(gfx[sheet].height / h);
	var tx = Math.floor(tile % ix) * w;
	var ty = Math.floor(tile / ix) * h;
	g.drawImage(
		gfx[sheet],
		tx, ty, w, h, // src
		 0,  0, w, h  // dst
	);
	g.restore();
}

function drawTile(t, pos) {
	g.save();

	// because the canvas drawing coordinate system is horseshit:
	g.translate(0.5, 0.5);

	if (t != null && t.isBlock) {
		g.beginPath();
		g.strokeStyle = blockColor;
		g.setLineDash([5, 5]);
		g.lineWidth = 1;
		g.rect(5, 5, TILE_SIZE - 10, TILE_SIZE - 10);
		g.stroke();
	}
	else {
		// background
		g.beginPath();
		g.fillStyle = (t == null)         ? 'white' :
		              (t == selectedTile) ? tileHighlight :
		              tileColor;
		g.rect(0, 0, TILE_SIZE, TILE_SIZE);
		g.fill();

		// outline
		g.beginPath();
		g.strokeStyle = (t == null) ? blockColor : tileOutline;
		g.lineWidth = 0;
		g.rect(0, 0, TILE_SIZE, TILE_SIZE);
		g.stroke();

		if (t != null && pos && canAttack(t)) {
			var defense = defenseAround(gameState().board, pos);
			if (defense > 0) { drawInfo(defense, t.team); }
		}
	}
	g.restore();

	if (t == null || t.isBlock) { return; }

	var teams = {
		'black' : 0,
		'red'   : 1,
		'blue'  : 2,
		'green' : 3,
	};
	dirs.forEach(function(d) {
		if (t.atk[(d + t.rot) % 4]) {
			drawRotated('icons.png', teams[t.team]*2,   d, TILE_SIZE, TILE_SIZE, 0, 0);
		}
		if (t.def[(d + t.rot) % 4]) {
			drawRotated('icons.png', teams[t.team]*2+1, d, TILE_SIZE, TILE_SIZE, 0, 0);
		}
	});
}

function drawHeading(t) {
	g.beginPath();
	g.fillStyle    = 'black';
	g.textAlign    = 'center';
	g.textBaseline = 'middle';
	g.font         = '15px Helvetica';
	g.fillText(
		t,
		(SIZE_X / 2),
		30
	);
}

function drawInfo(t, color) {
	g.beginPath();
	g.fillStyle    = color;
	g.textAlign    = 'center';
	g.textBaseline = 'middle';
	g.font         = '15px Helvetica';
	g.fillText(
		t,
		(TILE_SIZE / 2),
		(TILE_SIZE / 2)
	);
}

function getBoardPosition(p) {
	var height = TILE_SIZE * BOARD_X;
	var width  = TILE_SIZE * BOARD_Y;
	return pos(
		(SIZE_X - width)  / 2 + (p.x * TILE_SIZE),
		(SIZE_Y - height) / 2 + (p.y * TILE_SIZE)
	);
}

function drawOne(background, t, pos) {
	g.save();
	var tpos = getBoardPosition(pos);
	g.translate(tpos.x, tpos.y);
	if (background) { drawTile(null); }
	else if (t) { drawTile(t, pos); }
	g.restore();
};

function drawBoard(state) {
	forBoard(state.board, drawOne.bind(this, true));
	forBoard(state.board, drawOne.bind(this, false));
}

function getHandPosition(team, index) {
	var height  = (TILE_SIZE + 5) * 6 - 5;
	var width   = (TILE_SIZE + 5) * 3 - 5;
	var hmargin = 10;
	var vcenter = Math.floor((SIZE_Y - height) / 2);
	var step    = TILE_SIZE + 5;
	var px      = team == 'red' ? (SIZE_X - width - hmargin) : hmargin + width - step;
	var py      = vcenter;
	var r       = pos(px, py);

	for (var x = 0; x < index; x++) {
		r.y += step;
		if (x == 5)  { r.x += (team == 'red') ? step : -step; r.y = py + Math.floor(TILE_SIZE / 2); }
		if (x == 10) { r.x += (team == 'red') ? step : -step; r.y = py; }
	}
	return r;
}

function drawHand(state, team) {
	state.hands[team].forEach(function(x, i) {
		g.save();
		var tpos = getHandPosition(team, i);
		g.translate(tpos.x, tpos.y);
		if (x != null) { drawTile(x); }
		g.restore();
	});

	g.save();
	var spos = getHandPosition(team, 6);
	g.translate(spos.x, spos.y - TILE_SIZE);
	drawInfo(score(state.board, team), team);
	g.restore();
}

function drawButton(img, p, color) {
	g.fillStyle = color;
	g.fillRect(p.x, p.y, 64, 64);
	drawRotated(img, 0, 0, 64, 64, p.x, p.y);
}

function getUndoPosition() { return getBoardPosition(pos(0,         -1.25)); }
function getRedoPosition() { return getBoardPosition(pos(BOARD_X-1, -1.25)); }

function drawGame() {
	g.fillStyle = 'white';
	g.fillRect(0, 0, SIZE_X, SIZE_Y);

	drawBoard(gameState());
	drawHand(gameState(), 'red');
	drawHand(gameState(), 'blue');

	if (gameState().mode == 'blue_turn' && ai.name != 'Blue') { return; }

	drawButton('undo.png', getUndoPosition(), historyCursor > 0                      ? tileColor : backColor);
	drawButton('redo.png', getRedoPosition(), historyCursor < gameHistory.length - 1 ? tileColor : backColor);

	if (selectedTile) {
		g.save();
		g.translate(
			mousePos.x - selectedX,
			mousePos.y - selectedY
		);
		drawTile(selectedTile);
		g.restore();
	}
}

function repaint() {
	stateFunc('draw')();
}

////////////////////////////////////////////////////////
//
//  Tiles
//
////////////////////////////////////////////////////////

var types = [
	{ atk: [1, 0, 0, 0], def: [0, 0, 0, 0] },
	{ atk: [0, 0, 0, 0], def: [1, 0, 0, 0] },
	{ atk: [1, 1, 0, 0], def: [0, 0, 0, 0] },
	{ atk: [0, 0, 0, 0], def: [1, 1, 0, 0] },
	{ atk: [1, 0, 0, 0], def: [0, 1, 0, 0] },
	{ atk: [0, 1, 0, 0], def: [1, 0, 0, 0] },
	{ atk: [1, 0, 0, 0], def: [0, 0, 1, 0] },
	{ atk: [1, 0, 1, 0], def: [0, 0, 0, 0] },
	{ atk: [0, 0, 0, 0], def: [1, 0, 1, 0] },
	{ atk: [1, 1, 0, 0], def: [0, 0, 1, 0] },
	{ atk: [1, 0, 1, 0], def: [0, 1, 0, 0] },
	{ atk: [0, 1, 1, 0], def: [1, 0, 0, 0] },
	{ atk: [1, 1, 1, 0], def: [0, 0, 0, 0] },
	{ atk: [0, 0, 1, 0], def: [1, 1, 0, 0] },
	{ atk: [0, 1, 0, 0], def: [1, 0, 1, 0] },
	{ atk: [1, 0, 0, 0], def: [0, 1, 1, 0] },
	{ atk: [0, 0, 0, 0], def: [1, 1, 1, 0] },
];

function newTiles(team) {
	return types.map(function(t) {
		return {
			team : team,
			atk  : t.atk,
			def  : t.def,
			rot  : 0,
		}
	});
}

function blankEdges(tile) {
	return 4 - tile.atk.concat(tile.def).reduce(sum, 0);
}

function canAttack(tile) {
	return tile.atk.reduce(sum, 0) > 0;
}

function edgesIn(board, pos, dir) {
	function edge(tile, dir) {
		if (tile == null || tile.isBlock) { return 'blank'; }
		var d = (dir + tile.rot) % 4;
		return ['blank','shield','spear'][
			(tile.def[d]) + (tile.atk[d] * 2)
		];
	};
	return {
		out : edge(get(board, pos), dir),
		in  : edge(get(board, neighbor(board, pos, dir)), opposite[dir]),
	}
}

////////////////////////////////////////////////////////
//
//  The Board
//
////////////////////////////////////////////////////////

function newBoard() {
	var r = [];
	for (var y = 0; y < BOARD_Y; y++) {
		var row = [];
		for (var x = 0; x < BOARD_X; x++) { row[x] = null; }
		r.push(row);
	}
	return r;
}

function forBoard(board, f) {
	for (var y = 0; y < BOARD_Y; y++) {
		for (var x = 0; x < BOARD_X; x++) {
			f(board[y][x], pos(x, y));
		}
	}
}

function boardTiles(board) {
	var r = [];
	forBoard(board, function(t, pos) {
		if (t != null) { r.push(t) }
	})
	return r;
}

function emptyPositions(board) {
	var r = [];
	forBoard(board, function(t, pos) {
		if (t == null) { r.push(pos); }
	})
	return r;
}

function get(board, pos) {
	if (pos == null) { return null; }
	return board[pos.y][pos.x];
}
function set(board, pos, val) {
	board[pos.y][pos.x] = val;
}

function validTile(pos) {
	return (pos.x >= 0) &&
	       (pos.y >= 0) &&
	       (pos.x < BOARD_X) &&
	       (pos.y < BOARD_Y);
}

function neighbor(board, pos, dir) {
	var pos = {
		x : pos.x + ortho[dir][0],
		y : pos.y + ortho[dir][1],
	};
	if (!validTile(pos)) { return null; }
	return pos;
}

function neighborsOf(source, pos) {
	return source.map(function(p, i) {
		return {
			x : p[0] + pos.x,
			y : p[1] + pos.y,
			i : i,
		};
	}).filter(validTile);
}

////////////////////////////////////////////////////////
//
//  Game Logic
//
////////////////////////////////////////////////////////

function score(board, team) {
	return boardTiles(board).filter(function(t) {
		return t.team == team;
	}).map(blankEdges).reduce(sum, 0);
}

function isGameOver(state) {
	// next player has no tiles:
	var next = (state.mode == 'red_turn' || state.mode == 'red_anim') ? 'blue' : 'red'
	if (!state.hands[next].some(notNull)) { return true; }

	// next player has no valid spaces to play into:
	return emptyPositions(state.board).length < 1;
}

function defenseAround(board, pos) {
	return dirs.map(function(dir) {
		return edgesIn(board, pos, dir).in == 'shield';
	}).reduce(sum, 0);
}

function evaluateMove(state, tile, pos) {
	// remove the tile from the player's hand:
	var tileIndex = state.hands[tile.team].indexOf(tile);
	if (tileIndex < 0) { throw new Error("bogus tile selected to move."); }
	state.hands[tile.team][tileIndex] = null;

	// play the tile:
	set(state.board, pos, tile);

	// clear any existing exclusion zone:
	forBoard(state.board, function(t, pos) {
		if (t != null && t.team == 'black') { set(state.board, pos, null); }
	});

	// consider attacking every orthogonal neighbor.
	var killset = [];
	dirs.forEach(function(dir) {
		var otherpos = neighbor(state.board, pos, dir);
		var other = get(state.board, otherpos);
		if (other == null) { return; }

		var edges = edgesIn(state.board, pos, dir);

		// shields block spears, spears beat empties.
		if (edges.out == 'spear') {
			if (edges.in  == 'shield') { return; }
			if (edges.in  == 'blank')  { killset.push(otherpos); return; }
		}
		if (edges.in == 'spear') {
			if (edges.out == 'shield') { return; }
			if (edges.out == 'blank')  { killset.push(pos); return; }
		}

		// spears versus spears consider defense
		if (edges.out == 'spear' && edges.in == 'spear') {
			var defenseIn  = defenseAround(state.board, otherpos);
			var defenseOut = defenseAround(state.board, pos);
			if (defenseOut >= defenseIn) { killset.push(otherpos); }
			if (defenseOut <= defenseIn) { killset.push(pos); }
		}
	});

	// remove fatalities.
	killset.forEach(function(pos) { set(state.board, pos, null); });

	// if the tile we just played survived,
	// reserve exclusion zone around placed tile
	if (get(state.board, pos) != null) {
		neighborsOf(around, pos).forEach(function(pos) {
			if (get(state.board, pos) != null) { return; }
			set(state.board, pos, { team : 'black', isBlock : true });
		});
	}

	return state;
}

function playMove(tile, pos) {
	recordMove(
		evaluateMove(copyState(gameState()), tile, pos),
		{ tile: tile, pos: pos }
	);

	// advance the state machine:
	if (isGameOver(gameState())) {
		recordMove(
			stepTo('end_anim', gameState())
		);
	}
	else {
		recordMove(
			stateFunc('next')(gameState())
		);
	}
}

////////////////////////////////////////////////////////
//
//  Turn Animation
//
////////////////////////////////////////////////////////

var tweenPercent = 0;
var tweening = false;

function beginTween(state) {
	tweenPercent = 0;
	tweening = true;
	return state;
}

function drawTween() {
	if (!tweening) { return; }

	g.fillStyle = 'white';
	g.fillRect(0, 0, SIZE_X, SIZE_Y);
	drawHand(gameState(), 'red');
	drawHand(gameState(), 'blue');
	forBoard(gameState().board, drawOne.bind(this, true));

	function drawTile(tile, pos) {
		if (tile != null && tile.isBlock) { return; }
		drawOne(false, tile, pos);
	}

	if (tweenPercent < .5) {
		forBoard(prevState().board, function(t, pos) {
			var old    = t;
			var now    = get(gameState().board, pos);
			var dead   = (now == null) || (now.isBlock);
			var fizzle = poseq(pos, prevMove().pos) && dead;
			var killed = (old != null) && (!old.isBlock) && dead;

			if (fizzle || killed) {
				// destroyed tiles are faded out
				g.save();
				g.globalAlpha = (1 - tweenPercent * 2);
				drawTile(old || prevMove().tile, pos);
				g.restore();
			}
			else {
				// everything else is treated normally
				drawTile(now, pos);
			}
		});
	}
	else {
		// fade up blocks
		forBoard(gameState().board, function(t, pos) {
			g.save();
			if (t != null && t.isBlock) {
				g.globalAlpha = (tweenPercent - .5) * 2;
			}
			drawOne(false, t, pos);
			g.restore()
		});
	}

	if (tweenPercent < 1) {
		tweenPercent = Math.min(1, tweenPercent + .1);
		window.setTimeout(drawTween, 100);
	}
	else {
		tweening = false;
		recordMove(stateFunc('next')(gameState()));
	}
}

////////////////////////////////////////////////////////
//
//  AI Helpers
//
////////////////////////////////////////////////////////

function chooseRandom(list) {
	return list[Math.floor(Math.random() * list.length)];
}

function copyState(state) {
	// note that this only performs a shallow copy
	// of tiles themselves; be careful not to screw
	// up their rotation values!

	function copyBoard(board) {
		var r = newBoard();
		forBoard(board, function(t, pos) { set(r, pos, t); })
		return r;
	}
	return {
		mode  : state.mode,
		board : copyBoard(state.board),
		hands : {
			'red'  : state.hands.red.slice(0),
			'blue' : state.hands.blue.slice(0),
		},
	};
}

function otherTeam(team) {
	return team == 'red' ? 'blue' : 'red';
}

function forMoves(state, team, f) {
	state.hands[team].filter(notNull).forEach(function(tile) {
		var originalRot = tile.rot;
		dirs.forEach(function(rot) {
			tile.rot = rot;
			emptyPositions(state.board).forEach(function(pos) {
				f(tile, rot, pos);
			});
		});
		tile.rot = originalRot;
	});
}

////////////////////////////////////////////////////////
//
//  Input Handlers
//
////////////////////////////////////////////////////////

var dragging = false;
var selectedTile = null;
var selectedX = -1;
var selectedY = -1;
var originalIndex = -1;
var mousePos = pos(-1, -1);

function mouseMove(event) {
	if (event.targetTouches) {
		// adapt touch-drag events down to
		// behave the same as mouse-drags:
		if (selectedTile) { event.preventDefault(); }
		event = event.targetTouches[0];
		if (!event) { return; }
	}
	var rect = c.getBoundingClientRect();
	mousePos = pos(
		event.clientX - rect.left,
		event.clientY - rect.top
	);
	if (stateFunc('click') && !tweening); { repaint(); }
	if (!selectedTile) { return; }
	var handler = stateFunc('drag');
	if (handler) { handler(); }
	if (!tweening) { repaint(); }
}

function mouseDown(event)  {
	event.preventDefault();
	dragging = true;
	mouseMove(event);
	if (!selectedTile) {
		var handler = stateFunc('grab');
		if (handler) { handler(); }
		if (!tweening) { repaint(); }
	}
}

function mouseUp(event) {
	dragging = false;
	mouseMove(event);
	var clicker = stateFunc('click');
	if (clicker) {
		clicker(gameState());
	}
	if (selectedTile) {
		var handler = stateFunc('drop');
		if (handler) { handler(); }
	}
	if (!tweening) { repaint(); }
}

function inputHandlers() {
	c.addEventListener("mousemove",   mouseMove, false);
	c.addEventListener("contextmenu", mouseMove, false);
	c.addEventListener("mousedown",   mouseDown, false);
	c.addEventListener("mouseup"  ,   mouseUp,   false);
	c.addEventListener("mouseout",    mouseUp,   false);
	
	c.addEventListener("touchstart",  mouseDown, false);
	c.addEventListener("touchend",    mouseUp,   false);
	c.addEventListener("touchmove",   mouseMove, false);
}

function grab(team) {
	gameState().hands[team].forEach(function (x, i) {
		if (x == null || selectedTile) { return; }
		var pos = getHandPosition(team, i);
		if (inTile(pos, mousePos)) {
			selectedTile = x;
			originalIndex = i;
			selectedX = mousePos.x - pos.x;
			selectedY = mousePos.y - pos.y;
			gameState().hands[team][i] = null;
		}
	});
}

function drop(team) {
	forBoard(gameState().board, function(t, pos) {
		if (t != null) { return; }
		if (inTile(getBoardPosition(pos), mousePos)) {
			gameState().hands[team][originalIndex] = selectedTile;
			playMove(selectedTile, pos);
			selectedTile = null;
		}
	});
	if (inTile(getHandPosition(team, originalIndex), mousePos)) {
		selectedTile.rot = (selectedTile.rot + 1) % 4;
	}
	if (selectedTile) {
		gameState().hands[team][originalIndex] = selectedTile;
		selectedTile = null;
	}
}

////////////////////////////////////////////////////////
//
//  Opponent Menu
//
////////////////////////////////////////////////////////

var opponents = [
	new RandomAI('blue'),
	new MaxineAI('blue'),
	{ name: "Human" },
];

var ai = null;

var OPP_BUTTON_W   = 300;
var OPP_BUTTON_H   =  40;
var OPP_BUTTON_PAD =   5;

function getOpponentPosition(index) {
	var height = (OPP_BUTTON_H + OPP_BUTTON_PAD) * opponents.length - OPP_BUTTON_PAD;
	return pos(
		(SIZE_X - OPP_BUTTON_W) / 2,
		(SIZE_Y - height) / 2 + (OPP_BUTTON_H + OPP_BUTTON_PAD) * index
	);
}

function drawOpponentMenu() {
	g.fillStyle = 'white';
	g.fillRect(0, 0, SIZE_X, SIZE_Y);

	g.save();
	g.translate(0.5, 0.5);
	opponents.map(function(o, i) {
		g.save();
		var p = getOpponentPosition(i);
		g.translate(p.x, p.y);

		var over = inBox(p, OPP_BUTTON_W, OPP_BUTTON_H, mousePos);

		g.beginPath();
		g.fillStyle = over ? tileHighlight : tileColor;
		g.strokeStyle = tileOutline;
		g.rect(0, 0, OPP_BUTTON_W, OPP_BUTTON_H);
		g.fill();
		g.stroke();

		g.fillStyle    = tileOutline;
		g.textAlign    = 'center';
		g.textBaseline = 'middle';
		g.font         = '15px Helvetica';
		g.fillText(
			o.name,
			(OPP_BUTTON_W / 2),
			(OPP_BUTTON_H / 2)
		);

		g.restore();
	});
	g.restore();
}

////////////////////////////////////////////////////////
//
//  History
//
////////////////////////////////////////////////////////

var gameHistory = [
	{
		state: {
			mode: 'opp_menu',
			board: newBoard(),
			hands: {
				'red'  : newTiles('red'),
				'blue' : newTiles('blue'),
			},
		},
		move: null,
	},
];
var historyCursor = 0;

function gameState() { return gameHistory[historyCursor].state; }
function prevMove()  { return gameHistory[historyCursor].move;  }
function prevState() { return (historyCursor == 0) ? null : gameHistory[historyCursor-1].state; }

function stateFunc(name) {
	return gameMachine[gameState().mode][name];
}

function recordMove(newState, move) {
	if (!move) {
		if (typeof newState == 'function') {
			console.log(newState);
			throw new Error("WTF");
		}
		gameHistory[historyCursor].state = newState;
	}
	else {
		gameHistory = gameHistory.slice(0, historyCursor+1);
		gameHistory.push({
			state : newState,
			move  : move,
		});
		historyCursor++;
	}
}

function stepTo(mode, state) {
	state.mode = mode;
	var init = gameMachine[state.mode]['init'];
	if (init) { state = init(state); }
	repaint();
	return state;
}

function undoStep() { return ai.name == 'Blue' ? 1 : 2; }
function undoMove() { historyCursor = Math.max(historyCursor - undoStep(), 0); }
function redoMove() { historyCursor = Math.min(historyCursor + undoStep(), gameHistory.length - 1); }

function clickUndoRedo() {
	if (inTile(getUndoPosition(), mousePos)) { undoMove(); }
	if (inTile(getRedoPosition(), mousePos)) { redoMove(); }
}

////////////////////////////////////////////////////////
//
//  Main Program
//
////////////////////////////////////////////////////////



var gameMachine = {
	'opp_menu' : {
		draw: function() {
			drawOpponentMenu();
			drawHeading("Choose an Opponent:");
		},
		click: function(state) {
			opponents.forEach(function(o, i) {
				if (inBox(getOpponentPosition(i), OPP_BUTTON_W, OPP_BUTTON_H, mousePos)) {
					if (o.name == 'Human') {
						o.name = 'Blue';
						gameMachine['red_turn'].draw = function(){ drawGame(); drawHeading("Red's Turn"); }
						gameMachine['blue_turn'].grab = grab.bind(this, 'blue');
						gameMachine['blue_turn'].drop = drop.bind(this, 'blue');
						gameMachine['blue_turn'].init = null;
					}
					ai = o;
					state.mode = 'red_turn';
				}
			});
		},
	},
	'red_turn' : {
		grab: grab.bind(this, 'red'),
		drop: drop.bind(this, 'red'),
		draw: function() {
			drawGame();
			drawHeading("Player's Turn");
		},
		click: clickUndoRedo,
		next: stepTo.bind(this, 'red_anim'),
	},
	'red_anim' : {
		init: beginTween,
		draw: drawTween,
		next: stepTo.bind(this, 'blue_turn'),
	},
	'blue_turn' : {
		init: function(state) {
			window.setTimeout(function() {
				var move = ai.decide(state);
				playMove(move.tile, pos(move.x, move.y));
			}, 1500);
			return state;
		},
		draw: function() {
			drawGame();
			drawHeading(ai.name + "'s Turn");
		},
		click: clickUndoRedo,
		next: stepTo.bind(this, 'blue_anim'),
	},
	'blue_anim' : {
		init: beginTween,
		draw: drawTween,
		next: stepTo.bind(this, 'red_turn'),
	},
	'end_anim' : {
		init: beginTween,
		draw: drawTween,
		next: stepTo.bind(this, 'game_over'),
	},
	'game_over' : {
		init: repaint,
		draw: function() {
			drawGame();
			var red  = score(gameState().board, 'red');
			var blue = score(gameState().board, 'blue');
			if (red == blue) {
				drawHeading("The game is a draw.");
			}
			else {
				var winner = (red > blue) ? "Red" : "Blue";
				drawHeading(winner + " is victorious.")
			}
		}
	},
};

function init() {
	inputHandlers();
	repaint();
}

loadGraphics(init, [
	'icons.png',
	'undo.png',
	'redo.png',
]);
