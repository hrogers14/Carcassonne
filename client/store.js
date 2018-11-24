import { createStore, applyMiddleware } from 'redux';
import thunkMiddleware from 'redux-thunk';
import axios from 'axios';
import TileNode from './components/BoardComponents/TileNode';
import { findRegion } from './components/renderFuncs/checkValid';

const top = 0;
const right = 1;
const bottom = 2;
const left = 3;

//initial state--
const initialState = {
  player: {},
  curTile: {},
  curLocation: null,
  board: {},
  roomId: '',
  players: [],
  currentPlayer: '',
  unfilledTiles: {},
  gameState: '',
  startTile: {},
  curMeeple: {},
  scores: {},
  meeplesPlaced: [],
  removeMeeples: []
};

//action types
const CREATE_ROOM = 'CREATE_ROOM';
const JOIN_ROOM = 'JOIN_ROOM';
const INIT_GAME = 'INIT_GAME';
const ROTATE_TILE = 'ROTATE_TILE';
const NEXT_TURN = 'NEXT_TURN';
const ADD_TO_BOARD = 'ADD_TO_BOARD';
const SET_PLAYER = 'SET_PLAYER';
const SET_MEEPLE = 'SET_MEEPLE';
const GAME_OVER = 'GAME_OVER';

//action creators
export const createRoom = (roomId, player) => ({type: CREATE_ROOM, roomId, player});
export const joinRoom = player => ({ type: JOIN_ROOM, player });
export const initGame = (players, roomId, startTile, curTile, currentPlayer) => ({ type: INIT_GAME, players, roomId, startTile, curTile, currentPlayer });
export const rotate = () => ({ type: ROTATE_TILE });
export const nextTurn = (player, tile) => ({ type: NEXT_TURN, player, tile });
export const addToBoard = coords => ({ type: ADD_TO_BOARD, coords });
export const setPlayer = player => ({ type: SET_PLAYER, player });
export const setMeeple = meeple => ({ type: SET_MEEPLE, meeple });
export const gameOver = () => ({ type: GAME_OVER });

const getNeighbors = (x, y) => {
  return [`${x},${y + 1}`,`${x + 1},${y}`, `${x},${y - 1}`, `${x - 1},${y}`]
}

const initStartNode = (startTile) => {
  const startNode = new TileNode(startTile);
  const neighb0 = new TileNode(null);
  neighb0.setNeighbor(bottom, startNode);
  const neighb1 = new TileNode(null);
  neighb1.setNeighbor(left, startNode);
  const neighb2 = new TileNode(null);
  neighb2.setNeighbor(top, startNode);
  const neighb3 = new TileNode(null);
  neighb3.setNeighbor(right, startNode);
  const unfilled = {
    [[0, 1]]: neighb0,
    [[1, 0]]: neighb1,
    [[0, -1]]: neighb2,
    [[-1, 0]]: neighb3
  }
  return {startNode, unfilled}
}

const initScores = (players) => {
  const scores = {};
  players.forEach(player => {scores[player.name] = 0});
  return scores
}

const rotateTileCopy = (tile) => {
  const newTile = Object.assign(Object.create(Object.getPrototypeOf(tile)), tile);
  newTile.rotate();
  return newTile;
}

const updateNeighbors = (xVal, yVal, tileNode, board, update) => {
  tileNode.resetNeighbors();
  const possibleDirs = getNeighbors(xVal, yVal)
  for (let i = 0; i < possibleDirs.length; i++) {
    if (board.hasOwnProperty(possibleDirs[i])) {
      tileNode.setNeighbor(i, board[possibleDirs[i]]);
      if (update) {
        board[possibleDirs[i]].setNeighbor(tileNode.findOppEdge(i), tileNode);
      }
    }
  }
};

const createNewUnfilled = (curUnfilled, x, y, board) => {
  const newUnfilledObj = { ...curUnfilled };
  delete newUnfilledObj[`${x},${y}`];
  const dirs = getNeighbors(x, y)
  for (let i = 0; i < dirs.length; i++) {
    if (!board.hasOwnProperty(dirs[i])) {
      const newTileNode = new TileNode(null);
      updateNeighbors(parseInt(dirs[i].split(',')[0], 10), parseInt(dirs[i].split(',')[1], 10), newTileNode, board);
      newUnfilledObj[dirs[i]] = newTileNode;
    }
  }
  return newUnfilledObj;
};

const updatePlayerMeepleCnt = (curPlayer, allPlayers, addVal, returnOriginal) => {
  if (returnOriginal) return allPlayers
  let allPlayersCopy = [...allPlayers];
  const idx = allPlayersCopy.findIndex(
    player => player.name === curPlayer.name
  );
  allPlayersCopy[idx].meeple += addVal;
  return allPlayersCopy;
};


