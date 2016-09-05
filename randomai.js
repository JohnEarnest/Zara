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

	// The decide function should return a tuple
	// { tile, x, y } where tile is  some tile
	// from the AI's hand, and x and y are empty
	// coordinates on the board:
	this.decide = function(state) {

		var tile = chooseRandom(state.hands[this.myTeam].filter(notNull));
		var pos  = chooseRandom(emptyPositions(state.board));
		tile.rot = Math.floor(Math.random() * 4);

		return {
			tile : tile,
			x    : pos.x,
			y    : pos.y,
		};
	}
}