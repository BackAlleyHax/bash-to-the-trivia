var express = require('express');
var bodyParser = require('body-parser');
var path = require('path');
var request = require('request');
var morgan = require('morgan');
// var jwt = require('jsonwebtoken');
var multer = require('multer');
var fs = require('fs');


var mongoose = require('mongoose');
var db = require('./db-config.js');
var User = require('./app/user-model.js');
var Room = require('./app/room-model.js');
var Question = require('./app/question-model.js');
var questionApi = 'https://www.opentdb.com/api.php?amount=10&difficulty=easy&type=multiple';

var app = express();
var PORT = process.env.PORT || 8080;

//Set up socket.io
var http = require('http').Server(app);
var io = require('socket.io')(http);

var uploading = multer({
  dest: '../uploads',
});

app.use(bodyParser.urlencoded({extended: true}));
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, '../client')));
app.use(morgan('dev'));


app.post('/api/profile/upload', uploading.single('avatar'), function(req, res, next) {
  console.log('req.body', req.body);
  console.log('req.file', req.file);
  var username = req.body.username;
  User.findOne({username: username}).exec(function(err, user) {
    if (err) {
      res.sendStatus(400);
    } else {
      console.log('req.file.filename', req.file.filename );
      user.avatar = req.file.filename;
      console.log('user', user);
      user.save(function(err, user) {
        if (err) {
          return res.status(400).send('Error on save');
        }
        console.log('save succesful', user.avatar);
        res.send(user.avatar);
      });
    }
  });
});

app.get('/api/uploads/:avatar', function(req, res) {
  var avatar = req.params.avatar;
  console.log('avatar', avatar);

  console.log('path', path.join(__dirname, '../uploads/' + avatar ));
  fs.readFile(path.join(__dirname, '../uploads/' + avatar ), function(err, content) {
    if (err) {
      res.sendStatus(500).end();
    } else {
      res.header('Content-Type', 'image/jpeg').end(content, 'utf-8');
    }
  });
});


var usersX = [];
var roomsX = {
  'Profile': [],
  'Lobby': []
};
var readyX = {
  'Profile': [],
  'Lobby': []
}

  var debouncedStartGame = debounce(function(io, socket, allQuestions){
    console.log('sendQuestions emitted')
    io.sockets.in(socket.roomname).emit('SendQuestions', allQuestions);
  }, 3000);
//SOCKET.IO MANAGEMENT//

