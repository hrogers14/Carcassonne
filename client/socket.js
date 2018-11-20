import io from 'socket.io-client'
import store, { createRoom, joinRoom, initGame, nextTurn, addToBoard } from './store'

const socket = io(window.location.origin)

socket.on('connect', () => {
    console.log('I am connected')
})

socket.on('roomCreated', (roomId, player) => {
    store.dispatch(createRoom(roomId, player))
})

socket.on('playerJoined', (player) => {
    store.dispatch(joinRoom(player))
})

socket.on('initGame', (players, roomId, startTile, firstTile, firstPlayer) => {
    store.dispatch(initGame(players, roomId, startTile, firstTile, firstPlayer))
})

socket.on('newTile', (coords) => {
    store.dispatch(addToBoard(coords))
})

socket.on('newPlayer', (player, newTile) => {
    store.dispatch(nextTurn(player, newTile))
})

export default socket