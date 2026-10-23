import { Schema, model, type Types } from "mongoose";

export interface BookmarkDoc {
  _id: Types.ObjectId;
  user: Types.ObjectId;
  translationGroup: Types.ObjectId;
  createdAt: Date;
}

const bookmarkSchema = new Schema<BookmarkDoc>(
  {
    user: { type: Schema.Types.ObjectId, ref: "UserProfile", required: true },
    translationGroup: { type: Schema.Types.ObjectId, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);
bookmarkSchema.index({ user: 1, translationGroup: 1 }, { unique: true });
bookmarkSchema.index({ user: 1, createdAt: -1 });

export const Bookmark = model<BookmarkDoc>("Bookmark", bookmarkSchema);
