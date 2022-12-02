const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const UserSchema = new Schema({
  useremail: {
    type: String,
  },
  username: {
    type: String,
  },
  refreshToken: {
    type: String,
  },
  clientId: {
    type: String,
  },
  accessToken: {
    type: String,
  },
  clientSecret: {
    type: String,
  }
});

module.exports = User = mongoose.model("user", UserSchema);
