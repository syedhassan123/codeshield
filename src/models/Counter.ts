import mongoose, { Schema, type Model } from "mongoose";

const CounterSchema = new Schema({
  key: { type: String, required: true, unique: true },
  seq: { type: Number, required: true, default: 0 },
});

export type CounterDocument = {
  _id: mongoose.Types.ObjectId;
  key: string;
  seq: number;
};

export const Counter: Model<CounterDocument> =
  mongoose.models.Counter ||
  mongoose.model<CounterDocument>("Counter", CounterSchema);

export async function nextSequence(key: string, startAt = 1000) {
  const doc = await Counter.findOneAndUpdate(
    { key },
    { $inc: { seq: 1 } },
    { returnDocument: "after", upsert: true, setDefaultsOnInsert: true },
  );

  if (doc.seq < startAt) {
    doc.seq = startAt;
    await doc.save();
  }

  return doc.seq;
}
