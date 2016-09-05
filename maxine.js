////////////////////////////////////////////////////////
//
//  Maxine
//
//  A somewhat less naive AI which selects moves that
//  maximize short-term gains, incorporating a few
//  simple heuristics.
//
////////////////////////////////////////////////////////

function MaxineAI(team) {

	this.name = "Maxine";
	this.myTeam = team;

	this.ATTACK_REWARD = 3.00;
	this.SCORE_REWARD  = 1.00;
	this.EDGE_REWARD   = 0.75;
	this.EDGE_DEFENSE  = 1.00;
	this.FUZZ_FACTOR   = 0.10;

	this.moveValue = function(prior, state, lastMove) {
		var value = 0;

		// it's good when the enemy loses points:
		var prevOther = score(prior.board, otherTeam(this.myTeam));
		var nowOther  = score(state.board, otherTeam(this.myTeam));
		if (nowOther < prevOther) {
			value += (prevOther - nowOther) * this.ATTACK_REWARD;
		}

		// it's good when we gain points:
		var prevMe = score(prior.board, this.myTeam);
		var nowMe  = score(state.board, this.myTeam);
		if (nowMe > prevMe) {
			value += (nowMe - prevMe) * this.SCORE_REWARD;
		}

		// prefer edges of the board; those spaces are easier to defend:
		if (lastMove.x == 0 || lastMove.y == 0 || lastMove.x == BOARD_X-1 || lastMove.y == BOARD_Y-1) {
			value += this.EDGE_REWARD;

			// it's ideal to make the blank edges of our pieces face the edges of the board:
			var p = pos(lastMove.x, lastMove.y);
			if (lastMove.y == 0         && edgesIn(state.board, p, 0).out == 'blank') { value += this.EDGE_DEFENSE; }
			if (lastMove.x == BOARD_X-1 && edgesIn(state.board, p, 1).out == 'blank') { value += this.EDGE_DEFENSE; }
			if (lastMove.y == BOARD_Y-1 && edgesIn(state.board, p, 2).out == 'blank') { value += this.EDGE_DEFENSE; }
			if (lastMove.x == 0         && edgesIn(state.board, p, 3).out == 'blank') { value += this.EDGE_DEFENSE; }
		}

		// add some random fuzz to make things less predictable:
		value += (Math.random() * this.FUZZ_FACTOR);

		return value;
	};

	this.randomMove = function(state, team) {
		var pos  = chooseRandom(emptyPositions(state.board));
		var tile = chooseRandom(state.hands[team].filter(notNull));
		var rot  = Math.floor(Math.random() * 4);
		return {
			x    : pos.x,
			y    : pos.y,
			tile : tile,
			rot  : rot,
		};
	};

	this.consider = function(state, team) {
		// start with a wild guess
		var best      = this.randomMove(state, team);
		var bestval   = 0; // really bad moves may have a negative value.
		var trials    = 0;
		var startTime = new Date().getTime();

		// brute-force search for the maximum-valued move
		state.hands[team].filter(notNull).forEach(function(tile) {
			var originalRot = tile.rot;
			dirs.forEach(function(rot) {
				tile.rot = rot;
				emptyPositions(state.board).forEach(function(pos) {

					// evaluateMove modifies in place, so defensively copy
					var nextState = evaluateMove(copyState(state), tile, pos);
					trials++;

					var thisMove = {
						x    : pos.x,
						y    : pos.y,
						tile : tile,
						rot  : rot,
					};

					// prefer better moves (duh)
					var value = this.moveValue(state, nextState, thisMove);
					if (value > bestval) {
						bestval = value;
						best    = thisMove;
					}

				}.bind(this));
			}.bind(this));
			tile.rot = originalRot;
		}.bind(this));

		var endTime = new Date().getTime();
		console.log(
			'considered ' + trials + ' moves in ' + (endTime - startTime)  + 'ms.' +
			'\nmy best move has a value of ' + bestval + '.'
		);
		return best;
	};

	this.decide = function(state) {
		// find an ideal move
		var best = this.consider(state, this.myTeam);

		// set our tile rotation appropriately
		best.tile.rot = best.rot;
		return best;
	};
}
