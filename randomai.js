////////////////////////////////////////////////////////
//
//  Random AI
//
//  Starting simple: an AI which makes random,
//  valid moves. Sometimes this is more effective
//  than you might imagine.
//
////////////////////////////////////////////////////////

function RandomAI(team) {

	this.name = "Random AI";
	this.myTeam = team;

	this.chooseRandom = function(list) {
		return list[Math.floor(Math.random() * list.length)];
	}

	// The decide function should return a tuple
	// { tile, x, y } where tile is  some tile
	// from the AI's hand, and x and y are empty
	// coordinates on the board:
	this.decide = function(state) {

		var tile = this.chooseRandom(state.hands[this.myTeam].filter(notNull));
		var pos  = this.chooseRandom(emptyPositions(state.board));

		tile.rot = (tile.rot + Math.floor(Math.random() * 4)) % 4;

		return {
			tile : tile,
			x    : pos.x,
			y    : pos.y,
		};
	}
}