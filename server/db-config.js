var mongoose = require('mongoose');

var currentDB = process.env.MONGODB_URI || 'mongodb://localhost/users';

// 'mongodb://heroku_1sdtg5p6:f79acqoi6othgbc3sk0qbponk8@ds133358.mlab.com:33358/heroku_1sdtg5p6'

//set the connect URL to currentDB;
mongoose.connect(currentDB);
var db = mongoose.connection;
db.on('error', console.error.bind(console, 'connection error:'));
db.once('open', function() {
	// *** uncomment line below to reset db
	//db.dropDatabase();
  console.log('db connected with mongoose');
});

