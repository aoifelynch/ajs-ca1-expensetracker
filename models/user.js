import mongoose from "mongoose";
import bcrypt from "bcrypt";

const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
    },
    name: {
      type: String,
      required: true,
    },
    passwordHash: {
      type: String,
      required: true,
    },
    role: {
      type: String,
      enum: ['user', 'admin'],
      default: 'user',
  },
  },
  { timestamps: true }
);

userSchema.set("toJSON", {
  transform: (_document, returnedObject) => {
    returnedObject.id = returnedObject._id.toString();
    delete returnedObject._id;
    delete returnedObject.__v;
    delete returnedObject.passwordHash;
    delete returnedObject.createdAt;
    delete returnedObject.updatedAt;
  },
});

userSchema.statics.hashPassword = async function (password) {
  const saltRounds = 10;
  return await bcrypt.hash(password, saltRounds);
};

userSchema.methods.verifyPassword = async function (password) {
  if (!password) {
    return false;
  }
  return await bcrypt.compare(password, this.passwordHash);
};

const User = mongoose.model("User", userSchema);

export default User;