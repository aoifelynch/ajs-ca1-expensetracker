import mongoose from "mongoose";

const categorySchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    createdAt: { type: Date, default: Date.now  },
  },
  { timestamps: true }
);

categorySchema.set("toJSON", {
  transform: (_document, returnedObject) => {
    returnedObject.id = returnedObject._id.toString();
    delete returnedObject._id;
    delete returnedObject.__v;
    delete returnedObject.createdAt;
    delete returnedObject.updatedAt;
    delete returnedObject.userId;
  },
});

categorySchema.index({ name: 1, user: 1 }, { unique: true });

const Category = mongoose.model('Category', categorySchema);

export default Category;