// SEVDA VERSION //
io.on('connection', function(socket) {


  socket.on('signUp', function(user) {
    socket.username = user.username;
    socket.roomname = 'Profile';
    socket.join('Profile');
    roomsX[socket.roomname].push(socket.username);
    console.log(socket.username + ' connected to ' + socket.roomname);
  });

  socket.on('disconnect', function() {
    if (socket.roomname !== 'Profile') {
      socket.broadcast.to(socket.roomname).emit('UserLeft', socket.username);
    }
    console.log('Rooms: ', roomsX);
    console.log('socket.roomname: ', socket.roomname);
    if (socket.roomname !== undefined) {
      var index = roomsX[socket.roomname].indexOf(socket.username);
      roomsX[socket.roomname].splice(index, 1);
    }
    socket.leave(socket.roomname);
  });


  socket.on('signIn', function(user) {
    socket.username = user.username;
    socket.avatar = user.avatar;
    socket.roomname = 'Profile';
    socket.join('Profile');
    roomsX[socket.roomname].push(socket.username);
    console.log(socket.username + ' connected to ' + socket.roomname);
  });

  socket.on('changeRoom', function(newRoomObj) {
    var currentRoom = socket.roomname;
    var newRoom = newRoomObj.roomname;
    socket.broadcast.to(currentRoom).emit('UserLeft', socket.username);
    console.log('newRoomObj', newRoomObj);
    console.log('roomsX', roomsX);
    console.log('currentRoom', currentRoom);
    if (!roomsX[currentRoom]) {
      roomsX[currentRoom] = [];
    } else if (roomsX[currentRoom].indexOf(socket.username) !== -1) {
      var index = roomsX[currentRoom].indexOf(socket.username);
      roomsX[currentRoom].splice(index, 1);
    }
    socket.leave(currentRoom);
    socket.roomname = newRoom;
    if (roomsX[newRoom] === undefined) {
      roomsX[newRoom] = [socket.username];
    } else {
      roomsX[newRoom].push(socket.username);
    }
    socket.join(newRoom);
    console.log('new roomX: ', roomsX[newRoom])
    console.log('newroom: ', newRoom);
    console.log('socket.roomname: ', socket.roomname);

    io.sockets.in(newRoom).emit('UserJoined', socket.username, socket.avatar, roomsX[newRoom]);
  });

  socket.on('addNewRoom', function(newRoomName) {
    if (socket.roomname !== 'Profile') {
      socket.broadcast.to(socket.roomname).emit('UserLeft', socket.username);
    }
    console.log('addNewRoom newRoom: ', newRoomName);
    socket.leave(socket.roomname);
    socket.roomname = newRoomName;
    socket.join(socket.roomname);
    console.log('socket.roomname: ', socket.roomname);

    if (roomsX[newRoomName] === undefined) {
      roomsX[newRoomName] = [socket.username];
    } else {
      roomsX[newRoomName].push(socket.username);
    }
    console.log('new roomX: ', roomsX[newRoomName])


  });

  // function updateActiveUsers() {
  // 	socket.emit('updateView', {activeUsers: users});
  // }

  socket.on('addNewPlayer', function(room, newPlayerUsername) {
    io.sockets.emit('PlayerAdded', room, newPlayerUsername);
  });

  socket.on('startNewGame', function(allQuestions) {
    console.log('startNewGame called')
    debouncedStartGame(io, socket, allQuestions);
  });

  socket.on('updateScores', function(room) {
    console.log(room);
    io.sockets.in(room).emit('UpdateScores');
  });

  socket.on('playerReady', function(x, username){
    roomsX[socket.roomname]
    io.sockets.in(socket.roomname).emit('playerReady', username);
  });

  socket.on('correctAnswer', function(user, score) {
    io.sockets.in(socket.roomname).emit('correctAnswer', user, score);
  });

  socket.on('incorrectAnswer', function(username) {
    io.sockets.in(socket.roomname).emit('incorrectAnswer', socket.username);
  })

  socket.on('alertPowerUp', function(username) {
    io.sockets.in(socket.roomname).emit('alertPowerUp', socket.username);
    console.log("alert emit received on server side");
  })

  socket.on('blankPowerUp', function(username) {
    io.sockets.in(socket.roomname).emit('blankPowerUp', socket.username);
    console.log("blank emit received on server side");
  })

  socket.on('blackoutPowerUp', function(username) {
    io.sockets.in(socket.roomname).emit('blackoutPowerUp', socket.username);
    console.log("blackout emit received on server side");
  })

});




////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////

app.get('/api/users', function(req, res) {
  User.find({}, function(err, users) {
    var allUsers = {};
    users.forEach(function(user) {
      allUsers[user._id] = user;
    });
    res.json(allUsers);
  });
});

app.get('/api/rooms', function(req, res) {
  Room.find({}, function(err, rooms) {
    var allrooms = {};
    rooms.forEach(function(room) {
      allrooms[room._id] = room;
    });
    res.json(allrooms);
  });
});

// Gets user info for a specific room
app.get('/api/users/:username', function(req, res) {
	var username = req.params.username;
	User.findOne( {username: username}, function(err, user) {
		res.json({username: username, rooms: user.rooms, avatar: user.avatar})
	})
})

// Gets spcific room info in current user scope
app.get('/api/users/:username/:roomname', function(req, res) {
	var username = req.params.username;
	var roomname = req.params.roomname;
	Room.findOne({roomname: roomname}).exec(function(err, room) {
		res.send(objectifyResp(room, username))
	})
})

app.post('/api/users/addRoom', function(req, res) {
  var roomname = req.body.roomname;
  var admin = req.body.currentUser;
  User.findOne({username: admin})
  .then(function(user){
    if(!user) {
      return res.status(400).send('User does not exist');
    }
    Room.findOne({roomname: roomname})
    .then(function(room){
      if(room){
        return res.status(400).send('Room already exists');
      }
      var newRoom = Room({
        roomname: roomname,
        admin: admin,
        users: [{username: admin, avatar: user.avatar, score: 0}]
      });
      newRoom.save(function(err, room) {
        if(err) {
          return res.status(400).send('Error saving room');
        }
      });
      user.rooms.push(roomname);
      user.save()
      .then(function(savedUser) {
        if(!savedUser) {
          res.status(500).send('Error on saving user');
        }
        res.status(201).send(user);
      });
    });
  });
});

