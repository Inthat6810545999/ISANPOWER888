import { Schema, model, type InferSchemaType } from "mongoose";

export const REQUEST_TYPES = [
  "equipment",
  "space",
  "consumable",
  "access",
  "visitor",
  "general",
] as const;

export const REQUEST_STATUSES = [
  "submitted",
  "under_review",
  "approved",
  "rejected",
  "cancelled",
] as const;

const labRequestSchema = new Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, default: "", trim: true, maxlength: 5000 },
    type: { type: String, required: true, enum: REQUEST_TYPES },
    status: { type: String, required: true, enum: REQUEST_STATUSES, default: "submitted" },
    requesterEmail: { type: String, required: true, trim: true, lowercase: true },
    neededBy: { type: Date },
  },
  { timestamps: true },
);

export type LabRequestDocument = InferSchemaType<typeof labRequestSchema>;

export const LabRequest = model("LabRequest", labRequestSchema);
