const mongoose = require("mongoose");
// const config = require("config");
// const db = config.get("mongoURI");
const db = "mongodb+srv://Ryuusei:<Paxxw0rd>@cluster0.d8siq79.mongodb.net/?retryWrites=true&w=majority"

// Connection to MongoDB
const connectDB = async () => {
  try {
    await mongoose.connect(db, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      // useCreateIndex: true,
      // useFindAndModify: false,
    });
    console.log("MongoDB Connected...");
  } catch (err) {
    console.error(err.message);
    // Exit process with failure
    process.exit(1);
  }
};

module.exports = connectDB;