app.post('/api/users/addNewPlayer', function(req, res){
  var roomname = req.body.roomname;
  var newPlayerUsername = req.body.newPlayerUsername;
  User.findOne({username: newPlayerUsername})
  .then(function(user) {
    if (!user) {
      return res.status(400).send('User does not exist');
    }
    Room.findOne({roomname: roomname, 'users.username': newPlayerUsername})
    .then(function(roomWithUser){
      if (roomWithUser) { return res.status(400).send('User is already in room');}
      else {
        Room.findOne({roomname: roomname})
        .then(function(room){
          if (!room) {
            return res.status(400).send('Room does not exist');
          }
          var newPlayer = {
            username: newPlayerUsername,
            avatar: user.avatar,
            score: 0,
          };
          room.users.push(newPlayer);
          room.save(function(err){
            if(err) {
              return res.status(400).send('Cannot save room updates');
            }
            user.rooms.push(roomname);
            user.save(function(err) {
              if(err) {
                return res.status(400).send('Cannot save user updates');
              }
              res.status(201).send(user);
            });
          });
        });
      }
    });
  });
});

app.post('/api/updateScores', function(req, res) {
  var username = req.body.username;
  var score = req.body.score;
  var roomname = req.body.roomname;
  User.findOne({username: username}).exec(function(err, user) {
    if (err) {
      return res.status(400).send('User doesn\'t exist');
    } else {
      user.score += score;
      user.save(function(err) {
        if (err) {
          res.status(400).send('Cannot save user score in db');
        } else {
          Room.findOne({roomname: roomname}).where('users.username', username).exec(function(err, room) {
            if (err) {
              return res.status(400).send('Room not found');
            } else {
              //It it necessary to update the entire array and not just the user data, mongoose doesn't save when updating by index - other option may be to create a Schema for each user in the users array - ref backlog
              var usersArray = [];
              for (var i = 0; i < room.users.length; i++) {
                if (room.users[i].username === username) {
                  var newUser = {
                    username: username,
                    avatar: room.users[i].avatar,
                    score: room.users[i].score + score
                  };
                  usersArray.push(newUser);
                } else {
                  usersArray.push(room.users[i]);
                }
              }
              room.users = usersArray;
              room.save(function(err) {
                if (err) {
                  return res.status(400).send('Cannot update score in DB');
                } else {
                  return res.send('Score saved in DB');
                }
              });
            }
          });
        }
      });
    }
  });
});

app.get('/api/getScores/:roomname', function(req, res) {
  var roomname = req.params.roomname;
  Room.findOne({roomname: roomname}).exec(function(err, room) {
    if (err) {
      return res.status(400).send('Room not found');
    } else {
      var resp = {};
      resp.roomname = room.roomname;
      resp.users = room.users;
      resp.admin = room.admin;
      return res.send(resp);
    }
  });
});

app.post('/api/signup', function(req, res) {
	var username = req.body.username;
	var password = req.body.password;
	User.findOne({username: username}).exec(function(err, user) {
		if(err) {
			res.send(err);
		} else if(user) {
			res.send();
		} else {
			var promise = new Promise(function(resolve, reject) {
				var newUser = new User({
					username: username,
					password: password,
          score: 0
				})
				newUser.save(function(err, user) {
					console.log("ON SAVE", err, user)
					if(err) {
						reject(err);
					} else {
						resolve(user);
					}
				})
			})
			promise.then(function(user) {
				Room.findOne({roomname: "Lobby"}, function(err, room) {
					if(err) return res.sendStatus(500);
          var newUser = {
            username: user.username,
            avatar: user.avatar,
            score: 0
          };
          var avatar = user.avatar;
          var score = user.score;
					room.users.push(newUser);
					room.save(function(err) {
						if(err) return res.send(err);
            // var token = jwt.sign(user, 'bashtothetrivia');
						var rooms = {};
						var user = {};
						var resp = {};
						rooms[room.roomname] = {
							roomname: room.roomname,
							users: room.users,
							admin: room.admin
						};
            console.log('userrrr: ', user);
						user.username = username;
            user.avatar = avatar;
            user.score = score;
						resp.user = user;
						resp.rooms = rooms;
            // resp.token = token;
            console.log('RESPPP', resp);
						res.json(resp);
					})
				})
			})
		}
	})
})

