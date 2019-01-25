function makeid() {
  const animalNames = ['gorilla', 'tiger', 'monkey', 'elephant', 'leopard']
  const possibleNums = '0123456789';
  
  let text = animalNames[Math.floor(Math.random()*animalNames.length)];
  for (var i = 0; i < 5; i++) {
    text += possibleNums.charAt(Math.floor(Math.random() * possibleNums.length));
  }

  return text;
}

function playerLeftWhilePlaying(rooms, roomId, player, broadcastToAll, socket) {
  rooms[roomId].disconnected.push(player)
  if (rooms[roomId].disconnected.length === rooms[roomId].players.length) {
    delete rooms[roomId]
  } else {
    if (player.host) {
      player.setHost(false)
      let newHost = rooms[roomId].players[Math.floor(Math.random() * rooms[roomId].players.length)]
      while (rooms[roomId].disconnected.find(player => player.name === newHost.name)) {
        newHost = rooms[roomId].players[Math.floor(Math.random() * rooms[roomId].players.length)]
      }
      newHost.setHost(true)
      broadcastToAll(socket, roomId, 'newHost', rooms[roomId].players)
    }
    socket.broadcast.to(roomId).emit('disconnectedPlayer', player.name)
  }
}

function playerLeftRoom(rooms, roomId, socketId, player, broadcastToAll, socket) {
  setTimeout(() => {
    player = rooms[roomId].players.find(curPlayer => curPlayer.name === player.name)
    if (player.socketId === socketId) {
      if (rooms[roomId].gameState === 'playing') {
        playerLeftWhilePlaying(rooms, roomId, player, broadcastToAll, socket);
      } else if (player.host) {
        socket.broadcast.to(roomId).emit('hostLeft')
        delete rooms[roomId]
      } else {
        rooms[roomId].players = rooms[roomId].players.filter(curPlayer => player.name !== curPlayer.name)
        if (player.animal !== '' && !rooms[roomId].meeple.includes(player.animal)) {
          rooms[roomId].meeple.push(player.animal)
        }
        socket.broadcast.to(roomId).emit('playerLeft', rooms[roomId].meeple, rooms[roomId].players)
      }
    }
  }, 5000)
}

module.exports = {makeid, playerLeftRoom}