const updateScores = (tileNodePlaced, curScores) => {
  let meeplesToRemove = [];
  tileNodePlaced.tile.regions.forEach(region => {
    if (region.type !== "monastery" && region.type !== "field") {
      const visitedTiles = new Set();
      const blocksToCheck = [];
      let regionClosed = true;
      let meeples = [];
      let numTilesInRegion = 1;
      if (region.meeple.length) {
        meeples.push(region.meeple[0]);
      }
      for (let i = 0; i < region.edges.length; i++) {
        let neighbor = tileNodePlaced.neighbors[region.edges[i]];
        if (neighbor) {
          let oppEdge = tileNodePlaced.findOppEdge(region.edges[i]);
          blocksToCheck.push({ tileNode: neighbor, edge: oppEdge });
        } else {
          regionClosed = false;
        }
      }
      while (blocksToCheck.length && regionClosed) {
        const block = blocksToCheck.shift();
        numTilesInRegion++;
        visitedTiles.add(block.tileNode);
        const curRegion = findRegion(block.tileNode.tile, block.edge);
        if (curRegion.meeple.length) {
          meeples.push(curRegion.meeple[0]);
        }
        // eslint-disable-next-line no-loop-func
        curRegion.edges.forEach(edge => {
          if (edge !== block.edge) {
            const neighbor = block.tileNode.neighbors[edge];
            if (!visitedTiles.has(neighbor)) {
              if (neighbor) {
                const oppEdge = block.tileNode.findOppEdge(edge);
                blocksToCheck.push({ tileNode: neighbor, edge: oppEdge });
              } else {
                regionClosed = false;
              }
            }
          }
        });
      }
      if (regionClosed) {
        const scoreVal = region.type === "city" ? 2 : 1;
        meeples.forEach(
          meeple =>
          (curScores[meeple.player.name] += scoreVal * numTilesInRegion)
          );
          meeplesToRemove = [...meeplesToRemove, ...meeples];
        }
      }
    });
    return { meeplesToRemove, curScores };
  };
  
  const nextTurnUpdates = (board, curLocation, curTile, curMeeple, scores, newPlayersState) => {
    updateNeighbors(curLocation[0], curLocation[1], curTile, board, true);
    const tilePlaced = Object.assign(Object.create(Object.getPrototypeOf(curTile)), curTile);
    if (curMeeple.coords) {
      tilePlaced.tile.regions[curMeeple.regionIdx].meeple.push(curMeeple);
    }
    board[`${curLocation[0]},${curLocation[1]}`] = tilePlaced;
    const { meeplesToRemove, curScores } = updateScores(tilePlaced, {...scores});
    meeplesToRemove.forEach(meeple => {
      let idx = newPlayersState.findIndex(player => player.name === meeple.player.name);
      newPlayersState[idx].meeple++;
    });
    return {board, meeplesToRemove, curScores, newPlayersState}
  }
  
  //reducer
// eslint-disable-next-line complexity
const reducer = (state = initialState, action) => {
  switch (action.type) {
    case SET_PLAYER:
      return { ...state, player: action.player };
    case CREATE_ROOM:
      return {...state, roomId: action.roomId, players: [action.player], player: action.player};
    case JOIN_ROOM:
      return { ...state, players: [...state.players, action.player] };
    case ROTATE_TILE:
      return { ...state, curTile: rotateTileCopy(state.curTile) };
    case SET_MEEPLE:
      return {...state, curMeeple: action.meeple, players: updatePlayerMeepleCnt(state.currentPlayer, state.players, -1, state.curMeeple.coords)};
    case GAME_OVER:
      return { ...state, gameState: 'gameOver' };
    case ADD_TO_BOARD:
      if (action.coords) updateNeighbors(action.coords[0], action.coords[1], state.curTile, state.board, false);
      return {
        ...state,
        curLocation: action.coords,
        curMeeple: {},
        players: updatePlayerMeepleCnt(state.currentPlayer, state.players, 1, !state.curMeeple.coords)
      };
    case NEXT_TURN:
      const {board, meeplesToRemove, curScores, newPlayersState} = nextTurnUpdates({...state.board}, state.curLocation, state.curTile, state.curMeeple, {...state.scores}, [...state.players]);
      return {
        ...state,
        currentPlayer: action.player,
        curTile: new TileNode(action.tile),
        unfilledTiles: createNewUnfilled(state.unfilledTiles, state.curLocation[0], state.curLocation[1], board),
        board: board,
        curLocation: null,
        curMeeple: {},
        removeMeeples: meeplesToRemove,
        scores: curScores,
        allPlayers: newPlayersState
      };
    case INIT_GAME:
      const {startNode, unfilled} = initStartNode(action.startTile)
      return {
        ...state,
        players: action.players,
        roomId: action.roomId,
        curTile: new TileNode(action.curTile),
        startTile: startNode,
        currentPlayer: action.currentPlayer,
        board: { [[0, 0]]: startNode },
        gameState: 'playing',
        unfilledTiles: unfilled,
        scores: initScores(action.players)
      };
    default:
      return state;
  }
};

export default createStore(
  reducer,
  applyMiddleware(thunkMiddleware.withExtraArgument({ axios }))
);