app.post('/api/signin', function(req, res) {
	var username = req.body.username;
	var password = req.body.password;
	User.findOne({username: username}).exec(function(err, user) {
		if(err || !user) {
			return res.send(new Error('login error'));
		} else {
			user.auth(password, user.password).then(function(match) {
        var avatar = user.avatar;
        var score = user.score;
				if(match) {
					Room.find({'users.username': username}, function(err, foundRooms) {
						if(err) return res.sendStatus(500);
						// console.log('ROOMS/ERR', foundRooms.length)
						var rooms = {};
						var resp = {};
						var user = {};
						for(var i = 0; i < foundRooms.length; i++) {
							rooms[foundRooms[i].roomname] = {
								roomname: foundRooms[i].roomname,
								users: foundRooms[i].users,
								admin: foundRooms[i].admin
							};
						}
						user.username = username;
            user.avatar = avatar;
            user.score = score;
						resp.user = user;
						resp.rooms = rooms;
						console.log(resp);
						return res.json(resp);
					});
				} else {
					console.log('NO MATCH');
					res.status(401).end();
				}
			})
		}
	})
})







app.get('/api/questions', function(req, res) {
  var promise = new Promise(function(resolve, reject) {
    request.get(questionApi, function (error, response, body) {
      if (error && !response.statusCode == 200) {
        console.log("Error at api/questions!!!");
        reject(err);
      } else {
        resolve(body);
      }
    });
  })
  promise.then(function(body) {
    var temp0 = JSON.parse(body).results;

    // this function deals with the special characters sent from the Trivia API
    function translate(src){
      var questions = [];
      for (var i = 0; i < src.length;i++) {
        var result = {};
        var q = src[i].question;
        //two most commonly seen one, see if you can combine them into 1 line of code
        var question = q.replace(/&quot;/gi, '\'').replace(/&#039;/gi,'\'');
        //less comon
        // var question= q2.replace(/&eacute;/gi,'e');
        result['question'] = question;

        var ca = src[i].correct_answer;
        var correct_answer = ca.replace(/&quot;/gi, '\'').replace(/&#039;/gi,'\'');
        result['correct_answer'] = correct_answer;

        var ia = src[i].incorrect_answers;
        var incorrect_answers = [];
        for (j = 0; j<ia.length; j++) {
          incorrect_answers.push(ia[j].replace(/&quot;/gi, '\'').replace(/&#039;/gi,'\''));
        };
        result['incorrect_answers'] = incorrect_answers;
        questions[i] = result;
        };
      return questions;
    }
    var temp = translate(temp0);
    res.json(temp);
    for(var i = 0; i < 10; i++) {
      var qt = new Question({
        question: temp[i].question,
        correctAnswer: temp[i].correct_answer,
        incorrectAnswer: temp[i].incorrect_answers,
      });
      qt.save();
    }
  }).catch(function(err) {
      res.status(404).json(err)
    })
})


app.get('/api/questionsdb', function(req, res) {
  Question.find({}, function(err, questions) {
    var allquestions = {};
    questions.forEach(function(question) {
    	console.log('ID', question._id)
      allquestions[question._id] = question;
    });
    res.json(allquestions);
  });
});


// HELPER FUNCTIONS
// function objectifyResp(selected, username) {
// 	var currentRoom = {}
// 	currentRoom[selected.roomname] = {
// 		roomname: selected.roomname,
// 		users: selected.users,
// 		admin: selected.admin
// 	};
// 	var currentUser = {};
// 	currentUser = {
// 		username: username,
// 		rooms:
// 	}

// 	return {
// 		currentUser: currentUser,
// 		currentRoom: currentRoom
// 	}
// }

function parser (string) {
	return string[0].toUpperCase() + string.slice(1).toLowerCase();
};



http.listen(PORT, function() {
  console.log('Listening to port ', PORT);
});



function debounce(func, wait, immediate) {
    var timeout;
    return function() {
        var context = this, args = arguments;
        var later = function() {
            timeout = null;
            if (!immediate) func.apply(context, args);
        };
        var callNow = immediate && !timeout;
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
        if (callNow) func.apply(context, args);
    };
};
