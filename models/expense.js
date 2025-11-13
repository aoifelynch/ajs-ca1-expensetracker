import mongoose from "mongoose";

const expenseSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true },
  amount: { type: Number, required: true, min: 0 },
  currency: { type: String, default: 'EURO' },
  date: { type: Date, default: Date.now },
  note: { type: String, trim: true },
  description: { type: String, trim: true }, 
  createdAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

expenseSchema.set("toJSON", {
  transform: (_document, returnedObject) => {
    returnedObject.id = returnedObject._id.toString();
    delete returnedObject._id;
    delete returnedObject.__v;
    delete returnedObject.createdAt;
    delete returnedObject.updatedAt;
    delete returnedObject.userId;
  },
});

const Expense = mongoose.model("Expense", expenseSchema);

export default Expense;
