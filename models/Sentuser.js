const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const UserSchema = new Schema({
  useremail: {
    type: String,
  },
  accessToken : {
    type: String,
  }
});

module.exports = User = mongoose.model("sentuser", UserSchema);
