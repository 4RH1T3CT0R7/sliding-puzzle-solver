import { Puzzle, slideDirections } from "./Puzzle.js";
import { state } from "./State.js";
import { solvePuzzleStrategically } from "./strategicAlgorithm.js";
import {
	solvePuzzleIDAStar,
	solvePuzzleAStarClosedSet,
	solvePuzzleAStar,
	solvePuzzleBFS } from "./searchAlgorithms.js";
import { animateMoveList, checkPuzzleBeforeAnimating, initializeUiElements } from "./uiUtils.js";


// When page is finished loading
window.addEventListener('load', () => {
	// Enable offline access for Mobile (PWA)
	// Webpack is smart and will remove dev check during production builds :-)
	if ('serviceWorker' in navigator) {
		if (process.env.NODE_ENV === 'development') {
			console.log('In development mode, will not register service worker');
		} else {
			navigator.serviceWorker.register('./service-worker.js')
			.catch(registrationError => {
				console.log('Failed to enable offline access', registrationError);
			});
		}
	}

	// Initialize UI, buttons, css toggles, initial Puzzle state
	initializeUiElements();

	// Add custom onclick for solve button with animation locking logic
	document.getElementById("solveBtn").addEventListener("click", async () => {
		if (state.solveAnimation.active) {
			return;
		}

		// Wait for our animation lock to become available
		// Don't want to start solving while puzzle is moving, or kick off two animations at the same time
		await state.solveAnimation.lock.finish;
		solvePuzzle();
	});
});


// Maps dropdown values to our solver functions
const algorithmMappings = {
	Strategic: solvePuzzleStrategically,
	"IDA*": solvePuzzleIDAStar,
	"A*": solvePuzzleAStar,
	"A*closedSet": solvePuzzleAStarClosedSet,
	BFS: solvePuzzleBFS,
};

// Solve puzzle using selected algorithm, output result, and start animation
const solvePuzzle = () => {
	// If multiple instances get are trying to acquire lock at same time, this will stop them
	// Needed for mobile where you can press multiple buttons at the same time (randomize + solve)
	if (state.solveAnimation.active) {
		return;
	}

	// Lock our state for solving/animating the puzzle solution
	state.solveAnimation.active = true;
	state.solveAnimation.lock.acquire();
	const startingPuzzle = checkPuzzleBeforeAnimating();
	if (!startingPuzzle) {
		return;
	}

	// Get our algorithm
	const selectedAlgorithm = document.getElementById("algorithmsDropdown").value;
	const algorithm = algorithmMappings[selectedAlgorithm];

	// Solve using algorithm
	const originalPuzzle = Puzzle.fromPuzzle(startingPuzzle);
	let solution = algorithm(startingPuzzle, state.goalPuzzle);
	let solutionMoves = [];
	if (solution["solutionMoves"]) {

		// Strategic algorithm keeps track of solution moves for us
		solutionMoves = solution["solutionMoves"];
	} else {

		// Get inverse of our slide Directions so we can get the key from the value
		let solutionPuzzle = solution["solutionPuzzle"];
		Object.keys(slideDirections).forEach((key) => {
			slideDirections[slideDirections[key]] = key;
		});

		// Build move list from Puzzle state working backwards
		while (solutionPuzzle) {
			solutionMoves.push(slideDirections[solutionPuzzle.lastSlideDirection]);
			solutionPuzzle = solutionPuzzle.cameFrom;
		}

		// Started from end to finish, so reverse moves and remove INITIAL state
		solutionMoves = solutionMoves.reverse();
		solutionMoves.shift();
	}

	// -----------------------------
	// New: Convert directions to tile numbers
	// -----------------------------
	const tileMoves = [];
	const simPuzzle = Puzzle.fromPuzzle(originalPuzzle); // copy to simulate

	// Helper to perform a slide on the simulated puzzle
	const slideFns = {
		UP:   () => simPuzzle.slideUp(),
		DOWN: () => simPuzzle.slideDown(),
		LEFT: () => simPuzzle.slideLeft(),
		RIGHT:() => simPuzzle.slideRight()
	};

	for (const dir of solutionMoves) {
		let tileNumber;
		switch (dir) {
			case "UP":
				tileNumber = simPuzzle.matrix[simPuzzle.blankRow - 1][simPuzzle.blankCol];
				break;
			case "DOWN":
				tileNumber = simPuzzle.matrix[simPuzzle.blankRow + 1][simPuzzle.blankCol];
				break;
			case "LEFT":
				tileNumber = simPuzzle.matrix[simPuzzle.blankRow][simPuzzle.blankCol - 1];
				break;
			case "RIGHT":
				tileNumber = simPuzzle.matrix[simPuzzle.blankRow][simPuzzle.blankCol + 1];
				break;
		}
		tileMoves.push(tileNumber);
		slideFns[dir](); // advance simulated puzzle
	}
	// -----------------------------

	// Output summary to screen
	summaryOutput.value = "";
	summaryOutput.value += `Runtime: ${solution["runtimeMs"].toFixed(3)}ms\n`;
	summaryOutput.value += `Moves: ${solutionMoves.length} ${
		selectedAlgorithm !== "Strategic" || solutionMoves.length === 0 || solutionMoves.length === 1
			? "(optimal)"
			: "(nonoptimal)"
	}
`;
	summaryOutput.value += `Max puzzles in memory: ${solution["maxPuzzlesInMemory"]}`;
	console.log(algorithm.name, "SOLUTION (directions):", solutionMoves.length - 1, solutionMoves);
	console.log("SOLUTION (tiles):", tileMoves.length, tileMoves);

	// Output move list to screen (tiles instead of directions)
	let moveList = "Move list:\n";
	tileMoves.slice(0, 20000).forEach((tile, i) => {
		moveList += `${i + 1}: ${tile}\n`;
	});
	solutionOutput.value = moveList;
	solutionOutput.value += tileMoves.length > 20000 ? "See console for full move list...\n" : "";

	// Animate the solution (still uses directions)
	animateMoveList(originalPuzzle, solutionMoves);
};