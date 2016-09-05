
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

var SIZE_X     = 800;
var SIZE_Y     = 480;
var TILE_SIZE  = 64;
var TILE_COUNT = 9;

var BOARD_X = 5;
var BOARD_Y = 5;

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

var tiles = new Image();
tiles.onload = init;
tiles.src = 'icons.png';

function pos(x, y)  { return { x : x, y : y }; }
function sum(x, y)  { return x + y; }
function notNull(x) { return x != null; }
function isNull(x)  { return x == null; }

function inBox(pos, w, h, mx, my) {
	return !((mx < pos.x) ||
		     (my < pos.y) ||
		     (mx > pos.x + w) ||
		     (my > pos.y + h));
}

function inTile(pos, mx, my) {
	return inBox(pos, TILE_SIZE, TILE_SIZE, mx, my);
}

////////////////////////////////////////////////////////
//
//  Drawing
//
////////////////////////////////////////////////////////

var c = document.getElementById('target');
var g = c.getContext('2d');

function drawSprite(x, y, c, i) {
	g.drawImage(tiles,
		i * TILE_SIZE, c * TILE_SIZE, TILE_SIZE, TILE_SIZE, // src
		x,             y,             TILE_SIZE, TILE_SIZE  // dst
	);
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
			var defense = defenseAround(gameState.board, pos);
			if (defense > 0) { drawInfo(defense, t.team); }
		}
	}
	g.restore();

	if (t == null || t.isBlock) { return; }

	var teams = {
		'black' : 0,
		'red'   : 1,
		'blue'  : 2,
	};
	dirs.forEach(function(d) {
		if (t.atk[(d + t.rot) % 4]) { drawSprite(0, 0, teams[t.team], d); }
		if (t.def[(d + t.rot) % 4]) { drawSprite(0, 0, teams[t.team], d + 4); }
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

function drawBoard(gameState) {
	function drawOne(background, t, pos) {
		g.save();
		var tpos = getBoardPosition(pos);
		g.translate(tpos.x, tpos.y);
		if (background) { drawTile(null); }
		else if (t) { drawTile(t, pos); }
		g.restore();
	};
	forBoard(gameState.board, drawOne.bind(this, true));
	forBoard(gameState.board, drawOne.bind(this, false));
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

function drawHand(gameState, team) {
	gameState.hands[team].forEach(function(x, i) {
		g.save();
		var tpos = getHandPosition(team, i);
		g.translate(tpos.x, tpos.y);
		if (x != null) { drawTile(x); }
		g.restore();
	});

	g.save();
	var spos = getHandPosition(team, 16);
	g.translate(spos.x, spos.y);
	drawInfo(score(gameState.board, team), team);
	g.restore();
}

function drawGame() {
	g.fillStyle = 'white';
	g.fillRect(0, 0, SIZE_X, SIZE_Y);

	drawBoard(gameState);
	drawHand(gameState, 'red');
	drawHand(gameState, 'blue');

	if (selectedTile) {
		g.save();
		g.translate(mouseX - selectedX, mouseY - selectedY);
		drawTile(selectedTile);
		g.restore();
	}
}

function repaint() {
	gameMachine[gameState.mode]['draw']();
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
	gameState = evaluateMove(gameState, tile, pos);

	// advance the state machine:
	if (isGameOver(gameState)) {
		gameState.mode = 'game_over';
	}
	else {
		gameState = gameMachine[gameState.mode]['next'](gameState);
		gameState = gameMachine[gameState.mode]['init'](gameState);
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

function copyBoard(board) {
	var r = newBoard();
	forBoard(board, function(t, pos) { set(r, pos, t); })
	return r;
};

function copyState(state) {
	// note that this only performs a shallow copy
	// of tiles themselves; be careful not to screw
	// up their rotation values!
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
var mouseX = -1;
var mouseY = -1;

function mouseMove(event) {
	if (event.targetTouches) {
		// adapt touch-drag events down to
		// behave the same as mouse-drags:
		if (selectedTile) { event.preventDefault(); }
		event = event.targetTouches[0];
		if (!event) { return; }
	}
	var rect = c.getBoundingClientRect();
	mouseX = event.clientX - rect.left;
	mouseY = event.clientY - rect.top;
	if (gameMachine[gameState.mode]['click']); { repaint(); }
	if (!selectedTile) { return; }
	var handler = gameMachine[gameState.mode]['drag'];
	if (handler) { handler(); }
	repaint();
}

function mouseDown(event)  {
	dragging = true;
	mouseMove(event);
	if (!selectedTile) {
		var handler = gameMachine[gameState.mode]['grab'];
		if (handler) { handler(); }
		repaint();
	}
}

function mouseUp(event) {
	dragging = false;
	mouseMove(event);
	var clicker = gameMachine[gameState.mode]['click'];
	if (clicker) {
		clicker(gameState);
	}
	if (selectedTile) {
		var handler = gameMachine[gameState.mode]['drop'];
		if (handler) { handler(); }
	}
	repaint();
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
	gameState.hands[team].forEach(function (x, i) {
		if (x == null || selectedTile) { return; }
		var pos = getHandPosition(team, i);
		if (inTile(pos, mouseX, mouseY)) {
			selectedTile = x;
			originalIndex = i;
			selectedX = mouseX - pos.x;
			selectedY = mouseY - pos.y;
			gameState.hands[team][i] = null;
		}
	});
}

function drop(team) {
	forBoard(gameState.board, function(t, pos) {
		if (t != null) { return; }
		if (inTile(getBoardPosition(pos), mouseX, mouseY)) {
			playMove(selectedTile, pos);
			selectedTile = null;
		}
	});
	if (inTile(getHandPosition(team, originalIndex), mouseX, mouseY)) {
		selectedTile.rot = (selectedTile.rot + 1) % 4;
	}
	if (selectedTile) {
		gameState.hands[team][originalIndex] = selectedTile;
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

		var over = inBox(p, OPP_BUTTON_W, OPP_BUTTON_H, mouseX, mouseY);

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
//  Main Program
//
////////////////////////////////////////////////////////

var gameState = {
	mode: 'opp_menu',
	board: newBoard(),
	hands: {
		'red'  : newTiles('red'),
		'blue' : newTiles('blue'),
	},
};

var gameMachine = {
	'opp_menu' : {
		draw: function() {
			drawOpponentMenu();
			drawHeading("Choose an Opponent:");
		},
		click: function(state) {
			opponents.forEach(function(o, i) {
				if (inBox(getOpponentPosition(i), OPP_BUTTON_W, OPP_BUTTON_H, mouseX, mouseY)) {
					ai = o;
					state.mode = 'red_turn';
				}
			});
		},
	},
	'red_turn' : {
		grab: grab.bind(this, 'red'),
		drop: drop.bind(this, 'red'),
		init: function(state) {
			return state;
		},
		draw: function() {
			drawGame();
			drawHeading("Player's Turn");
		},
		next: function(state) {
			state.mode = 'blue_turn';
			return state;
		},
	},
	'blue_turn' : {
		init: function(state) {
			window.setTimeout(function() {
				var move = ai.decide(state);
				var tileIndex = state.hands['blue'].indexOf(move.tile);
				if (tileIndex < 0) { throw new Error("bogus tile selected by AI."); }
				state.hands['blue'][tileIndex] = null;
				playMove(move.tile, pos(move.x, move.y));
				repaint();
			}, 1500);
			return state;
		},
		draw: function() {
			drawGame();
			drawHeading(ai.name + "'s Turn");
		},
		next: function(state) {
			state.mode = 'red_turn';
			return state;
		},
	},
	'game_over' : {
		init: function(state) {
			return state;
		},
		draw: function() {
			drawGame();
			var red  = score(gameState.board, 'red');
			var blue = score(gameState.board, 'blue');
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
